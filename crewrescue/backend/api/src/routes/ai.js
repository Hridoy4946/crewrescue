// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — RAG Copilot API Routes
//
// POST /api/ai/copilot              - Field technician / dispatcher copilot query
// GET  /api/ai/knowledge            - List knowledge base documents
// POST /api/ai/knowledge            - Add a new knowledge document
// DELETE /api/ai/knowledge/:id      - Remove a document
// POST /api/ai/triage               - AI incident triage (unchanged)
// POST /api/ai/dispatcher-query     - Dispatcher natural language assistant (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../config/logger.js';
import KnowledgeDoc from '../models/KnowledgeDoc.js';

const router = express.Router();
router.use(authenticate);

// ── Keyword-based fallback classifier (no LLM needed) ─────────────────────────
function keywordClassify(text) {
  const t = text.toLowerCase();
  let category = 'EQUIPMENT_BREAKDOWN';
  let severity = 'MEDIUM';
  const requiredSkills = [];
  const recommendedParts = [];

  if (t.includes('power') || t.includes('outage') || t.includes('electric') || t.includes('voltage')) {
    category = 'POWER_OUTAGE'; requiredSkills.push('ELECTRICAL', 'HIGH_VOLTAGE');
  } else if (t.includes('hvac') || t.includes('cooling') || t.includes('ac ') || t.includes('temperature')) {
    category = 'HVAC_FAILURE'; requiredSkills.push('HVAC', 'ELECTRICAL');
    recommendedParts.push('compressor', 'control_board');
  } else if (t.includes('fiber') || t.includes('cable') || t.includes('network') || t.includes('internet')) {
    category = 'NETWORK_FAILURE'; requiredSkills.push('FIBER_OPTIC', 'NETWORKING');
    recommendedParts.push('fiber_cable', 'splice_kit');
  } else if (t.includes('transformer')) {
    category = 'TRANSFORMER_FAULT'; requiredSkills.push('ELECTRICAL', 'TRANSFORMER', 'HIGH_VOLTAGE');
    recommendedParts.push('transformer_relay', 'insulating_oil');
  } else if (t.includes('generator')) {
    category = 'EQUIPMENT_BREAKDOWN'; requiredSkills.push('GENERATOR', 'ELECTRICAL');
    recommendedParts.push('fuel_filter', 'voltage_regulator');
  } else if (t.includes('water') || t.includes('pump') || t.includes('leak')) {
    category = 'WATER_LEAK'; requiredSkills.push('WATER_SYSTEMS', 'MECHANICAL');
    recommendedParts.push('pump_seal', 'pipe_fitting');
  } else if (t.includes('flood') || t.includes('storm') || t.includes('damage')) {
    category = 'STORM_DAMAGE'; requiredSkills.push('ELECTRICAL', 'MECHANICAL');
  }

  if (t.includes('critical') || t.includes('server room') || t.includes('hospital') ||
      t.includes('datacenter') || t.includes('entire building') || t.includes('complete loss') || t.includes('fire')) {
    severity = 'CRITICAL';
  } else if (t.includes('urgent') || t.includes('emergency') || t.includes('immediately') || t.includes('major')) {
    severity = 'HIGH';
  } else if (t.includes('minor') || t.includes('partial') || t.includes('intermittent')) {
    severity = 'LOW';
  }

  return {
    category,
    severity,
    required_skills:    [...new Set(requiredSkills)],
    recommended_parts:  recommendedParts,
    sla_urgency:        severity === 'CRITICAL' ? 'IMMEDIATE' : severity === 'HIGH' ? 'URGENT' : 'STANDARD',
    summary:            `Classified as ${category} (${severity}) based on keyword analysis.`,
    method:             'keyword_fallback',
  };
}

// ── Cosine similarity between two embedding vectors ───────────────────────────
function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// ── Keyword-based document retrieval (fallback) ────────────────────────────────
function keywordSearch(docs, query, topK = 5) {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  return docs
    .map((doc) => {
      const text  = `${doc.title} ${doc.content} ${doc.keywords?.join(' ')}`.toLowerCase();
      const score = queryWords.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ doc }) => doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/triage — Incident triage
// ─────────────────────────────────────────────────────────────────────────────
router.post('/triage', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Incident description too short' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        });

        const prompt = `You are an emergency field-service incident classifier for a utility company.
Analyze the following incident description and return a JSON object with this exact schema:
{
  "category": one of [POWER_OUTAGE, HVAC_FAILURE, NETWORK_FAILURE, EQUIPMENT_BREAKDOWN, WATER_LEAK, TRANSFORMER_FAULT, GENERATOR_FAILURE, FIBER_CUT, SAFETY_HAZARD, FLOOD_DAMAGE, STORM_DAMAGE, SCHEDULED_MAINTENANCE, CUSTOMER_COMPLAINT],
  "severity": one of [CRITICAL, HIGH, MEDIUM, LOW],
  "required_skills": array of skill IDs from [ELECTRICAL, HVAC, FIBER_OPTIC, NETWORKING, HIGH_VOLTAGE, GENERATOR, HYDRAULICS, MECHANICAL, WELDING, PLC, SOLAR, TRANSFORMER, TELECOM, WATER_SYSTEMS, SAFETY_OFFICER],
  "recommended_parts": array of part name strings (max 5),
  "sla_urgency": one of [IMMEDIATE, URGENT, STANDARD, ROUTINE],
  "summary": one sentence plain-English summary of the incident,
  "method": "gemini"
}

Incident description: "${text.replace(/"/g, "'")}"`

        const result = await model.generateContent(prompt);
        const parsed = JSON.parse(result.response.text());
        return res.json({ success: true, classification: parsed });
      } catch (geminiErr) {
        logger.warn('Gemini triage failed, falling back to keyword classifier:', geminiErr.message);
      }
    }

    res.json({ success: true, classification: keywordClassify(text) });
  } catch (err) {
    logger.error('AI triage error:', err);
    res.status(500).json({ success: false, error: 'Triage failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/dispatcher-query — Natural language assistant
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dispatcher-query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Query required' });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'your_gemini_api_key_here') {
      return res.json({
        success: true,
        response: `[AI Stub] Query received: "${query}". Configure GEMINI_API_KEY in .env to enable real AI responses.`,
        method: 'stub',
      });
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an AI assistant for emergency field-service dispatchers at a utility company.
Answer the following dispatcher query concisely and practically. Limit to 3-4 sentences.

Query: "${query}"`;

    const result = await model.generateContent(prompt);
    res.json({ success: true, response: result.response.text(), method: 'gemini' });
  } catch (err) {
    logger.error('Dispatcher query error:', err);
    res.status(500).json({ success: false, error: 'AI query failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/copilot — RAG-powered technician / dispatcher copilot
//
// Flow:
//   1. Embed the user query (Gemini text-embedding-004, or skip if no key)
//   2. Retrieve top-K relevant knowledge docs (cosine similarity or keyword fallback)
//   3. Build a grounded prompt with retrieved context
//   4. Generate a response with Gemini 1.5 Flash
// ─────────────────────────────────────────────────────────────────────────────
router.post('/copilot', async (req, res) => {
  try {
    const { query, category } = req.body;
    if (!query || query.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'Query too short' });
    }

    // ── 1. Retrieve candidate knowledge docs ────────────────────────────────
    const filter = { isActive: true };
    if (category) filter.category = category;

    // Fetch org-specific docs + global docs (no orgId)
    const allDocs = await KnowledgeDoc.find(filter).lean();

    const geminiKey = process.env.GEMINI_API_KEY;
    let retrievedDocs = [];

    if (geminiKey && geminiKey !== 'your_gemini_api_key_here' && allDocs.some((d) => d.embedding?.length)) {
      // ── Vector semantic search ─────────────────────────────────────────────
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI        = new GoogleGenerativeAI(geminiKey);
        const embedModel   = genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const embedResult  = await embedModel.embedContent(query);
        const queryVector  = embedResult.embedding.values;

        retrievedDocs = allDocs
          .filter((d) => d.embedding?.length)
          .map((d) => ({ doc: d, score: cosineSimilarity(queryVector, d.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(({ doc }) => doc);

        // If vector search returned nothing, fall back to keyword
        if (retrievedDocs.length === 0) {
          retrievedDocs = keywordSearch(allDocs, query, 5);
        }
      } catch {
        retrievedDocs = keywordSearch(allDocs, query, 5);
      }
    } else {
      // ── Keyword fallback retrieval ────────────────────────────────────────
      retrievedDocs = keywordSearch(allDocs, query, 5);
    }

    // ── 2. Build grounded context ──────────────────────────────────────────
    const contextBlocks = retrievedDocs.map((d, i) =>
      `[${i + 1}] ${d.title} (${d.source ?? d.category}) ${d.pageRef ? `— ${d.pageRef}` : ''}\n${d.content}`
    ).join('\n\n');

    const hasContext = retrievedDocs.length > 0;

    // ── 3. Generate response with Gemini ───────────────────────────────────
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const systemPrompt = `You are CrewRescue Copilot — an expert AI assistant for field service technicians and emergency dispatchers in the utility and critical infrastructure sector.
You provide precise, actionable troubleshooting guidance based on equipment manuals and operational knowledge.
Always be concise (max 5 sentences). If the provided context contains the answer, cite the source. If not, give your best expert answer.
${hasContext ? `\n== KNOWLEDGE BASE CONTEXT ==\n${contextBlocks}\n== END CONTEXT ==` : ''}

Query: "${query}"`;

        const result = await model.generateContent(systemPrompt);
        return res.json({
          success: true,
          response: result.response.text(),
          sources:  retrievedDocs.map((d) => ({ title: d.title, source: d.source, category: d.category, pageRef: d.pageRef })),
          method:   'gemini_rag',
        });
      } catch (geminiErr) {
        logger.warn('Gemini copilot failed:', geminiErr.message);
      }
    }

    // ── Stub response when no API key ──────────────────────────────────────
    res.json({
      success:  true,
      response: hasContext
        ? `Based on the knowledge base: ${retrievedDocs[0]?.content?.slice(0, 300)}...`
        : `[Copilot Stub] Configure GEMINI_API_KEY for full AI responses. Query: "${query}"`,
      sources: retrievedDocs.map((d) => ({ title: d.title, source: d.source, category: d.category })),
      method:  'keyword_stub',
    });
  } catch (err) {
    logger.error('Copilot error:', err);
    res.status(500).json({ success: false, error: 'Copilot query failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai/knowledge — List knowledge base documents
// ─────────────────────────────────────────────────────────────────────────────
router.get('/knowledge', async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;

    let docs = await KnowledgeDoc.find(filter)
      .select('-embedding -content')
      .sort({ category: 1, title: 1 })
      .lean();

    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter((d) =>
        d.title.toLowerCase().includes(s) ||
        d.source?.toLowerCase().includes(s) ||
        d.keywords?.some((k) => k.toLowerCase().includes(s))
      );
    }

    res.json({ success: true, docs, count: docs.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/knowledge — Add a knowledge document
// ─────────────────────────────────────────────────────────────────────────────
router.post('/knowledge', async (req, res) => {
  try {
    const { title, source, category, content, pageRef, keywords } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ success: false, error: 'title, category, and content are required' });
    }

    // Try to generate embedding
    let embedding;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI       = new GoogleGenerativeAI(geminiKey);
        const embedModel  = genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const embedResult = await embedModel.embedContent(`${title}\n${content}`);
        embedding         = embedResult.embedding.values;
      } catch (e) {
        logger.warn('Embedding generation failed:', e.message);
      }
    }

    const doc = await KnowledgeDoc.create({
      organizationId: req.organizationId,
      title,
      source,
      category,
      content,
      pageRef,
      keywords: keywords ?? [],
      embedding,
    });

    res.status(201).json({ success: true, doc: { _id: doc._id, title, category, source } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/ai/knowledge/:id — Remove a knowledge document
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/knowledge/:id', async (req, res) => {
  try {
    await KnowledgeDoc.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

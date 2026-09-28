// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — RAG Copilot API Routes
//
// POST /api/ai/chat                 - Full conversational AI assistant (multi-turn)
// POST /api/ai/copilot              - Field technician / dispatcher copilot query
// GET  /api/ai/knowledge            - List knowledge base documents
// POST /api/ai/knowledge            - Add a new knowledge document
// DELETE /api/ai/knowledge/:id      - Remove a document
// POST /api/ai/triage               - AI incident triage
// POST /api/ai/dispatcher-query     - Dispatcher natural language assistant
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../config/logger.js';
import KnowledgeDoc from '../models/KnowledgeDoc.js';
import Technician from '../models/Technician.js';
import WorkOrder from '../models/WorkOrder.js';
import Emergency from '../models/Emergency.js';

const router = express.Router();
router.use(authenticate);

// ── Active Gemini model (detected from API key capabilities) ──────────────────
const GEMINI_MODEL       = 'gemini-flash-latest';
const GEMINI_EMBED_MODEL = 'gemini-embedding-001';

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
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
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
          model: GEMINI_MODEL,
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
    if (!query || !query.trim()) return res.status(400).json({ success: false, error: 'Query required' });

    const qLower = query.toLowerCase();
    const orgId = req.organizationId;

    // Fetch live operational context from DB
    const [openWOCount, criticalWOCount, activeEmergency, totalTechs, availableTechs] = await Promise.all([
      WorkOrder.countDocuments({ organizationId: orgId, status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, severity: 'CRITICAL', status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      Emergency.findOne({ organizationId: orgId, isActive: true }).sort({ createdAt: -1 }).lean(),
      Technician.countDocuments({ organizationId: orgId, isActive: true }),
      Technician.countDocuments({ organizationId: orgId, isActive: true, status: 'AVAILABLE' }),
    ]);

    // Check if query is asking for technicians
    const territories = ['Gulshan', 'Uttara', 'Dhanmondi', 'Mirpur', 'Tejgaon', 'Motijheel', 'Wari', 'Mohammadpur', 'Banani', 'Badda', 'Khilgaon'];
    const matchedTerritory = territories.find(t => qLower.includes(t.toLowerCase()));

    // Skill detection mapping
    const skillKeywords = {
      FIBER_OPTIC: ['fiber', 'optical', 'splice', 'otdr'],
      ELECTRICAL: ['electric', 'wiring', 'breaker', 'short circuit'],
      HIGH_VOLTAGE: ['high voltage', '11kv', '33kv', 'substation', 'switchgear', 'loto'],
      TRANSFORMER: ['transformer', 'dga', 'bushing', 'tap changer', 'oil'],
      GENERATOR: ['generator', 'diesel', 'genset', 'avr', 'alternator'],
      HVAC: ['hvac', 'chiller', 'cooling', 'compressor', 'refrigerant', 'ac '],
      WATER_SYSTEMS: ['water', 'pump', 'pipe', 'plumbing', 'valve'],
      NETWORKING: ['network', 'switch', 'router', 'ethernet', 'lan'],
      SAFETY_OFFICER: ['safety', 'arc flash', 'ppe', 'confined space', 'shock', 'hazard'],
    };

    let matchedSkill = null;
    for (const [skill, kws] of Object.entries(skillKeywords)) {
      if (kws.some(kw => qLower.includes(kw))) {
        matchedSkill = skill;
        break;
      }
    }

    // Try Gemini if key is provided and valid
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        const prompt = `You are CrewRescue Dispatcher Copilot — an expert operations assistant for utility dispatchers.
Live system operational metrics:
- Active Unresolved Tickets: ${openWOCount} (${criticalWOCount} CRITICAL)
- Active Emergency: ${activeEmergency ? `${activeEmergency.level} - ${activeEmergency.title}` : 'None (Normal L0 operations)'}
- Total Fleet Technicians: ${totalTechs} (${availableTechs} currently AVAILABLE)

Answer the dispatcher query concisely and practically in 3-4 sentences. Include actionable next steps.
Query: "${query}"`;

        const result = await model.generateContent(prompt);
        return res.json({ success: true, response: result.response.text(), method: 'gemini' });
      } catch (geminiErr) {
        logger.warn('Gemini dispatcher query error, using heuristic fallback:', geminiErr.message);
      }
    }

    // Heuristic intelligent operational response when Gemini is not configured or offline:
    let responseText = '';

    // 1. Technician query
    if (matchedSkill || matchedTerritory || qLower.includes('who') || qLower.includes('technician') || qLower.includes('tech') || qLower.includes('crew')) {
      const techFilter = { organizationId: orgId, isActive: true };
      if (matchedTerritory) techFilter.territory = new RegExp(`^${matchedTerritory}$`, 'i');
      if (matchedSkill) techFilter['skills.skillId'] = matchedSkill;

      let candidateTechs = await Technician.find(techFilter)
        .sort({ status: 1, 'performance.rating': -1 })
        .limit(4)
        .lean();

      // If strict filter yielded nothing, search territory without skill constraint
      if (candidateTechs.length === 0 && matchedTerritory) {
        candidateTechs = await Technician.find({ organizationId: orgId, isActive: true, territory: new RegExp(`^${matchedTerritory}$`, 'i') })
          .sort({ 'performance.rating': -1 })
          .limit(3)
          .lean();
      }

      if (candidateTechs.length > 0) {
        const skillLabel = matchedSkill ? matchedSkill.replace(/_/g, ' ') : 'General Maintenance';
        const territoryLabel = matchedTerritory ? `in ${matchedTerritory}` : 'across all territories';
        const techList = candidateTechs.map((t, idx) => {
          const skillsStr = t.skills?.map(s => s.skillId.replace(/_/g, ' ')).join(', ') || 'General';
          return `${idx + 1}. **${t.name}** (${t.status}, Rating: ${t.performance?.rating ?? 4.5}⭐, Phone: ${t.phone || 'N/A'})\n   • Territory: ${t.territory} | Skills: ${skillsStr}`;
        }).join('\n');

        responseText = `Recommended technicians for **${skillLabel}** ${territoryLabel}:\n\n${techList}\n\n💡 *Dispatch tip: Prioritize technicians in AVAILABLE status to prevent overtime penalty.*`;
      } else {
        responseText = `Currently no specialized technicians found for ${matchedSkill || 'this role'} in ${matchedTerritory || 'this territory'}. Total available technicians in fleet: ${availableTechs} of ${totalTechs}. Recommend re-routing from an adjacent district or triggering the Optimization Engine.`;
      }
    }
    // 2. Outage / Emergency / SLA query
    else if (qLower.includes('emergency') || qLower.includes('sla') || qLower.includes('status') || qLower.includes('critical') || qLower.includes('outage') || qLower.includes('how many')) {
      const approachingSLA = await WorkOrder.countDocuments({
        organizationId: orgId,
        status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] },
        'sla.resolutionDeadline': { $gte: new Date(), $lte: new Date(Date.now() + 60 * 60 * 1000) },
      });

      responseText = `📊 **Current Dispatch Telemetry Summary**:\n• Active Unresolved Incidents: **${openWOCount}**\n• Critical Incidents: **${criticalWOCount}**\n• Approaching SLA Breach (<60m): **${approachingSLA}**\n• Available Technicians: **${availableTechs}** / **${totalTechs}**\n• Disaster Status: **${activeEmergency ? `${activeEmergency.level} - ${activeEmergency.title}` : 'L0 (Normal Day-to-Day Mode)'}**\n\nRecommended Action: Navigate to the **Optimization** tab to execute Simulated Annealing or Genetic Algorithm scheduling to clear high-risk tickets.`;
    }
    // 3. Equipment / Knowledge manual query
    else {
      const matchedDocs = await KnowledgeDoc.find({ isActive: true }).lean();
      const relevant = keywordSearch(matchedDocs, query, 2);
      if (relevant.length > 0) {
        responseText = `📖 **Equipment Manual Procedure: ${relevant[0].title}**\n*Category: ${relevant[0].category} · Source: ${relevant[0].source || 'Standard Operating Procedure'}*\n\n${relevant[0].content.slice(0, 380)}...\n\n🔗 For complete technical documentation, open the **Copilot (RAG)** tab in the sidebar.`;
      } else {
        responseText = `CrewRescue Dispatch Assistant operational. Currently tracking **${openWOCount}** open tickets (${criticalWOCount} critical) and **${availableTechs}** available technicians. You can ask me:\n• "Who is best for fiber optic in Gulshan?"\n• "Show available technicians in Mirpur"\n• "Current SLA and emergency status"\n• "How to troubleshoot 11kV transformer fault"`;
      }
    }

    res.json({
      success: true,
      response: responseText,
      method: 'smart_ops_engine',
    });
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
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Please enter at least 2 characters for your query.' });
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
        const embedModel   = genAI.getGenerativeModel({ model: GEMINI_EMBED_MODEL });
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

    // If query words didn't match specific docs but category filter was selected, fall back to category docs
    if (retrievedDocs.length === 0 && allDocs.length > 0) {
      retrievedDocs = allDocs.slice(0, 5);
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
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

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
        const embedModel  = genAI.getGenerativeModel({ model: GEMINI_EMBED_MODEL });
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat — Full conversational AI assistant (multi-turn)
//
// Body: { message: string, history: [{role, parts:[{text}]}] }
// Injects live operational context (tickets, techs, emergencies) into every turn
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, error: 'Message required' });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'your_gemini_api_key_here') {
      return res.json({
        success: true,
        reply: 'AI Assistant requires a valid GEMINI_API_KEY to be configured in the server environment.',
        method: 'no_key',
      });
    }

    const orgId = req.organizationId;

    // Fetch rich live context from DB
    const [openWOCount, criticalWOCount, highWOCount, activeEmergency, totalTechs, availableTechs, onJobTechs, recentCritical] = await Promise.all([
      WorkOrder.countDocuments({ organizationId: orgId, status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, severity: 'CRITICAL', status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, severity: 'HIGH',     status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      Emergency.findOne({ organizationId: orgId, isActive: true }).sort({ createdAt: -1 }).lean(),
      Technician.countDocuments({ organizationId: orgId, isActive: true }),
      Technician.countDocuments({ organizationId: orgId, isActive: true, status: 'AVAILABLE' }),
      Technician.countDocuments({ organizationId: orgId, isActive: true, status: 'ON_JOB' }),
      WorkOrder.find({ organizationId: orgId, severity: 'CRITICAL', status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } })
        .sort({ createdAt: -1 }).limit(3).select('workOrderNumber title category location.area').lean(),
    ]);

    const approachingSLA = await WorkOrder.countDocuments({
      organizationId: orgId,
      status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] },
      'sla.resolutionDeadline': { $gte: new Date(), $lte: new Date(Date.now() + 2 * 60 * 60 * 1000) },
    });

    // Build system context prompt
    const systemInstruction = `You are CrewRescue AI — an intelligent operations assistant for utility field service dispatchers.
You have deep expertise in: emergency dispatch, technician scheduling, SLA management, power grid operations, HVAC, fiber/network infrastructure, and field safety protocols.

LIVE OPERATIONAL CONTEXT (as of this moment):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Ticket Status:
  • Total Active (unresolved): ${openWOCount} tickets
  • CRITICAL severity: ${criticalWOCount} tickets
  • HIGH severity: ${highWOCount} tickets
  • Approaching SLA breach (<2 hrs): ${approachingSLA} tickets

🚨 Emergency Mode: ${activeEmergency ? `ACTIVE — ${activeEmergency.level}: "${activeEmergency.title}"` : 'NONE — Normal L0 Operations'}

👷 Technician Fleet:
  • Total active technicians: ${totalTechs}
  • Currently AVAILABLE: ${availableTechs}
  • Currently ON_JOB: ${onJobTechs}
  • Utilization rate: ${totalTechs > 0 ? Math.round((onJobTechs / totalTechs) * 100) : 0}%

🔴 Most Critical Open Tickets:
${recentCritical.length > 0 ? recentCritical.map((t, i) => `  ${i + 1}. [${t.workOrderNumber}] ${t.title} — ${t.category} in ${t.location?.area || 'Unknown Area'}`).join('\n') : '  None currently'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEHAVIOR GUIDELINES:
- Be concise, direct, and actionable. Dispatchers need answers fast.
- When asked about technicians, provide names/skills if available from queries.
- Use markdown formatting (bold, bullet points) for readability.
- For technical questions (equipment, safety), provide step-by-step procedures.
- Always prioritize CRITICAL and SLA-breaching tickets in recommendations.
- If you don't know something specific, say so and provide the best available guidance.
- You CAN answer general operational, scheduling, and technical questions even without DB data.`;

    // Sanitize and format history strictly according to Gemini requirements:
    // 1. Valid roles are only 'user' and 'model' (map 'assistant' -> 'model')
    // 2. The first message in history MUST be with role 'user'
    // 3. Messages must alternate roles (user -> model -> user -> model)
    const cleanHistory = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (!h.text || typeof h.text !== 'string' || !h.text.trim()) continue;
        const role = (h.role === 'assistant' || h.role === 'model') ? 'model' : 'user';
        if (cleanHistory.length === 0) {
          if (role !== 'user') continue; // Skip initial assistant greetings
        } else {
          const lastRole = cleanHistory[cleanHistory.length - 1].role;
          if (lastRole === role) {
            cleanHistory[cleanHistory.length - 1].parts[0].text += `\n\n${h.text.trim()}`;
            continue;
          }
        }
        cleanHistory.push({ role, parts: [{ text: h.text.trim() }] });
      }
    }

    // Ensure the last message in history is from 'model' so the incoming message ('user') is valid next turn
    if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
      cleanHistory.pop();
    }

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction,
      });

      // Reconstruct the chat session with sanitized history
      const chat = model.startChat({
        history: cleanHistory,
      });

      const result = await chat.sendMessage(message);
      const reply  = result.response.text();

      return res.json({
        success: true,
        reply,
        context: {
          openTickets: openWOCount,
          criticalTickets: criticalWOCount,
          availableTechs,
          totalTechs,
          emergencyActive: !!activeEmergency,
        },
        method: 'gemini_chat',
      });
    } catch (geminiErr) {
      logger.warn('Gemini chat API call failed, falling back to smart telemetry response:', geminiErr.message);
      
      const isRateLimit = geminiErr.message?.includes('429') || geminiErr.message?.includes('quota');
      const isOverload  = geminiErr.message?.includes('503') || geminiErr.message?.includes('high demand');
      const noteReason = isRateLimit
        ? 'Cloud AI free-tier quota rate limit reached'
        : isOverload
          ? 'Cloud AI model temporary load spike'
          : 'Cloud AI connection temporarily delayed';

      const fallbackReply = `Operational telemetry summary:\n` +
        `• **Active Tickets**: ${openWOCount} (${criticalWOCount} CRITICAL, ${highWOCount} HIGH)\n` +
        `• **Fleet Status**: ${availableTechs} available out of ${totalTechs} technicians (${totalTechs > 0 ? Math.round((onJobTechs / totalTechs) * 100) : 0}% fleet utilization)\n` +
        `• **Emergency**: ${activeEmergency ? `${activeEmergency.level} - ${activeEmergency.title}` : 'Normal L0 Operations'}\n` +
        `• **SLA Warning**: ${approachingSLA} tickets approaching SLA resolution window.\n\n` +
        `💡 *Dispatch Action:* Prioritize the ${criticalWOCount} critical tickets or run **Simulated Annealing** in the Optimization tab.\n\n` +
        `*(Note: ${noteReason}; displaying real-time telemetry from dispatch database.)*`;

      return res.json({
        success: true,
        reply: fallbackReply,
        context: {
          openTickets: openWOCount,
          criticalTickets: criticalWOCount,
          availableTechs,
          totalTechs,
          emergencyActive: !!activeEmergency,
        },
        method: 'smart_ops_fallback',
      });
    }
  } catch (err) {
    logger.error('AI chat error:', err.message);
    res.status(500).json({ success: false, error: `AI chat failed: ${err.message}` });
  }
});

export default router;

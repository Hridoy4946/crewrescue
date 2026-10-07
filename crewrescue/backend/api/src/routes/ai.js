// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — High-Performance RAG Copilot & Dispatch Assistant Routes
//
// POST /api/ai/chat                 - Conversational operational & technical AI
// POST /api/ai/copilot              - Grounded RAG technician field copilot
// GET  /api/ai/knowledge            - List knowledge base documents
// POST /api/ai/knowledge            - Add a new knowledge document
// DELETE /api/ai/knowledge/:id      - Remove a document
// POST /api/ai/triage               - AI incident classification & triage
// POST /api/ai/dispatcher-query     - Dispatcher natural language search
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

// ── Models & API Key Validation ──────────────────────────────────────────────
const GEMINI_MODEL       = 'gemini-1.5-flash';
const GEMINI_EMBED_MODEL = 'gemini-embedding-001';

function isValidGeminiKey(key) {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  if (k.length < 30) return false;
  if (k.startsWith('REPLACE_') || k.startsWith('your_') || k.includes('CHANGE_ME')) return false;
  return k.startsWith('AIza');
}

// ── Keyword-based classifier (no external LLM needed) ─────────────────────────
function keywordClassify(text) {
  const t = text.toLowerCase();
  let category = 'EQUIPMENT_BREAKDOWN';
  let severity = 'MEDIUM';
  const requiredSkills = [];
  const recommendedParts = [];

  if (t.includes('power') || t.includes('outage') || t.includes('electric') || t.includes('voltage') || t.includes('blackout')) {
    category = 'POWER_OUTAGE'; requiredSkills.push('ELECTRICAL', 'HIGH_VOLTAGE');
  } else if (t.includes('hvac') || t.includes('cooling') || t.includes('chiller') || t.includes('temperature') || t.includes('ac ')) {
    category = 'HVAC_FAILURE'; requiredSkills.push('HVAC', 'ELECTRICAL');
    recommendedParts.push('compressor', 'control_board');
  } else if (t.includes('fiber') || t.includes('cable') || t.includes('network') || t.includes('internet') || t.includes('splice')) {
    category = 'NETWORK_FAILURE'; requiredSkills.push('FIBER_OPTIC', 'NETWORKING');
    recommendedParts.push('fiber_cable', 'splice_kit');
  } else if (t.includes('transformer') || t.includes('buchholz') || t.includes('megger')) {
    category = 'TRANSFORMER_FAULT'; requiredSkills.push('ELECTRICAL', 'TRANSFORMER', 'HIGH_VOLTAGE');
    recommendedParts.push('transformer_relay', 'insulating_oil');
  } else if (t.includes('generator') || t.includes('cummins') || t.includes('diesel') || t.includes('genset')) {
    category = 'EQUIPMENT_BREAKDOWN'; requiredSkills.push('GENERATOR', 'ELECTRICAL');
    recommendedParts.push('fuel_filter', 'voltage_regulator');
  } else if (t.includes('water') || t.includes('pump') || t.includes('leak') || t.includes('pipe')) {
    category = 'WATER_LEAK'; requiredSkills.push('WATER_SYSTEMS', 'MECHANICAL');
    recommendedParts.push('pump_seal', 'pipe_fitting');
  } else if (t.includes('flood') || t.includes('storm') || t.includes('cyclone') || t.includes('damage')) {
    category = 'STORM_DAMAGE'; requiredSkills.push('ELECTRICAL', 'MECHANICAL');
  } else if (t.includes('solar') || t.includes('inverter') || t.includes('fronius')) {
    category = 'EQUIPMENT_BREAKDOWN'; requiredSkills.push('SOLAR', 'ELECTRICAL');
  }

  if (t.includes('critical') || t.includes('server room') || t.includes('hospital') ||
      t.includes('datacenter') || t.includes('entire building') || t.includes('complete loss') || t.includes('fire') || t.includes('explosion')) {
    severity = 'CRITICAL';
  } else if (t.includes('urgent') || t.includes('emergency') || t.includes('immediately') || t.includes('major')) {
    severity = 'HIGH';
  } else if (t.includes('minor') || t.includes('partial') || t.includes('intermittent')) {
    severity = 'LOW';
  }

  return {
    category,
    severity,
    required_skills:    [...new Set(requiredSkills.length ? requiredSkills : ['ELECTRICAL'])],
    recommended_parts:  recommendedParts,
    sla_urgency:        severity === 'CRITICAL' ? 'IMMEDIATE' : severity === 'HIGH' ? 'URGENT' : 'STANDARD',
    summary:            `Classified as ${category.replace(/_/g, ' ')} (${severity}) based on operational analysis.`,
    method:             'heuristic_engine',
  };
}

// ── Smart Knowledge Search & Ranking ──────────────────────────────────────────
function searchKnowledge(docs, query, categoryFilter = '', topK = 4) {
  if (!docs || docs.length === 0) return [];

  const rawTokens = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  const stopWords = new Set(['how', 'what', 'where', 'when', 'which', 'who', 'does', 'with', 'from', 'into', 'that', 'this', 'safe', 'safely']);
  const searchTokens = rawTokens.filter(t => !stopWords.has(t));
  const tokens = searchTokens.length > 0 ? searchTokens : rawTokens;

  const scored = docs.map(doc => {
    let score = 0;
    const titleLower   = (doc.title || '').toLowerCase();
    const contentLower = (doc.content || '').toLowerCase();
    const sourceLower  = (doc.source || '').toLowerCase();
    const catLower     = (doc.category || '').toLowerCase();
    const keywords     = (doc.keywords || []).map(k => k.toLowerCase());

    if (categoryFilter && doc.category === categoryFilter) {
      score += 5;
    }

    for (const token of tokens) {
      // Title match (high weight)
      if (titleLower.includes(token)) score += 6;
      // Keywords match
      if (keywords.some(k => k.includes(token))) score += 4;
      // Category match
      if (catLower.includes(token)) score += 3;
      // Source match
      if (sourceLower.includes(token)) score += 2;
      // Content occurrence
      const occurrences = (contentLower.match(new RegExp(`\\b${token}`, 'g')) || []).length;
      score += Math.min(occurrences, 5);
    }

    // Exact phrase bonus
    const phrase = tokens.join(' ');
    if (phrase.length > 4 && (contentLower.includes(phrase) || titleLower.includes(phrase))) {
      score += 8;
    }

    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top results that have a positive score, or fallback to first doc in category
  const filtered = scored.filter(s => s.score > 0).map(s => s.doc).slice(0, topK);
  if (filtered.length > 0) return filtered;

  if (categoryFilter) {
    const catDocs = docs.filter(d => d.category === categoryFilter);
    if (catDocs.length > 0) return catDocs.slice(0, topK);
  }

  return docs.slice(0, Math.min(topK, docs.length));
}

// ── Local RAG Response Synthesizer ────────────────────────────────────────────
function synthesizeRAGGuidance(query, relevantDocs) {
  if (!relevantDocs || relevantDocs.length === 0) {
    return {
      text: `No exact procedure manual found for: "${query}". Please check the **Knowledge Base** tab to review all standard operating manuals, or consult the Field Operations Supervisor.`,
      sources: []
    };
  }

  const primary = relevantDocs[0];
  const steps = [];
  const warnings = [];
  const lines = primary.content.split('\n');

  lines.forEach(l => {
    const trimmed = l.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase().includes('warning:') || trimmed.toLowerCase().includes('danger:') || trimmed.toLowerCase().includes('caution:')) {
      warnings.push(trimmed);
    } else {
      steps.push(trimmed);
    }
  });

  let responseMarkdown = `### 📋 Technical Procedure: **${primary.title}**\n\n`;
  responseMarkdown += `*Source: ${primary.source || 'Standard Operating Procedure'} ${primary.pageRef ? `(${primary.pageRef})` : ''} · Category: **${primary.category}***\n\n`;

  if (warnings.length > 0) {
    responseMarkdown += `> ⚠️ **CRITICAL SAFETY DIRECTIVE:**\n`;
    warnings.forEach(w => {
      responseMarkdown += `> ${w.replace(/^(warning|danger|caution):?\s*/i, '')}\n`;
    });
    responseMarkdown += `\n`;
  }

  responseMarkdown += `**Standard Operating Procedure:**\n\n`;
  responseMarkdown += steps.map(s => s).join('\n\n') + '\n\n';

  if (relevantDocs.length > 1) {
    responseMarkdown += `**Additional Field References & Related Standards:**\n`;
    relevantDocs.slice(1, 3).forEach(rd => {
      responseMarkdown += `• **${rd.title}** (${rd.source}): *${rd.content.slice(0, 140).trim()}…*\n`;
    });
  }

  return {
    text: responseMarkdown,
    sources: relevantDocs.map(d => ({
      title: d.title,
      source: d.source,
      category: d.category,
      pageRef: d.pageRef
    }))
  };
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
    if (isValidGeminiKey(geminiKey)) {
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

Incident description: "${text.replace(/"/g, "'")}"`;

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
// POST /api/ai/copilot — Grounded RAG technician field copilot
// ─────────────────────────────────────────────────────────────────────────────
router.post('/copilot', async (req, res) => {
  try {
    const { query, category } = req.body;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Please enter at least 2 characters for your query.' });
    }

    // Retrieve knowledge base documents
    const filter = { isActive: true };
    if (category) filter.category = category;
    const allDocs = await KnowledgeDoc.find(filter).lean();

    const matchedDocs = searchKnowledge(allDocs, query, category, 4);

    // Try Gemini with grounded context if API key is present & valid
    const geminiKey = process.env.GEMINI_API_KEY;
    if (isValidGeminiKey(geminiKey) && matchedDocs.length > 0) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        const contextBlocks = matchedDocs.map((d, i) =>
          `[DOC ${i + 1}: ${d.title} (${d.source ?? d.category})]\n${d.content}`
        ).join('\n\n');

        const systemPrompt = `You are CrewRescue Copilot — an expert field service engineering and dispatch copilot for power, utility, and telecommunication infrastructure.
Give a direct, highly structured response with:
1. Exact procedure steps
2. Safety requirements / PPE
3. Verification / tolerances
Cite the specific manual sources in your response.

== OFFICIAL MANUAL CONTEXT ==
${contextBlocks}
== END CONTEXT ==

User Query: "${query}"`;

        const result = await model.generateContent(systemPrompt);
        return res.json({
          success:  true,
          response: result.response.text(),
          sources:  matchedDocs.map(d => ({ title: d.title, source: d.source, category: d.category, pageRef: d.pageRef })),
          method:   'gemini_rag',
        });
      } catch (geminiErr) {
        logger.warn('Gemini copilot query failed, falling back to local RAG engine:', geminiErr.message);
      }
    }

    // Local Autonomous RAG Synthesis Engine
    const synthesized = synthesizeRAGGuidance(query, matchedDocs);
    res.json({
      success:  true,
      response: synthesized.text,
      sources:  synthesized.sources,
      method:   'rag_synthesis',
    });
  } catch (err) {
    logger.error('Copilot error:', err);
    res.status(500).json({ success: false, error: 'Copilot query failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/dispatcher-query — Natural language dispatch search
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dispatcher-query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) return res.status(400).json({ success: false, error: 'Query required' });

    const qLower = query.toLowerCase();
    const orgId = req.organizationId;

    const [openWOCount, criticalWOCount, activeEmergency, totalTechs, availableTechs] = await Promise.all([
      WorkOrder.countDocuments({ organizationId: orgId, status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, severity: 'CRITICAL', status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      Emergency.findOne({ organizationId: orgId, isActive: true }).sort({ createdAt: -1 }).lean(),
      Technician.countDocuments({ organizationId: orgId, isActive: true }),
      Technician.countDocuments({ organizationId: orgId, isActive: true, status: 'AVAILABLE' }),
    ]);

    // Check territories
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

    // Try Gemini if configured
    const geminiKey = process.env.GEMINI_API_KEY;
    if (isValidGeminiKey(geminiKey)) {
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

    // Heuristic operational response
    let responseText = '';

    if (matchedSkill || matchedTerritory || qLower.includes('who') || qLower.includes('technician') || qLower.includes('tech') || qLower.includes('crew')) {
      const techFilter = { organizationId: orgId, isActive: true };
      if (matchedTerritory) techFilter.territory = new RegExp(`^${matchedTerritory}$`, 'i');
      if (matchedSkill) techFilter['skills.skillId'] = matchedSkill;

      let candidateTechs = await Technician.find(techFilter)
        .sort({ status: 1, 'performance.rating': -1 })
        .limit(4)
        .lean();

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
          return `${idx + 1}. **${t.name}** [ID: \`${t.employeeId || 'EMP-' + t._id.toString().slice(-4).toUpperCase()}\`] (${t.status}, Rating: ${t.performance?.rating ?? 4.5}⭐, Phone: ${t.phone || '+880-1700-000000'})\n   • Territory: ${t.territory} | Skills: ${skillsStr}`;
        }).join('\n');

        responseText = `Recommended technicians for **${skillLabel}** ${territoryLabel}:\n\n${techList}\n\n💡 *Dispatch tip: Prioritize technicians in AVAILABLE status to prevent overtime penalty.*`;
      } else {
        responseText = `Currently no specialized technicians found for ${matchedSkill || 'this role'} in ${matchedTerritory || 'this territory'}. Total available technicians in fleet: ${availableTechs} of ${totalTechs}. Recommend re-routing from an adjacent district or triggering the Optimization Engine.`;
      }
    } else if (qLower.includes('emergency') || qLower.includes('sla') || qLower.includes('status') || qLower.includes('critical') || qLower.includes('outage') || qLower.includes('how many')) {
      const approachingSLA = await WorkOrder.countDocuments({
        organizationId: orgId,
        status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] },
        'sla.resolutionDeadline': { $gte: new Date(), $lte: new Date(Date.now() + 60 * 60 * 1000) },
      });

      responseText = `📊 **Current Dispatch Telemetry Summary**:\n• Active Unresolved Incidents: **${openWOCount}**\n• Critical Incidents: **${criticalWOCount}**\n• Approaching SLA Breach (<60m): **${approachingSLA}**\n• Available Technicians: **${availableTechs}** / **${totalTechs}**\n• Disaster Status: **${activeEmergency ? `${activeEmergency.level} - ${activeEmergency.title}` : 'L0 (Normal Day-to-Day Mode)'}**\n\nRecommended Action: Navigate to the **Optimization** tab to execute Simulated Annealing or Genetic Algorithm scheduling to clear high-risk tickets.`;
    } else {
      const allDocs = await KnowledgeDoc.find({ isActive: true }).lean();
      const relevant = searchKnowledge(allDocs, query, '', 2);
      if (relevant.length > 0) {
        const syn = synthesizeRAGGuidance(query, relevant);
        responseText = syn.text;
      } else {
        responseText = `CrewRescue Dispatch Assistant operational. Currently tracking **${openWOCount}** open tickets (${criticalWOCount} critical) and **${availableTechs}** available technicians. You can ask me:\n• "Who is best for fiber optic in Gulshan?"\n• "Show available technicians in Mirpur"\n• "Current SLA and emergency status"\n• "How to troubleshoot 11kV transformer fault"`;
      }
    }

    res.json({ success: true, response: responseText, method: 'smart_ops_engine' });
  } catch (err) {
    logger.error('Dispatcher query error:', err);
    res.status(500).json({ success: false, error: 'AI query failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat — Full Conversational AI Assistant (Multi-turn)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, error: 'Message required' });

    const q = message.trim();
    const qLower = q.toLowerCase();
    const orgId = req.organizationId;

    // Fetch live operational context
    const [openWOCount, criticalWOCount, highWOCount, activeEmergency, totalTechs, availableTechs, onJobTechs, recentCritical] = await Promise.all([
      WorkOrder.countDocuments({ organizationId: orgId, status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, severity: 'CRITICAL', status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, severity: 'HIGH',     status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      Emergency.findOne({ organizationId: orgId, isActive: true }).sort({ createdAt: -1 }).lean(),
      Technician.countDocuments({ organizationId: orgId, isActive: true }),
      Technician.countDocuments({ organizationId: orgId, isActive: true, status: 'AVAILABLE' }),
      Technician.countDocuments({ organizationId: orgId, isActive: true, status: { $in: ['ON_JOB', 'BUSY', 'EN_ROUTE', 'ON_SITE'] } }),
      WorkOrder.find({ organizationId: orgId, severity: 'CRITICAL', status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } })
        .sort({ createdAt: -1 }).limit(3).select('workOrderNumber title category location.area').lean(),
    ]);

    const approachingSLA = await WorkOrder.countDocuments({
      organizationId: orgId,
      status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] },
      'sla.resolutionDeadline': { $gte: new Date(), $lte: new Date(Date.now() + 2 * 60 * 60 * 1000) },
    });

    const liveContext = {
      openTickets: openWOCount,
      criticalTickets: criticalWOCount,
      availableTechs,
      totalTechs,
      emergencyActive: !!activeEmergency,
    };

    // Try Gemini if valid key exists
    const geminiKey = process.env.GEMINI_API_KEY;
    if (isValidGeminiKey(geminiKey)) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);

        const systemInstruction = `You are CrewRescue AI — an intelligent operations assistant for utility field service dispatchers.
LIVE TELEMETRY:
- Open Tickets: ${openWOCount} (${criticalWOCount} CRITICAL, ${highWOCount} HIGH)
- Fleet: ${totalTechs} total (${availableTechs} AVAILABLE, ${onJobTechs} busy/on job)
- Emergency Mode: ${activeEmergency ? `${activeEmergency.level}: ${activeEmergency.title}` : 'Normal L0 Operations'}
- SLA Approaching: ${approachingSLA} tickets

Guidelines:
- Give concise, actionable, markdown formatted responses.
- When asked about dispatching or technicians, provide actionable advice.
- When asked about equipment or safety, provide step-by-step procedures.`;

        const cleanHistory = [];
        if (Array.isArray(history)) {
          for (const h of history) {
            if (!h.text || typeof h.text !== 'string' || !h.text.trim()) continue;
            const role = (h.role === 'assistant' || h.role === 'model') ? 'model' : 'user';
            if (cleanHistory.length === 0 && role !== 'user') continue;
            if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
              cleanHistory[cleanHistory.length - 1].parts[0].text += `\n\n${h.text.trim()}`;
              continue;
            }
            cleanHistory.push({ role, parts: [{ text: h.text.trim() }] });
          }
        }
        if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
          cleanHistory.pop();
        }

        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction });
        const chat = model.startChat({ history: cleanHistory });
        const result = await chat.sendMessage(q);

        return res.json({
          success: true,
          reply: result.response.text(),
          context: liveContext,
          method: 'gemini_chat',
        });
      } catch (geminiErr) {
        logger.warn('Gemini chat error, falling back to smart operations assistant:', geminiErr.message);
      }
    }

    // ── Local Conversational Intelligence Engine ──────────────────────────────
    let reply = '';

    // A. Equipment, Technical & Safety Queries -> Search RAG Knowledge Base
    const technicalKeywords = [
      'how to', 'isolate', 'transformer', 'generator', 'cummins', 'abb', 'buchholz', 'switchgear',
      'megger', 'breaker', 'fuse', 'inverter', 'fronius', 'plc', 'siemens', 'step 7', 'fiber', 'otdr',
      'splice', 'manhole', 'confined space', 'ppe', 'arc flash', 'chiller', 'hvac', 'refrigerant',
      'pump', 'seal', 'procedure', 'troubleshoot', 'fault code', 'alarm', 'start', 'test', 'oil sample'
    ];

    const isTechnical = technicalKeywords.some(kw => qLower.includes(kw));

    if (isTechnical) {
      const allDocs = await KnowledgeDoc.find({ isActive: true }).lean();
      const matched = searchKnowledge(allDocs, q, '', 3);
      if (matched.length > 0) {
        const guidance = synthesizeRAGGuidance(q, matched);
        reply = guidance.text;
      }
    }

    // B. Technician / Who to dispatch query
    if (!reply && (qLower.includes('who') || qLower.includes('technician') || qLower.includes('tech') || qLower.includes('dispatch') || qLower.includes('worker') || qLower.includes('crew'))) {
      const territories = ['Gulshan', 'Uttara', 'Dhanmondi', 'Mirpur', 'Tejgaon', 'Motijheel', 'Wari', 'Mohammadpur', 'Banani', 'Badda', 'Khilgaon'];
      const matchedTerritory = territories.find(t => qLower.includes(t.toLowerCase()));

      let techFilter = { organizationId: orgId, isActive: true };
      if (matchedTerritory) techFilter.territory = new RegExp(`^${matchedTerritory}$`, 'i');

      const skillKeys = ['TRANSFORMER', 'HIGH_VOLTAGE', 'FIBER_OPTIC', 'ELECTRICAL', 'HVAC', 'GENERATOR', 'SOLAR', 'WATER_SYSTEMS', 'NETWORKING', 'PLC', 'SAFETY_OFFICER'];
      const detectedSkill = skillKeys.find(s => qLower.includes(s.toLowerCase().replace('_', ' ')) || qLower.includes(s.toLowerCase()));

      if (detectedSkill) techFilter['skills.skillId'] = detectedSkill;

      let candidateTechs = await Technician.find(techFilter)
        .sort({ status: 1, 'performance.rating': -1 })
        .limit(4)
        .lean();

      if (candidateTechs.length === 0 && (detectedSkill || matchedTerritory)) {
        candidateTechs = await Technician.find({ organizationId: orgId, isActive: true })
          .sort({ status: 1, 'performance.rating': -1 })
          .limit(4)
          .lean();
      }

      if (candidateTechs.length > 0) {
        const techList = candidateTechs.map((t, idx) => {
          const skillsStr = t.skills?.map(s => s.skillId.replace(/_/g, ' ')).join(', ') || 'General';
          return `${idx + 1}. **${t.name}** [ID: \`${t.employeeId || 'EMP-' + t._id.toString().slice(-4).toUpperCase()}\`]\n   • Status: **${t.status}** · Rating: **${t.performance?.rating ?? 4.8}⭐**\n   • District: ${t.territory || 'Central'} · Phone: ${t.phone || '+880-1700-000000'}\n   • Skills: ${skillsStr}`;
        }).join('\n\n');

        reply = `Here are the top recommended technicians for this dispatch assignment:\n\n${techList}\n\n💡 **Recommendation:** Assign technicians in **AVAILABLE** status first. You can assign them directly on the **Incident Management** page or let the **Optimization Engine** auto-cluster routes.`;
      }
    }

    // C. Status / SLA / Critical Ticket queries
    if (!reply && (qLower.includes('sla') || qLower.includes('critical') || qLower.includes('ticket') || qLower.includes('open') || qLower.includes('emergency') || qLower.includes('outage') || qLower.includes('count') || qLower.includes('how many'))) {
      reply = `### 📊 Live System Operational Telemetry\n\n` +
        `• **Active Unresolved Work Orders**: **${openWOCount}**\n` +
        `• **Critical (P1) Tickets**: **${criticalWOCount}** (${criticalWOCount > 0 ? 'requires urgent response' : 'none'})\n` +
        `• **High (P2) Tickets**: **${highWOCount}**\n` +
        `• **SLA Warning Window (<2h)**: **${approachingSLA}** tickets at risk of SLA penalties\n` +
        `• **Field Fleet Utilization**: **${totalTechs > 0 ? Math.round((onJobTechs / totalTechs) * 100) : 0}%** (${availableTechs} available out of ${totalTechs})\n` +
        `• **Emergency Ops Level**: **${activeEmergency ? `${activeEmergency.level} — "${activeEmergency.title}"` : 'L0 — Normal Operational Readiness'}**\n\n` +
        (recentCritical.length > 0 ? `**Most Urgent Open Incidents:**\n` + recentCritical.map(t => `• [\`${t.workOrderNumber}\`] **${t.title}** (${t.location?.area || 'Metro Area'})`).join('\n') + '\n\n' : '') +
        `👉 *Action Plan:* Use the **Optimization** tab to automatically balance workload and clear high-priority tickets.`;
    }

    // D. Conversational / General queries ("hello", "all ok?", "help", etc.)
    if (!reply) {
      if (qLower.includes('all ok') || qLower.includes('status ok') || qLower.includes('healthy')) {
        const isHealthy = criticalWOCount < 5 && availableTechs > 10;
        reply = isHealthy
          ? `✅ **System Status is Nominal:**\n\n• Fleet is active with **${availableTechs} technicians ready**.\n• Only **${criticalWOCount} critical tickets** pending.\n• **0 active emergency declarations**.\n\nAll dispatch systems, GPS tracking, and optimization workers are operating normally.`
          : `⚠️ **Operational Alert:**\n\n• **${criticalWOCount} critical tickets** currently require immediate dispatch.\n• **${availableTechs} technicians available** out of ${totalTechs}.\n• **${approachingSLA} tickets** are within 2 hours of SLA breach.\n\n**Recommended step:** Dispatch available senior technicians to the critical tickets or run Simulated Annealing optimization.`;
      } else {
        reply = `Hello! I'm **CrewRescue AI Assistant**.\n\n` +
          `Current live status: **${openWOCount} open tickets** (${criticalWOCount} critical), with **${availableTechs} technicians available**.\n\n` +
          `I can assist you with:\n` +
          `• **Technician Dispatch:** *"Who is best for high voltage switchgear?"* or *"Show available techs in Gulshan"*\n` +
          `• **Equipment Manuals:** *"How to isolate ABB T400 transformer"* or *"Cummins generator emergency start"*\n` +
          `• **Safety & Protocols:** *"Arc flash PPE requirements"* or *"Confined space entry procedure"*\n` +
          `• **SLA & Queue Health:** *"What tickets are breaching SLA?"*\n\n` +
          `How can I assist your dispatch operations right now?`;
      }
    }

    return res.json({
      success: true,
      reply,
      context: liveContext,
      method:  'smart_operations_engine',
    });
  } catch (err) {
    logger.error('AI chat error:', err.message);
    res.status(500).json({ success: false, error: `AI chat failed: ${err.message}` });
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

    const doc = await KnowledgeDoc.create({
      organizationId: req.organizationId,
      title,
      source,
      category,
      content,
      pageRef,
      keywords: keywords ?? [],
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

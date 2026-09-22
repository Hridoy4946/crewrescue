import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();
router.use(authenticate);

// Keyword-based fallback classifier (no LLM needed)
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

  if (t.includes('critical') || t.includes('server room') || t.includes('hospital') || t.includes('datacenter') || t.includes('entire building') || t.includes('complete loss') || t.includes('fire')) {
    severity = 'CRITICAL';
  } else if (t.includes('urgent') || t.includes('emergency') || t.includes('immediately') || t.includes('major')) {
    severity = 'HIGH';
  } else if (t.includes('minor') || t.includes('partial') || t.includes('intermittent')) {
    severity = 'LOW';
  }

  return {
    category,
    severity,
    required_skills: [...new Set(requiredSkills)],
    recommended_parts: recommendedParts,
    sla_urgency: severity === 'CRITICAL' ? 'IMMEDIATE' : severity === 'HIGH' ? 'URGENT' : 'STANDARD',
    summary: `Classified as ${category} (${severity}) based on keyword analysis.`,
    method: 'keyword_fallback',
  };
}

// POST /api/ai/triage
router.post('/triage', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Incident description too short' });
    }

    // Try Gemini if key is configured
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
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
        const jsonText = result.response.text();
        const parsed = JSON.parse(jsonText);

        return res.json({ success: true, classification: parsed });
      } catch (geminiErr) {
        logger.warn('Gemini triage failed, falling back to keyword classifier:', geminiErr.message);
      }
    }

    // Fallback to keyword classifier
    const classification = keywordClassify(text);
    res.json({ success: true, classification });
  } catch (err) {
    logger.error('AI triage error:', err);
    res.status(500).json({ success: false, error: 'Triage failed' });
  }
});

// POST /api/ai/dispatcher-query — natural language dispatcher assistant
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

export default router;

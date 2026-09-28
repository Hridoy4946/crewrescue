// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — Knowledge Base (RAG Copilot)
// Mongoose model for equipment manual document chunks
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

const knowledgeDocSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },

  // Document metadata
  title:      { type: String, required: true },
  source:     { type: String },              // e.g. "ABB T400 Transformer Manual v2.3"
  category:   {
    type:   String,
    enum:   ['TRANSFORMER', 'GENERATOR', 'HVAC', 'FIBER_OPTIC', 'HIGH_VOLTAGE', 'WATER_PUMP',
             'PLC', 'SOLAR_INVERTER', 'SAFETY', 'GENERAL'],
    required: true,
  },

  // The actual text chunk (one section of a manual)
  content:    { type: String, required: true },
  pageRef:    String,   // e.g. "p.34-36"

  // Simple keyword index for fallback search (no vector embedding needed)
  keywords:   [String],

  // Gemini text embedding (stored as flat float array)
  embedding:  [Number],

  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

knowledgeDocSchema.index({ category: 1, isActive: 1 });
knowledgeDocSchema.index({ keywords: 1 });
knowledgeDocSchema.index({ organizationId: 1 });

export default mongoose.model('KnowledgeDoc', knowledgeDocSchema);

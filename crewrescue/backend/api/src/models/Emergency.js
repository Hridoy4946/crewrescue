import mongoose from 'mongoose';

const emergencySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  level:          { type: Number, required: true, min: 1, max: 4 },
  title:          { type: String, required: true },
  description:    String,
  type: {
    type: String,
    enum: ['STORM', 'FLOOD', 'POWER_OUTAGE', 'NETWORK_OUTAGE', 'EQUIPMENT_FAILURE',
           'TECHNICIAN_SHORTAGE', 'DEPOT_CLOSURE', 'ROAD_CLOSURE', 'MASS_OUTAGE', 'CUSTOM'],
    required: true,
  },

  // Impact metrics at declaration time
  impactSnapshot: {
    affectedIncidents:  { type: Number, default: 0 },
    affectedTechnicians:{ type: Number, default: 0 },
    closedDepots:       { type: Number, default: 0 },
    blockedRoads:       { type: Number, default: 0 },
    slaRiskCount:       { type: Number, default: 0 },
    financialExposure:  { type: Number, default: 0 },
  },

  declaredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  declaredAt: { type: Date, default: Date.now },
  resolvedAt: Date,

  status: { type: String, enum: ['ACTIVE', 'RESOLVING', 'RESOLVED'], default: 'ACTIVE' },

  // Optimization weight overrides during emergency
  weightOverrides: mongoose.Schema.Types.Mixed,

  // Generated incidents during this emergency
  generatedWorkOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' }],

  timeline: [{
    event:     String,
    detail:    String,
    at:        { type: Date, default: Date.now },
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
}, { timestamps: true });

emergencySchema.index({ organizationId: 1, status: 1 });

export default mongoose.model('Emergency', emergencySchema);

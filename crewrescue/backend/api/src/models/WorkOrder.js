import mongoose from 'mongoose';
import { WORK_ORDER_STATUS, INCIDENT_CATEGORIES, SKILL_IDS, PINNED_STATUSES } from '@crewrescue/shared';

const workOrderSchema = new mongoose.Schema({
  organizationId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  workOrderNumber: { type: String, required: true },
  title:           { type: String, required: true, trim: true },
  description:     String,

  // Classification
  category:   { type: String, enum: INCIDENT_CATEGORIES },
  severity:   { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], required: true },
  type:       { type: String, enum: ['EMERGENCY', 'BREAK_FIX', 'SCHEDULED', 'INSPECTION', 'INSTALLATION', 'REPLACEMENT', 'RECURRING'], default: 'BREAK_FIX' },
  isEmergency:{ type: Boolean, default: false },

  // Relationships
  assetId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
  depotId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Depot' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

  // Assignment
  assignedTechnicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', default: null },
  assignedVehicleId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
  assignedCrewIds:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Technician' }],

  // Location
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
    address:     String,
    area:        String,
  },

  // Status & lifecycle
  status:    { type: String, enum: WORK_ORDER_STATUS, default: 'CREATED' },
  isPinned:  { type: Boolean, default: false }, // locked from optimizer

  // Skills & parts
  requiredSkills: [{ type: String, enum: SKILL_IDS }],
  requiredParts:  [{ partName: String, quantity: { type: Number, default: 1 } }],

  // Time
  estimatedDurationMin: { type: Number, default: 60 },
  scheduledStart:       Date,
  scheduledEnd:         Date,
  actualStart:          Date,
  actualEnd:            Date,
  customerTimeWindowStart: Date,
  customerTimeWindowEnd:   Date,

  // SLA
  sla: {
    responseDeadline:   Date,
    resolutionDeadline: Date,
    responseBreached:   { type: Boolean, default: false },
    resolutionBreached: { type: Boolean, default: false },
    penaltyAmount:      { type: Number, default: 0 },
    financialExposure:  { type: Number, default: 0 },
  },

  // Priority & cost
  customerPriority: { type: Number, default: 1, min: 1, max: 5 },
  estimatedCost:    { type: Number, default: 0 },

  // Evidence & audit
  notes:   [{ author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: String, at: { type: Date, default: Date.now } }],
  statusHistory: [{
    status:    String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at:        { type: Date, default: Date.now },
    reason:    String,
  }],

  // Optimization metadata
  optimizationRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'OptimizationRun', default: null },
}, { timestamps: true });

workOrderSchema.index({ location: '2dsphere' });
workOrderSchema.index({ organizationId: 1, status: 1 });
workOrderSchema.index({ organizationId: 1, severity: 1 });
workOrderSchema.index({ organizationId: 1, workOrderNumber: 1 }, { unique: true });
workOrderSchema.index({ 'sla.resolutionDeadline': 1 });

// Auto-pin when status moves to a locked state
workOrderSchema.pre('save', function (next) {
  if (this.isModified('status') && PINNED_STATUSES.includes(this.status)) {
    this.isPinned = true;
  }
  next();
});

export default mongoose.model('WorkOrder', workOrderSchema);

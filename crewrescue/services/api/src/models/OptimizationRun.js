import mongoose from 'mongoose';
import { ALGORITHMS } from '@crewrescue/shared';

const optimizationRunSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  trigger: {
    type: String,
    enum: ['MANUAL', 'NEW_CRITICAL_INCIDENT', 'EMERGENCY_DECLARED', 'TECHNICIAN_UNAVAILABLE',
           'VEHICLE_BREAKDOWN', 'DEPOT_CLOSED', 'SCHEDULED', 'WHAT_IF'],
    required: true,
  },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  algorithm:   { type: String, enum: Object.values(ALGORITHMS), required: true },

  // Input snapshot
  inputSnapshot: {
    totalWorkOrders:   Number,
    totalTechnicians:  Number,
    totalVehicles:     Number,
    pinnedJobs:        Number,
    unassignedJobs:    Number,
    emergencyLevel:    Number,
    weights:           mongoose.Schema.Types.Mixed,
  },

  // Results
  status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  runtimeMs: Number,
  candidateSolutions: { type: Number, default: 0 },

  // Before/after comparison
  before: {
    slaCompliancePct:  Number,
    unassignedCount:   Number,
    travelKm:          Number,
    overtimeHours:     Number,
    estimatedCost:     Number,
    slaFinancialRisk:  Number,
  },
  after: {
    slaCompliancePct:  Number,
    unassignedCount:   Number,
    travelKm:          Number,
    overtimeHours:     Number,
    estimatedCost:     Number,
    slaFinancialRisk:  Number,
  },

  // Schedule changes proposed
  assignments: [{
    workOrderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' },
    prevTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
    newTechnician:  { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
    scheduledStart: Date,
    reason:         String,
  }],

  // Human approval
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: Date,
  rejectionReason: String,

  // What-if scenario
  isScenario:    { type: Boolean, default: false },
  scenarioLabel: String,
  expiresAt:     Date, // TTL for scenario runs

  errorMessage: String,
}, { timestamps: true });

optimizationRunSchema.index({ organizationId: 1, createdAt: -1 });
// Auto-expire scenario runs after 1 hour
optimizationRunSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export default mongoose.model('OptimizationRun', optimizationRunSchema);

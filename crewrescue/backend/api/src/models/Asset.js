import mongoose from 'mongoose';
import { ASSET_CATEGORIES, SKILL_IDS } from '@crewrescue/shared';

const assetSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  assetId:        { type: String, required: true },
  name:           { type: String, required: true, trim: true },
  category:       { type: String, enum: ASSET_CATEGORIES, required: true },
  serialNumber:   String,
  manufacturer:   String,
  model:          String,
  installDate:    Date,
  warrantyExpiry: Date,
  customerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
    address:     String,
    area:        String,
  },
  condition: {
    type: String,
    enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL', 'DECOMMISSIONED'],
    default: 'GOOD',
  },
  criticality: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  requiredSkills: [{ type: String, enum: SKILL_IDS }],
  maintenanceHistory: [{
    date:        Date,
    type:        String,
    technicianId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
    notes:       String,
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' },
  }],
  failureProbability: { type: Number, default: 0, min: 0, max: 1 }, // 0–1 ML prediction
  lastInspection:     Date,
  nextInspection:     Date,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

assetSchema.index({ location: '2dsphere' });
assetSchema.index({ organizationId: 1, assetId: 1 }, { unique: true });

export default mongoose.model('Asset', assetSchema);

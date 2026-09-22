import mongoose from 'mongoose';
import { VEHICLE_TYPES } from '@crewrescue/shared';

const vehicleSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  plateNumber:    { type: String, required: true },
  type:           { type: String, enum: VEHICLE_TYPES, required: true },
  make:           String,
  model:          String,
  year:           Number,
  capacity:       { type: Number, default: 500 }, // kg
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
  },
  assignedTechnicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', default: null },
  depotId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Depot' },
  status: {
    type: String,
    enum: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'BREAKDOWN', 'OFFLINE'],
    default: 'AVAILABLE',
  },
  fuel: {
    type:    { type: String, enum: ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC'], default: 'DIESEL' },
    levelPct: { type: Number, default: 100, min: 0, max: 100 },
  },
  maintenanceDue: Date,
  specialEquipment: [String],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

vehicleSchema.index({ currentLocation: '2dsphere' });
vehicleSchema.index({ organizationId: 1, plateNumber: 1 }, { unique: true });

export default mongoose.model('Vehicle', vehicleSchema);

import mongoose from 'mongoose';
import { SKILL_IDS } from '@crewrescue/shared';

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true }, // [lng, lat]
}, { _id: false });

const skillSchema = new mongoose.Schema({
  skillId:    { type: String, enum: SKILL_IDS, required: true },
  level:      { type: String, enum: ['JUNIOR', 'MID', 'SENIOR', 'EXPERT'], default: 'MID' },
  certified:  { type: Boolean, default: false },
  certExpiry: Date,
  yearsExp:   { type: Number, default: 0 },
}, { _id: false });

const technicianSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  employeeId:     { type: String, required: true },
  name:           { type: String, required: true, trim: true },
  email:          { type: String, trim: true, lowercase: true },
  phone:          String,
  skills:         [skillSchema],
  territory:      String,
  depotId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Depot' },
  vehicleId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  currentLocation: locationSchema,
  status: {
    type: String,
    enum: ['AVAILABLE', 'BUSY', 'EN_ROUTE', 'ON_SITE', 'OFFLINE', 'UNAVAILABLE', 'EMERGENCY'],
    default: 'AVAILABLE',
    index: true,
  },
  availability: {
    shiftStart:  { type: String, default: '08:00' },
    shiftEnd:    { type: String, default: '18:00' },
    onCall:      { type: Boolean, default: false },
    unavailableUntil: Date,
    unavailableReason: { type: String, enum: ['SICK', 'VACATION', 'TRAINING', 'INCIDENT', null], default: null },
  },
  performance: {
    firstTimeFixRate: { type: Number, default: 0 },
    avgJobDurationMin: { type: Number, default: 60 },
    jobsCompleted:    { type: Number, default: 0 },
    slaCompliance:    { type: Number, default: 1 },
    rating:           { type: Number, default: 4.0, min: 0, max: 5 },
  },
  isActive: { type: Boolean, default: true },
  lastLocationUpdate: Date,
}, { timestamps: true });

technicianSchema.index({ currentLocation: '2dsphere' });
technicianSchema.index({ organizationId: 1, status: 1 });
technicianSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });

export default mongoose.model('Technician', technicianSchema);

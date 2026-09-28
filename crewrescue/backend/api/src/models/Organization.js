import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  industry: {
    type: String,
    enum: ['TELECOM', 'POWER_UTILITY', 'WATER_UTILITY', 'INDUSTRIAL', 'HVAC', 'TRANSPORT', 'MUNICIPAL', 'OTHER'],
    default: 'POWER_UTILITY',
  },
  contactEmail: { type: String, required: true },
  contactPhone: String,
  address: {
    street: String,
    city: String,
    country: { type: String, default: 'Bangladesh' },
  },
  settings: {
    timezone: { type: String, default: 'Asia/Dhaka' },
    currency: { type: String, default: 'BDT' },
    businessHoursStart: { type: String, default: '08:00' },
    businessHoursEnd: { type: String, default: '20:00' },
    emergencyLevel: { type: Number, default: 0, min: 0, max: 4 },
    activeEmergencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Emergency', default: null },
    optimizationWeights: {
      w1_travel:           { type: Number, default: 0.20 },
      w2_sla_penalty:      { type: Number, default: 0.35 },
      w3_overtime:         { type: Number, default: 0.10 },
      w4_customer_priority:{ type: Number, default: 0.15 },
      w5_unassigned:       { type: Number, default: 0.15 },
      w6_parts_delay:      { type: Number, default: 0.05 },
    },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Organization', organizationSchema);

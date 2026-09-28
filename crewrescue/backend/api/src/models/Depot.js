import mongoose from 'mongoose';

const depotSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name:           { type: String, required: true, trim: true },
  code:           { type: String, required: true },
  address: {
    street:  String,
    area:    String,
    city:    { type: String, default: 'Dhaka' },
    country: { type: String, default: 'Bangladesh' },
  },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  territory:     String,
  capacity:      { type: Number, default: 50 }, // max technicians
  status: {
    type: String,
    enum: ['OPERATIONAL', 'REDUCED', 'CLOSED', 'EMERGENCY_ONLY'],
    default: 'OPERATIONAL',
  },
  operatingHours: {
    open:  { type: String, default: '06:00' },
    close: { type: String, default: '22:00' },
    is24h: { type: Boolean, default: false },
  },
  inventory: [{
    partId:   String,
    partName: String,
    quantity: { type: Number, default: 0 },
    minStock: { type: Number, default: 5 },
  }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

depotSchema.index({ location: '2dsphere' });
depotSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export default mongoose.model('Depot', depotSchema);

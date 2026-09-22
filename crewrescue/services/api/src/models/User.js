import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '@crewrescue/shared';

const userSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: Object.values(ROLES), required: true },
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', default: null },
  avatar: String,
  isActive: { type: Boolean, default: true },
  lastLoginAt: Date,
  loginHistory: [{
    ip: String,
    userAgent: String,
    at: { type: Date, default: Date.now },
  }],
  refreshTokens: [{ type: String, select: false }],
}, { timestamps: true });

// Compound unique index: email per org
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  return obj;
};

export default mongoose.model('User', userSchema);

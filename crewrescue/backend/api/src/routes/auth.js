import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger } from '../config/logger.js';

const router = express.Router();

function generateTokens(userId, orgId, role) {
  const accessToken = jwt.sign(
    { userId, orgId, role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY ?? '15m' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY ?? '7d' }
  );
  return { accessToken, refreshToken };
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// ── POST /api/auth/login ───────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordHash +refreshTokens');

  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const { accessToken, refreshToken } = generateTokens(
    user._id.toString(),
    user.organizationId.toString(),
    user.role
  );

  user.refreshTokens = [...(user.refreshTokens ?? []).slice(-4), refreshToken];
  user.lastLoginAt = new Date();
  user.loginHistory = [...(user.loginHistory ?? []).slice(-19), {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    at: new Date(),
  }];
  await user.save();

  setRefreshCookie(res, refreshToken);

  logger.info(`Login: ${user.email} [${user.role}]`);
  res.json({
    success: true,
    accessToken,
    user: user.toSafeObject(),
  });
}));

// ── POST /api/auth/refresh ─────────────────────────────────────────────────────
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, error: 'No refresh token' });

  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.userId).select('+refreshTokens');

  if (!user || !user.isActive || !user.refreshTokens?.includes(token)) {
    throw new AppError('Invalid refresh token', 401);
  }

  const { accessToken, refreshToken: newRefresh } = generateTokens(
    user._id.toString(),
    user.organizationId.toString(),
    user.role
  );

  user.refreshTokens = user.refreshTokens.filter((t) => t !== token).concat(newRefresh);
  await user.save();

  setRefreshCookie(res, newRefresh);
  res.json({ success: true, accessToken });
}));

// ── POST /api/auth/logout ──────────────────────────────────────────────────────
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const user = await User.findById(req.user._id).select('+refreshTokens');
    if (user) {
      user.refreshTokens = (user.refreshTokens ?? []).filter((t) => t !== token);
      await user.save();
    }
  }
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out' });
}));

// ── GET /api/auth/me ───────────────────────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
}));

// ── POST /api/auth/register (admin only or first-org setup) ───────────────────
const registerSchema = z.object({
  orgName:  z.string().min(2).optional(),
  name:     z.string().min(2),
  email:    z.string().email(),
  password: z.string().min(8),
  role:     z.string().optional(),
});

router.post('/register', asyncHandler(async (req, res) => {
  const { orgName, name, email, password, role } = registerSchema.parse(req.body);

  const orgCount = await Organization.countDocuments();
  let org;

  if (orgCount === 0) {
    const slug = (orgName ?? 'default-org').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    org = await Organization.create({
      name: orgName ?? 'DhakaPower Utilities',
      slug,
      contactEmail: email,
    });
  } else {
    return res.status(400).json({ success: false, error: 'Registration requires an invite. Contact your admin.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase(), organizationId: org._id });
  if (existing) return res.status(409).json({ success: false, error: 'Email already registered' });

  const user = await User.create({
    organizationId: org._id,
    name,
    email,
    passwordHash: password,
    role: role ?? 'ORG_ADMIN',
  });

  const { accessToken, refreshToken } = generateTokens(user._id.toString(), org._id.toString(), user.role);

  user.refreshTokens = [refreshToken];
  await user.save();

  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    success: true,
    accessToken,
    user: user.toSafeObject(),
    organization: org,
  });
}));

export default router;

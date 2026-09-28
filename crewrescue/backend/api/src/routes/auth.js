import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { authenticate } from '../middleware/auth.js';
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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+passwordHash +refreshTokens');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = generateTokens(
      user._id.toString(),
      user.organizationId.toString(),
      user.role
    );

    // Store refresh token (keep last 5 devices)
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
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    logger.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ── POST /api/auth/refresh ─────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ success: false, error: 'No refresh token' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('+refreshTokens');

    if (!user || !user.isActive || !user.refreshTokens?.includes(token)) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken: newRefresh } = generateTokens(
      user._id.toString(),
      user.organizationId.toString(),
      user.role
    );

    // Rotate refresh token
    user.refreshTokens = user.refreshTokens.filter((t) => t !== token).concat(newRefresh);
    await user.save();

    setRefreshCookie(res, newRefresh);
    res.json({ success: true, accessToken });
  } catch {
    res.status(401).json({ success: false, error: 'Refresh token invalid or expired' });
  }
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
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
  } catch {
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

// ── POST /api/auth/register (admin only or first-org setup) ───────────────────
const registerSchema = z.object({
  orgName:  z.string().min(2).optional(),
  name:     z.string().min(2),
  email:    z.string().email(),
  password: z.string().min(8),
  role:     z.string().optional(),
});

router.post('/register', async (req, res) => {
  try {
    const { orgName, name, email, password, role } = registerSchema.parse(req.body);

    // Check if any org exists — first registration creates the org
    const orgCount = await Organization.countDocuments();
    let org;

    if (orgCount === 0) {
      // First registration: create organization
      const slug = (orgName ?? 'default-org').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      org = await Organization.create({
        name: orgName ?? 'DhakaPower Utilities',
        slug,
        contactEmail: email,
      });
    } else {
      // Subsequent registrations need an existing org
      return res.status(400).json({ success: false, error: 'Registration requires an invite. Contact your admin.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase(), organizationId: org._id });
    if (existing) return res.status(409).json({ success: false, error: 'Email already registered' });

    const user = await User.create({
      organizationId: org._id,
      name,
      email,
      passwordHash: password, // gets hashed by pre-save hook
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
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    logger.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

export default router;

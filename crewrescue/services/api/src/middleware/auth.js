import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No access token provided' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.userId).select('-passwordHash -refreshTokens');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'User not found or deactivated' });
    }

    req.user = user;
    req.organizationId = user.organizationId.toString();
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, error: 'Invalid access token' });
  }
}

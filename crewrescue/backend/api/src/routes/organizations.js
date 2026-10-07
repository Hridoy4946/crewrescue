import express from 'express';
import Organization from '../models/Organization.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();
router.use(authenticate);

router.get('/:id', asyncHandler(async (req, res) => {
  if (req.params.id !== req.organizationId && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  const org = await Organization.findById(req.params.id);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });
  res.json({ success: true, organization: org });
}));

router.patch('/:id/settings', authorize('org:*'), asyncHandler(async (req, res) => {
  if (req.params.id !== req.organizationId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  const org = await Organization.findByIdAndUpdate(
    req.params.id,
    { $set: { 'settings': { ...req.body.settings } } },
    { new: true, runValidators: true }
  );
  res.json({ success: true, organization: org });
}));

router.patch('/:id/weights', authorize('optimization:run'), asyncHandler(async (req, res) => {
  if (req.params.id !== req.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
  const org = await Organization.findByIdAndUpdate(
    req.params.id,
    { $set: { 'settings.optimizationWeights': req.body.weights } },
    { new: true }
  );
  res.json({ success: true, weights: org.settings.optimizationWeights });
}));

export default router;

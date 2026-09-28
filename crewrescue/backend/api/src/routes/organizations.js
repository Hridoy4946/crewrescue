import express from 'express';
import Organization from '../models/Organization.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();
router.use(authenticate);

router.get('/:id', async (req, res) => {
  try {
    // Tenant check: user can only access their own org
    if (req.params.id !== req.organizationId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });
    res.json({ success: true, organization: org });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/settings', authorize('org:*'), async (req, res) => {
  try {
    if (req.params.id !== req.organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: { 'settings': { ...req.body.settings } } },
      { new: true, runValidators: true }
    );
    res.json({ success: true, organization: org });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/weights', authorize('optimization:run'), async (req, res) => {
  try {
    if (req.params.id !== req.organizationId) return res.status(403).json({ success: false, error: 'Access denied' });
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: { 'settings.optimizationWeights': req.body.weights } },
      { new: true }
    );
    res.json({ success: true, weights: org.settings.optimizationWeights });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

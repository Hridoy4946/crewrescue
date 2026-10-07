import express from 'express';
import Asset from '../models/Asset.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { category, condition, criticality, page = 1, limit = 50 } = req.query;
  const query = { organizationId: req.organizationId, isActive: true };
  if (category) query.category = category;
  if (condition) query.condition = condition;
  if (criticality) query.criticality = criticality;

  const [assets, total] = await Promise.all([
    Asset.find(query).sort({ criticality: -1, name: 1 }).skip((page-1)*limit).limit(Number(limit)),
    Asset.countDocuments(query),
  ]);
  res.json({ success: true, assets, total });
}));

router.get('/map', asyncHandler(async (req, res) => {
  const assets = await Asset.find({
    organizationId: req.organizationId,
    isActive: true,
    'location.coordinates': { $exists: true, $ne: [] },
  }).select('assetId name category condition criticality location failureProbability');
  res.json({ success: true, assets });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const asset = await Asset.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
  res.json({ success: true, asset });
}));

export default router;

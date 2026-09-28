import express from 'express';
import Asset from '../models/Asset.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/map', async (req, res) => {
  try {
    const assets = await Asset.find({
      organizationId: req.organizationId,
      isActive: true,
      'location.coordinates': { $exists: true, $ne: [] },
    }).select('assetId name category condition criticality location failureProbability');
    res.json({ success: true, assets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    res.json({ success: true, asset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

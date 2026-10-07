import express from 'express';
import Depot from '../models/Depot.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const depots = await Depot.find({ organizationId: req.organizationId, isActive: true })
    .sort({ name: 1 });
  res.json({ success: true, depots });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const depot = await Depot.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!depot) return res.status(404).json({ success: false, error: 'Depot not found' });
  res.json({ success: true, depot });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const depot = await Depot.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.organizationId },
    { status },
    { new: true }
  );
  if (!depot) return res.status(404).json({ success: false, error: 'Depot not found' });

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('depot:status_changed', {
    depotId: depot._id, name: depot.name, status,
  });

  res.json({ success: true, depot });
}));

export default router;

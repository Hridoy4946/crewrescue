import express from 'express';
import Vehicle from '../models/Vehicle.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = { organizationId: req.organizationId, isActive: true };
  if (status) query.status = status;

  const vehicles = await Vehicle.find(query)
    .populate('assignedTechnicianId', 'name employeeId')
    .populate('depotId', 'name code')
    .sort({ plateNumber: 1 });
  res.json({ success: true, vehicles });
}));

router.get('/map', asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find({
    organizationId: req.organizationId,
    isActive: true,
    'currentLocation.coordinates': { $exists: true, $ne: [] },
  }).select('plateNumber type status currentLocation assignedTechnicianId');
  res.json({ success: true, vehicles });
}));

export default router;

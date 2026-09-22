import express from 'express';
import Vehicle from '../models/Vehicle.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const query = { organizationId: req.organizationId, isActive: true };
    if (status) query.status = status;

    const vehicles = await Vehicle.find(query)
      .populate('assignedTechnicianId', 'name employeeId')
      .populate('depotId', 'name code')
      .sort({ plateNumber: 1 });
    res.json({ success: true, vehicles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/map', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      organizationId: req.organizationId,
      isActive: true,
      'currentLocation.coordinates': { $exists: true, $ne: [] },
    }).select('plateNumber type status currentLocation assignedTechnicianId');
    res.json({ success: true, vehicles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import express from 'express';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Stub — full work orders route (incidents route handles most cases)
router.get('/', async (req, res) => {
  const { default: WorkOrder } = await import('../models/WorkOrder.js');
  try {
    const { page = 1, limit = 30, status, type } = req.query;
    const query = { organizationId: req.organizationId };
    if (status) query.status = status;
    if (type) query.type = type;
    const [workOrders, total] = await Promise.all([
      WorkOrder.find(query)
        .populate('assignedTechnicianId', 'name employeeId status')
        .sort({ 'sla.resolutionDeadline': 1 })
        .skip((page-1)*limit).limit(Number(limit)),
      WorkOrder.countDocuments(query),
    ]);
    res.json({ success: true, workOrders, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

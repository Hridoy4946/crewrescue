import express from 'express';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { logger } from '../config/logger.js';

const router = express.Router();
router.use(authenticate);

// ── GET /api/work-orders ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 30, status, type, severity, assignedToMe } = req.query;
    const query = { organizationId: req.organizationId };
    if (status) query.status = status;
    if (type) query.type = type;
    if (severity) query.severity = severity;

    // Technician self-service: only see own assigned jobs
    if (assignedToMe === 'true' && req.user?.technicianId) {
      query.assignedTechnicianId = req.user.technicianId;
    }

    const [data, total] = await Promise.all([
      WorkOrder.find(query)
        .populate('assignedTechnicianId', 'name employeeId status currentLocation')
        .populate('assetId', 'name category location criticality')
        .sort({ 'sla.resolutionDeadline': 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      WorkOrder.countDocuments(query),
    ]);
    res.json({ success: true, data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    logger.error('Work orders list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/work-orders/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const wo = await WorkOrder.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate('assignedTechnicianId', 'name employeeId status phone currentLocation')
      .populate('assetId', 'name category location criticality serialNumber')
      .lean();
    if (!wo) return res.status(404).json({ success: false, error: 'Work order not found' });
    res.json({ success: true, data: wo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/work-orders/:id/status ─────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, notes, resolution } = req.body;
    const VALID_STATUSES = ['CREATED','TRIAGED','PENDING_ASSIGNMENT','ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','RESOLVED','VERIFIED','CLOSED'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status: ${status}` });
    }

    const update = { status };
    if (status === 'IN_PROGRESS') update.actualStart = new Date();
    if (['RESOLVED', 'CLOSED'].includes(status)) {
      update.actualEnd = new Date();
      if (resolution) update.resolution = resolution;
    }

    const wo = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      { $set: update, ...(notes ? { $push: { notes: { text: notes, author: req.user?._id, createdAt: new Date() } } } : {}) },
      { new: true }
    ).populate('assignedTechnicianId', 'name employeeId').lean();

    if (!wo) return res.status(404).json({ success: false, error: 'Work order not found' });

    // Broadcast status change via Socket.IO
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('workorder:updated', { workOrder: wo });

    logger.info(`WO ${wo.workOrderNumber} status → ${status} by ${req.user?.email}`);
    res.json({ success: true, data: wo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/work-orders/:id/assign ────────────────────────────────────────
router.patch('/:id/assign', authorize('workorders:*'), async (req, res) => {
  try {
    const { technicianId } = req.body;
    const tech = technicianId
      ? await Technician.findOne({ _id: technicianId, organizationId: req.organizationId })
      : null;

    const wo = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      {
        $set: {
          assignedTechnicianId: tech?._id ?? null,
          status: tech ? 'ASSIGNED' : 'PENDING_ASSIGNMENT',
          scheduledStart: new Date(),
        },
      },
      { new: true }
    ).populate('assignedTechnicianId', 'name employeeId status').lean();

    if (!wo) return res.status(404).json({ success: false, error: 'Work order not found' });

    // Update technician status to BUSY
    if (tech) {
      await Technician.findByIdAndUpdate(technicianId, { status: 'BUSY' });
    }

    req.app.get('io')?.to(`org:${req.organizationId}`).emit('workorder:assigned', { workOrder: wo });
    res.json({ success: true, data: wo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/work-orders ─────────────────────────────────────────────────────
router.post('/', authorize('workorders:*'), async (req, res) => {
  try {
    const wo = await WorkOrder.create({ ...req.body, organizationId: req.organizationId });
    res.status(201).json({ success: true, data: wo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

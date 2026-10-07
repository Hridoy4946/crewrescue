import express from 'express';
import Emergency from '../models/Emergency.js';
import Organization from '../models/Organization.js';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();
router.use(authenticate);

// POST /api/emergency/declare
router.post('/declare', authorize('emergency:declare'), asyncHandler(async (req, res) => {
  const { level, title, description, type, weightOverrides } = req.body;
  const orgId = req.organizationId;

  const [unassigned, slaRisk, affectedTechs] = await Promise.all([
    WorkOrder.countDocuments({ organizationId: orgId, assignedTechnicianId: null, status: { $nin: ['CLOSED','RESOLVED','VERIFIED'] } }),
    WorkOrder.countDocuments({ organizationId: orgId, 'sla.resolutionDeadline': { $lt: new Date(Date.now() + 2 * 3_600_000) }, status: { $nin: ['CLOSED','RESOLVED','VERIFIED'] } }),
    Technician.countDocuments({ organizationId: orgId, status: { $in: ['UNAVAILABLE','OFFLINE'] } }),
  ]);

  const emergency = await Emergency.create({
    organizationId: orgId,
    level,
    title,
    description,
    type: type ?? 'CUSTOM',
    weightOverrides,
    declaredBy: req.user._id,
    impactSnapshot: {
      affectedIncidents: unassigned,
      affectedTechnicians: affectedTechs,
      slaRiskCount: slaRisk,
    },
    timeline: [{ event: 'DECLARED', detail: `Level ${level} emergency declared by ${req.user.name}`, actorId: req.user._id }],
  });

  await Organization.findByIdAndUpdate(orgId, {
    'settings.emergencyLevel': level,
    'settings.activeEmergencyId': emergency._id,
  });

  req.app.get('io')?.to(`org:${orgId}`).emit('emergency:declared', {
    emergency: { _id: emergency._id, level, title, type, declaredAt: emergency.declaredAt },
  });

  res.status(201).json({ success: true, emergency });
}));

// GET /api/emergency/active
router.get('/active', asyncHandler(async (req, res) => {
  const emergency = await Emergency.findOne({ organizationId: req.organizationId, status: 'ACTIVE' })
    .populate('declaredBy', 'name role');
  res.json({ success: true, emergency });
}));

// POST /api/emergency/:id/resolve
router.post('/:id/resolve', authorize('emergency:declare'), asyncHandler(async (req, res) => {
  const emergency = await Emergency.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.organizationId, status: 'ACTIVE' },
    {
      status: 'RESOLVED',
      resolvedBy: req.user._id,
      resolvedAt: new Date(),
      $push: { timeline: { event: 'RESOLVED', detail: req.body.notes ?? 'Emergency resolved', actorId: req.user._id } },
    },
    { new: true }
  );
  if (!emergency) return res.status(404).json({ success: false, error: 'Active emergency not found' });

  await Organization.findByIdAndUpdate(req.organizationId, {
    'settings.emergencyLevel': 0,
    'settings.activeEmergencyId': null,
  });

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('emergency:resolved', {
    emergencyId: emergency._id,
  });

  res.json({ success: true, emergency });
}));

export default router;

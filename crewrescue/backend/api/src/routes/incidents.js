import express from 'express';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { SEVERITY } from '@crewrescue/shared';

const router = express.Router();
router.use(authenticate);

// GET /api/incidents
router.get('/', asyncHandler(async (req, res) => {
  const { status, severity, assignedTo, assignedToMe, unassigned, page = 1, limit = 30, emergency } = req.query;
  const query = { organizationId: req.organizationId };
  if (status) query.status = status;
  if (severity) query.severity = severity;
  if (assignedTo) query.assignedTechnicianId = assignedTo;
  if (assignedToMe === 'true') {
    let techId = req.user.technicianId;
    if (!techId) {
      const tech = await Technician.findOne({ organizationId: req.organizationId, email: req.user.email });
      if (tech) techId = tech._id;
    }
    if (techId) {
      query.assignedTechnicianId = techId;
    } else {
      query.assignedTechnicianId = req.user._id;
    }
  }
  if (unassigned === 'true') query.assignedTechnicianId = null;
  if (emergency === 'true') query.isEmergency = true;

  const [incidents, total] = await Promise.all([
    WorkOrder.find(query)
      .populate('assignedTechnicianId', 'name employeeId status currentLocation')
      .populate('assetId', 'name category location')
      .sort({ 'sla.resolutionDeadline': 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    WorkOrder.countDocuments(query),
  ]);

  res.json({ success: true, incidents, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// GET /api/incidents/map — for Leaflet incident markers
router.get('/map', asyncHandler(async (req, res) => {
  const incidents = await WorkOrder.find({
    organizationId: req.organizationId,
    status: { $nin: ['CLOSED', 'VERIFIED'] },
    'location.coordinates': { $exists: true, $ne: [] },
  }).select('workOrderNumber title severity status isEmergency location sla assignedTechnicianId');

  res.json({ success: true, incidents });
}));

// POST /api/incidents
router.post('/', authorize('incidents:*'), asyncHandler(async (req, res) => {
  const org = req.organizationId;
  const count = await WorkOrder.countDocuments({ organizationId: org });
  const workOrderNumber = `WO-${String(count + 1).padStart(5, '0')}`;

  const sev = SEVERITY[req.body.severity] ?? SEVERITY.MEDIUM;
  const now = new Date();
  const responseDeadline = new Date(now.getTime() + sev.slaResponseMin * 60_000);
  const resolutionDeadline = new Date(now.getTime() + sev.slaResolutionHr * 3_600_000);

  const incident = await WorkOrder.create({
    organizationId: org,
    workOrderNumber,
    ...req.body,
    sla: {
      responseDeadline,
      resolutionDeadline,
      financialExposure: req.body.sla?.financialExposure ?? 0,
    },
    status: 'CREATED',
  });

  req.app.get('io')?.to(`org:${org}`).emit('incident:created', {
    incident: {
      _id: incident._id,
      workOrderNumber,
      title: incident.title,
      severity: incident.severity,
      isEmergency: incident.isEmergency,
      location: incident.location,
      sla: incident.sla,
    },
  });

  res.status(201).json({ success: true, incident });
}));

// GET /api/incidents/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const incident = await WorkOrder.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('assignedTechnicianId', 'name employeeId status phone currentLocation skills')
    .populate('assignedVehicleId', 'plateNumber type status')
    .populate('assetId', 'name category serialNumber condition location requiredSkills')
    .populate('notes.author', 'name role');
  if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
  res.json({ success: true, incident });
}));

// PATCH /api/incidents/:id/status
router.patch('/:id/status', authorize('incidents:*'), asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const incident = await WorkOrder.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

  const prevStatus = incident.status;
  incident.status = status;
  incident.statusHistory.push({ status, changedBy: req.user._id, reason });

  if (status === 'IN_PROGRESS' && !incident.actualStart) incident.actualStart = new Date();
  if (['RESOLVED', 'CLOSED'].includes(status) && !incident.actualEnd) incident.actualEnd = new Date();

  await incident.save();

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('incident:status_changed', {
    incidentId: incident._id,
    workOrderNumber: incident.workOrderNumber,
    prevStatus,
    status,
    severity: incident.severity,
  });

  res.json({ success: true, incident });
}));

// PATCH /api/incidents/:id/assign
router.patch('/:id/assign', authorize('incidents:*'), asyncHandler(async (req, res) => {
  const { technicianId, vehicleId, scheduledStart } = req.body;
  const incident = await WorkOrder.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.organizationId },
    {
      assignedTechnicianId: technicianId,
      assignedVehicleId: vehicleId ?? null,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : undefined,
      status: 'ASSIGNED',
      $push: { statusHistory: { status: 'ASSIGNED', changedBy: req.user._id, reason: 'Manual assignment' } },
    },
    { new: true }
  ).populate('assignedTechnicianId', 'name employeeId');

  if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('incident:assigned', {
    incidentId: incident._id,
    technicianId,
    technicianName: incident.assignedTechnicianId?.name,
    workOrderNumber: incident.workOrderNumber,
  });

  res.json({ success: true, incident });
}));

// POST /api/incidents/:id/notes
router.post('/:id/notes', asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ success: false, error: 'Note text required' });

  const incident = await WorkOrder.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.organizationId },
    {
      $push: {
        notes: {
          author: req.user._id,
          text: text.trim(),
          at: new Date(),
        },
      },
    },
    { new: true }
  ).populate('notes.author', 'name role');

  if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('incident:note_added', {
    incidentId: incident._id,
    author: req.user.name,
    text: text.trim(),
  });

  res.json({ success: true, notes: incident.notes });
}));

export default router;

import express from 'express';
import mongoose from 'mongoose';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import Emergency from '../models/Emergency.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard/stats — powers the main stat cards
router.get('/stats', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const now = new Date();

    const [
      totalWorkOrders, openIncidents, criticalIncidents,
      unassignedIncidents, slaAtRisk, slaBreached,
      availableTechs, busyTechs, unavailableTechs,
      activeEmergency,
      completedToday,
    ] = await Promise.all([
      WorkOrder.countDocuments({ organizationId: orgId, status: { $nin: ['CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, severity: 'CRITICAL', status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({ organizationId: orgId, assignedTechnicianId: null, status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] } }),
      WorkOrder.countDocuments({
        organizationId: orgId,
        'sla.resolutionDeadline': { $gt: now, $lt: new Date(now.getTime() + 2 * 3_600_000) },
        status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] },
      }),
      WorkOrder.countDocuments({
        organizationId: orgId,
        'sla.resolutionDeadline': { $lt: now },
        'sla.resolutionBreached': false,
        status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] },
      }),
      Technician.countDocuments({ organizationId: orgId, status: 'AVAILABLE', isActive: true }),
      Technician.countDocuments({ organizationId: orgId, status: { $in: ['BUSY', 'EN_ROUTE', 'ON_SITE'] }, isActive: true }),
      Technician.countDocuments({ organizationId: orgId, status: { $in: ['UNAVAILABLE', 'OFFLINE'] }, isActive: true }),
      Emergency.findOne({ organizationId: orgId, status: 'ACTIVE' }).select('level title type declaredAt'),
      WorkOrder.countDocuments({
        organizationId: orgId,
        status: 'CLOSED',
        updatedAt: { $gte: new Date(now.setHours(0,0,0,0)) },
      }),
    ]);

    // Estimate SLA financial exposure
    const exposureAgg = await WorkOrder.aggregate([
      { $match: { organizationId: req.user.organizationId, status: { $nin: ['RESOLVED','VERIFIED','CLOSED'] } } },
      { $group: { _id: null, total: { $sum: '$sla.financialExposure' } } },
    ]);
    const financialExposure = exposureAgg[0]?.total ?? 0;

    const totalTechs = availableTechs + busyTechs + unavailableTechs;
    const slaCompliancePct = openIncidents > 0
      ? Math.max(0, Math.round(((openIncidents - slaBreached) / openIncidents) * 100))
      : 100;

    res.json({
      success: true,
      stats: {
        workOrders: { total: totalWorkOrders, open: openIncidents, completedToday },
        incidents: { critical: criticalIncidents, unassigned: unassignedIncidents },
        sla: { atRisk: slaAtRisk, breached: slaBreached, compliancePct: slaCompliancePct, financialExposure },
        technicians: { total: totalTechs, available: availableTechs, busy: busyTechs, unavailable: unavailableTechs },
        emergency: activeEmergency,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/sla-health — for SLA health panel
router.get('/sla-health', async (req, res) => {
  try {
    const now = new Date();
    const twoHrsLater = new Date(now.getTime() + 2 * 3_600_000);

    const [onTrack, atRisk, breachRisk] = await Promise.all([
      WorkOrder.countDocuments({
        organizationId: req.organizationId,
        'sla.resolutionDeadline': { $gt: twoHrsLater },
        status: { $nin: ['RESOLVED','VERIFIED','CLOSED'] },
      }),
      WorkOrder.countDocuments({
        organizationId: req.organizationId,
        'sla.resolutionDeadline': { $gt: now, $lt: twoHrsLater },
        status: { $nin: ['RESOLVED','VERIFIED','CLOSED'] },
      }),
      WorkOrder.countDocuments({
        organizationId: req.organizationId,
        'sla.resolutionDeadline': { $lt: now },
        status: { $nin: ['RESOLVED','VERIFIED','CLOSED'] },
      }),
    ]);

    res.json({ success: true, slaHealth: { onTrack, atRisk, breachRisk } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/analytics — rich breakdown for analytics page
router.get('/analytics', async (req, res) => {
  try {
    const orgId = new mongoose.Types.ObjectId(req.organizationId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [
      severityBreakdown,
      categoryBreakdown,
      statusBreakdown,
      techUtilByTerritory,
      completionTrend,
      slaByCategory,
    ] = await Promise.all([
      // Severity breakdown of open incidents
      WorkOrder.aggregate([
        { $match: { organizationId: orgId, status: { $nin: ['CLOSED','VERIFIED'] } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Category breakdown
      WorkOrder.aggregate([
        { $match: { organizationId: orgId, status: { $nin: ['CLOSED','VERIFIED'] } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),

      // Status breakdown of all active WOs
      WorkOrder.aggregate([
        { $match: { organizationId: orgId, status: { $nin: ['CLOSED','VERIFIED'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Technician utilization by territory
      Technician.aggregate([
        { $match: { organizationId: orgId, isActive: true } },
        {
          $group: {
            _id: '$territory',
            total:     { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
            busy:      { $sum: { $cond: [{ $in:  ['$status', ['BUSY','EN_ROUTE','ON_SITE']] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]),

      // 7-day resolution trend (completed per day)
      WorkOrder.aggregate([
        {
          $match: {
            organizationId: orgId,
            status: { $in: ['CLOSED', 'VERIFIED', 'RESOLVED'] },
            updatedAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // SLA compliance by category
      WorkOrder.aggregate([
        { $match: { organizationId: orgId } },
        {
          $group: {
            _id: '$category',
            total:   { $sum: 1 },
            breached: { $sum: { $cond: ['$sla.resolutionBreached', 1, 0] } },
          },
        },
        { $limit: 6 },
      ]),
    ]);

    res.json({
      success: true,
      analytics: {
        severityBreakdown,
        categoryBreakdown,
        statusBreakdown,
        techUtilByTerritory,
        completionTrend,
        slaByCategory,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

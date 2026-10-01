// ─────────────────────────────────────────────────────────────────────────────
// SLA Prediction + Notification API Routes (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { predictBatchSLABreaches, predictBreachProbability } from '../services/slaPrediction.js';
import { sendNotification } from '../services/notificationService.js';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import { logger } from '../config/logger.js';

const router = express.Router();
router.use(authenticate);

// ── GET /api/sla/predictions — batch SLA breach predictions ──────────────────
router.get('/predictions', async (req, res) => {
  try {
    const result = await predictBatchSLABreaches(WorkOrder, Technician, req.organizationId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('SLA predictions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/sla/predict — single incident prediction ────────────────────────
router.post('/predict', async (req, res) => {
  try {
    const { workOrderId, severity, category, createdAt, slaResolutionDeadline, technicianActiveCount, isEmergency } = req.body;

    let woData = { severity, category, createdAt, slaResolutionDeadline, technicianActiveCount, isEmergency };

    // If workOrderId provided, fetch from DB
    if (workOrderId) {
      const wo = await WorkOrder.findOne({ _id: workOrderId, organizationId: req.organizationId }).lean();
      if (!wo) return res.status(404).json({ success: false, error: 'Work order not found' });
      woData = {
        severity:              wo.severity,
        category:              wo.category,
        createdAt:             wo.createdAt,
        slaResolutionDeadline: wo.sla?.resolutionDeadline,
        isEmergency:           wo.isEmergency ?? false,
      };
    }

    const prediction = predictBreachProbability(woData);
    res.json({ success: true, prediction });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/notifications/test — send a test notification ──────────────────
router.post('/notifications/test', async (req, res) => {
  try {
    const { type = 'SLA_BREACH_WARNING', email } = req.body;
    const io = req.app.get('io');

    const testData = {
      SLA_BREACH_WARNING:   { workOrderNumber: 'WO-00001', title: 'Test Incident', minutesRemaining: 45 },
      INCIDENT_ASSIGNED:    { workOrderNumber: 'WO-00001', title: 'Test Incident', technicianName: 'Test Technician', slaDeadline: new Date(Date.now() + 2 * 3600_000) },
      OPTIMIZATION_COMPLETE: { algorithm: 'SIMULATED_ANNEALING', slaImprovementPct: 12, assignedCount: 8 },
      EMERGENCY_DECLARED:   { title: 'Test Emergency', level: 'L3', affectedArea: 'Gulshan' },
    };

    const result = await sendNotification({
      io,
      orgId:      req.organizationId?.toString(),
      type,
      severity:   'warning',
      data:       testData[type] ?? testData.SLA_BREACH_WARNING,
      recipients: email ? [{ email }] : [],
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

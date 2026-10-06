// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — Optimization API Routes
//
// POST /api/optimization/run          - Enqueue an optimization job (SA/GA async, Greedy sync)
// GET  /api/optimization/runs         - List recent optimization runs
// GET  /api/optimization/runs/:id     - Get a single run with full assignment detail
// POST /api/optimization/runs/:id/approve - Apply approved assignments to work orders
// GET  /api/optimization/queue/status - Current BullMQ queue depth & active jobs
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import { Queue } from 'bullmq';
import OptimizationRun from '../models/OptimizationRun.js';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { metrics } from '../config/metrics.js';
import { logger } from '../config/logger.js';
import {
  ALGORITHMS, PINNED_STATUSES, DEFAULT_WEIGHTS
} from '@crewrescue/shared';
import { runSimulatedAnnealing } from '../solvers/simulatedAnnealing.js';
import { runGeneticAlgorithm }   from '../solvers/geneticAlgorithm.js';
import { runGreedySolver as greedySolve } from '../solvers/greedySolver.js';

const router = express.Router();
router.use(authenticate);

// ── BullMQ Queue connection ────────────────────────────────────────────────────
const redisConfig = {
  host:     process.env.REDIS_HOST     ?? 'localhost',
  port:     parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD ?? undefined,
};

let optimizationQueue;
try {
  optimizationQueue = new Queue('optimization', { connection: redisConfig });
  logger.info('Optimization BullMQ queue connected');
} catch (err) {
  logger.warn('BullMQ queue unavailable (Redis not running?) — SA/GA will run synchronously:', err.message);
}

// ── POST /api/optimization/run ─────────────────────────────────────────────────
router.post('/run', authorize('optimization:run'), async (req, res) => {
  try {
    const { algorithm = ALGORITHMS.GREEDY, trigger = 'MANUAL', weightOverrides } = req.body;
    const orgId = req.organizationId;

    const [workOrders, technicians] = await Promise.all([
      WorkOrder.find({ organizationId: orgId, status: { $nin: ['CLOSED', 'VERIFIED', 'RESOLVED'] } }).lean(),
      Technician.find({ organizationId: orgId, isActive: true }).lean(),
    ]);

    const weights       = { ...DEFAULT_WEIGHTS, ...weightOverrides };
    const pinnedCount   = workOrders.filter((w) => PINNED_STATUSES.includes(w.status)).length;
    const unassignedCount = workOrders.filter((w) => !w.assignedTechnicianId && !PINNED_STATUSES.includes(w.status)).length;

    const beforeSlaCompliant = workOrders.filter((w) => {
      if (!w.sla?.resolutionDeadline) return true;
      return new Date(w.sla.resolutionDeadline) > new Date();
    }).length;
    const beforeSlaCompliancePct = workOrders.length > 0
      ? Math.round((beforeSlaCompliant / workOrders.length) * 100)
      : 100;
    const beforeFinancialRisk = workOrders.reduce((s, w) => s + (w.sla?.financialExposure ?? 0), 0);

    // Determine if this algo requires async processing
    const isAsync = (algorithm === ALGORITHMS.SA || algorithm === ALGORITHMS.GA) && optimizationQueue;

    const run = await OptimizationRun.create({
      organizationId: orgId,
      trigger,
      triggeredBy:    req.user._id,
      algorithm,
      status:         isAsync ? 'PENDING' : 'RUNNING',
      inputSnapshot: {
        totalWorkOrders:  workOrders.length,
        totalTechnicians: technicians.length,
        totalVehicles:    0,
        pinnedJobs:       pinnedCount,
        unassignedJobs:   unassignedCount,
        weights,
      },
      before: {
        slaCompliancePct: beforeSlaCompliancePct,
        unassignedCount,
        estimatedCost:    beforeFinancialRisk,
        slaFinancialRisk: beforeFinancialRisk,
        travelKm:         0,
        overtimeHours:    0,
      },
    });

    // ── Async SA/GA via BullMQ ─────────────────────────────────────────────
    if (isAsync) {
      await optimizationQueue.add('solve', {
        runId:     run._id.toString(),
        orgId:     orgId.toString(),
        algorithm,
        weights,
      }, {
        attempts:      3,
        backoff:       { type: 'exponential', delay: 2000 },
        removeOnComplete: 50,
        removeOnFail:     20,
      });

      await OptimizationRun.findByIdAndUpdate(run._id, { status: 'RUNNING' });

      metrics.optimizationRuns.labels(algorithm, 'queued').inc();
      return res.status(202).json({
        success: true,
        runId:   run._id,
        status:  'RUNNING',
        mode:    'async',
        message: `${algorithm} job enqueued. Listen to optimization:progress and optimization:completed Socket.IO events.`,
      });
    }

    // ── Sync Greedy / Hybrid fallback ──────────────────────────────────────
    res.status(202).json({ success: true, runId: run._id, status: 'RUNNING', mode: 'sync' });

    // Run solver after responding (fire-and-forget for responsiveness)
    setImmediate(async () => {
      try {
        let result;
        if (algorithm === ALGORITHMS.SA) {
          result = runSimulatedAnnealing(workOrders, technicians, weights);
        } else if (algorithm === ALGORITHMS.GA) {
          result = runGeneticAlgorithm(workOrders, technicians, weights);
        } else {
          result = greedySolve(workOrders, technicians, weights);
        }

        const afterUnassigned        = result.unassigned;
        const afterSlaCompliancePct  = Math.min(100, beforeSlaCompliancePct + Math.round(result.assigned * 0.3));
        const afterFinancialRisk     = Math.round(beforeFinancialRisk * (afterUnassigned / Math.max(unassignedCount, 1)));

        await OptimizationRun.findByIdAndUpdate(run._id, {
          status:             'COMPLETED',
          runtimeMs:          result.runtimeMs,
          candidateSolutions: result.stats?.candidateSolutions ?? result.assigned,
          assignments:        result.assignments,
          after: {
            slaCompliancePct: afterSlaCompliancePct,
            unassignedCount:  afterUnassigned,
            estimatedCost:    afterFinancialRisk,
            slaFinancialRisk: afterFinancialRisk,
            travelKm:         0,
            overtimeHours:    0,
          },
        });

        metrics.optimizationRuns.labels(algorithm, 'completed').inc();

        req.app.get('io')?.to(`org:${orgId}`).emit('optimization:completed', {
          runId:     run._id,
          algorithm,
          runtimeMs: result.runtimeMs,
          assigned:  result.assigned,
          before:    { slaCompliancePct: beforeSlaCompliancePct, unassignedCount, financialRisk: beforeFinancialRisk },
          after:     { slaCompliancePct: afterSlaCompliancePct, unassignedCount: afterUnassigned, financialRisk: afterFinancialRisk },
          stats:     result.stats,
        });
      } catch (solveErr) {
        logger.error('Optimization solve error:', solveErr);
        await OptimizationRun.findByIdAndUpdate(run._id, { status: 'FAILED', errorMessage: solveErr.message });
        metrics.optimizationRuns.labels(algorithm, 'failed').inc();
      }
    });
  } catch (err) {
    logger.error('Optimization run error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/optimization/runs ─────────────────────────────────────────────────
router.get('/runs', async (req, res) => {
  try {
    const runs = await OptimizationRun.find({
      organizationId: req.organizationId,
      isScenario:     { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('triggeredBy', 'name role')
      .populate('approvedBy',  'name role');
    res.json({ success: true, runs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/optimization/runs/:id ────────────────────────────────────────────
router.get('/runs/:id', async (req, res) => {
  try {
    const run = await OptimizationRun
      .findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate('triggeredBy',             'name role')
      .populate('approvedBy',              'name role')
      .populate('assignments.workOrderId', 'workOrderNumber title severity location')
      .populate('assignments.prevTechnician', 'name employeeId')
      .populate('assignments.newTechnician',  'name employeeId');
    if (!run) return res.status(404).json({ success: false, error: 'Optimization run not found' });
    res.json({ success: true, run });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/optimization/runs/:id/approve ───────────────────────────────────
router.post('/runs/:id/approve', authorize('optimization:approve'), async (req, res) => {
  try {
    const run = await OptimizationRun.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    if (run.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Only completed runs can be approved' });
    }

    const bulk = run.assignments.map((a) => ({
      updateOne: {
        filter: { _id: a.workOrderId, organizationId: req.organizationId },
        update: {
          assignedTechnicianId: a.newTechnician,
          scheduledStart:       a.scheduledStart,
          status:               'ASSIGNED',
          optimizationRunId:    run._id,
          $push: {
            statusHistory: {
              status:    'ASSIGNED',
              changedBy: req.user._id,
              reason:    `Optimization run ${run._id} approved by ${req.user.name}`,
            },
          },
        },
      },
    }));

    await WorkOrder.bulkWrite(bulk);
    await OptimizationRun.findByIdAndUpdate(run._id, {
      status:     'APPROVED',
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    req.app.get('io')?.to(`org:${req.organizationId}`).emit('schedule:updated', {
      runId:           run._id,
      assignmentCount: run.assignments.length,
      approvedBy:      req.user.name,
    });

    res.json({ success: true, message: `${run.assignments.length} assignments applied` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/optimization/runs/:id/reject ────────────────────────────────────
router.post('/runs/:id/reject', authorize('optimization:approve'), async (req, res) => {
  try {
    const { reason = 'Rejected by dispatcher' } = req.body;
    const run = await OptimizationRun.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    if (!['COMPLETED', 'APPROVED'].includes(run.status)) {
      return res.status(400).json({ success: false, error: 'Run cannot be rejected in current state' });
    }

    await OptimizationRun.findByIdAndUpdate(run._id, {
      status:          'REJECTED',
      rejectionReason: reason,
    });

    res.json({ success: true, message: 'Run rejected' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/optimization/queue/status ────────────────────────────────────────
router.get('/queue/status', async (req, res) => {
  try {
    if (!optimizationQueue) {
      return res.json({ success: true, queue: { available: false, message: 'BullMQ queue not connected (Redis unavailable)' } });
    }
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      optimizationQueue.getWaitingCount(),
      optimizationQueue.getActiveCount(),
      optimizationQueue.getCompletedCount(),
      optimizationQueue.getFailedCount(),
      optimizationQueue.getDelayedCount(),
    ]);

    res.json({
      success: true,
      queue: {
        available: true,
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/optimization/compare ─────────────────────────────────────────────
// Compare two optimization runs side by side
router.get('/compare', async (req, res) => {
  try {
    const { run1, run2 } = req.query;
    if (!run1 || !run2) return res.status(400).json({ success: false, error: 'run1 and run2 query params required' });

    const [r1, r2] = await Promise.all([
      OptimizationRun.findOne({ _id: run1, organizationId: req.organizationId }).lean(),
      OptimizationRun.findOne({ _id: run2, organizationId: req.organizationId }).lean(),
    ]);
    if (!r1 || !r2) return res.status(404).json({ success: false, error: 'One or both runs not found' });

    res.json({
      success: true,
      comparison: {
        run1: { id: r1._id, algorithm: r1.algorithm, runtimeMs: r1.runtimeMs, ...r1.after, candidateSolutions: r1.candidateSolutions },
        run2: { id: r2._id, algorithm: r2.algorithm, runtimeMs: r2.runtimeMs, ...r2.after, candidateSolutions: r2.candidateSolutions },
        winner: (r1.after?.slaCompliancePct ?? 0) >= (r2.after?.slaCompliancePct ?? 0) ? 'run1' : 'run2',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

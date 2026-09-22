import express from 'express';
import OptimizationRun from '../models/OptimizationRun.js';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { metrics } from '../config/metrics.js';
import { logger } from '../config/logger.js';
import { ALGORITHMS, PINNED_STATUSES, SEVERITY, DEFAULT_WEIGHTS } from '@crewrescue/shared';

const router = express.Router();
router.use(authenticate);

// ─── Greedy solver (runs synchronously, <1 sec) ────────────────────────────────
function greedySolve(workOrders, technicians, weights) {
  const startMs = Date.now();
  const assignments = [];
  const techLoad = {};
  technicians.forEach(t => { techLoad[t._id.toString()] = 0; });

  const unassigned = workOrders
    .filter(w => !PINNED_STATUSES.includes(w.status) && !w.assignedTechnicianId)
    .sort((a, b) => {
      const sevA = SEVERITY[a.severity]?.priority ?? 1;
      const sevB = SEVERITY[b.severity]?.priority ?? 1;
      return sevB - sevA;
    });

  for (const wo of unassigned) {
    const eligible = technicians.filter(t => {
      if (t.status === 'UNAVAILABLE' || t.status === 'OFFLINE') return false;
      if (wo.requiredSkills?.length > 0) {
        const techSkillIds = t.skills.map(s => s.skillId);
        if (!wo.requiredSkills.every(s => techSkillIds.includes(s))) return false;
      }
      return true;
    });

    if (eligible.length === 0) continue;

    // Pick technician with least load
    const best = eligible.sort((a, b) => (techLoad[a._id.toString()] ?? 0) - (techLoad[b._id.toString()] ?? 0))[0];
    techLoad[best._id.toString()] = (techLoad[best._id.toString()] ?? 0) + (wo.estimatedDurationMin ?? 60);

    assignments.push({
      workOrderId:    wo._id,
      prevTechnician: wo.assignedTechnicianId ?? null,
      newTechnician:  best._id,
      scheduledStart: new Date(),
      reason:         `Greedy: lowest load, skill match`,
    });
  }

  const runtimeMs = Date.now() - startMs;
  const assigned = assignments.length;
  const totalUnassigned = unassigned.length;

  return { assignments, runtimeMs, assigned, unassigned: totalUnassigned - assigned };
}

// ── POST /api/optimization/run ────────────────────────────────────────────────
router.post('/run', authorize('optimization:run'), async (req, res) => {
  try {
    const { algorithm = ALGORITHMS.GREEDY, trigger = 'MANUAL', weightOverrides } = req.body;
    const orgId = req.organizationId;

    // Load operational data
    const [workOrders, technicians] = await Promise.all([
      WorkOrder.find({ organizationId: orgId, status: { $nin: ['CLOSED', 'VERIFIED', 'RESOLVED'] } }).lean(),
      Technician.find({ organizationId: orgId, isActive: true }).lean(),
    ]);

    const weights = { ...DEFAULT_WEIGHTS, ...weightOverrides };
    const pinnedCount = workOrders.filter(w => PINNED_STATUSES.includes(w.status)).length;
    const unassignedCount = workOrders.filter(w => !w.assignedTechnicianId && !PINNED_STATUSES.includes(w.status)).length;

    // Snapshot before
    const beforeSlaCompliant = workOrders.filter(w => {
      if (!w.sla?.resolutionDeadline) return true;
      return new Date(w.sla.resolutionDeadline) > new Date();
    }).length;
    const beforeSlaCompliancePct = workOrders.length > 0 ? Math.round((beforeSlaCompliant / workOrders.length) * 100) : 100;
    const beforeFinancialRisk = workOrders.reduce((s, w) => s + (w.sla?.financialExposure ?? 0), 0);

    // Create run record
    const run = await OptimizationRun.create({
      organizationId: orgId,
      trigger,
      triggeredBy: req.user._id,
      algorithm,
      status: 'RUNNING',
      inputSnapshot: {
        totalWorkOrders: workOrders.length,
        totalTechnicians: technicians.length,
        totalVehicles: 0,
        pinnedJobs: pinnedCount,
        unassignedJobs: unassignedCount,
        weights,
      },
      before: {
        slaCompliancePct: beforeSlaCompliancePct,
        unassignedCount,
        estimatedCost: beforeFinancialRisk,
        slaFinancialRisk: beforeFinancialRisk,
        travelKm: 0,
        overtimeHours: 0,
      },
    });

    // Immediately return run ID for polling
    res.status(202).json({ success: true, runId: run._id, status: 'RUNNING' });

    // Solve (Greedy sync, SA/GA async via queue in Phase 2)
    try {
      const solution = greedySolve(workOrders, technicians, weights);
      const afterUnassigned = unassignedCount - solution.assigned;
      const afterSlaCompliancePct = Math.min(100, beforeSlaCompliancePct + Math.round(solution.assigned * 0.3));
      const afterFinancialRisk = Math.round(beforeFinancialRisk * (afterUnassigned / Math.max(unassignedCount, 1)));

      await OptimizationRun.findByIdAndUpdate(run._id, {
        status: 'COMPLETED',
        runtimeMs: solution.runtimeMs,
        candidateSolutions: solution.assignments.length,
        assignments: solution.assignments,
        after: {
          slaCompliancePct: afterSlaCompliancePct,
          unassignedCount: afterUnassigned,
          estimatedCost: afterFinancialRisk,
          slaFinancialRisk: afterFinancialRisk,
          travelKm: 0,
          overtimeHours: 0,
        },
      });

      metrics.optimizationRuns.labels(algorithm, 'completed').inc();

      // Broadcast result
      req.app.get('io')?.to(`org:${orgId}`).emit('optimization:completed', {
        runId: run._id,
        algorithm,
        runtimeMs: solution.runtimeMs,
        assigned: solution.assigned,
        before: { slaCompliancePct: beforeSlaCompliancePct, unassignedCount, financialRisk: beforeFinancialRisk },
        after: { slaCompliancePct: afterSlaCompliancePct, unassignedCount: afterUnassigned, financialRisk: afterFinancialRisk },
      });
    } catch (solveErr) {
      logger.error('Optimization solve error:', solveErr);
      await OptimizationRun.findByIdAndUpdate(run._id, { status: 'FAILED', errorMessage: solveErr.message });
      metrics.optimizationRuns.labels(algorithm, 'failed').inc();
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/optimization/runs ────────────────────────────────────────────────
router.get('/runs', async (req, res) => {
  try {
    const runs = await OptimizationRun.find({
      organizationId: req.organizationId,
      isScenario: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('triggeredBy', 'name role')
      .populate('approvedBy', 'name role');
    res.json({ success: true, runs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/optimization/runs/:id ───────────────────────────────────────────
router.get('/runs/:id', async (req, res) => {
  try {
    const run = await OptimizationRun.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate('triggeredBy', 'name role')
      .populate('approvedBy', 'name role')
      .populate('assignments.workOrderId', 'workOrderNumber title severity')
      .populate('assignments.prevTechnician', 'name employeeId')
      .populate('assignments.newTechnician', 'name employeeId');
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
    if (run.status !== 'COMPLETED') return res.status(400).json({ success: false, error: 'Only completed runs can be approved' });

    // Apply assignments
    const bulk = run.assignments.map(a => ({
      updateOne: {
        filter: { _id: a.workOrderId, organizationId: req.organizationId },
        update: {
          assignedTechnicianId: a.newTechnician,
          scheduledStart: a.scheduledStart,
          status: 'ASSIGNED',
          optimizationRunId: run._id,
          $push: { statusHistory: { status: 'ASSIGNED', changedBy: req.user._id, reason: `Optimization run ${run._id} approved` } },
        },
      },
    }));

    await WorkOrder.bulkWrite(bulk);

    await OptimizationRun.findByIdAndUpdate(run._id, {
      status: 'APPROVED',
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    req.app.get('io')?.to(`org:${req.organizationId}`).emit('schedule:updated', {
      runId: run._id,
      assignmentCount: run.assignments.length,
      approvedBy: req.user.name,
    });

    res.json({ success: true, message: `${run.assignments.length} assignments applied` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

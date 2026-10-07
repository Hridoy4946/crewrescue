// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — BullMQ Optimization Job Worker
//
// This worker process picks jobs off the 'optimization' BullMQ queue and runs
// the appropriate solver (Greedy, SA, or GA). It updates the OptimizationRun
// record and emits Socket.IO progress + completion events.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { Worker } from 'bullmq';
import { connectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { getIO } from '../socket/index.js';
import OptimizationRun from '../models/OptimizationRun.js';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import { ALGORITHMS, PINNED_STATUSES, DEFAULT_WEIGHTS } from '@crewrescue/shared';
import { runSimulatedAnnealing } from '../solvers/simulatedAnnealing.js';
import { runGeneticAlgorithm } from '../solvers/geneticAlgorithm.js';
import { runGreedySolver as greedySolve } from '../solvers/greedySolver.js';
import { getRedisConfig } from '../config/redis.js';

// Redis connection config
const redisConfig = getRedisConfig();

// ── Job processor ─────────────────────────────────────────────────────────────
async function processOptimizationJob(job) {
  const { runId, orgId, algorithm, weights } = job.data;
  logger.info(`[Worker] Processing optimization job ${job.id} — runId=${runId} algo=${algorithm}`);

  // ── Load operational data ──────────────────────────────────────────────────
  const [workOrders, technicians] = await Promise.all([
    WorkOrder.find({ organizationId: orgId, status: { $nin: ['CLOSED', 'VERIFIED', 'RESOLVED'] } }).lean(),
    Technician.find({ organizationId: orgId, isActive: true }).lean(),
  ]);

  const io      = getIO();
  const orgRoom = `org:${orgId}`;

  // Helper to emit progress
  const emitProgress = (data) => {
    io?.to(orgRoom).emit('optimization:progress', { runId, ...data });
    logger.info(`[Worker] Progress runId=${runId}`, data);
  };

  // ── Run solver ─────────────────────────────────────────────────────────────
  let result;
  const mergedWeights = { ...DEFAULT_WEIGHTS, ...weights };

  if (algorithm === ALGORITHMS.SA) {
    result = runSimulatedAnnealing(workOrders, technicians, mergedWeights, {
      T_start:  100,
      T_min:    0.1,
      alpha:    0.995,
      maxIter:  12000,
    }, emitProgress);
  } else if (algorithm === ALGORITHMS.GA) {
    result = runGeneticAlgorithm(workOrders, technicians, mergedWeights, {
      popSize:      60,
      generations:  200,
      mutationRate: 0.05,
      eliteCount:   2,
      tournamentK:  3,
    }, emitProgress);
  } else {
    // Default to Greedy for HYBRID/unknown
    result = greedySolve(workOrders, technicians, mergedWeights);
  }

  // ── Compute after-metrics ──────────────────────────────────────────────────
  const beforeUnassigned  = workOrders.filter((w) => !w.assignedTechnicianId && !PINNED_STATUSES.includes(w.status)).length;
  const afterUnassigned   = result.unassigned;

  const beforeSlaCompliant = workOrders.filter((w) => {
    if (!w.sla?.resolutionDeadline) return true;
    return new Date(w.sla.resolutionDeadline) > new Date();
  }).length;
  const beforeSlaCompliancePct = workOrders.length > 0
    ? Math.round((beforeSlaCompliant / workOrders.length) * 100)
    : 100;
  const afterSlaCompliancePct  = Math.min(100, beforeSlaCompliancePct + Math.round(result.assigned * 0.3));

  const beforeFinancialRisk = workOrders.reduce((s, w) => s + (w.sla?.financialExposure ?? 0), 0);
  const afterFinancialRisk  = Math.round(beforeFinancialRisk * (afterUnassigned / Math.max(beforeUnassigned, 1)));

  // ── Update run record ──────────────────────────────────────────────────────
  await OptimizationRun.findByIdAndUpdate(runId, {
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
    'inputSnapshot.solverStats': result.stats,
  });

  // ── Broadcast completion ───────────────────────────────────────────────────
  io?.to(orgRoom).emit('optimization:completed', {
    runId,
    algorithm,
    runtimeMs:  result.runtimeMs,
    assigned:   result.assigned,
    before: {
      slaCompliancePct: beforeSlaCompliancePct,
      unassignedCount:  beforeUnassigned,
      financialRisk:    beforeFinancialRisk,
    },
    after: {
      slaCompliancePct: afterSlaCompliancePct,
      unassignedCount:  afterUnassigned,
      financialRisk:    afterFinancialRisk,
    },
    stats: result.stats,
  });

  logger.info(`[Worker] Completed runId=${runId} — assigned=${result.assigned} runtime=${result.runtimeMs}ms`);
  return { assigned: result.assigned, runtimeMs: result.runtimeMs };
}

// ── Bootstrap worker ──────────────────────────────────────────────────────────
async function startWorker() {
  await connectDB();
  logger.info('[Worker] Database connected');

  const worker = new Worker('optimization', processOptimizationJob, {
    connection:  redisConfig,
    concurrency: 2,
  });

  worker.on('completed', (job, result) => {
    logger.info(`[Worker] Job ${job.id} completed: assigned=${result.assigned}`);
  });

  worker.on('failed', async (job, err) => {
    logger.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
    if (job?.data?.runId) {
      await OptimizationRun.findByIdAndUpdate(job.data.runId, {
        status:       'FAILED',
        errorMessage: err.message,
      }).catch(() => {});
      getIO()?.to(`org:${job.data.orgId}`).emit('optimization:failed', {
        runId:   job.data.runId,
        message: err.message,
      });
    }
  });

  worker.on('error', (err) => logger.error('[Worker] Worker error:', err));

  logger.info('[Worker] Optimization worker running, waiting for jobs...');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
  });
}

startWorker().catch((err) => {
  logger.error('[Worker] Fatal startup error:', err);
  process.exit(1);
});

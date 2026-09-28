// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — Simulated Annealing Optimization Solver
//
// Algorithm:  Simulated Annealing (SA)
// Complexity: O(n * iterations) where n = work orders count
// Purpose:    Near-optimal assignment via probabilistic hill-climbing
//
// SA explores the assignment solution space by:
//   1. Starting from the Greedy solution (warm start)
//   2. Randomly perturbing assignments (swap or reassign)
//   3. Accepting worse solutions with probability e^(-ΔCost/T)
//   4. Cooling T by a factor α per iteration until T < T_min
// ─────────────────────────────────────────────────────────────────────────────

import { computeScheduleCost, isEligible } from './costFunction.js';
import { PINNED_STATUSES, SEVERITY } from '@crewrescue/shared';

/**
 * Build an initial greedy schedule (warm start for SA).
 * Returns a Map: workOrderId (string) → technicianId (string)
 */
function buildGreedySchedule(workOrders, technicians, weights) {
  const schedule = new Map();
  const techLoad = {};
  technicians.forEach((t) => { techLoad[t._id.toString()] = 0; });

  const sortedWOs = workOrders
    .filter((w) => !PINNED_STATUSES.includes(w.status))
    .sort((a, b) => {
      const pa = SEVERITY[a.severity]?.priority ?? 1;
      const pb = SEVERITY[b.severity]?.priority ?? 1;
      return pb - pa;
    });

  for (const wo of sortedWOs) {
    const eligible = technicians.filter((t) => isEligible(wo, t));
    if (eligible.length === 0) continue;
    const best = eligible.reduce((prev, cur) =>
      (techLoad[cur._id.toString()] ?? 0) < (techLoad[prev._id.toString()] ?? 0) ? cur : prev
    );
    schedule.set(wo._id.toString(), best._id.toString());
    techLoad[best._id.toString()] = (techLoad[best._id.toString()] ?? 0) + (wo.estimatedDurationMin ?? 60);
  }

  return schedule;
}

/**
 * Generate a neighbour solution by randomly applying one of three mutations:
 *   1. SWAP:      Swap two WOs' technician assignments
 *   2. REASSIGN:  Move one WO to a random eligible technician
 *   3. UNASSIGN:  Remove one WO assignment (forces re-evaluation)
 */
function generateNeighbour(schedule, workOrders, technicians) {
  const neighbour   = new Map(schedule);
  const assignedWOs = workOrders.filter((w) => schedule.has(w._id.toString()));
  if (assignedWOs.length === 0) return neighbour;

  const mutationType = Math.random();

  if (mutationType < 0.5 && assignedWOs.length >= 2) {
    // SWAP: exchange assignments of two random work orders
    const idx1 = Math.floor(Math.random() * assignedWOs.length);
    let idx2 = Math.floor(Math.random() * assignedWOs.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * assignedWOs.length);

    const wo1 = assignedWOs[idx1];
    const wo2 = assignedWOs[idx2];
    const tech1 = schedule.get(wo1._id.toString());
    const tech2 = schedule.get(wo2._id.toString());

    // Only swap if each tech is eligible for the other's WO
    const tech1Obj = technicians.find((t) => t._id.toString() === tech1);
    const tech2Obj = technicians.find((t) => t._id.toString() === tech2);
    if (tech1Obj && tech2Obj && isEligible(wo1, tech2Obj) && isEligible(wo2, tech1Obj)) {
      neighbour.set(wo1._id.toString(), tech2);
      neighbour.set(wo2._id.toString(), tech1);
    }
  } else {
    // REASSIGN: move one random WO to a random eligible technician
    const wo        = assignedWOs[Math.floor(Math.random() * assignedWOs.length)];
    const eligible  = technicians.filter((t) => isEligible(wo, t));
    if (eligible.length > 0) {
      const newTech = eligible[Math.floor(Math.random() * eligible.length)];
      neighbour.set(wo._id.toString(), newTech._id.toString());
    }
  }

  return neighbour;
}

/**
 * Run the Simulated Annealing solver.
 *
 * @param {Object[]} workOrders   - Active (non-pinned) work orders (lean)
 * @param {Object[]} technicians  - Available technicians (lean)
 * @param {Object}   weights      - Cost function weight overrides
 * @param {Object}   options      - SA hyperparameters
 * @param {Function} onProgress   - Callback(iteration, temperature, cost) for streaming updates
 * @returns {Object}              - { schedule, assignments, stats }
 */
export function runSimulatedAnnealing(workOrders, technicians, weights = {}, options = {}, onProgress = null) {
  const {
    T_start     = 100,     // Initial temperature
    T_min       = 0.1,     // Minimum temperature (stopping criterion)
    alpha       = 0.995,   // Cooling rate (0.99 = slow cool, 0.9 = fast cool)
    maxIter     = 15000,   // Hard iteration cap
  } = options;

  const startMs  = Date.now();
  let iterations = 0;
  let accepted   = 0;
  let improved   = 0;

  // Warm start: use greedy schedule
  let current     = buildGreedySchedule(workOrders, technicians, weights);
  let currentCost = computeScheduleCost(current, workOrders, technicians, weights);
  let best        = new Map(current);
  let bestCost    = currentCost;

  let T = T_start;

  while (T > T_min && iterations < maxIter) {
    const neighbour     = generateNeighbour(current, workOrders, technicians);
    const neighbourCost = computeScheduleCost(neighbour, workOrders, technicians, weights);
    const delta         = neighbourCost - currentCost;

    // Accept better solutions always; accept worse solutions with probability e^(-Δ/T)
    if (delta < 0 || Math.random() < Math.exp(-delta / T)) {
      current     = neighbour;
      currentCost = neighbourCost;
      accepted++;

      if (currentCost < bestCost) {
        best     = new Map(current);
        bestCost = currentCost;
        improved++;
      }
    }

    T          *= alpha;
    iterations++;

    // Report progress every 1000 iterations
    if (onProgress && iterations % 1000 === 0) {
      onProgress({
        iteration:   iterations,
        temperature: T,
        currentCost,
        bestCost,
        accepted,
        improved,
        pctComplete: Math.min(100, Math.round((iterations / maxIter) * 100)),
      });
    }
  }

  // Build assignments array from best schedule
  const techMap   = new Map(technicians.map((t) => [t._id.toString(), t]));
  const assignments = [];

  for (const wo of workOrders) {
    if (PINNED_STATUSES.includes(wo.status)) continue;
    const woId   = wo._id.toString();
    const techId = best.get(woId);
    if (!techId) continue;
    const tech = techMap.get(techId);

    assignments.push({
      workOrderId:    wo._id,
      prevTechnician: wo.assignedTechnicianId ?? null,
      newTechnician:  tech._id,
      scheduledStart: new Date(),
      reason:         `SA(T0=${T_start},α=${alpha},${iterations} iters): cost=${bestCost.toFixed(3)}`,
    });
  }

  return {
    schedule:     best,
    assignments,
    runtimeMs:    Date.now() - startMs,
    assigned:     assignments.length,
    unassigned:   workOrders.filter((w) => !PINNED_STATUSES.includes(w.status) && !best.has(w._id.toString())).length,
    stats: {
      iterations,
      finalTemperature: T,
      acceptedMoves:    accepted,
      improvedMoves:    improved,
      initialCost:      currentCost,
      finalCost:        bestCost,
      improvementPct:   currentCost > 0 ? Math.round(((currentCost - bestCost) / currentCost) * 100) : 0,
      candidateSolutions: iterations,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — Greedy Solver
// Shared greedy assignment: assigns unassigned work orders to the least-loaded
// skill-matching technician. Runs synchronously in <50ms for 500+ WOs.
// ─────────────────────────────────────────────────────────────────────────────

import { PINNED_STATUSES, SEVERITY } from '@crewrescue/shared';

/**
 * @param {Array} workOrders  - Mongoose WorkOrder lean documents
 * @param {Array} technicians - Mongoose Technician lean documents
 * @param {Object} _weights   - Cost weights (unused in greedy; accepted for API parity)
 * @returns {{ assignments, runtimeMs, assigned, unassigned, stats }}
 */
export function runGreedySolver(workOrders, technicians, _weights) {
  const startMs  = Date.now();
  const techLoad = {};
  const assignments = [];
  technicians.forEach((t) => { techLoad[t._id.toString()] = 0; });

  const unassigned = workOrders
    .filter((w) => !PINNED_STATUSES.includes(w.status) && !w.assignedTechnicianId)
    .sort((a, b) => (SEVERITY[b.severity]?.priority ?? 1) - (SEVERITY[a.severity]?.priority ?? 1));

  for (const wo of unassigned) {
    const eligible = technicians.filter((t) => {
      if (t.status === 'UNAVAILABLE' || t.status === 'OFFLINE') return false;
      const techSkillIds = t.skills.map((s) => s.skillId);
      return (wo.requiredSkills ?? []).every((s) => techSkillIds.includes(s));
    });
    if (eligible.length === 0) continue;

    const best = eligible.sort(
      (a, b) => (techLoad[a._id.toString()] ?? 0) - (techLoad[b._id.toString()] ?? 0)
    )[0];
    techLoad[best._id.toString()] = (techLoad[best._id.toString()] ?? 0) + (wo.estimatedDurationMin ?? 60);

    assignments.push({
      workOrderId:    wo._id,
      prevTechnician: wo.assignedTechnicianId ?? null,
      newTechnician:  best._id,
      scheduledStart: new Date(),
      reason:         `Greedy: lowest-load skill-matched technician`,
    });
  }

  return {
    assignments,
    runtimeMs:  Date.now() - startMs,
    assigned:   assignments.length,
    unassigned: unassigned.length - assignments.length,
    stats:      { candidateSolutions: assignments.length },
  };
}

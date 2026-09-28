// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — Multi-Objective Cost Function
// Used by Greedy, Simulated Annealing, and Genetic Algorithm solvers
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_WEIGHTS, SEVERITY } from '@crewrescue/shared';

/**
 * Haversine distance in km between two [lng, lat] coordinate pairs
 */
export function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute minutes until SLA resolution deadline (negative = already breached)
 */
function minutesUntilDeadline(workOrder) {
  if (!workOrder.sla?.resolutionDeadline) return 999;
  return (new Date(workOrder.sla.resolutionDeadline) - Date.now()) / 60000;
}

/**
 * Compute the composite cost for a single work-order → technician assignment.
 *
 * @param {Object} workOrder  - Mongoose WorkOrder document (lean)
 * @param {Object} technician - Mongoose Technician document (lean)
 * @param {Object} techLoad   - Map of techId → accumulated scheduled minutes
 * @param {Object} weights    - Optimization weight overrides (merged with defaults)
 * @returns {number}          - Scalar cost (lower = better)
 */
export function computeAssignmentCost(workOrder, technician, techLoad = {}, weights = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const techId = technician._id.toString();

  // ── C_travel: distance from technician's current location to WO site ─────────
  const techLoc   = technician.currentLocation?.coordinates ?? [90.4125, 23.8103];
  const woLoc     = workOrder.location?.coordinates          ?? [90.4125, 23.8103];
  const distKm    = haversineKm(techLoc, woLoc);
  const travelMin = distKm * 2.5; // ~24 km/h city speed → 2.5 min/km
  const C_travel  = travelMin / 60; // normalise to hours

  // ── C_sla: time-sensitivity / breach risk ─────────────────────────────────
  const minsLeft = minutesUntilDeadline(workOrder);
  const C_sla =
    minsLeft < 0
      ? 10 + Math.abs(minsLeft) / 60 // already breached
      : minsLeft < 60
      ? 5
      : minsLeft < 240
      ? 2
      : minsLeft < 480
      ? 1
      : 0;

  // ── C_overtime: load beyond 8h shift ─────────────────────────────────────
  const currentLoad = techLoad[techId] ?? 0;
  const shiftCapMin = 8 * 60; // 480 min standard shift
  const overageMin  = Math.max(0, currentLoad + (workOrder.estimatedDurationMin ?? 60) - shiftCapMin);
  const C_overtime  = overageMin / 60;

  // ── C_criticality: severity / priority multiplier ─────────────────────────
  const sevPriority   = SEVERITY[workOrder.severity]?.priority ?? 1;
  const custPriority  = workOrder.customerPriority ?? 1;
  const C_criticality = 1 / (sevPriority * custPriority); // lower cost for higher priority WOs

  // ── C_detour: skill mismatch penalty (proxy for parts detour) ────────────
  const techSkillIds  = technician.skills?.map((s) => s.skillId) ?? [];
  const missingSkills = (workOrder.requiredSkills ?? []).filter((sk) => !techSkillIds.includes(sk));
  const C_detour      = missingSkills.length > 0 ? 3 * missingSkills.length : 0;

  // ── Composite weighted cost ───────────────────────────────────────────────
  return (
    w.w1_travel            * C_travel      +
    w.w2_sla_penalty       * C_sla         +
    w.w3_overtime          * C_overtime    +
    w.w4_customer_priority * C_criticality +
    w.w6_parts_delay       * C_detour
  );
}

/**
 * Compute the total schedule cost for a full assignment map.
 *
 * @param {Map<string, string>} schedule - Map of workOrderId → technicianId
 * @param {Object[]} workOrders          - All active work orders (lean)
 * @param {Object[]} technicians         - All available technicians (lean)
 * @param {Object}   weights             - Weight overrides
 * @returns {number}                     - Total schedule cost
 */
export function computeScheduleCost(schedule, workOrders, technicians, weights = {}) {
  const w        = { ...DEFAULT_WEIGHTS, ...weights };
  const techMap  = new Map(technicians.map((t) => [t._id.toString(), t]));
  const techLoad = {};
  let total      = 0;

  for (const wo of workOrders) {
    const woId   = wo._id.toString();
    const techId = schedule.get(woId);

    if (!techId) {
      // Penalty for unassigned jobs weighted by severity
      const sevPriority = SEVERITY[wo.severity]?.priority ?? 1;
      total += w.w5_unassigned * (1 + sevPriority * 2);
      continue;
    }

    const tech = techMap.get(techId);
    if (!tech) continue;

    total += computeAssignmentCost(wo, tech, techLoad, weights);
    techLoad[techId] = (techLoad[techId] ?? 0) + (wo.estimatedDurationMin ?? 60);
  }

  return total;
}

/**
 * Check if a technician meets hard constraints for a work order.
 * @returns {boolean}
 */
export function isEligible(workOrder, technician) {
  if (technician.status === 'UNAVAILABLE' || technician.status === 'OFFLINE') return false;
  const techSkillIds = technician.skills?.map((s) => s.skillId) ?? [];
  const required     = workOrder.requiredSkills ?? [];
  return required.every((sk) => techSkillIds.includes(sk));
}

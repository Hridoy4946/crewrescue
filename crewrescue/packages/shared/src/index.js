// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — Shared Constants
// Used by API, optimization worker, and frontend
// ─────────────────────────────────────────────────────────────────────────────

// ── Skills ────────────────────────────────────────────────────────────────────
export const SKILLS = [
  { id: 'ELECTRICAL', label: 'Electrical', color: '#F59E0B' },
  { id: 'HVAC', label: 'HVAC', color: '#06B6D4' },
  { id: 'FIBER_OPTIC', label: 'Fiber Optic', color: '#8B5CF6' },
  { id: 'NETWORKING', label: 'Networking', color: '#3B82F6' },
  { id: 'HIGH_VOLTAGE', label: 'High Voltage', color: '#EF4444' },
  { id: 'GENERATOR', label: 'Generator Repair', color: '#10B981' },
  { id: 'HYDRAULICS', label: 'Hydraulics', color: '#F97316' },
  { id: 'MECHANICAL', label: 'Mechanical', color: '#6B7280' },
  { id: 'WELDING', label: 'Welding', color: '#D97706' },
  { id: 'PLC', label: 'PLC / Automation', color: '#7C3AED' },
  { id: 'SOLAR', label: 'Solar / Inverter', color: '#FBBF24' },
  { id: 'TRANSFORMER', label: 'Transformer', color: '#EC4899' },
  { id: 'TELECOM', label: 'Telecommunications', color: '#14B8A6' },
  { id: 'WATER_SYSTEMS', label: 'Water Systems', color: '#0EA5E9' },
  { id: 'SAFETY_OFFICER', label: 'Safety Officer', color: '#84CC16' },
];

export const SKILL_IDS = SKILLS.map((s) => s.id);

// ── Incident Severity ─────────────────────────────────────────────────────────
export const SEVERITY = {
  CRITICAL: { id: 'CRITICAL', label: 'Critical', color: '#EF4444', priority: 4, slaResponseMin: 30, slaResolutionHr: 4 },
  HIGH:     { id: 'HIGH',     label: 'High',     color: '#F97316', priority: 3, slaResponseMin: 120, slaResolutionHr: 8 },
  MEDIUM:   { id: 'MEDIUM',   label: 'Medium',   color: '#F59E0B', priority: 2, slaResponseMin: 480, slaResolutionHr: 24 },
  LOW:      { id: 'LOW',      label: 'Low',      color: '#6B7280', priority: 1, slaResponseMin: 1440, slaResolutionHr: 72 },
};

// ── Work Order Status ─────────────────────────────────────────────────────────
export const WORK_ORDER_STATUS = [
  'CREATED',
  'TRIAGED',
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'BLOCKED_WAITING_PARTS',
  'RESOLVED',
  'VERIFIED',
  'CLOSED',
];

// Statuses that lock a job from optimizer reshuffling
export const PINNED_STATUSES = ['EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'BLOCKED_WAITING_PARTS'];

// ── Emergency Levels ──────────────────────────────────────────────────────────
export const EMERGENCY_LEVELS = {
  0: { label: 'Normal',   color: '#10B981', description: 'Standard operating conditions' },
  1: { label: 'Elevated', color: '#F59E0B', description: 'Increased incident volume detected' },
  2: { label: 'Major',    color: '#F97316', description: 'Significant operational disruption' },
  3: { label: 'Critical', color: '#EF4444', description: 'Major infrastructure failure' },
  4: { label: 'Disaster', color: '#7C3AED', description: 'Mass casualty / full-region outage' },
};

// ── User Roles ────────────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN:        'SUPER_ADMIN',
  ORG_ADMIN:          'ORG_ADMIN',
  OPERATIONS_DIRECTOR:'OPERATIONS_DIRECTOR',
  EMERGENCY_MANAGER:  'EMERGENCY_MANAGER',
  DISPATCHER:         'DISPATCHER',
  FIELD_SUPERVISOR:   'FIELD_SUPERVISOR',
  TECHNICIAN:         'TECHNICIAN',
  INVENTORY_MANAGER:  'INVENTORY_MANAGER',
  FLEET_MANAGER:      'FLEET_MANAGER',
  AUDITOR:            'AUDITOR',
  EXECUTIVE:          'EXECUTIVE',
};

// Role → allowed actions map
export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]:         ['*'],
  [ROLES.ORG_ADMIN]:           ['org:*', 'users:*', 'incidents:*', 'workorders:*', 'optimization:*', 'emergency:*', 'analytics:read'],
  [ROLES.EMERGENCY_MANAGER]:   ['emergency:declare', 'emergency:resolve', 'optimization:run', 'optimization:approve', 'incidents:*', 'workorders:read'],
  [ROLES.DISPATCHER]:          ['incidents:*', 'workorders:*', 'technicians:read', 'optimization:approve', 'optimization:run', 'emergency:read'],
  [ROLES.FIELD_SUPERVISOR]:    ['workorders:read', 'workorders:update', 'technicians:read', 'incidents:read'],
  [ROLES.TECHNICIAN]:          ['workorders:own', 'incidents:own'],
  [ROLES.INVENTORY_MANAGER]:   ['inventory:*', 'workorders:read'],
  [ROLES.FLEET_MANAGER]:       ['vehicles:*', 'workorders:read'],
  [ROLES.AUDITOR]:             ['audit:read', 'analytics:read', 'incidents:read', 'workorders:read'],
  [ROLES.EXECUTIVE]:           ['analytics:read', 'dashboard:read'],
};

// ── Vehicle Types ─────────────────────────────────────────────────────────────
export const VEHICLE_TYPES = ['VAN', 'TRUCK', 'PICKUP', 'MOTORCYCLE', 'EMERGENCY_UNIT', 'CRANE_TRUCK'];

// ── Asset Categories ──────────────────────────────────────────────────────────
export const ASSET_CATEGORIES = [
  'TRANSFORMER', 'CELL_TOWER', 'ROUTER', 'GENERATOR',
  'PUMP', 'HVAC_UNIT', 'INDUSTRIAL_MACHINE', 'WATER_METER',
  'ELEVATOR', 'SOLAR_INVERTER', 'DISTRIBUTION_LINE', 'SUBSTATION',
];

// ── Incident Categories ───────────────────────────────────────────────────────
export const INCIDENT_CATEGORIES = [
  'POWER_OUTAGE', 'HVAC_FAILURE', 'NETWORK_FAILURE', 'EQUIPMENT_BREAKDOWN',
  'WATER_LEAK', 'TRANSFORMER_FAULT', 'GENERATOR_FAILURE', 'FIBER_CUT',
  'SAFETY_HAZARD', 'FLOOD_DAMAGE', 'STORM_DAMAGE', 'SCHEDULED_MAINTENANCE',
  'CUSTOMER_COMPLAINT', 'INSPECTION', 'INSTALLATION', 'DECOMMISSION',
];

// ── Optimization Algorithm IDs ────────────────────────────────────────────────
export const ALGORITHMS = {
  GREEDY: 'GREEDY',
  SA:     'SIMULATED_ANNEALING',
  GA:     'GENETIC_ALGORITHM',
  HYBRID: 'HYBRID',
};

// ── Default Optimization Weights ─────────────────────────────────────────────
export const DEFAULT_WEIGHTS = {
  w1_travel:          0.20,  // Travel time
  w2_sla_penalty:     0.35,  // SLA financial penalty
  w3_overtime:        0.10,  // Overtime cost
  w4_customer_priority:0.15, // Customer criticality multiplier
  w5_unassigned:      0.15,  // Unassigned job penalty
  w6_parts_delay:     0.05,  // Parts detour penalty
};

// Dhaka metropolitan area bounding box (for seed data)
export const DHAKA_BOUNDS = {
  north: 23.9,
  south: 23.65,
  east:  90.52,
  west:  90.28,
  center: { lat: 23.8103, lng: 90.4125 },
};


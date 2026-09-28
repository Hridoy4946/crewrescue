// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue Field App — Status Transition Logic
// Defines the valid state machine transitions for field technicians
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_COLORS = {
  CREATED:     '#64748B',
  TRIAGED:     '#8B5CF6',
  PENDING:     '#F59E0B',
  ASSIGNED:    '#3B82F6',
  ACCEPTED:    '#06B6D4',
  EN_ROUTE:    '#8B5CF6',
  ARRIVED:     '#F97316',
  IN_PROGRESS: '#F59E0B',
  RESOLVED:    '#22C55E',
  VERIFIED:    '#10B981',
  CLOSED:      '#64748B',
};

export const STATUS_LABELS = {
  CREATED:     'Created',
  TRIAGED:     'Triaged',
  PENDING:     'Pending',
  ASSIGNED:    'Assigned',
  ACCEPTED:    'Accepted',
  EN_ROUTE:    'En Route',
  ARRIVED:     'On Site',
  IN_PROGRESS: 'In Progress',
  RESOLVED:    'Resolved',
  VERIFIED:    'Verified',
  CLOSED:      'Closed',
};

// State machine: from each status, what transitions are allowed for a field tech?
export const FIELD_TRANSITIONS = {
  ASSIGNED:    [{ status: 'ACCEPTED',    label: 'Accept Job',          icon: '✅', color: '#06B6D4', btnClass: 'btn-action', style: { background: '#0E7490' } }],
  ACCEPTED:    [{ status: 'EN_ROUTE',    label: 'I\'m En Route',        icon: '🚗', color: '#8B5CF6', style: { background: '#7C3AED' } },
                { status: 'ASSIGNED',    label: 'Unaccept',             icon: '↩️', color: '#64748B', style: { background: 'var(--bg-elevated)' } }],
  EN_ROUTE:    [{ status: 'ARRIVED',     label: 'I\'ve Arrived',         icon: '📍', color: '#F97316', style: { background: '#C2410C' } }],
  ARRIVED:     [{ status: 'IN_PROGRESS', label: 'Start Work',           icon: '🔧', color: '#F59E0B', style: { background: '#B45309' } }],
  IN_PROGRESS: [{ status: 'RESOLVED',    label: 'Mark Resolved',        icon: '🎉', color: '#22C55E', style: { background: '#15803D' } }],
  RESOLVED:    [], // Dispatcher verifies
  VERIFIED:    [], // Done
  CLOSED:      [],
};

export function getNextTransitions(currentStatus) {
  return FIELD_TRANSITIONS[currentStatus] ?? [];
}

export function getSeverityBadgeClass(severity) {
  return `severity-badge severity-${severity}`;
}

export function formatSLARemaining(deadline) {
  if (!deadline) return null;
  const ms  = new Date(deadline) - Date.now();
  if (ms <= 0) return { text: 'BREACHED', critical: true };
  const h   = Math.floor(ms / 3_600_000);
  const m   = Math.floor((ms % 3_600_000) / 60_000);
  const critical = ms < 60 * 60 * 1000; // less than 1 hour
  return { text: h > 0 ? `${h}h ${m}m` : `${m}m`, critical };
}

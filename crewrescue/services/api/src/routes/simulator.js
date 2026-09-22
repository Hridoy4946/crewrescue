import express from 'express';
import WorkOrder from '../models/WorkOrder.js';
import Technician from '../models/Technician.js';
import Depot from '../models/Depot.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { SEVERITY, INCIDENT_CATEGORIES, SKILL_IDS, DHAKA_BOUNDS } from '@crewrescue/shared';

const router = express.Router();
router.use(authenticate);

// Helper: random point in Dhaka
function randomDhakaPoint() {
  const lat = DHAKA_BOUNDS.south + Math.random() * (DHAKA_BOUNDS.north - DHAKA_BOUNDS.south);
  const lng = DHAKA_BOUNDS.west  + Math.random() * (DHAKA_BOUNDS.east  - DHAKA_BOUNDS.west);
  return { lat, lng };
}

// POST /api/simulator/storm — inject storm scenario
router.post('/storm', authorize('emergency:declare'), async (req, res) => {
  try {
    const orgId = req.organizationId;
    const {
      newIncidents = 85,
      disableTechnicians = 15,
      closeDepots = 2,
    } = req.body;

    const results = { created: 0, techniciansDisabled: 0, depotsClosed: 0 };

    // 1. Create emergency incidents
    const incidentCount = await WorkOrder.countDocuments({ organizationId: orgId });
    const severities = ['CRITICAL', 'CRITICAL', 'HIGH', 'HIGH', 'MEDIUM'];
    const categories = ['STORM_DAMAGE', 'POWER_OUTAGE', 'FLOOD_DAMAGE', 'EQUIPMENT_BREAKDOWN', 'TRANSFORMER_FAULT'];
    const workOrders = [];

    for (let i = 0; i < newIncidents; i++) {
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const sev = SEVERITY[severity];
      const { lat, lng } = randomDhakaPoint();
      const now = new Date();

      workOrders.push({
        organizationId: orgId,
        workOrderNumber: `WO-${String(incidentCount + i + 1).padStart(5, '0')}`,
        title: `[STORM] ${category.replace(/_/g,' ')} - Emergency Response`,
        description: 'Storm-related emergency incident requiring immediate dispatch.',
        category,
        severity,
        type: 'EMERGENCY',
        isEmergency: true,
        status: 'CREATED',
        location: { type: 'Point', coordinates: [lng, lat], area: 'Dhaka Metropolitan' },
        requiredSkills: [SKILL_IDS[Math.floor(Math.random() * SKILL_IDS.length)]],
        estimatedDurationMin: 60 + Math.floor(Math.random() * 120),
        sla: {
          responseDeadline: new Date(now.getTime() + sev.slaResponseMin * 60_000),
          resolutionDeadline: new Date(now.getTime() + sev.slaResolutionHr * 3_600_000),
          financialExposure: severity === 'CRITICAL' ? 5000 + Math.floor(Math.random() * 5000) : 500 + Math.floor(Math.random() * 1500),
        },
        customerPriority: severity === 'CRITICAL' ? 5 : severity === 'HIGH' ? 4 : 2,
      });
    }

    await WorkOrder.insertMany(workOrders);
    results.created = workOrders.length;

    // 2. Mark random technicians as unavailable
    const availableTechs = await Technician.find({ organizationId: orgId, status: 'AVAILABLE', isActive: true })
      .select('_id').limit(disableTechnicians * 2);
    const toDisable = availableTechs.slice(0, disableTechnicians).map(t => t._id);
    if (toDisable.length > 0) {
      await Technician.updateMany(
        { _id: { $in: toDisable } },
        { status: 'UNAVAILABLE', 'availability.unavailableReason': 'INCIDENT', 'availability.unavailableUntil': new Date(Date.now() + 8 * 3_600_000) }
      );
      results.techniciansDisabled = toDisable.length;
    }

    // 3. Close random depots
    const activeDepots = await Depot.find({ organizationId: orgId, status: 'OPERATIONAL', isActive: true })
      .select('_id').limit(closeDepots * 2);
    const toClose = activeDepots.slice(0, closeDepots).map(d => d._id);
    if (toClose.length > 0) {
      await Depot.updateMany({ _id: { $in: toClose } }, { status: 'CLOSED' });
      results.depotsClosed = toClose.length;
    }

    // Broadcast storm event
    req.app.get('io')?.to(`org:${orgId}`).emit('simulator:storm_injected', {
      results,
      message: `Storm scenario injected: ${results.created} incidents, ${results.techniciansDisabled} techs unavailable, ${results.depotsClosed} depots closed`,
    });

    res.json({ success: true, scenario: 'STORM', results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/simulator/reset — restore technicians and depots
router.post('/reset', authorize('emergency:declare'), async (req, res) => {
  try {
    const orgId = req.organizationId;
    await Promise.all([
      Technician.updateMany(
        { organizationId: orgId, status: 'UNAVAILABLE', 'availability.unavailableReason': 'INCIDENT' },
        { status: 'AVAILABLE', 'availability.unavailableReason': null, 'availability.unavailableUntil': null }
      ),
      Depot.updateMany({ organizationId: orgId, status: 'CLOSED' }, { status: 'OPERATIONAL' }),
      // Remove emergency work orders
      WorkOrder.deleteMany({ organizationId: orgId, isEmergency: true, status: 'CREATED' }),
    ]);
    res.json({ success: true, message: 'Simulator state reset' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

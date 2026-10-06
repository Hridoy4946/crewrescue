import express from 'express';
import Technician from '../models/Technician.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();
router.use(authenticate);

// GET /api/technicians
router.get('/', async (req, res) => {
  try {
    const { status, skill, territory, page = 1, limit = 50 } = req.query;
    const query = { organizationId: req.organizationId, isActive: true };
    if (status) query.status = status;
    if (territory) query.territory = territory;
    if (skill) query['skills.skillId'] = skill;

    const [technicians, total] = await Promise.all([
      Technician.find(query)
        .populate('depotId', 'name code location')
        .populate('vehicleId', 'plateNumber type status')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Technician.countDocuments(query),
    ]);

    res.json({ success: true, technicians, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/technicians/map — all technicians with location (for map render)
router.get('/map', async (req, res) => {
  try {
    const technicians = await Technician.find({
      organizationId: req.organizationId,
      isActive: true,
      'currentLocation.coordinates': { $exists: true, $ne: [] },
    }).select('name employeeId status currentLocation skills territory lastLocationUpdate');

    res.json({ success: true, technicians });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/technicians/:id
router.get('/:id', async (req, res) => {
  try {
    const tech = await Technician.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate('depotId', 'name code location address')
      .populate('vehicleId', 'plateNumber type status fuel');
    if (!tech) return res.status(404).json({ success: false, error: 'Technician not found' });
    res.json({ success: true, technician: tech });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/technicians/me/location — called by PWA every 30s
router.post('/me/location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ success: false, error: 'lat and lng required' });

    let techId = req.user.technicianId;
    if (!techId) {
      const tech = await Technician.findOne({ organizationId: req.organizationId, email: req.user.email });
      if (tech) techId = tech._id;
    }

    if (!techId) {
      return res.json({ success: true, note: 'User not mapped to technician' });
    }

    const tech = await Technician.findOneAndUpdate(
      { _id: techId, organizationId: req.organizationId },
      {
        currentLocation: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        lastLocationUpdate: new Date(),
      },
      { new: true }
    ).select('name status currentLocation lastLocationUpdate');

    if (!tech) return res.status(404).json({ success: false, error: 'Technician not found' });

    // Broadcast via socket
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('technician:location_updated', {
      technicianId: tech._id,
      name: tech.name,
      status: tech.status,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      at: tech.lastLocationUpdate,
    });

    res.json({ success: true, tech });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/technicians/:id/location — called by PWA every 30s
router.patch('/:id/location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'lat and lng required' });

    const tech = await Technician.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      {
        currentLocation: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        lastLocationUpdate: new Date(),
      },
      { new: true }
    ).select('name status currentLocation lastLocationUpdate');

    if (!tech) return res.status(404).json({ success: false, error: 'Technician not found' });

    // Broadcast via socket
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('technician:location_updated', {
      technicianId: tech._id,
      name: tech.name,
      status: tech.status,
      location: { lat, lng },
      at: tech.lastLocationUpdate,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/technicians/:id/status
router.patch('/:id/status', authorize('technicians:read'), async (req, res) => {
  try {
    const { status, unavailableUntil, unavailableReason } = req.body;
    const update = { status };
    if (unavailableUntil) update['availability.unavailableUntil'] = new Date(unavailableUntil);
    if (unavailableReason) update['availability.unavailableReason'] = unavailableReason;

    const tech = await Technician.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      update,
      { new: true }
    );
    if (!tech) return res.status(404).json({ success: false, error: 'Technician not found' });

    req.app.get('io')?.to(`org:${req.organizationId}`).emit('technician:status_changed', {
      technicianId: tech._id,
      status: tech.status,
    });

    res.json({ success: true, technician: tech });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

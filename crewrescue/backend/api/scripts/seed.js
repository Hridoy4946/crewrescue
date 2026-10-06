#!/usr/bin/env node
/**
 * CrewRescue AI — Database Seeder
 * Generates: 1 org, 2 users, 100 technicians, 35 vehicles, 8 depots, 300 assets, 500 work orders
 * Run: npm run seed --workspace=backend/api
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Organization from '../src/models/Organization.js';
import User from '../src/models/User.js';
import Technician from '../src/models/Technician.js';
import Vehicle from '../src/models/Vehicle.js';
import Depot from '../src/models/Depot.js';
import Asset from '../src/models/Asset.js';
import WorkOrder from '../src/models/WorkOrder.js';
import { SKILL_IDS, VEHICLE_TYPES, ASSET_CATEGORIES, INCIDENT_CATEGORIES, SEVERITY, ROLES, DHAKA_BOUNDS } from '@crewrescue/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);

function randomDhakaPoint(spreadKm = 15) {
  const kmPerDeg = 111;
  const dlat = (Math.random() - 0.5) * 2 * (spreadKm / kmPerDeg);
  const dlng = (Math.random() - 0.5) * 2 * (spreadKm / (kmPerDeg * Math.cos(DHAKA_BOUNDS.center.lat * Math.PI / 180)));
  return {
    lat: Math.min(DHAKA_BOUNDS.north, Math.max(DHAKA_BOUNDS.south, DHAKA_BOUNDS.center.lat + dlat)),
    lng: Math.min(DHAKA_BOUNDS.east,  Math.max(DHAKA_BOUNDS.west,  DHAKA_BOUNDS.center.lng + dlng)),
  };
}

// Realistic Dhaka areas
const DHAKA_AREAS = [
  'Motijheel', 'Gulshan', 'Banani', 'Mirpur', 'Dhanmondi', 'Uttara',
  'Rampura', 'Badda', 'Mohakhali', 'Tejgaon', 'Paltan', 'Wari',
  'Demra', 'Khilgaon', 'Shyampur', 'Mohammadpur', 'Lalbagh', 'Kamrangirchar',
];

const TECHNICIAN_NAMES = [
  'Rahim Uddin', 'Karim Ahmed', 'Jamal Hossain', 'Arif Khan', 'Sabbir Islam',
  'Noman Ali', 'Rafiq Miah', 'Selim Reza', 'Masum Billah', 'Zahir Chowdhury',
  'Imran Sharif', 'Faisal Rahman', 'Nasir Uddin', 'Milon Haque', 'Rubel Sheikh',
  'Shahin Akter', 'Polash Mondal', 'Ripon Das', 'Babul Mia', 'Limon Khan',
  'Abir Hossain', 'Tanvir Ahmed', 'Shakil Islam', 'Mehedi Hassan', 'Touhid Alam',
  'Sumon Sarker', 'Raju Talukder', 'Maruf Sikder', 'Shahed Karim', 'Opu Barua',
  'Rony Paul', 'Tushar Ghosh', 'Emon Saha', 'Niloy Roy', 'Partho Sen',
  'Biswajit Dey', 'Dipak Bose', 'Hasan Reza', 'Wahid Mollah', 'Monir Hossain',
  'Akash Mia', 'Badal Sheikh', 'Chanchal Roy', 'Dipu Sarkar', 'Emon Khan',
  'Faruk Ahmed', 'Gias Uddin', 'Helal Mia', 'Iqbal Hossain', 'Jewel Rana',
  'Kabir Hossain', 'Liton Mia', 'Mamun Rashid', 'Naim Islam', 'Omar Faruq',
  'Palash Dey', 'Quamrul Islam', 'Ratan Barua', 'Sadek Ali', 'Tariqul Islam',
  'Ujjal Sen', 'Vashkar Das', 'Wahab Mia', 'Xavier Costa', 'Yeamin Khan',
  'Zakir Hossain', 'Arman Hasan', 'Bulbul Ahmed', 'Chayan Roy', 'Delwar Mia',
  'Ekram Ali', 'Farhan Islam', 'Golam Sarwar', 'Himu Barua', 'Iqbal Ahmed',
  'Jahangir Alam', 'Kamal Hossain', 'Lal Mia', 'Mithu Sheikh', 'Nayem Islam',
  'Omor Ali', 'Pappu Roy', 'Qader Mia', 'Rasel Mia', 'Saiful Islam',
  'Tarek Ahmed', 'Ujjwal Dey', 'Viral Singh', 'Waliur Rahman', 'Xelil Mia',
  'Yusuf Ali', 'Zafar Ahmed', 'Ashraf Ali', 'Babu Mia', 'Chand Mia',
  'Dablu Ahmed', 'Elias Khan', 'Feroz Mia', 'Habib Ullah', 'Ismail Mia',
];

const DEPOT_DATA = [
  { name: 'Central Depot Motijheel', code: 'D-MOT', area: 'Motijheel',    lat: 23.7333, lng: 90.4175 },
  { name: 'Gulshan Operations Hub',  code: 'D-GUL', area: 'Gulshan',      lat: 23.7808, lng: 90.4149 },
  { name: 'Mirpur Service Center',   code: 'D-MIR', area: 'Mirpur',       lat: 23.8041, lng: 90.3590 },
  { name: 'Uttara North Depot',      code: 'D-UTT', area: 'Uttara',       lat: 23.8759, lng: 90.3795 },
  { name: 'Demra Industrial Hub',    code: 'D-DEM', area: 'Demra',        lat: 23.7100, lng: 90.4800 },
  { name: 'Dhanmondi Field Base',    code: 'D-DHA', area: 'Dhanmondi',    lat: 23.7461, lng: 90.3742 },
  { name: 'Tejgaon Emergency Center',code: 'D-TEJ', area: 'Tejgaon',      lat: 23.7608, lng: 90.3994 },
  { name: 'Badda East Depot',        code: 'D-BAD', area: 'Badda',        lat: 23.7798, lng: 90.4388 },
];

const WORK_ORDER_TITLES = [
  'Transformer fault at distribution substation',
  'Complete power outage reported by customer',
  'HVAC system failure — server room overheating',
  'Fiber optic cable cut — service disruption',
  'Generator startup failure at data center',
  'Water pump breakdown — residential complex',
  'High voltage line maintenance required',
  'Network equipment replacement at cell tower',
  'Solar inverter fault — rooftop installation',
  'Scheduled annual transformer inspection',
  'Emergency: Electrical fire risk — immediate response',
  'PLC controller malfunction — industrial unit',
  'Cable splice required — underground fiber',
  'HVAC compressor replacement needed',
  'Meter reading and verification — bulk customers',
  'Emergency generator fuel system fault',
  'Distribution board fault — commercial building',
  'Elevator control system failure',
  'Scheduled preventive maintenance — substation',
  'Customer complaint — intermittent power fluctuation',
];

// ─── Main seeder ──────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱 CrewRescue AI — Database Seeder Starting...\n');
  await connectDB();

  // ── Wipe existing data ─────────────────────────────────────────────────────
  console.log('🗑  Clearing existing data...');
  await Promise.all([
    Organization.deleteMany({}),
    User.deleteMany({}),
    Technician.deleteMany({}),
    Vehicle.deleteMany({}),
    Depot.deleteMany({}),
    Asset.deleteMany({}),
    WorkOrder.deleteMany({}),
  ]);

  // ── Organization ───────────────────────────────────────────────────────────
  console.log('🏢 Creating organization...');
  const org = await Organization.create({
    name: process.env.SEED_ORG_NAME ?? 'DhakaPower Utilities',
    slug: 'dhakapower',
    industry: 'POWER_UTILITY',
    contactEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@dhakapower.bd',
    contactPhone: '+880-2-9876543',
    address: { street: '1 Power House Road', city: 'Dhaka', country: 'Bangladesh' },
  });
  console.log(`   ✅ Org: ${org.name} (${org._id})`);

  // ── Users ─────────────────────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const adminUser = await User.create({
    organizationId: org._id,
    name: 'Rahman Al-Rashid',
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@dhakapower.bd',
    passwordHash: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@CrewRescue2025',
    role: ROLES.ORG_ADMIN,
  });

  const dispatcherUser = await User.create({
    organizationId: org._id,
    name: 'Nadia Chowdhury',
    email: 'dispatcher@dhakapower.bd',
    passwordHash: 'Dispatch@2025',
    role: ROLES.DISPATCHER,
  });
  console.log(`   ✅ Admin: ${adminUser.email}`);
  console.log(`   ✅ Dispatcher: ${dispatcherUser.email}`);

  // ── Depots ────────────────────────────────────────────────────────────────
  console.log('🏭 Creating depots...');
  const depots = await Depot.insertMany(DEPOT_DATA.map((d) => ({
    organizationId: org._id,
    name: d.name,
    code: d.code,
    address: { area: d.area, city: 'Dhaka', country: 'Bangladesh' },
    location: { type: 'Point', coordinates: [d.lng, d.lat] },
    territory: d.area,
    status: 'OPERATIONAL',
    is24h: d.code === 'D-TEJ',
  })));
  console.log(`   ✅ ${depots.length} depots created`);

  // ── Vehicles ──────────────────────────────────────────────────────────────
  console.log('🚐 Creating vehicles...');
  const vehicleTypes = ['VAN', 'VAN', 'TRUCK', 'PICKUP', 'PICKUP', 'MOTORCYCLE', 'EMERGENCY_UNIT'];
  const vehicles = [];
  for (let i = 0; i < 35; i++) {
    const depot = depots[i % depots.length];
    const pt = randomDhakaPoint(8);
    const type = vehicleTypes[i % vehicleTypes.length];
    vehicles.push({
      organizationId: org._id,
      plateNumber: `DHA-${String(1001 + i).padStart(4, '0')}`,
      type,
      make: pick(['Toyota', 'Mitsubishi', 'Isuzu', 'Tata', 'Honda']),
      model: type === 'MOTORCYCLE' ? 'CB150' : type === 'TRUCK' ? 'Canter' : 'Hilux',
      year: rand(2018, 2024),
      capacity: type === 'MOTORCYCLE' ? 50 : type === 'VAN' ? 500 : 1000,
      currentLocation: { type: 'Point', coordinates: [pt.lng, pt.lat] },
      depotId: depot._id,
      status: Math.random() > 0.15 ? 'AVAILABLE' : 'IN_USE',
      fuel: { type: type === 'MOTORCYCLE' ? 'PETROL' : 'DIESEL', levelPct: rand(40, 100) },
      specialEquipment: pick([
        [], ['ladder'], ['hydraulic_lift'], ['cable_drum'], ['generator_set'], ['fiber_tools'],
      ]),
    });
  }
  const savedVehicles = await Vehicle.insertMany(vehicles);
  console.log(`   ✅ ${savedVehicles.length} vehicles created`);

  // ── Technicians ───────────────────────────────────────────────────────────
  console.log('👷 Creating 100 technicians...');
  const technicians = [];
  for (let i = 0; i < 100; i++) {
    const depot = depots[i % depots.length];
    const vehicle = savedVehicles[i % savedVehicles.length];
    const pt = randomDhakaPoint(12);
    const skillCount = rand(3, 6);
    const skills = pickN(SKILL_IDS, skillCount).map((skillId) => ({
      skillId,
      level: pick(['JUNIOR', 'MID', 'MID', 'SENIOR', 'EXPERT']),
      certified: Math.random() > 0.3,
      yearsExp: rand(1, 15),
    }));

    const statusOptions = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BUSY', 'EN_ROUTE', 'ON_SITE', 'OFFLINE'];
    const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];

    technicians.push({
      organizationId: org._id,
      employeeId: `EMP-${String(1001 + i).padStart(4, '0')}`,
      name: TECHNICIAN_NAMES[i] ?? `Technician ${i + 1}`,
      email: `tech${i + 1}@dhakapower.bd`,
      phone: `+880-1${rand(100000000, 999999999)}`,
      skills,
      territory: pick(DHAKA_AREAS),
      depotId: depot._id,
      vehicleId: vehicle._id,
      currentLocation: { type: 'Point', coordinates: [pt.lng, pt.lat] },
      lastLocationUpdate: new Date(Date.now() - rand(0, 1800000)),
      status,
      availability: {
        shiftStart: pick(['06:00', '07:00', '08:00', '09:00']),
        shiftEnd:   pick(['16:00', '17:00', '18:00', '20:00']),
        onCall:     Math.random() > 0.7,
        unavailableUntil: status === 'OFFLINE' ? new Date(Date.now() + rand(1, 4) * 3_600_000) : null,
        unavailableReason: status === 'OFFLINE' ? pick(['SICK', 'TRAINING']) : null,
      },
      performance: {
        firstTimeFixRate: rand(70, 98) / 100,
        avgJobDurationMin: rand(45, 180),
        jobsCompleted: rand(50, 500),
        slaCompliance: rand(85, 100) / 100,
        rating: (rand(35, 50) / 10),
      },
    });
  }
  const savedTechs = await Technician.insertMany(technicians);
  console.log(`   ✅ ${savedTechs.length} technicians created`);

  // ── Additional Operational Role Users ─────────────────────────────────────
  console.log('👥 Creating operational role accounts...');
  await User.insertMany([
    {
      organizationId: org._id,
      name: 'Kamal Hossain',
      email: 'emergency@dhakapower.bd',
      passwordHash: 'Emergency@2025',
      role: ROLES.EMERGENCY_MANAGER,
    },
    {
      organizationId: org._id,
      name: 'Tariqul Islam',
      email: 'supervisor@dhakapower.bd',
      passwordHash: 'Supervisor@2025',
      role: ROLES.FIELD_SUPERVISOR,
    },
    {
      organizationId: org._id,
      name: 'Nusrat Jahan',
      email: 'executive@dhakapower.bd',
      passwordHash: 'Executive@2025',
      role: ROLES.EXECUTIVE,
    },
    {
      organizationId: org._id,
      name: savedTechs[0].name,
      email: 'tech1@dhakapower.bd',
      passwordHash: 'Tech@2025',
      role: ROLES.TECHNICIAN,
      technicianId: savedTechs[0]._id,
    },
    {
      organizationId: org._id,
      name: savedTechs[1].name,
      email: 'tech2@dhakapower.bd',
      passwordHash: 'Tech@2025',
      role: ROLES.TECHNICIAN,
      technicianId: savedTechs[1]._id,
    },
  ]);
  console.log('   ✅ Role accounts created: Emergency Manager, Field Supervisor, Executive, Technicians');

  // ── Assets ────────────────────────────────────────────────────────────────
  console.log('⚡ Creating 300 assets...');
  const assets = [];
  const REQUIRED_SKILLS_MAP = {
    TRANSFORMER:       ['TRANSFORMER', 'ELECTRICAL', 'HIGH_VOLTAGE'],
    CELL_TOWER:        ['TELECOM', 'ELECTRICAL'],
    HVAC_UNIT:         ['HVAC', 'ELECTRICAL'],
    GENERATOR:         ['GENERATOR', 'ELECTRICAL'],
    ROUTER:            ['NETWORKING', 'TELECOM'],
    PUMP:              ['WATER_SYSTEMS', 'MECHANICAL'],
    SOLAR_INVERTER:    ['SOLAR', 'ELECTRICAL'],
    DISTRIBUTION_LINE: ['ELECTRICAL', 'HIGH_VOLTAGE'],
    SUBSTATION:        ['ELECTRICAL', 'HIGH_VOLTAGE', 'TRANSFORMER'],
  };

  for (let i = 0; i < 300; i++) {
    const category = pick(ASSET_CATEGORIES);
    const area = pick(DHAKA_AREAS);
    const pt = randomDhakaPoint(12);
    const criticalityOpts = ['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'CRITICAL'];

    assets.push({
      organizationId: org._id,
      assetId: `ASSET-${String(1001 + i).padStart(5, '0')}`,
      name: `${area} ${category.replace(/_/g,' ')} ${String(i + 1).padStart(3, '0')}`,
      category,
      serialNumber: `SN-${rand(100000, 999999)}`,
      manufacturer: pick(['Siemens', 'ABB', 'Schneider', 'GE', 'Fuji', 'Mitsubishi', 'Local OEM']),
      installDate: new Date(Date.now() - rand(180, 3650) * 86_400_000),
      location: {
        type: 'Point',
        coordinates: [pt.lng, pt.lat],
        address: `${rand(1, 200)} ${pick(['Road', 'Avenue', 'Lane', 'Street'])}, ${area}`,
        area,
      },
      condition: pick(['EXCELLENT', 'GOOD', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']),
      criticality: criticalityOpts[Math.floor(Math.random() * criticalityOpts.length)],
      requiredSkills: REQUIRED_SKILLS_MAP[category] ?? ['ELECTRICAL'],
      failureProbability: Math.random() * 0.4,
      lastInspection: new Date(Date.now() - rand(7, 180) * 86_400_000),
    });
  }
  const savedAssets = await Asset.insertMany(assets);
  console.log(`   ✅ ${savedAssets.length} assets created`);

  // ── Work Orders ───────────────────────────────────────────────────────────
  console.log('📋 Creating 500 work orders...');
  const workOrders = [];
  const woStatuses = [
    'CREATED', 'TRIAGED', 'PENDING_ASSIGNMENT', 'PENDING_ASSIGNMENT',
    'ASSIGNED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS',
    'RESOLVED', 'CLOSED',
  ];
  const sevKeys = ['CRITICAL', 'HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'LOW'];
  const woCount = await WorkOrder.countDocuments({ organizationId: org._id });

  for (let i = 0; i < 500; i++) {
    const severity = sevKeys[Math.floor(Math.random() * sevKeys.length)];
    const sev = SEVERITY[severity];
    const status = pick(woStatuses);
    const asset = savedAssets[i % savedAssets.length];
    const tech = Math.random() > 0.15 ? savedTechs[rand(0, savedTechs.length - 1)] : null;
    const createdAt = new Date(Date.now() - rand(0, 7) * 86_400_000 - rand(0, 86_400_000));
    const now = new Date();

    const responseDeadline = new Date(createdAt.getTime() + sev.slaResponseMin * 60_000);
    const resolutionDeadline = new Date(createdAt.getTime() + sev.slaResolutionHr * 3_600_000);
    const isBreached = resolutionDeadline < now && !['RESOLVED','CLOSED'].includes(status);

    workOrders.push({
      organizationId: org._id,
      workOrderNumber: `WO-${String(woCount + i + 1).padStart(5, '0')}`,
      title: WORK_ORDER_TITLES[i % WORK_ORDER_TITLES.length],
      description: `${pick(['Urgent', 'Routine', 'Scheduled', 'Emergency'])} maintenance request from ${pick(DHAKA_AREAS)} area. Customer reported ${pick(['complete failure', 'intermittent issues', 'reduced performance', 'safety concern'])}.`,
      category: pick(INCIDENT_CATEGORIES),
      severity,
      type: severity === 'CRITICAL' ? pick(['EMERGENCY', 'BREAK_FIX']) : pick(['BREAK_FIX', 'SCHEDULED', 'INSPECTION']),
      isEmergency: severity === 'CRITICAL' && Math.random() > 0.5,
      assetId: asset._id,
      assignedTechnicianId: ['ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','RESOLVED','CLOSED'].includes(status) && tech ? tech._id : null,
      location: asset.location,
      status,
      isPinned: ['EN_ROUTE','ARRIVED','IN_PROGRESS'].includes(status),
      requiredSkills: asset.requiredSkills ?? ['ELECTRICAL'],
      requiredParts: Math.random() > 0.6 ? [{ partName: pick(['transformer_relay','fiber_cable','compressor','circuit_breaker','voltage_regulator']), quantity: 1 }] : [],
      estimatedDurationMin: rand(30, 240),
      scheduledStart: status !== 'CREATED' ? new Date(createdAt.getTime() + rand(30, 120) * 60_000) : undefined,
      actualStart: ['ARRIVED','IN_PROGRESS','RESOLVED','CLOSED'].includes(status) ? new Date(createdAt.getTime() + rand(60, 180) * 60_000) : undefined,
      actualEnd: ['RESOLVED','CLOSED'].includes(status) ? new Date(createdAt.getTime() + rand(120, 480) * 60_000) : undefined,
      sla: {
        responseDeadline,
        resolutionDeadline,
        responseBreached: responseDeadline < now && !['RESOLVED','CLOSED'].includes(status),
        resolutionBreached: isBreached,
        financialExposure: severity === 'CRITICAL' ? rand(3000, 10000) : severity === 'HIGH' ? rand(500, 3000) : rand(100, 500),
      },
      customerPriority: severity === 'CRITICAL' ? 5 : severity === 'HIGH' ? 4 : rand(1, 3),
      estimatedCost: rand(500, 15000),
      createdAt,
      updatedAt: createdAt,
    });
  }
  await WorkOrder.insertMany(workOrders);
  console.log(`   ✅ 500 work orders created`);

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ SEED COMPLETE');
  console.log('═══════════════════════════════════════════════');
  console.log(`Organization : ${org.name}`);
  console.log(`Admin Login  : ${adminUser.email}`);
  console.log(`Password     : ${process.env.SEED_ADMIN_PASSWORD ?? 'Admin@CrewRescue2025'}`);
  console.log(`Dispatcher   : dispatcher@dhakapower.bd`);
  console.log(`Dispatcher PW: Dispatch@2025`);
  console.log('───────────────────────────────────────────────');
  console.log(`Technicians  : 100`);
  console.log(`Vehicles     : 35`);
  console.log(`Depots       : 8`);
  console.log(`Assets       : 300`);
  console.log(`Work Orders  : 500`);
  console.log('═══════════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

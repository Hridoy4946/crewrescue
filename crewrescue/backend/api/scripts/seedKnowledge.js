#!/usr/bin/env node
/**
 * CrewRescue AI — Knowledge Base Seeder
 * Seeds 15 equipment manual sections for the RAG Copilot
 * Run: node scripts/seedKnowledge.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import KnowledgeDoc from '../src/models/KnowledgeDoc.js';

const KNOWLEDGE_DOCS = [
  // ── Transformer ────────────────────────────────────────────────────────────
  {
    title:    'ABB Transformer T400 — Fault Isolation Procedure',
    source:   'ABB T400 Installation & Maintenance Manual v2.3',
    category: 'TRANSFORMER',
    pageRef:  'pp. 34–38',
    content:  `When a fault is detected on the ABB T400 distribution transformer, follow this isolation procedure:
1. Open the HV isolator (disconnect switch) before any inspection.
2. Check the Buchholz relay for gas accumulation — persistent gas indicates an internal winding fault.
3. Measure insulation resistance between HV and LV windings using a 5kV Megger. Values below 100MΩ indicate moisture ingress or winding degradation.
4. Inspect the silica gel breather — replace if more than 50% is saturated (pink/orange colour).
5. Check oil level in the conservator tank — low oil combined with Buchholz alarm indicates oil leak.
6. If the overtemperature relay (OTR) has tripped, allow the unit to cool for 30 minutes, then check the cooling fins for blockage.
WARNING: Never energise a transformer showing Buchholz relay operation without full dissolved gas analysis (DGA) from the oil sample.`,
    keywords: ['transformer', 'fault', 'buchholz', 'insulation', 'megger', 'ABB', 'T400', 'isolation', 'winding', 'oil'],
  },
  {
    title:    'Transformer Oil Sampling — Field Procedure',
    source:   'IEC 60567 Field Guide',
    category: 'TRANSFORMER',
    pageRef:  'pp. 12–15',
    content:  `Dissolved Gas Analysis (DGA) oil sampling procedure for distribution transformers:
1. Use a 50mL vacuum glass syringe — never plastic as it absorbs gases.
2. Locate the oil drain valve at the base of the transformer tank (typically 1.5" NPT valve).
3. Flush 100mL of oil through a clean tube to purge air before collecting sample.
4. Fill syringe without introducing air bubbles. Seal immediately with a rubber cap.
5. Label sample with: transformer ID, date/time, oil temperature at sampling, load current.
6. Deliver to lab within 72 hours — refrigerate at 4°C if delay expected.
Key indicators in DGA: H2 > 100ppm = corona, C2H2 > 5ppm = arcing (CRITICAL), CO > 350ppm = cellulose degradation.`,
    keywords: ['DGA', 'oil sample', 'dissolved gas', 'transformer', 'syringe', 'acetylene', 'corona', 'arcing'],
  },

  // ── Generator ──────────────────────────────────────────────────────────────
  {
    title:    'Cummins QSB7 Generator — Emergency Start Procedure',
    source:   'Cummins QSB7 Operator Manual OMS-4491',
    category: 'GENERATOR',
    pageRef:  'pp. 22–25',
    content:  `Emergency generator start procedure for Cummins QSB7:
1. Check fuel level — minimum 25% tank required for reliable operation.
2. Check coolant level in overflow tank — must be visible in the safe range.
3. Check engine oil level — must be between MIN and MAX on dipstick.
4. Press and hold the RESET button for 3 seconds to clear any fault codes.
5. Turn the START/STOP switch to START. Maximum cranking time = 30 seconds.
6. If unit does not start within 30s, wait 2 minutes before next attempt (starter motor protection).
7. After successful start, allow engine to warm up for 3 minutes before applying load.
8. Check voltage output: 380-415V (3-phase), 220-240V (single phase), frequency 50Hz ±1Hz.
Common faults: Low oil pressure (check level + prime oil pump), High coolant temperature (check coolant + fan belt), Overcrank fault (check battery voltage > 24V DC).`,
    keywords: ['generator', 'Cummins', 'QSB7', 'emergency start', 'fuel', 'coolant', 'oil pressure', 'overcrank', 'fault code'],
  },
  {
    title:    'Generator AVR (Automatic Voltage Regulator) Troubleshooting',
    source:   'Stamford Marathon AVR Field Manual',
    category: 'GENERATOR',
    pageRef:  'pp. 8–14',
    content:  `Troubleshooting AVR issues on alternator-coupled generators:
Symptom: Voltage too high (>10% over nominal)
- Check AVR VOLTS trimmer potentiometer — turn CCW to reduce voltage.
- Verify sensing fuse is intact (AVR sensing circuit).
- Check for open-circuit in the voltage feedback wiring harness.

Symptom: Voltage too low or no output
- Check excitation fuse on AVR board.
- Test diodes in exciter bridge rectifier — measure forward voltage 0.3-0.6V (OK), >1V or OL = failed diode.
- Apply 12V DC to exciter field to perform flash excitation if residual magnetism is lost.

Symptom: Voltage hunting / oscillating
- Increase STABILITY trimmer (CW) in small increments.
- Check for loose connections in sensing circuit.
- Verify engine speed is stable (governor issue if speed is fluctuating).`,
    keywords: ['AVR', 'voltage regulator', 'generator', 'alternator', 'excitation', 'voltage hunting', 'Stamford', 'diode', 'trimmer'],
  },

  // ── HVAC ───────────────────────────────────────────────────────────────────
  {
    title:    'Carrier Chiller 19XR — Compressor Fault Reset',
    source:   'Carrier 19XR Operation and Service Manual',
    category: 'HVAC',
    pageRef:  'pp. 4-1 to 4-8',
    content:  `Carrier 19XR centrifugal chiller compressor fault reset procedure:
1. Identify fault code on the ICVC (Integrated Comfort View Controller) display.
2. Common codes:
   - 1-100 Low refrigerant pressure: Check Refrigerant charge, verify low-pressure transducer.
   - 1-101 High discharge pressure: Check condenser water flow rate, clean condenser tubes.
   - 1-105 Motor overtemperature: Allow 30 min cooldown, check motor winding resistance.
   - 1-200 Vane motor fault: Inspect inlet guide vane actuator linkage.
3. After correcting root cause, press RESET on ICVC.
4. Perform a pre-start checklist before restarting:
   a. Verify refrigerant pressure is within spec (suction 50-70 psi R-134a).
   b. Confirm condenser water flow > minimum spec.
   c. Verify oil heater was ON for minimum 8 hours before start.
5. Do NOT reset more than 3 times without root cause identification — lockout applies.`,
    keywords: ['chiller', 'Carrier', '19XR', 'compressor', 'fault code', 'ICVC', 'refrigerant', 'condenser', 'vane motor', 'HVAC'],
  },
  {
    title:    'Precision AC Unit — Refrigerant Leak Detection',
    source:   'Emerson Liebert PEX Field Service Guide',
    category: 'HVAC',
    pageRef:  'pp. 67–72',
    content:  `Refrigerant leak detection for Liebert PEX precision cooling units:
1. Use an electronic leak detector (Inficon D-TEK Select or equivalent) — set sensitivity to <0.1 oz/year.
2. Check leak-prone areas in order: Schrader valves, flare connections at compressor, sight glass fittings, filter-drier connections, expansion valve inlet.
3. Apply soap bubbles to suspected areas as secondary confirmation.
4. If refrigerant charge is low (<10% of nominal), locate and repair leak before recharging — do not top up a known leaking system.
5. After repair, pressure test with dry nitrogen at 150 psi for 24 hours before evacuation.
6. Pull vacuum to <500 microns before charging. Charge by weight — do NOT charge by sight glass alone.
7. Record: leak location, repair method, pre-charge pressure, final charge weight, post-charge superheat/subcooling values.`,
    keywords: ['refrigerant', 'leak', 'Liebert', 'PEX', 'precision cooling', 'Schrader', 'evacuation', 'vacuum', 'charge', 'superheat'],
  },

  // ── High Voltage ───────────────────────────────────────────────────────────
  {
    title:    '11kV Switchgear — Safe Isolation & Lock-Out/Tag-Out',
    source:   'Schneider Electric SM6 Operating Instructions',
    category: 'HIGH_VOLTAGE',
    pageRef:  'pp. 18–24',
    content:  `Safety isolation procedure for 11kV medium-voltage switchgear (SM6 type):
MANDATORY: This procedure requires two certified HV-authorised persons.

1. VERIFY: Confirm the correct circuit via single-line diagram — identify feeder number.
2. OPEN: Open the circuit breaker (CB) — confirm red OPEN indicator is lit.
3. ISOLATE: Move withdrawal handle to TEST position, then to ISOLATED position. Verify CB carriage is fully withdrawn.
4. EARTH: Apply earthing using the integral earthing switch — confirm EARTH indicator lit.
5. LOCK: Apply padlock to withdrawable CB carriage. Apply danger tag with technician name and date.
6. PROVE DEAD: Use calibrated voltage tester to verify absence of voltage on all three phases and neutral.
7. Work may proceed only after all 6 steps are confirmed.

RE-ENERGISATION (reverse order):
1. Remove all tools and personnel from the work area.
2. Remove earth, remove lock and tag.
3. Insert CB to TEST position, then SERVICE position.
4. Close CB — confirm healthy indicators before loading.`,
    keywords: ['11kV', 'switchgear', 'LOTO', 'lock out', 'tag out', 'isolation', 'earthing', 'SM6', 'Schneider', 'HV', 'high voltage'],
  },

  // ── Fiber Optic ────────────────────────────────────────────────────────────
  {
    title:    'Single-Mode Fiber Splice — OTDR Testing Protocol',
    source:   'Corning Fiber Installation Best Practices Guide v4.1',
    category: 'FIBER_OPTIC',
    pageRef:  'pp. 102–109',
    content:  `OTDR (Optical Time-Domain Reflectometer) testing for single-mode fiber splices:
1. Set OTDR range to 1.5x the fiber span length. Use 1550nm wavelength for single-mode.
2. Average 3 OTDR traces from each end of the span (bidirectional measurement).
3. Acceptance criteria for fusion splices: insertion loss ≤0.1 dB per splice, reflectance <-55 dB.
4. Mechanical splice acceptance: ≤0.3 dB insertion loss.
5. If splice loss > 0.3 dB on fusion splice: re-cleave both fiber ends and re-splice. Check:
   - Cleave angle: ≤0.5° (use cleave checker)
   - Fiber end face: no chips or contamination (clean with IPA wipe)
   - Core alignment: use visual fault locator before fusion
6. Document: splice location (distance marker), splice loss (bidirectional average), pre/post photos.
7. Use OTDR dead zone < 10m — use a launch cable if the connector is within the dead zone.`,
    keywords: ['OTDR', 'fiber', 'splice', 'single mode', 'fusion', 'insertion loss', 'reflectance', 'cleave', 'Corning'],
  },
  {
    title:    'Fiber Optic Cable Cut — Emergency Restoration',
    source:   'Bangladesh Telecom Fiber Operations SOP-FIB-002',
    category: 'FIBER_OPTIC',
    pageRef:  'Rev 3, pp. 5–11',
    content:  `Emergency fiber cut restoration procedure:
1. Locate the cut using OTDR (distance from nearest access point with known markers).
2. Excavate carefully — minimum 0.5m clearance from OTDR-indicated distance on each side.
3. If conduit is damaged, replace minimum 1m of conduit on each side of the break.
4. Prepare both fiber ends: strip outer jacket, remove loose tube, clean buffer, strip coating.
5. Fusion splice all fibers in order (fiber count: 6, 12, 24, or 48 depending on cable type).
6. Protect splices with heat-shrink sleeves in a splice tray.
7. Test with OTDR before closing — acceptance: <0.1 dB per splice.
8. Seal splice enclosure — apply waterproof sealant to all cable gland entries.
9. Restore conduit fill and backfill. Install surface marker at splice location.
Target restoration time: single-point cut ≤ 4 hours, multiple breaks ≤ 8 hours.`,
    keywords: ['fiber cut', 'OTDR', 'restoration', 'fusion splice', 'splice enclosure', 'conduit', 'emergency', 'telecom'],
  },

  // ── Water Systems ──────────────────────────────────────────────────────────
  {
    title:    'Submersible Pump — Failure Diagnosis & Extraction',
    source:   'Grundfos SP-Series Service Manual',
    category: 'WATER_PUMP',
    pageRef:  'pp. 28–36',
    content:  `Diagnosis and extraction of failed submersible pump (Grundfos SP series):
Symptom: Pump runs but no flow
- Check static water level vs. pump setting depth — pump may be above the water table.
- Measure motor current: if below nameplate (e.g. 8A instead of 12A) — pump impellers may be worn or detached.
- If motor current is 0: check control panel, cable insulation (Megger at 500V > 10MΩ between phase and earth).

Symptom: Pump trips on overload
- Measure cable resistance end-to-end — unbalanced phases indicate single-phasing or cable fault.
- Check motor winding resistance: all three phases should be equal within 2%.

Extraction procedure:
1. Mark extraction depth on rising main pipe.
2. Use pump extraction tripod — rated minimum 1.5x pump+column weight.
3. Loosen pipe unions every 3m during extraction.
4. Do NOT use cable for lifting — only use the dedicated lift point on pump head.
5. Inspect: shaft rotation (free = bearings OK, stiff = sand ingestion), impeller wear.`,
    keywords: ['submersible pump', 'Grundfos', 'SP series', 'no flow', 'overload', 'extraction', 'motor current', 'impeller', 'megger'],
  },

  // ── PLC / Automation ───────────────────────────────────────────────────────
  {
    title:    'Siemens S7-300 PLC — CPU Fault Recovery',
    source:   'Siemens SIMATIC S7-300 System Manual',
    category: 'PLC',
    pageRef:  'pp. 8-1 to 8-12',
    content:  `Siemens S7-300 PLC CPU fault recovery procedure:
1. Identify fault via LED status on CPU front panel:
   - STOP (yellow): CPU in stop mode. STARTUP sequence may have failed.
   - SF (red): System fault — diagnostics buffer has error entries.
   - BF (red): Bus fault — check PROFIBUS/DP cable connections.
   - DC (red): 24V DC supply failure.

2. Read diagnostics buffer via SIMATIC Manager or TIA Portal: Online → PLC → Diagnostic Buffer.
3. Common errors and remedies:
   - Error 0x2521 "I/O access error": Check SM (signal module) for loose connector or failed module.
   - Error 0x2522 "Module removed": Re-seat the affected module and clear error.
   - Error 0x3501 "Program cycle time exceeded": Increase OB1 cycle time limit or optimise program.

4. To recover from STOP mode: Set memory reset (MRES) — hold MRES for 3 seconds, LED flashes, release.
5. After memory reset, reload the program from backup (memory card or engineering station).
6. Test all I/O channels with FORCE TABLE before returning to AUTO mode.`,
    keywords: ['PLC', 'Siemens', 'S7-300', 'CPU fault', 'SIMATIC', 'PROFIBUS', 'diagnostics buffer', 'STOP mode', 'MRES', 'automation'],
  },

  // ── Solar / Inverter ───────────────────────────────────────────────────────
  {
    title:    'Fronius Symo Inverter — Grid Fault & Island Protection',
    source:   'Fronius Symo Operating Instructions v1.6',
    category: 'SOLAR_INVERTER',
    pageRef:  'pp. 32–38',
    content:  `Fronius Symo three-phase inverter grid fault diagnosis:
Common fault codes and remedies:
- State 102 "AC voltage too high/low": Grid voltage out of range ±10%. Check grid voltage with multimeter. If grid is stable, recalibrate AC voltage limits in Setup → Grid Parameters.
- State 307 "RCMU fault": Ground fault detected in PV array. Disconnect strings one at a time until fault isolates. Check cable insulation between PV modules.
- State 405 "Inverter overtemperature": Check ventilation clearances (minimum 20cm on all sides). Clean internal fans and heatsink fins.
- State 509 "Anti-islanding protection active": Grid outage detected. Inverter will restart automatically when grid returns. Do NOT bypass anti-islanding protection.

Pre-commissioning checks:
1. Verify DC string voltage < maximum input voltage (1000V for Symo 15-25kW).
2. Verify string polarity with DC clamp meter before connecting.
3. Check isolation resistance > 1MΩ between string positive and earth (DC pre-test with MegOhm mode).`,
    keywords: ['Fronius', 'Symo', 'solar', 'inverter', 'fault code', 'grid fault', 'anti-islanding', 'RCMU', 'ground fault', 'PV'],
  },

  // ── Safety ─────────────────────────────────────────────────────────────────
  {
    title:    'Electrical Safety — Arc Flash PPE Requirements',
    source:   'NFPA 70E 2021 Field Reference',
    category: 'SAFETY',
    pageRef:  'Table 130.5(G)',
    content:  `Arc flash personal protective equipment (PPE) requirements per NFPA 70E:

PPE Category 1 (minimum 4 cal/cm²):
- Arc-rated shirt and pants OR arc-rated coverall (minimum 4 cal/cm²)
- Arc-rated face shield (minimum 4 cal/cm²) + safety glasses
- Heavy-duty leather gloves, leather work shoes.
- Applicable to: 120-240V panels with limited upstream protection.

PPE Category 2 (minimum 8 cal/cm²):
- Arc-rated shirt and pants OR arc-rated coverall
- Arc-rated face shield (minimum 8 cal/cm²) + balaclava
- Voltage-rated gloves (class 00 minimum) + leather protectors.
- Applicable to: Distribution panels up to 480V.

PPE Category 3 (minimum 25 cal/cm²):
- Arc-rated jacket, pants, and balaclava
- Arc-rated face shield (minimum 25 cal/cm²) + hard hat
- Class 2 voltage-rated gloves.
- Applicable to: 600V-15kV equipment.

PPE Category 4 (minimum 40 cal/cm²):
- Full arc flash suit with integrated face shield
- Class 3 voltage-rated gloves.
- Applicable to: 15kV-38kV equipment.

CAUTION: Never work on energised equipment above the boundaries without appropriate PPE.`,
    keywords: ['arc flash', 'PPE', 'NFPA 70E', 'safety', 'cal/cm2', 'protective equipment', 'arc-rated', 'voltage rated gloves', 'category'],
  },
  {
    title:    'Confined Space Entry — Pre-Entry Atmospheric Testing',
    source:   'OSHA 29 CFR 1910.146 Field Checklist',
    category: 'SAFETY',
    pageRef:  'Appendix C',
    content:  `Confined space atmospheric testing procedure (utility manholes, cable tunnels, pump sumps):

Required measurements BEFORE entry:
1. Oxygen (O₂): 19.5%–23.5% acceptable range. < 19.5% = oxygen deficient, > 23.5% = oxygen enriched (fire risk).
2. Combustible gases (LEL): < 10% LEL is safe for entry. 10-25% LEL = danger zone. > 25% LEL = NO ENTRY.
3. Carbon monoxide (CO): < 35 ppm safe, 35–200 ppm = evacuate immediately, > 200 ppm = IDLH.
4. Hydrogen sulphide (H₂S): < 10 ppm safe, > 10 ppm = evacuate.

Testing procedure:
1. Test at top, middle, and bottom of space — gases stratify.
2. Purge space with 3 air changes before testing if readings are borderline.
3. Test CONTINUOUSLY during work — do not rely on pre-entry test only.
4. Station an attendant at entry point at all times — rescue must be coordinated, NOT improvised.
5. Document all readings with time, date, and meter ID in confined space permit.`,
    keywords: ['confined space', 'atmospheric testing', 'oxygen', 'LEL', 'CO', 'H2S', 'OSHA', 'manhole', 'PPE', 'safety'],
  },
  {
    title:    'Emergency Response — Electrical Shock Casualty',
    source:   'CrewRescue Emergency Response Protocol ERP-003',
    category: 'SAFETY',
    pageRef:  'Rev 2',
    content:  `Immediate response to electrical shock casualty on-site:

1. DO NOT TOUCH the casualty if they are still in contact with the electrical source.
2. ISOLATE: Shut off power at the nearest isolator / circuit breaker before approaching.
3. VERIFY SAFE: Use a non-contact voltage tester to confirm the circuit is dead.
4. ASSESS: Check responsiveness — call out and gently tap shoulders.
5. If UNRESPONSIVE and NOT BREATHING: Start CPR immediately. Call emergency services (999 in BD).
   - 30 chest compressions (rate: 100–120/min, depth: 5–6 cm)
   - 2 rescue breaths (if trained)
   - Use AED if available — attach pads to dry skin.
6. If RESPONSIVE: Lay casualty on their side (recovery position). Do NOT give food or water.
7. ALL electrical shock casualties must be transported to hospital for cardiac monitoring — even if they appear uninjured. Cardiac arrhythmia can be delayed 24–48 hours.
8. Report to supervisor immediately. Preserve the incident scene for investigation.`,
    keywords: ['electrical shock', 'casualty', 'CPR', 'AED', 'emergency response', 'first aid', 'electrocution', 'cardiac', 'safety'],
  },
];

async function seedKnowledge() {
  console.log('\n🧠 Seeding Knowledge Base (RAG Copilot documents)...');

  // Remove existing docs
  await KnowledgeDoc.deleteMany({});

  const docs = await KnowledgeDoc.insertMany(KNOWLEDGE_DOCS);
  console.log(`   ✅ ${docs.length} knowledge documents seeded`);

  return docs;
}

async function main() {
  await connectDB();
  await seedKnowledge();
  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ KNOWLEDGE BASE SEED COMPLETE');
  console.log('═══════════════════════════════════════════════');
  console.log(`Documents : ${KNOWLEDGE_DOCS.length}`);
  console.log('Categories: TRANSFORMER, GENERATOR, HVAC, FIBER_OPTIC,');
  console.log('            HIGH_VOLTAGE, WATER_PUMP, PLC, SOLAR_INVERTER, SAFETY');
  console.log('Note: Run the API with GEMINI_API_KEY set to enable vector embeddings');
  console.log('═══════════════════════════════════════════════\n');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Knowledge seed failed:', err);
  process.exit(1);
});

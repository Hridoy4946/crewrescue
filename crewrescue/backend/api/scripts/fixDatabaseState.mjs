import mongoose from 'mongoose';
import { KNOWLEDGE_DOCS } from './seedKnowledge.js';
import KnowledgeDoc from '../src/models/KnowledgeDoc.js';
import Depot from '../src/models/Depot.js';
import Technician from '../src/models/Technician.js';
import WorkOrder from '../src/models/WorkOrder.js';
import Organization from '../src/models/Organization.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crewrescue';

async function run() {
  console.log('Connecting to', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const org = await Organization.findOne({});
  const orgId = org?._id;

  // 1. Seed / update 15 knowledge docs
  console.log('Checking knowledge documents...');
  for (const doc of KNOWLEDGE_DOCS) {
    await KnowledgeDoc.updateOne(
      { title: doc.title },
      {
        $set: {
          organizationId: orgId,
          title: doc.title,
          category: doc.category,
          source: doc.source,
          pageRef: doc.pageRef,
          keywords: doc.keywords,
          content: doc.content,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }
  const knowCount = await KnowledgeDoc.countDocuments();
  console.log('✅ Knowledge docs count:', knowCount);

  // 2. Reopen all depots
  const depotRes = await Depot.updateMany({}, { $set: { status: 'OPERATIONAL' } });
  console.log(`✅ Reopened ${depotRes.modifiedCount} depots to OPERATIONAL.`);

  // 3. Reset technicians to realistic statuses (70 AVAILABLE, 20 BUSY, 10 EN_ROUTE)
  const allTechs = await Technician.find({});
  console.log(`Found ${allTechs.length} technicians.`);
  for (let i = 0; i < allTechs.length; i++) {
    const status = i < 70 ? 'AVAILABLE' : (i < 90 ? 'BUSY' : 'EN_ROUTE');
    await Technician.updateOne(
      { _id: allTechs[i]._id },
      {
        $set: {
          status,
          isActive: true,
          'availability.unavailableReason': null,
          'availability.unavailableUntil': null,
        }
      }
    );
  }
  console.log('✅ Technicians reset (70 AVAILABLE, 20 BUSY, 10 EN_ROUTE).');

  // 4. Remove duplicate storm work orders if > 600
  const totalWO = await WorkOrder.countDocuments();
  console.log(`Total work orders: ${totalWO}`);
  if (totalWO > 600) {
    const stormDel = await WorkOrder.deleteMany({
      title: { $regex: /\[STORM\]/i }
    });
    console.log(`Cleaned up ${stormDel.deletedCount} storm work orders.`);
  }

  // 5. Update open work order SLA deadlines to be REALISTIC (today & upcoming hours)
  const now = Date.now();
  const openWOs = await WorkOrder.find({
    status: { $nin: ['RESOLVED', 'CLOSED', 'VERIFIED'] }
  });
  console.log(`Updating ${openWOs.length} open work order deadlines...`);

  for (let i = 0; i < openWOs.length; i++) {
    const wo = openWOs[i];
    // Spread deadlines: 10% slightly overdue (-30m to -2h), 25% approaching (+45m to +2h), 65% upcoming (+3h to +10h)
    let offsetHr;
    if (i % 8 === 0) {
      offsetHr = -0.5 - (Math.random() * 1.5); // overdue
    } else if (i % 4 === 0) {
      offsetHr = 0.5 + Math.random() * 1.5; // approaching
    } else {
      offsetHr = 2.5 + Math.random() * 8; // upcoming
    }

    const resolutionDeadline = new Date(now + offsetHr * 3600000);
    const responseDeadline = new Date(resolutionDeadline.getTime() - 2 * 3600000);
    const isBreached = resolutionDeadline.getTime() < now;

    await WorkOrder.updateOne(
      { _id: wo._id },
      {
        $set: {
          'sla.resolutionDeadline': resolutionDeadline,
          'sla.responseDeadline': responseDeadline,
          'sla.resolutionBreached': isBreached,
          'sla.responseBreached': isBreached,
        }
      }
    );
  }

  console.log('✅ SLA deadlines refreshed with realistic current timestamps.');
  await mongoose.disconnect();
  console.log('✅ Database repair complete!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

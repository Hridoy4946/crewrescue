// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — Notification Service (Phase 4)
// Multi-channel outbound notification fanout:
//   - In-app (Socket.IO)             ← always enabled
//   - Web Push (VAPID)               ← if serviceWorkerPushEnabled
//   - Email via Resend/SendGrid      ← if EMAIL_API_KEY configured
//   - SMS via Twilio                 ← if TWILIO_* configured
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '../config/logger.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.EMAIL_API_KEY;
  const from   = process.env.EMAIL_FROM ?? 'noreply@crewrescue.app';
  if (!apiKey) return { sent: false, reason: 'no_api_key' };

  // Support Resend (primary) or SendGrid
  if (process.env.EMAIL_PROVIDER === 'sendgrid') {
    try {
      const sgMail = (await import('@sendgrid/mail')).default;
      sgMail.setApiKey(apiKey);
      await sgMail.send({ to, from, subject, html, text });
      return { sent: true };
    } catch (e) {
      logger.error('SendGrid error:', e.message);
      return { sent: false, reason: e.message };
    }
  }

  // Default: Resend
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from, to, subject, html }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    return { sent: true };
  } catch (e) {
    logger.error('Resend error:', e.message);
    return { sent: false, reason: e.message };
  }
}

async function sendSMS({ to, body }) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) return { sent: false, reason: 'no_twilio_config' };

  try {
    const { Twilio } = await import('twilio');
    const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({ body, from: TWILIO_FROM, to });
    return { sent: true };
  } catch (e) {
    logger.error('Twilio SMS error:', e.message);
    return { sent: false, reason: e.message };
  }
}

// ── Notification Templates ─────────────────────────────────────────────────────

export const NOTIFICATION_TEMPLATES = {
  INCIDENT_ASSIGNED: ({ workOrderNumber, title, technicianName, slaDeadline }) => ({
    subject: `[CrewRescue] Incident Assigned: ${workOrderNumber}`,
    html: `<p>Hello ${technicianName},</p>
           <p>A new incident has been assigned to you:</p>
           <p><strong>${workOrderNumber}: ${title}</strong></p>
           <p>SLA Resolution Deadline: <strong>${new Date(slaDeadline).toLocaleString()}</strong></p>
           <p>Please open the CrewRescue Field App to accept and get started.</p>`,
    sms: `[CrewRescue] ${workOrderNumber} assigned to you: ${title}. SLA: ${new Date(slaDeadline).toLocaleTimeString()}. Open app to accept.`,
  }),

  SLA_BREACH_WARNING: ({ workOrderNumber, title, minutesRemaining }) => ({
    subject: `⚠️ SLA Warning — ${minutesRemaining}min remaining: ${workOrderNumber}`,
    html: `<p><strong>SLA breach warning</strong></p>
           <p>${workOrderNumber}: ${title}</p>
           <p>Resolution deadline in <strong>${minutesRemaining} minutes</strong>. Immediate action required.</p>`,
    sms: `⚠️ SLA WARNING: ${workOrderNumber} - ${title} breaches in ${minutesRemaining}min. Take action now.`,
  }),

  SLA_BREACHED: ({ workOrderNumber, title }) => ({
    subject: `🔴 SLA BREACHED: ${workOrderNumber}`,
    html: `<p><strong>SLA has been breached</strong></p>
           <p>${workOrderNumber}: ${title}</p>
           <p>Immediate escalation required.</p>`,
    sms: `🔴 SLA BREACHED: ${workOrderNumber} - ${title}. Escalation required.`,
  }),

  OPTIMIZATION_COMPLETE: ({ algorithm, slaImprovementPct, assignedCount }) => ({
    subject: `✅ Optimization Complete (${algorithm})`,
    html: `<p>Optimization run completed using <strong>${algorithm}</strong>.</p>
           <p>Results: <strong>${assignedCount}</strong> new assignments, SLA compliance improved by <strong>${slaImprovementPct}%</strong>.</p>
           <p>Please review and approve assignments in the Dispatcher Console.</p>`,
    sms: `CrewRescue: ${algorithm} optimization complete — ${assignedCount} assignments, +${slaImprovementPct}% SLA. Review now.`,
  }),

  EMERGENCY_DECLARED: ({ title, level, affectedArea }) => ({
    subject: `🚨 EMERGENCY DECLARED: ${title}`,
    html: `<p><strong>EMERGENCY MODE ACTIVE</strong></p>
           <p>Level: ${level}</p>
           <p>Incident: ${title}</p>
           <p>Affected area: ${affectedArea}</p>
           <p>All available technicians are being mobilized. Please check the Dispatcher Console.</p>`,
    sms: `🚨 EMERGENCY: ${title} (Level ${level}) in ${affectedArea}. All techs mobilized. Check CrewRescue console.`,
  }),

  TECHNICIAN_OFFLINE: ({ technicianName, lastSeenMinutes }) => ({
    subject: `⚠️ Technician Offline: ${technicianName}`,
    html: `<p>Technician <strong>${technicianName}</strong> has not sent a GPS heartbeat in <strong>${lastSeenMinutes} minutes</strong>.</p>
           <p>Please attempt contact and verify their safety.</p>`,
    sms: `⚠️ ${technicianName} offline for ${lastSeenMinutes}min. Check welfare.`,
  }),
};

// ── Main Notification Dispatcher ───────────────────────────────────────────────

/**
 * Send a notification through all configured channels.
 *
 * @param {Object} opts
 * @param {Object} opts.io          - Socket.IO instance for in-app push
 * @param {string} opts.orgId       - Organization ID (for Socket.IO room)
 * @param {string} opts.type        - Notification type key (from NOTIFICATION_TEMPLATES)
 * @param {Object} opts.data        - Template data
 * @param {Array}  opts.recipients  - Array of { email, phone, userId } objects
 * @param {string} opts.severity    - 'info' | 'warning' | 'critical'
 */
export async function sendNotification({ io, orgId, type, data, recipients = [], severity = 'info' }) {
  const template = NOTIFICATION_TEMPLATES[type]?.(data);
  if (!template) {
    logger.warn(`Unknown notification type: ${type}`);
    return;
  }

  const results = { inApp: false, email: [], sms: [] };

  // ── 1. In-App via Socket.IO ──────────────────────────────────────────────
  if (io && orgId) {
    io.to(`org:${orgId}`).emit('notification', {
      type,
      severity,
      title:    template.subject,
      message:  template.sms, // compact version for toast
      data,
      sentAt:   new Date().toISOString(),
    });
    results.inApp = true;
  }

  // ── 2. Email ──────────────────────────────────────────────────────────────
  const emailRecipients = recipients.filter(r => r.email);
  for (const r of emailRecipients) {
    const res = await sendEmail({ to: r.email, subject: template.subject, html: template.html, text: template.sms });
    results.email.push({ to: r.email, ...res });
  }

  // ── 3. SMS via Twilio ────────────────────────────────────────────────────
  if (severity === 'critical' || severity === 'warning') {
    const smsRecipients = recipients.filter(r => r.phone);
    for (const r of smsRecipients) {
      const res = await sendSMS({ to: r.phone, body: template.sms });
      results.sms.push({ to: r.phone, ...res });
    }
  }

  logger.info(`Notification [${type}] sent — inApp:${results.inApp}, email:${results.email.length}, sms:${results.sms.length}`);
  return results;
}

// ── SLA Watch — background monitor ───────────────────────────────────────────

/**
 * Start a recurring SLA breach monitor.
 * Checks every 2 minutes for incidents approaching or breaching SLA.
 * Emits in-app + email + SMS for WARNING (60min) and BREACHED.
 *
 * @param {Object} io     - Socket.IO instance
 * @param {Object} WorkOrder - Mongoose model
 */
export function startSLAWatch(io, WorkOrder) {
  const CHECK_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes
  const notifiedWarning = new Set(); // track already-warned IDs
  const notifiedBreach  = new Set();

  async function check() {
    try {
      const now = new Date();
      const in60min = new Date(now.getTime() + 60 * 60 * 1000);

      // Find incidents approaching SLA breach in next 60 minutes
      const approaching = await WorkOrder.find({
        status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] },
        'sla.resolutionDeadline': { $gte: now, $lte: in60min },
      }).populate('assignedTechnicianId', 'name email phone').lean();

      for (const wo of approaching) {
        if (notifiedWarning.has(wo._id.toString())) continue;
        const minRemaining = Math.round((new Date(wo.sla.resolutionDeadline) - now) / 60_000);
        await sendNotification({
          io, orgId: wo.organizationId?.toString(), type: 'SLA_BREACH_WARNING', severity: 'warning',
          data: { workOrderNumber: wo.workOrderNumber, title: wo.title, minutesRemaining: minRemaining },
          recipients: wo.assignedTechnicianId ? [{ email: wo.assignedTechnicianId.email, phone: wo.assignedTechnicianId.phone }] : [],
        });
        notifiedWarning.add(wo._id.toString());
      }

      // Find already-breached incidents
      const breached = await WorkOrder.find({
        status: { $nin: ['RESOLVED', 'VERIFIED', 'CLOSED'] },
        'sla.resolutionDeadline': { $lt: now },
      }).lean();

      for (const wo of breached) {
        if (notifiedBreach.has(wo._id.toString())) continue;
        await sendNotification({
          io, orgId: wo.organizationId?.toString(), type: 'SLA_BREACHED', severity: 'critical',
          data: { workOrderNumber: wo.workOrderNumber, title: wo.title },
          recipients: [],
        });
        notifiedBreach.add(wo._id.toString());
      }
    } catch (err) {
      logger.error('SLA watch error:', err.message);
    }
  }

  const interval = setInterval(check, CHECK_INTERVAL_MS);
  logger.info('📡 SLA watch started (2-minute interval)');
  return interval;
}

import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, CheckCircle2, HardHat, MonitorCog, RadioTower, ShieldCheck, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="landing-page" role="main">
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-overlay" />
      <div className="landing-content">
        <div className="landing-topline">
          <div className="landing-brand"><span className="brand-mark"><ShieldCheck size={19} /></span> DHAKA POWER <b>·</b> CREWRESCUE</div>
          <div className="landing-system-status"><span /> SYSTEM OPERATIONAL <b>LIVE</b></div>
        </div>
        <div className="landing-eyebrow">EMERGENCY UTILITY OPERATIONS NETWORK</div>
        <h1>Restore critical power service <em>in real time.</em></h1>
        <p>Coordinate outages, dispatch field crews, and bring communities back online from one resilient operational command center.</p>
        <div className="landing-metrics" aria-label="Live service metrics">
          <div className="landing-metric outage"><Activity size={18} /><span><strong>858</strong><small>ACTIVE OUTAGES</small><b>MONITORED NOW</b></span></div>
          <div className="landing-metric crews"><Users size={18} /><span><strong>18</strong><small>CREWS DEPLOYED</small><b>FIELD NETWORK</b></span></div>
          <div className="landing-metric uptime"><CheckCircle2 size={18} /><span><strong>24/7</strong><small>RESPONSE NETWORK</small><b>ALWAYS ON</b></span></div>
        </div>
        <div className="landing-ops-row">
          <section className="landing-command-visual" aria-label="Live grid network overview">
            <div className="command-visual-header">
              <span><RadioTower size={15} /> GRID PULSE / LIVE</span>
              <b>Dhaka North Region</b>
            </div>
            <div className="command-radar">
              <svg className="radar-svg" viewBox="0 0 360 360" aria-hidden="true">
                <defs>
                  <radialGradient id="radarSweepGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(34, 197, 94, 0.35)" />
                    <stop offset="60%" stopColor="rgba(34, 197, 94, 0.08)" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Clock / Scope Reticle Crosshairs */}
                <line x1="180" y1="18" x2="180" y2="342" stroke="rgba(56, 189, 248, 0.16)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="18" y1="180" x2="342" y2="180" stroke="rgba(56, 189, 248, 0.16)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="65" y1="65" x2="295" y2="295" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" strokeDasharray="2 4" />
                <line x1="295" y1="65" x2="65" y2="295" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" strokeDasharray="2 4" />

                {/* Concentric radar rings */}
                <circle cx="180" cy="180" r="48" fill="none" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="1" />
                <circle cx="180" cy="180" r="98" fill="none" stroke="rgba(56, 189, 248, 0.18)" strokeWidth="1" />
                <circle cx="180" cy="180" r="148" fill="none" stroke="rgba(56, 189, 248, 0.28)" strokeWidth="1.2" />

                {/* Inner Network Vectors connecting center core to active nodes */}
                <g className="radar-vectors">
                  <line x1="180" y1="180" x2="80" y2="92" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.75" strokeDasharray="4 4" />
                  <line x1="180" y1="180" x2="282" y2="84" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.75" strokeDasharray="4 4" />
                  <line x1="180" y1="180" x2="280" y2="276" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.8" strokeDasharray="4 4" />
                  <line x1="180" y1="180" x2="88" y2="268" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.75" strokeDasharray="4 4" />
                </g>

                {/* Sweeping radar beam */}
                <g className="radar-sweep-group">
                  <line x1="180" y1="180" x2="180" y2="32" stroke="#22c55e" strokeWidth="1.8" filter="url(#nodeGlow)" />
                  <path d="M 180 180 L 180 32 A 148 148 0 0 1 245 48 Z" fill="url(#radarSweepGrad)" />
                </g>

                {/* Active Grid Nodes */}
                <g className="radar-node-group">
                  <circle cx="80" cy="92" r="7" fill="rgba(34, 197, 94, 0.25)" />
                  <circle cx="80" cy="92" r="4.5" fill="#22c55e" filter="url(#nodeGlow)" />
                </g>
                <g className="radar-node-group">
                  <circle cx="282" cy="84" r="7" fill="rgba(34, 197, 94, 0.25)" />
                  <circle cx="282" cy="84" r="4.5" fill="#22c55e" filter="url(#nodeGlow)" />
                </g>
                <g className="radar-node-group">
                  <circle cx="280" cy="276" r="7" fill="rgba(251, 191, 36, 0.3)" />
                  <circle cx="280" cy="276" r="4.5" fill="#fbbf24" filter="url(#nodeGlow)" />
                </g>
                <g className="radar-node-group">
                  <circle cx="88" cy="268" r="7" fill="rgba(34, 197, 94, 0.25)" />
                  <circle cx="88" cy="268" r="4.5" fill="#22c55e" filter="url(#nodeGlow)" />
                </g>
              </svg>

              <div className="command-center-core">
                <strong>98.4%</strong>
                <small>GRID HEALTH</small>
              </div>
            </div>
            <div className="command-visual-footer">
              <span><i className="node-green" /> 18 units online</span>
              <span><i className="node-amber" /> 04 priority zones</span>
              <span>SYNC 02:34:05</span>
            </div>
          </section>

          <Link className="landing-portal-card admin" to="/login">
            <div className="portal-card-badge">
              <span><MonitorCog size={13} /></span>
              <span>COMMAND & DISPATCH</span>
            </div>
            <div className="portal-card-body">
              <span className="portal-icon-box"><MonitorCog size={26} /></span>
              <h3>Operations Command Center</h3>
              <p>Monitor grid status, coordinate priority outages, assign emergency response crews, and track active restorations.</p>
            </div>
            <div className="portal-card-footer">
              <span className="portal-action-label">Enter Command Portal</span>
              <span className="portal-arrow"><ArrowUpRight size={18} /></span>
            </div>
          </Link>

          <a className="landing-portal-card field" href="https://crewrescue.vercel.app/">
            <div className="portal-card-badge">
              <span><HardHat size={13} /></span>
              <span>FIELD RESPONSE UNIT</span>
            </div>
            <div className="portal-card-body">
              <span className="portal-icon-box"><HardHat size={26} /></span>
              <h3>Field Technician Workspace</h3>
              <p>Receive live dispatches on site, navigate fault locations, execute safety checklists, and work fully offline.</p>
            </div>
            <div className="portal-card-footer">
              <span className="portal-action-label">Open Technician PWA</span>
              <span className="portal-arrow"><ArrowUpRight size={18} /></span>
            </div>
          </a>
        </div>
        <div className="landing-footer"><span><span className="footer-dot" /> Dhaka Grid Network</span><span>LAST SYNC: LIVE</span><span>SECURE OPERATIONS PLATFORM</span></div>
      </div>
    </main>
  );
}

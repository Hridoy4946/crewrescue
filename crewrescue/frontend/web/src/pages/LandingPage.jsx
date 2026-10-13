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
        <section className="landing-command-visual" aria-label="Live grid network overview">
          <div className="command-visual-header"><span><RadioTower size={15} /> GRID PULSE / LIVE</span><b>Dhaka North Region</b></div>
          <div className="command-radar">
            <div className="radar-ring ring-one" /><div className="radar-ring ring-two" /><div className="radar-ring ring-three" />
            <span className="radar-sweep" />
            <span className="grid-node node-one" /><span className="grid-node node-two" /><span className="grid-node node-three" /><span className="grid-node node-four" />
            <span className="grid-route route-one" /><span className="grid-route route-two" /><span className="grid-route route-three" />
            <div className="command-center-core"><strong>98.4%</strong><small>GRID HEALTH</small></div>
          </div>
          <div className="command-visual-footer"><span><i className="node-green" /> 18 units online</span><span><i className="node-amber" /> 04 priority zones</span><span>SYNC 02:34:05</span></div>
        </section>
        <div className="landing-portals">
          <Link className="landing-portal admin" to="/login"><span className="portal-icon"><MonitorCog size={20} /></span><span><strong>Operations Command Center</strong><small>Monitor grid status, dispatch crews, and coordinate response.</small></span><ArrowUpRight size={18} /></Link>
          <a className="landing-portal field" href="https://crewrescue.vercel.app/"><span className="portal-icon"><HardHat size={20} /></span><span><strong>Field Technician Workspace</strong><small>Receive assignments, navigate incidents, and work offline.</small></span><ArrowUpRight size={18} /></a>
        </div>
        <div className="landing-footer"><span><span className="footer-dot" /> Dhaka Grid Network</span><span>LAST SYNC: LIVE</span><span>SECURE OPERATIONS PLATFORM</span></div>
      </div>
    </main>
  );
}

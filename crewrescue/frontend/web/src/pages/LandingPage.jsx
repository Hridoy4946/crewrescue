import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, CheckCircle2, HardHat, MonitorCog, ShieldCheck, Users } from 'lucide-react';

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
        <div className="landing-portals">
          <Link className="landing-portal admin" to="/login"><span className="portal-icon"><MonitorCog size={20} /></span><span><strong>Operations Command Center</strong><small>Monitor grid status, dispatch crews, and coordinate response.</small></span><ArrowUpRight size={18} /></Link>
          <a className="landing-portal field" href="https://crewrescue.vercel.app/"><span className="portal-icon"><HardHat size={20} /></span><span><strong>Field Technician Workspace</strong><small>Receive assignments, navigate incidents, and work offline.</small></span><ArrowUpRight size={18} /></a>
        </div>
        <div className="landing-footer"><span><span className="footer-dot" /> Dhaka Grid Network</span><span>LAST SYNC: LIVE</span><span>SECURE OPERATIONS PLATFORM</span></div>
      </div>
    </main>
  );
}

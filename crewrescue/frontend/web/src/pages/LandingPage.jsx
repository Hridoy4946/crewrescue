import { Link } from 'react-router-dom';
import { Activity, MapPin, ShieldCheck, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="landing-page" role="main">
      <video className="landing-video" autoPlay muted loop playsInline aria-hidden="true">
        <source src="https://cdn.coverr.co/videos/coverr-aerial-view-of-a-city-1575/1080p.mp4" type="video/mp4" />
      </video>
      <div className="landing-overlay" />
      <div className="landing-content">
        <div className="landing-brand"><ShieldCheck size={22} /> DHAKA POWER · CREWRESCUE</div>
        <h1>CrewRescue: Real-Time Emergency Utility Response - Dhaka Power</h1>
        <p>Coordinate outages, dispatch field crews, and restore critical utility services from one operational network.</p>
        <div className="landing-metrics" aria-label="Live service metrics">
          <div className="landing-metric outage"><Activity size={18} /><span><strong>858</strong><small>Active Outages</small></span></div>
          <div className="landing-metric crews"><Users size={18} /><span><strong>18</strong><small>Active Crews</small></span></div>
        </div>
        <div className="landing-portals">
          <Link className="landing-portal admin" to="/login"><MapPin size={18} /><span><strong>Admin Control Panel</strong><small>Operations command center</small></span><b>→</b></Link>
          <a className="landing-portal field" href="https://crewrescue.vercel.app/"><ShieldCheck size={18} /><span><strong>Field Technician PWA</strong><small>Mobile dispatch workspace</small></span><b>↗</b></a>
        </div>
      </div>
    </main>
  );
}

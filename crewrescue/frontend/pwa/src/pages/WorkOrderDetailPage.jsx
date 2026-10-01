import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, MapPin, Clock, Wrench, AlertTriangle,
  Camera, MessageSquare, Send, CheckCircle,
  WifiOff, Navigation,
} from 'lucide-react';
import { useWorkOrderStore } from '../store/index.js';
import { getNextTransitions, STATUS_COLORS, STATUS_LABELS, formatSLARemaining, getSeverityBadgeClass } from '../lib/transitions.js';
import { savePhoto, getPhotosForWorkOrder } from '../lib/db.js';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, highlight = false }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <Icon size={14} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '0.85rem', fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--brand-light)' : 'var(--text-primary)', marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

// ── Camera capture ────────────────────────────────────────────────────────────
function CameraCapture({ workOrderId, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream]     = useState(null);
  const [captured, setCaptured] = useState(null);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(s => { setStream(s); if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => toast.error('Camera not available'));
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  function capture() {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCaptured(dataUrl);
    stream?.getTracks().forEach(t => t.stop());
  }

  async function save() {
    if (!captured) return;
    setSaving(true);
    await savePhoto(workOrderId, captured, note);
    toast.success('Photo saved');
    setSaving(false);
    onClose();
  }

  return (
    <div className="camera-overlay">
      {!captured ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="camera-viewfinder" />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ padding: '20px 16px', background: 'rgba(0,0,0,0.8)', display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" onClick={onClose} style={{ color: '#fff', flex: 1 }}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={capture}
              style={{ flex: 2, padding: '16px' }}
            >
              <Camera size={20} /> Capture
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 }}>
          <img src={captured} alt="Captured" style={{ flex: 1, objectFit: 'contain', borderRadius: 12 }} />
          <input
            type="text"
            className="input"
            placeholder="Add a note for this photo…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setCaptured(null)} style={{ flex: 1 }}>Retake</button>
            <button className="btn btn-success" onClick={save} disabled={saving} style={{ flex: 2, padding: 16 }}>
              {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <><CheckCircle size={16} /> Save Photo</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Work Order Detail Page ────────────────────────────────────────────────
export default function WorkOrderDetailPage({ workOrderId, onBack }) {
  const { activeWO, isOffline, fetchOne, transitionStatus, addNote } = useWorkOrderStore();
  const [loading, setLoading]       = useState(true);
  const [transitioning, setTrans]   = useState(false);
  const [noteText, setNoteText]     = useState('');
  const [sendingNote, setSending]   = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos]         = useState([]);
  const [confirmTransition, setConfirmTransition] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchOne(workOrderId).finally(() => setLoading(false));
    loadPhotos();
  }, [workOrderId]);

  async function loadPhotos() {
    const p = await getPhotosForWorkOrder(workOrderId);
    setPhotos(p);
  }

  async function handleTransition(transition) {
    if (transitioning) return;
    // Confirm for important steps
    if (['RESOLVED'].includes(transition.status)) {
      setConfirmTransition(transition);
      return;
    }
    doTransition(transition);
  }

  async function doTransition(transition) {
    setConfirmTransition(null);
    setTrans(true);
    try {
      const result = await transitionStatus(workOrderId, transition.status);
      toast.success(
        result.queued
          ? `Status → ${STATUS_LABELS[transition.status]} (queued, will sync)`
          : `Status → ${STATUS_LABELS[transition.status]}`
      );
      // Re-fetch to refresh the UI
      await fetchOne(workOrderId);
    } catch (_err) {
      toast.error('Failed to update status');
    } finally {
      setTrans(false);
    }
  }

  async function handleSendNote() {
    if (!noteText.trim() || sendingNote) return;
    setSending(true);
    const { queued } = await addNote(workOrderId, noteText.trim());
    toast.success(queued ? 'Note queued (offline)' : 'Note added');
    setNoteText('');
    setSending(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div className="skeleton" style={{ height: 32, width: 120, marginBottom: 20, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 60, marginBottom: 12, borderRadius: 14 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
      </div>
    );
  }

  const wo = activeWO;
  if (!wo) return (
    <div style={{ textAlign: 'center', padding: '80px 16px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
      <div>Work order not found</div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginTop: 16 }}>← Go Back</button>
    </div>
  );

  const sla         = formatSLARemaining(wo.sla?.resolutionDeadline);
  const statusColor = STATUS_COLORS[wo.status] ?? '#64748B';
  const transitions = getNextTransitions(wo.status);

  return (
    <>
      {showCamera && (
        <CameraCapture workOrderId={workOrderId} onClose={() => { setShowCamera(false); loadPhotos(); }} />
      )}

      {/* Confirm dialog */}
      {confirmTransition && (
        <div style={{
          position: 'fixed', inset: 0, z: 200, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end', padding: '0 0 env(safe-area-inset-bottom)',
        }}>
          <div style={{ width: '100%', background: 'var(--bg-elevated)', borderRadius: '24px 24px 0 0', padding: '24px 20px' }}>
            <h3 style={{ marginBottom: 8 }}>Mark as {STATUS_LABELS[confirmTransition.status]}?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              This will notify the dispatcher and update the live map.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmTransition(null)}>Cancel</button>
              <button
                className="btn btn-success"
                style={{ flex: 2, padding: 16, fontSize: '1rem' }}
                onClick={() => doTransition(confirmTransition)}
              >
                {confirmTransition.icon} Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back button + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '0 0 16px', borderBottom: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--brand-light)', fontWeight: 700 }}>
            {wo.workOrderNumber}
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {wo.title}
          </div>
        </div>
        <span className={getSeverityBadgeClass(wo.severity)}>{wo.severity}</span>
      </div>

      {/* Status + SLA */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'stretch' }}>
        <div style={{
          flex: 1, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
          borderLeft: `3px solid ${statusColor}`,
        }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
          <div style={{ fontWeight: 800, color: statusColor, fontSize: '0.95rem' }}>{STATUS_LABELS[wo.status]}</div>
          {isOffline && <div style={{ fontSize: '0.6rem', color: 'var(--warning)', marginTop: 2 }}><WifiOff size={9} style={{ verticalAlign: 'middle' }} /> Offline</div>}
        </div>
        {sla && (
          <div style={{
            flex: 1, padding: '12px 14px', background: sla.critical ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)',
            border: `1px solid ${sla.critical ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
            borderRadius: 14, borderLeft: `3px solid ${sla.critical ? '#EF4444' : '#F59E0B'}`,
          }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>SLA</div>
            <div style={{ fontWeight: 800, color: sla.critical ? '#EF4444' : '#F59E0B', fontSize: '0.95rem' }}>
              {sla.critical ? '🔴 ' : '⏱ '}{sla.text}
            </div>
          </div>
        )}
      </div>

      {/* ── 1-Tap Transition Buttons ─────────────────────────────────────────── */}
      {transitions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-label">Next Action</div>
          {transitions.map((t, i) => (
            <button
              key={i}
              className="transition-btn"
              onClick={() => handleTransition(t)}
              disabled={transitioning}
              style={{
                ...t.style,
                color: '#fff',
                marginBottom: i < transitions.length - 1 ? 10 : 0,
                boxShadow: `0 4px 20px ${t.color}40`,
              }}
            >
              {transitioning
                ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: '#fff' }} /> Updating…</>
                : <>{t.icon} {t.label}</>
              }
            </button>
          ))}
        </div>
      )}

      {/* ── Job Details ────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wrench size={14} style={{ color: 'var(--brand-light)' }} /> Job Details
          </div>
        </div>
        <div className="card-body">
          <InfoRow icon={MapPin}       label="Location"    value={wo.location?.address} highlight />
          <InfoRow icon={AlertTriangle} label="Category"   value={wo.category?.replace(/_/g, ' ')} />
          <InfoRow icon={Wrench}       label="Asset"       value={wo.assetId?.name} />
          <InfoRow icon={Clock}        label="Created"     value={wo.createdAt ? formatDistanceToNow(new Date(wo.createdAt)) + ' ago' : null} />
          {wo.description && (
            <div style={{ paddingTop: 10 }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 5 }}>Description</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{wo.description}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Required Skills ────────────────────────────────────────────────── */}
      {wo.requiredSkills?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div style={{ fontWeight: 700, fontSize: '0.85rem' }}>🎓 Required Skills</div></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {wo.requiredSkills.map(s => (
                <span key={s} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                  background: 'rgba(99,102,241,0.15)', color: 'var(--brand-light)',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Navigate ───────────────────────────────────────────────────────── */}
      {wo.location?.coordinates?.length === 2 && (
        <button
          className="btn btn-ghost w-full"
          style={{ padding: '14px 16px', borderRadius: 14, marginBottom: 16, fontSize: '0.9rem', border: '1px solid var(--border)' }}
          onClick={() => {
            const [lng, lat] = wo.location.coordinates;
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
          }}
        >
          <Navigation size={16} /> Open in Google Maps
        </button>
      )}

      {/* ── Photos ─────────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Camera size={14} style={{ color: 'var(--brand-light)' }} /> Photos
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCamera(true)}>
            <Camera size={13} /> Capture
          </button>
        </div>
        <div className="card-body">
          {photos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No photos yet — tap Capture to add evidence
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={p.dataUrl} alt={`Photo ${i + 1}`} className="photo-thumb" />
                  {p.note && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Note ───────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={14} style={{ color: 'var(--brand-light)' }} /> Add Note
        </div></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              className="input"
              rows={2}
              placeholder="Add site notes, parts used, observations…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              style={{ flex: 1, resize: 'none' }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSendNote}
              disabled={!noteText.trim() || sendingNote}
              style={{ padding: '10px 14px', flexShrink: 0 }}
            >
              {sendingNote
                ? <div className="spinner" style={{ width: 16, height: 16 }} />
                : <Send size={15} />
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Work order notes history ────────────────────────────────────────── */}
      {wo.notes?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">Notes History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {wo.notes.slice().reverse().map((n, i) => (
              <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', fontSize: '0.82rem' }}>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.text}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {n.author?.name ?? 'Unknown'} · {n.createdAt ? formatDistanceToNow(new Date(n.createdAt)) + ' ago' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

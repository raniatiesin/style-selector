import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API } from '../../config/api';
import { generateSlug } from '../../utils/slug';
import { formatDate, deriveSubtitle } from './utils';
import './GrossGauntletPages.css';

export default function LogView() {
  const { n } = useParams();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function fetchLog() {
      try {
        const res = await fetch(API.getLogByIndex(n));
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setLog(data?.data || data);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load log');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLog();
    return () => { cancelled = true; };
  }, [n]);

  // Auto-open if only one session exists on day n
  useEffect(() => {
    if (!log || loading) return;
    const sessions = Array.isArray(log.sessions) && log.sessions.length > 0
      ? log.sessions
      : [{ stream_number: 1, title: log.title || log.name || `Log ${n}`, subtitle: log.subtitle || null }];
    if (sessions.length === 1) {
      const slug = generateSlug(sessions[0].title || log.title || log.name || `Log ${n}`);
      navigate(`/Logs/${n}/${slug}`, { replace: true });
    }
  }, [log, loading, n, navigate]);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-log-view">
          <Link to="/Logs" className="gg-back-link">← Logs</Link>
          <p className="gg-page-subtitle">Loading Log {n}…</p>
        </div>
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="gg-page">
        <div className="gg-log-view">
          <Link to="/Logs" className="gg-back-link">← Logs</Link>
          <h1 className="gg-page-title">Log {n}</h1>
          <p className="gg-page-subtitle gg-error">{error || 'Log not found.'}</p>
        </div>
      </div>
    );
  }

  const sessions = Array.isArray(log.sessions) && log.sessions.length > 0
    ? log.sessions
    : [{ stream_number: 1, title: log.title || log.name || `Log ${n}`, subtitle: log.subtitle || null }];

  const title = log.title || log.name || `Log ${n}`;
  const subtitle = log.subtitle || log.timestamps || '';

  // Multi-session logic: render a session selector
  return (
    <div className="gg-page">
      <div className="gg-log-view">
        <Link to="/Logs" className="gg-back-link">← Logs</Link>
        <div className="gg-session-meta">
          <div className="gg-log-card-number">Log {n}</div>
          <h1 className="gg-page-title">{title}</h1>
          <p className="gg-page-subtitle">{subtitle}</p>
          <p className="gg-session-date">{formatDate(log.date || log.created_at)}</p>
        </div>

        <h2 className="gg-section-title">Stream Sessions</h2>
        <div className="gg-session-list">
          {sessions.map((session) => {
            const streamTitle = session.title || title;
            const sessionSubtitle = session.subtitle || deriveSubtitle(streamTitle);
            const slug = generateSlug(streamTitle);
            return (
              <Link
                key={`${session.stream_number}-${slug}`}
                to={`/Logs/${n}/${slug}`}
                className="gg-session-card"
              >
                <div className="gg-session-card-stream">Stream {session.stream_number}</div>
                <div className="gg-session-card-title">{sessionSubtitle || streamTitle}</div>
                <div className="gg-session-card-slug">{slug}</div>
                <div className="gg-session-card-arrow">→</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
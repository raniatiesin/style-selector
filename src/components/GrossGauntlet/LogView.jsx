import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../../config/api';
import { generateSlug } from '../../utils/slug';
import './GrossGauntletPages.css';

function formatDate(value) {
  if (!value) return 'Unknown date';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deriveSubtitle(streamTitle) {
  if (!streamTitle) return '';
  const parts = String(streamTitle).split(/[:—–-]/);
  return parts[parts.length - 1]?.trim() || streamTitle;
}

export default function LogView() {
  const { logNumber } = useParams();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLog() {
      try {
        const res = await fetch(API.getLogByIndex(logNumber));
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
  }, [logNumber]);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-log-view">
          <Link to="/grossgauntlet" className="gg-back-link">← GrossGauntlet</Link>
          <p className="gg-page-subtitle">Loading Log {logNumber}…</p>
        </div>
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="gg-page">
        <div className="gg-log-view">
          <Link to="/grossgauntlet" className="gg-back-link">← GrossGauntlet</Link>
          <h1 className="gg-page-title">Log {logNumber}</h1>
          <p className="gg-page-subtitle gg-error">{error || 'Log not found.'}</p>
        </div>
      </div>
    );
  }

  const sessions = Array.isArray(log.sessions) && log.sessions.length > 0
    ? log.sessions
    : [{ stream_number: 1, title: log.title || log.name || `Log ${logNumber}`, subtitle: log.subtitle || null }];

  const title = log.title || log.name || `Log ${logNumber}`;
  const subtitle = log.subtitle || log.timestamps || '';

  // Single-session logic: render the session directly
  if (sessions.length === 1) {
    const slug = generateSlug(sessions[0].title || title);
    return (
      <div className="gg-page">
        <div className="gg-log-view">
          <Link to="/grossgauntlet" className="gg-back-link">← GrossGauntlet</Link>
          <div className="gg-session-meta">
            <div className="gg-log-card-number">Log {logNumber}</div>
            <h1 className="gg-page-title">{title}</h1>
            <p className="gg-page-subtitle">{subtitle}</p>
            <p className="gg-session-date">{formatDate(log.date || log.created_at)}</p>
          </div>
          <Link to={`/grossgauntlet/log${logNumber}/${slug}`} className="gg-primary-link">
            View Session →
          </Link>
        </div>
      </div>
    );
  }

  // Multi-session logic: render a session selector
  return (
    <div className="gg-page">
      <div className="gg-log-view">
        <Link to="/grossgauntlet" className="gg-back-link">← GrossGauntlet</Link>
        <div className="gg-session-meta">
          <div className="gg-log-card-number">Log {logNumber}</div>
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
                to={`/grossgauntlet/log${logNumber}/${slug}`}
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
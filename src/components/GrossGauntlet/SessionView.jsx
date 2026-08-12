import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../../config/api';
import './GrossGauntletPages.css';

function formatDate(value) {
  if (!value) return 'Unknown date';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function SessionView() {
  const { n: logNumber, slug } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSession() {
      try {
        // Fetch specific session matching log position and slug
        // TODO: Replace with real endpoint
        const res = await fetch(API.getSession(logNumber, slug));
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setSession(data?.data || data);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load session');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSession();
    return () => { cancelled = true; };
  }, [logNumber, slug]);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-session-view">
          <Link to={`/Logs/${logNumber}`} className="gg-back-link">← Log {logNumber}</Link>
          <p className="gg-page-subtitle">Loading session…</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="gg-page">
        <div className="gg-session-view">
          <Link to={`/Logs/${logNumber}`} className="gg-back-link">← Log {logNumber}</Link>
          <h1 className="gg-page-title">Session not found</h1>
          <p className="gg-page-subtitle gg-error">{error || 'The requested session could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  const title = session.title || session.name || 'Untitled Session';
  const subtitle = session.subtitle || session.timestamps || '';
  const tasks = Array.isArray(session.tasks) ? session.tasks : [];

  return (
    <div className="gg-page">
      <div className="gg-session-view">
        <Link to={`/Logs/${logNumber}`} className="gg-back-link">← Log {logNumber}</Link>

        <div className="gg-session-header">
          <div className="gg-log-card-number">Log {logNumber}</div>
          <h1 className="gg-page-title">{title}</h1>
          {subtitle && <p className="gg-page-subtitle">{subtitle}</p>}
          <p className="gg-session-date">
            {formatDate(session.date || session.created_at)}
            {session.created_at && ` · ${formatTime(session.created_at)}`}
          </p>
          <div className="gg-session-slug">/{slug}</div>
        </div>

        <div className="gg-session-notice">
          ⚡ Historical record — read-only view
        </div>

        {tasks.length > 0 && (
          <div className="gg-session-tasks">
            <h2 className="gg-section-title">Tasks ({tasks.length})</h2>
            <div className="gg-task-list">
              {tasks.map((task) => (
                <div key={task.id || task.name} className={`gg-task-item gg-task-${task.status || 'waiting'}`}>
                  <span className="gg-task-status-dot" />
                  <span className="gg-task-name">{task.name}</span>
                  <span className="gg-task-status">{task.status || 'waiting'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {session.metrics && (
          <div className="gg-session-metrics">
            <h2 className="gg-section-title">Metrics</h2>
            <div className="gg-metrics-grid">
              {session.metrics.todaySeconds !== undefined && (
                <div className="gg-metric-card">
                  <div className="gg-metric-label">Today Work</div>
                  <div className="gg-metric-value">{Math.floor(session.metrics.todaySeconds / 3600)}h {Math.floor((session.metrics.todaySeconds % 3600) / 60)}m</div>
                </div>
              )}
              {session.metrics.contentCount !== undefined && (
                <div className="gg-metric-card">
                  <div className="gg-metric-label">Content</div>
                  <div className="gg-metric-value">{session.metrics.contentCount}</div>
                </div>
              )}
              {session.metrics.salesCount !== undefined && (
                <div className="gg-metric-card">
                  <div className="gg-metric-label">Sales</div>
                  <div className="gg-metric-value">{session.metrics.salesCount}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { buildBoard, buildBoardFromTasks } from './kanban/moveTask';
import { formatDateLong, formatTime } from './utils';
import './GrossGauntletPages.css';

export default function GrossGauntletSession() {
  const { date, sessionNumber } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSession() {
      try {
        const res = await fetch(API.getSession(date, sessionNumber));
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
  }, [date, sessionNumber]);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-session-view">
          <Link to={`/grossgauntlet/${date}`} className="gg-back-link">← {date}</Link>
          <p className="gg-page-subtitle">Loading session…</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="gg-page">
        <div className="gg-session-view">
          <Link to={`/grossgauntlet/${date}`} className="gg-back-link">← {date}</Link>
          <h1 className="gg-page-title">Session not found</h1>
          <p className="gg-page-subtitle gg-error">{error || 'The requested session could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  const title = session.title || session.name || 'Untitled Session';
  const subtitle = session.subtitle || session.timestamps || '';
  const tasks = Array.isArray(session.tasks) ? session.tasks : [];
  const board = session.board
    ? buildBoard(session.board)
    : buildBoardFromTasks(tasks);

  return (
    <div className="gg-page">
      <div className="gg-session-view">
        <Link to={`/grossgauntlet/${date}`} className="gg-back-link">← {date}</Link>

        <div className="gg-session-header">
          <div className="gg-log-card-number">{date}</div>
          <h1 className="gg-page-title">{title}</h1>
          {subtitle && <p className="gg-page-subtitle">{subtitle}</p>}
          <p className="gg-session-date">
            {formatDateLong(session.date || session.created_at)}
            {session.created_at && ` · ${formatTime(session.created_at)}`}
          </p>
          <div className="gg-session-slug">Session {sessionNumber}</div>
        </div>

        <div className="gg-session-notice">
          ⚡ Historical record — read-only view
        </div>

        <KanbanBoard initialBoard={board} editable={false} />

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

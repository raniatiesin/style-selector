import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API } from '../../config/api';
import { formatDate, deriveSubtitle } from './utils';
import './GrossGauntletPages.css';

export default function GrossGauntletDay() {
  const { date } = useParams();
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function fetchDay() {
      try {
        const res = await fetch(API.getDay(date));
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setDay(data?.data || data);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load day');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDay();
    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    if (!day || loading) return;
    const sessions = Array.isArray(day.sessions) && day.sessions.length > 0
      ? day.sessions
      : [{ session_number: 1, title: day.title || day.name || `Day ${date}`, subtitle: day.subtitle || null }];
    if (sessions.length === 1) {
      const sessNum = sessions[0].session_number ?? sessions[0].stream_number ?? 1;
      navigate(`/grossgauntlet/${date}/${sessNum}`, { replace: true });
    }
  }, [day, loading, date, navigate]);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-log-view">
          <Link to="/grossgauntlet" className="gg-back-link">← Days</Link>
          <p className="gg-page-subtitle">Loading {date}…</p>
        </div>
      </div>
    );
  }

  if (error || !day) {
    return (
      <div className="gg-page">
        <div className="gg-log-view">
          <Link to="/grossgauntlet" className="gg-back-link">← Days</Link>
          <h1 className="gg-page-title">{date}</h1>
          <p className="gg-page-subtitle gg-error">{error || 'Day not found.'}</p>
        </div>
      </div>
    );
  }

  const sessions = Array.isArray(day.sessions) && day.sessions.length > 0
    ? day.sessions
    : [{ session_number: 1, title: day.title || day.name || `Day ${date}`, subtitle: day.subtitle || null }];

  const title = day.title || day.name || `Day ${date}`;
  const subtitle = day.subtitle || day.timestamps || '';

  return (
    <div className="gg-page">
      <div className="gg-log-view">
        <Link to="/grossgauntlet" className="gg-back-link">← Days</Link>
        <div className="gg-session-meta">
          <div className="gg-log-card-number">{date}</div>
          <h1 className="gg-page-title">{title}</h1>
          <p className="gg-page-subtitle">{subtitle}</p>
          <p className="gg-session-date">{formatDate(day.date || day.created_at)}</p>
        </div>

        <h2 className="gg-section-title">Stream Sessions</h2>
        <div className="gg-session-list">
          {sessions.map((session) => {
            const sessNum = session.session_number ?? session.stream_number ?? 1;
            const streamTitle = session.title || title;
            const sessionSubtitle = session.subtitle || deriveSubtitle(streamTitle);
            return (
              <Link
                key={`${sessNum}`}
                to={`/grossgauntlet/${date}/${sessNum}`}
                className="gg-session-card"
              >
                <div className="gg-session-card-stream">Session {sessNum}</div>
                <div className="gg-session-card-title">{sessionSubtitle || streamTitle}</div>
                <div className="gg-session-card-arrow">→</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

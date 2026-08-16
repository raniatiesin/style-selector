import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../../config/api';
import { formatDate } from './utils';
import './GrossGauntletPages.css';

export default function GrossGauntletHome() {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDays() {
      try {
        const res = await fetch(API.getAllDays());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const records = Array.isArray(json) ? json : (json?.data || []);
        setDays(records);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load days');
        if (!cancelled) setDays([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDays();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-log-index">
          <h1 className="gg-page-title">GrossGauntlet</h1>
          <p className="gg-page-subtitle">Loading days…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gg-page">
        <div className="gg-log-index">
          <h1 className="gg-page-title">GrossGauntlet</h1>
          <p className="gg-page-subtitle gg-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gg-page">
      <div className="gg-log-index">
        <header className="gg-index-header">
          <h1 className="gg-page-title">GrossGauntlet</h1>
          <p className="gg-page-subtitle">Historical Log Index</p>
        </header>

        <div className="gg-log-grid">
          {days.map((day) => {
            const sessionCount = day.sessions?.length || 0;
            const isLive = day.sessions?.some(s => s.is_streaming);
            const totalDone = day.sessions?.reduce((acc, s) => acc + (s.done_count || 0), 0) || 0;
            const displayTitle = day.dayNumber ? `Day ${day.dayNumber}` : day.date;

            const navTarget = sessionCount === 1
              ? `/grossgauntlet/${day.dayNumber}/1`
              : `/grossgauntlet/${day.dayNumber}`;

            return (
              <Link
                key={day.date}
                to={navTarget}
                className="gg-log-card"
              >
                <div className="gg-log-card-number">{displayTitle}</div>
                <div className="gg-log-card-title">{formatDate(day.date)}</div>
                <div className="gg-log-card-meta">
                  <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''} · {totalDone} done</span>
                  {isLive && <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>● Live</span>}
                  <span>→</span>
                </div>
              </Link>
            );
          })}

          {days.length === 0 && (
            <p className="gg-empty">No challenge days recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

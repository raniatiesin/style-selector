import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../../config/api';
import './GrossGauntletPages.css';

function formatDate(value) {
  if (!value) return 'Unknown date';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LogIndex() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      try {
        // Fetch all records from GrossGauntlet table ordered by created_at / id
        // TODO: Replace with real endpoint
        const res = await fetch(API.getAllLogs());
        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const data = await res.json();
        if (cancelled) return;
        setLogs(Array.isArray(data) ? data : data?.data || []);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-log-index">
          <h1 className="gg-page-title">GrossGauntlet</h1>
          <p className="gg-page-subtitle">Loading logs…</p>
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
          {logs.map((log, index) => {
            const logNumber = index + 1;
            const title = log.title || log.name || `Log ${logNumber}`;
            return (
              <Link
                key={log.id ?? logNumber}
                to={`/grossgauntlet/log${logNumber}`}
                className="gg-log-card"
              >
                <div className="gg-log-card-number">Log {logNumber}</div>
                <div className="gg-log-card-title">{title}</div>
                <div className="gg-log-card-meta">
                  <span>{formatDate(log.date || log.created_at)}</span>
                  <span>→</span>
                </div>
              </Link>
            );
          })}

          {logs.length === 0 && (
            <p className="gg-empty">No historical logs found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
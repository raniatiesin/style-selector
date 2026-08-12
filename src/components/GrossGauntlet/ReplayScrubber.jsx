import { useParams, Link } from 'react-router-dom';
import './GrossGauntletPages.css';

/**
 * Phase 2 Event Replay – read-only timeline scrubber.
 * Queries event stream from Logs table matching :slug.
 * Renders timeline event scrubber.
 * Strictly read-only.
 */
export default function ReplayScrubber() {
  const { slug } = useParams();

  return (
    <div className="gg-page">
      <div className="gg-replay-scrubber">
        <Link to="/tasks" className="gg-back-link">← Tasks</Link>

        <h1 className="gg-page-title">Event Replay</h1>
        <p className="gg-page-subtitle">Slug: {slug}</p>

        <div className="gg-session-notice">
          🚧 Phase 2 — Timeline event scrubber coming soon.
        </div>

        <div className="gg-replay-placeholder">
          <p>This view will display a timeline scrubber of events from the Logs table matching <strong>{slug}</strong>.</p>
          <p className="gg-replay-note">Strictly read-only event replay.</p>
        </div>
      </div>
    </div>
  );
}
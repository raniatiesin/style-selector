import { useParams, Link } from 'react-router-dom';
import './GrossGauntletPages.css';

/**
 * Phase 2 Event Replay — read-only timeline scrubber.
 * Route: /tasks/:streamNumber/replay
 */
export default function ReplayScrubber() {
  const { streamNumber } = useParams();

  return (
    <div className="gg-page">
      <div className="gg-replay-scrubber">
        <Link to={`/tasks/${streamNumber}`} className="gg-back-link">← Session {streamNumber}</Link>
        <h1 className="gg-page-title">Event Replay</h1>

        <div className="gg-session-notice">
          🚧 Phase 2 — Timeline event scrubber coming soon.
        </div>

        <div className="gg-replay-placeholder">
          <p className="gg-replay-note">Strictly read-only event replay for session {streamNumber}.</p>
        </div>
      </div>
    </div>
  );
}

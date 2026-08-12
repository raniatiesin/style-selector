import './GrossGauntletPages.css';

/**
 * Phase 2 Event Replay – read-only timeline scrubber.
 * Queries event stream from Logs table matching :slug.
 * Renders timeline event scrubber.
 * Strictly read-only.
 * 
 * Future route: /Logs/:n/:slug/replay
 */
export default function ReplayScrubber() {
  return (
    <div className="gg-page">
      <div className="gg-replay-scrubber">
        <h1 className="gg-page-title">Event Replay</h1>

        <div className="gg-session-notice">
          🚧 Phase 2 — Timeline event scrubber coming soon.
        </div>

        <div className="gg-replay-placeholder">
          <p className="gg-replay-note">Strictly read-only event replay.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * GrossGauntlet API Configuration
 * All API calls MUST funnel through this single file.
 *
 * Uses relative /api/ paths for same-origin requests under the main domain.
 * Override with VITE_API_BASE_URL env variable for local dev or proxied setups.
 *
 * Backend route structure:
 *   /api/grossgauntlet/logs/:logNumber          — public log archives (plural RESTful)
 *   /api/stream/state|metrics|tasks|replay       — live stream & task controls
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const API = {
  /** Fetch all records from GrossGauntlet table (public log index) */
  getAllLogs: () => `${API_BASE}/grossgauntlet/logs`,

  /** Fetch a single log by 1-based row index */
  getLogByIndex: (logNumber) => `${API_BASE}/grossgauntlet/logs/${logNumber}`,

  /** Fetch a specific session by log number and slug */
  getSession: (logNumber, slug) => `${API_BASE}/grossgauntlet/logs/${logNumber}/${slug}`,

  /** Fetch current stream state (metrics, tasks, mode) */
  getStreamState: () => `${API_BASE}/stream/state`,

  /** Fetch tasks for the OBS overlay polling */
  getTasks: () => `${API_BASE}/stream/tasks`,

  /** Push metrics / state updates to the live stream row */
  postMetrics: () => `${API_BASE}/stream/metrics`,

  /** Fetch event replay data for a given slug (Phase 2) */
  getReplayEvents: (slug) => `${API_BASE}/stream/replay/${slug}`,
};

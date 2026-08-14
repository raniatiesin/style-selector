/**
 * GrossGauntlet API Configuration
 * All API calls MUST funnel through this single file.
 *
 * Uses relative /api/ paths for same-origin requests under the main domain.
 * Override with VITE_API_BASE_URL env variable for local dev or proxied setups.
 *
 * Backend route structure:
 *   /api/grossgauntlet/days                      — public archive index
 *   /api/grossgauntlet/days/:date/:sessionNumber  — single session detail
 *   /api/stream/state|metrics|tasks               — live stream & task controls
 */

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const API = {
  // Stream state (polling)
  getStreamState:  ()                      => `${BASE}/stream/state`,
  postMetrics:     ()                      => `${BASE}/stream/metrics`,
  postTask:        ()                      => `${BASE}/stream/tasks`,

  // Archive
  getAllDays:      ()                      => `${BASE}/grossgauntlet/days`,
  getDay:          (date)                  => `${BASE}/grossgauntlet/days/${date}`,
  getSession:      (date, sessionNumber)   => `${BASE}/grossgauntlet/days/${date}/${sessionNumber}`,

  // Phase 2
  getEvents:       (date, sessionNumber)   => `${BASE}/grossgauntlet/days/${date}/${sessionNumber}/events`,
};

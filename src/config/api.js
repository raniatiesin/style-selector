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

  // Archive — query-param based, all through /days
  getAllDays:      ()                      => `${BASE}/grossgauntlet/days`,
  getDay:          (dayNumber)             => `${BASE}/grossgauntlet/days?dayNumber=${encodeURIComponent(Number(dayNumber))}`,
  getSession:      (dayNumber, sessionNumber) => `${BASE}/grossgauntlet/days?dayNumber=${encodeURIComponent(Number(dayNumber))}&sessionNumber=${encodeURIComponent(Number(sessionNumber))}`,
  getEvents:       (dayNumber, sessionNumber) => `${BASE}/grossgauntlet/days?dayNumber=${encodeURIComponent(Number(dayNumber))}&sessionNumber=${encodeURIComponent(Number(sessionNumber))}&events=true`,

  // NoteLogs read (GET) and create (POST)
  getNotes:        (dayNumber, sessionNumber) => `${BASE}/grossgauntlet/note?dayNumber=${encodeURIComponent(Number(dayNumber))}&sessionNumber=${encodeURIComponent(Number(sessionNumber))}`,
  postNote:        ()                      => `${BASE}/grossgauntlet/note`,

  // SessionLogs read (GET)
  getSessionLogs:  (dayNumber, sessionNumber) => `${BASE}/grossgauntlet/sessionlogs?dayNumber=${encodeURIComponent(Number(dayNumber))}&sessionNumber=${encodeURIComponent(Number(sessionNumber))}`,
};

/**
 * Shared constants for Gross Gauntlet components
 */

// Target hours
export const HOURS_TARGET = 1000;

// Layout dimensions
export const CONTEXT_WIDTH = 1075.33;
export const OVERLAY_WIDTH = 1440;
export const OVERLAY_HEIGHT = 1080;

// Local storage keys
export const STORAGE_KEYS = {
  EXPLAIN_TOPIC: 'EXPLAIN_TOPIC',
  STREAM_ADMIN_KEY: 'STREAM_ADMIN_KEY',
  OBS_PASS: 'OBS_PASS',
  YT_MARKERS: 'YT_MARKERS',
  YT_STREAM_START: 'YT_STREAM_START',
  GROSSGAUNTLET_UNLOCKED: 'grossgauntlet_unlocked',
};

// OBS configuration
export const OBS_CONFIG = {
  WS_URL: "ws://localhost:4455",
  SCENES: {
    WORK: "work",
    EXPLAIN: "explain",
    BREAK: "break",
    STANDBY: "standby",
  },
};

// Polling intervals
export const POLL_INTERVALS = {
  TASKS: 2000,
  MAX_BACKOFF: 30000,
  STALE_THRESHOLD: 10000,
  STATE_SYNC: 2000,
};

// Task statuses
export const TASK_STATUSES = {
  IN_PROGRESS: 'in_progress',
  UP_NEXT: 'up_next',
  IN_REVIEW: 'in_review',
  WAITING: 'waiting',
  DONE: 'done',
};

// Mode types
export const MODES = {
  WORK: 'work',
  EXPLAIN: 'explain',
  BREAK: 'break',
  STANDBY: 'standby',
  MINECRAFT: 'minecraft',
};

// Daily work target (in seconds)
export const DAILY_WORK_TARGET_SECONDS = 10 * 3600; // 10 hours

// Standby options
export const STANDBY_OPTIONS = [
  'Coming Soon',
  'Break',
  'Offline',
  'Setting Up',
];

// Logging configuration
export const LOG_CONFIG = {
  MAX_LOGS: 20,
  AUTO_DISMISS_MS: 10000,
};

// Timer display format
export const TIME_FORMATS = {
  HMS: 'HMS', // HH:MM:SS
  MILLIS: 'MILLIS', // MM:SS or HH:MM:SS
  YT: 'YT', // YouTube chapter format
};

/**
 * Shared utility functions for Gross Gauntlet components
 */

// Date/Time formatting
export function formatDate(value, options = {}) {
  if (!value) return 'Unknown date';
  const d = new Date(value);
  const defaultOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

export function formatDateLong(value) {
  if (!value) return 'Unknown date';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

// Format date in CA format (YYYY-MM-DD) for consistent API calls
export function formatDateCA(value) {
  if (!value) return new Intl.DateTimeFormat('en-CA').format(new Date());
  const d = new Date(value);
  return new Intl.DateTimeFormat('en-CA').format(d);
}

export function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatTime12(date) {
  let h = date.getHours();
  const m = pad(date.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Time formatting utilities
export function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatHMS(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatMillis(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  if (!safe) return "--:--";
  const totalSeconds = Math.floor(safe / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatHours(totalSeconds) {
  return (Math.max(0, totalSeconds) / 3600).toFixed(1);
}

export function relativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// Math utilities
export function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

// String utilities
export function sanitizeFilenamePart(value) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

export function deriveSubtitle(streamTitle) {
  if (!streamTitle) return '';
  const parts = String(streamTitle).split(/[:—–-]/);
  return parts[parts.length - 1]?.trim() || streamTitle;
}

// Task status utilities
export function sortTasksByStatus(tasks, statusOrder) {
  return [...tasks].sort(
    (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
  );
}

// YouTube marker utilities
export function formatYTTime(startMillis) {
  if (!startMillis) return "00:00";
  const diffSec = Math.max(0, Math.floor((Date.now() - startMillis) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Local storage utilities with error handling
export function getLocalStorageItem(key, defaultValue = '') {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setLocalStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function getLocalStorageJSON(key, defaultValue = []) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setLocalStorageJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

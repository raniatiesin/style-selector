import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Notification system for GrossGauntlet.
 * Each notification:
 *  - id (auto-generated)
 *  - timestamp (ISO string)
 *  - type ('success' | 'error' | 'info' | 'pending')
 *  - action  (e.g. 'create_task', 'move_task', 'mode_change', 'poll')
 *  - endpoint (relative URL)
 *  - statusCode (number | null)
 *  - message  (long, precise, descriptive)
 *  - autoDismissMs (default 8000)
 */

let _nextId = 0;
function nextId() { return ++_nextId; }

export default function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const add = useCallback((opts = {}) => {
    const id = nextId();
    const now = new Date().toISOString();
    const n = {
      id,
      timestamp: now,
      type: opts.type || 'info',
      action: opts.action || 'unknown',
      endpoint: opts.endpoint || '',
      statusCode: opts.statusCode ?? null,
      message: opts.message || '',
      autoDismissMs: opts.autoDismissMs ?? 12000,
    };
    setNotifications(prev => [...prev, n]);

    if (n.autoDismissMs > 0) {
      timersRef.current[id] = setTimeout(() => {
        setNotifications(prev => prev.filter(x => x.id !== id));
        delete timersRef.current[id];
      }, n.autoDismissMs);
    }
    return id;
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(t => clearTimeout(t));
      timersRef.current = {};
    };
  }, []);

  return { notifications, add, dismiss };
}

/** Helper: build a descriptive notification message from an API response */
export function notifFromResponse(res, actionLabel, endpoint, extra = '') {
  const status = res.status;
  const ok = res.ok;
  let detail = '';
  if (ok) {
    detail = `${res.status} OK`;
  } else {
    detail = `${res.status} ${res.statusText}`;
  }
  const time = new Date().toLocaleTimeString();
  return {
    type: ok ? 'success' : 'error',
    action: actionLabel,
    endpoint,
    statusCode: status,
    message: `[${time}] ${actionLabel} — ${detail}.${extra ? ' ' + extra : ''}`
  };
}

/** Helper: build notification from a caught error */
export function notifFromError(actionLabel, endpoint, error) {
  const time = new Date().toLocaleTimeString();
  return {
    type: 'error',
    action: actionLabel,
    endpoint,
    statusCode: null,
    message: `[${time}] ❌ ${actionLabel} FAILED — ${error?.message || String(error)}. Endpoint: ${endpoint}`
  };
}

/** Helper: notification for a successful write */
export function notifOk(actionLabel, endpoint, detail = '') {
  const time = new Date().toLocaleTimeString();
  return {
    type: 'success',
    action: actionLabel,
    endpoint,
    statusCode: 200,
    message: `[${time}] ✓ ${actionLabel} succeeded.${detail ? ' ' + detail : ''}`
  };
}
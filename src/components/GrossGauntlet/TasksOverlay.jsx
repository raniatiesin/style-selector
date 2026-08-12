import { useState, useEffect, useRef } from 'react';
import { API } from '../../config/api';
import './GrossGauntletPages.css';

/**
 * Isolated OBS Overlay for Tasks.
 * CRITICAL: MUST NOT import @dnd-kit/core, @dnd-kit/sortable, or any drag-and-drop dependencies.
 * Read-only, polls /api/tasks every 2000ms with exponential backoff on errors.
 */
const POLL_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 30000;
const STALE_THRESHOLD_MS = 10000;

export default function TasksOverlay() {
  const [tasks, setTasks] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const backoffRef = useRef(POLL_INTERVAL_MS);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    async function fetchTasks() {
      try {
        const res = await fetch(API.getTasks());
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;

        // Successful fetch - reset backoff and stale state
        backoffRef.current = POLL_INTERVAL_MS;
        setLastFetchTime(Date.now());
        setIsStale(false);

        // Process tasks from response
        const fetchedTasks = Array.isArray(data.tasks)
          ? data.tasks.map((t) => ({
              id: String(t.id),
              name: String(t.name || 'Untitled Task').trim(),
              status: t.status || 'waiting',
            }))
          : Array.isArray(data)
            ? data.map((t) => ({
                id: String(t.id),
                name: String(t.name || 'Untitled Task').trim(),
                status: t.status || 'waiting',
              }))
            : [];

        setTasks(fetchedTasks);
      } catch (e) {
        if (cancelled) return;
        // Exponential backoff on errors
        const currentBackoff = backoffRef.current;
        backoffRef.current = Math.min(currentBackoff * 2, MAX_BACKOFF_MS);
      }
    }

    async function poll() {
      if (cancelled) return;
      await fetchTasks();
      if (cancelled) return;
      timeoutId = setTimeout(poll, backoffRef.current);
    }

    // Initial fetch
    poll();

    // Separate interval to check staleness
    const staleInterval = setInterval(() => {
      if (lastFetchTime && Date.now() - lastFetchTime > STALE_THRESHOLD_MS) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
    }, 1000);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (staleInterval) clearInterval(staleInterval);
    };
  }, []);

  const statusOrder = {
    in_progress: 0,
    up_next: 1,
    in_review: 2,
    waiting: 3,
    done: 4,
  };

  const sortedTasks = [...tasks].sort(
    (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
  );

  return (
    <div className="gg-overlay-root">
      <div className="gg-overlay-container">
        <div className="gg-overlay-header">
          <span className="gg-overlay-title">Tasks</span>
          {isStale && <span className="gg-overlay-stale-indicator" title="Data may be stale">●</span>}
        </div>
        <div className="gg-overlay-tasks">
          {sortedTasks.map((task) => (
            <div key={task.id} className={`gg-overlay-task gg-overlay-task-${task.status || 'waiting'}`}>
              <span className="gg-overlay-task-dot" />
              <span className="gg-overlay-task-name">{task.name}</span>
            </div>
          ))}
          {sortedTasks.length === 0 && (
            <div className="gg-overlay-empty">No tasks</div>
          )}
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { API } from '../../config/api';
import { sortTasksByStatus } from './utils';
import { POLL_INTERVALS, TASK_STATUSES } from './constants';
import './TasksOverlay.css';

/**
 * Isolated OBS Overlay for Tasks.
 * CRITICAL: MUST NOT import @dnd-kit/core, @dnd-kit/sortable, or any drag-and-drop dependencies.
 * Read-only, polls /api/stream/state with exponential backoff on errors.
 */

export default function TasksOverlay() {
  const [tasks, setTasks] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const backoffRef = useRef(POLL_INTERVALS.TASKS);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    async function fetchTasks() {
      try {
        const res = await fetch(API.getStreamState());
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;

        backoffRef.current = POLL_INTERVALS.TASKS;
        setLastFetchTime(Date.now());
        setIsStale(false);

        const fetchedTasks = Array.isArray(data.tasks)
          ? data.tasks.map((t) => ({
              id: String(t.id),
              name: String(t.name || 'Untitled Task').trim(),
              status: t.status || 'waiting',
            }))
          : [];

        setTasks(fetchedTasks);
      } catch {
        if (cancelled) return;
        backoffRef.current = Math.min(backoffRef.current * 2, POLL_INTERVALS.MAX_BACKOFF);
      }
    }

    async function poll() {
      if (cancelled) return;
      await fetchTasks();
      if (cancelled) return;
      timeoutId = setTimeout(poll, backoffRef.current);
    }

    poll();

    const staleInterval = setInterval(() => {
      setLastFetchTime((prev) => {
        if (prev && Date.now() - prev > POLL_INTERVALS.STALE_THRESHOLD) {
          setIsStale(true);
        } else if (prev) {
          setIsStale(false);
        }
        return prev;
      });
    }, 1000);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(staleInterval);
    };
  }, []);

  const statusOrder = {
    [TASK_STATUSES.IN_PROGRESS]: 0,
    [TASK_STATUSES.UP_NEXT]: 1,
    [TASK_STATUSES.IN_REVIEW]: 2,
    [TASK_STATUSES.WAITING]: 3,
    [TASK_STATUSES.DONE]: 4,
  };

  const sortedTasks = sortTasksByStatus(tasks, statusOrder);

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

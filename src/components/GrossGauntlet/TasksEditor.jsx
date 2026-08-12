import { useState, useEffect } from 'react';
import { API } from '../../config/api';
import './GrossGauntletPages.css';

const UNLOCK_KEY = 'grossgauntlet_unlocked';

function getIsUnlocked() {
  try {
    return localStorage.getItem(UNLOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function TasksEditor() {
  const [tasks, setTasks] = useState([]);
  const [mode, setMode] = useState('standby');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchState() {
      try {
        const res = await fetch(API.getStreamState());
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        const metrics = data?.metrics || {};
        const isActiveStream = metrics.isStreaming === true;
        const currentMode = metrics.mode || 'standby';

        setMode(currentMode);
        setIsStreaming(isActiveStream);

        // Editable ONLY if streaming AND unlocked
        // If not streaming, fall back to read-only mode
        const canEdit = isActiveStream && getIsUnlocked();
        setIsReadOnly(!canEdit);

        // Process tasks from API
        const fetchedTasks = Array.isArray(data.tasks)
          ? data.tasks.map((t) => ({
              id: String(t.id),
              name: String(t.name || 'Untitled Task').trim(),
              status: t.status || 'waiting',
            }))
          : [];

        setTasks(fetchedTasks);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-tasks-editor">
          <h1 className="gg-page-title">Tasks</h1>
          <p className="gg-page-subtitle">Loading tasks…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gg-page">
        <div className="gg-tasks-editor">
          <h1 className="gg-page-title">Tasks</h1>
          <p className="gg-page-subtitle gg-error">{error}</p>
        </div>
      </div>
    );
  }

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
    <div className="gg-page">
      <div className="gg-tasks-editor">
        <header className="gg-tasks-header">
          <div>
            <h1 className="gg-page-title">Tasks</h1>
            <p className="gg-page-subtitle">
              {isStreaming ? '🔴 Live' : '⏸️ Offline'}
              {isReadOnly && !isStreaming && ' — Read-only (latest session)'}
              {isReadOnly && isStreaming && ' — Read-only (unlock to edit)'}
              {!isReadOnly && ' — Editable'}
            </p>
          </div>
          <div className="gg-tasks-mode">
            <span className="gg-mode-badge">Mode: {mode}</span>
          </div>
        </header>

        {isReadOnly && (
          <div className="gg-session-notice">
            {!isStreaming
              ? '📖 No active stream. Showing latest session in read-only mode.'
              : '🔒 Stream is locked. Enable unlock in control panel to edit.'}
          </div>
        )}

        <div className="gg-task-list-editor">
          {sortedTasks.map((task) => (
            <div key={task.id} className={`gg-task-item gg-task-${task.status || 'waiting'}`}>
              <span className="gg-task-status-dot" />
              <span className="gg-task-name">{task.name}</span>
              <span className="gg-task-status">{task.status}</span>
            </div>
          ))}
          {sortedTasks.length === 0 && (
            <p className="gg-empty">No tasks available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
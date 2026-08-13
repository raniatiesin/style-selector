import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { buildBoard } from './kanban/moveTask';
import { STORAGE_KEYS } from './constants';
import './GrossGauntletPages.css';

const EMPTY_BOARD = buildBoard({});

async function syncBoardToApi(board) {
  const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
  if (!adminKey) throw new Error('Not authenticated');

  const res = await fetch(API.syncTasks(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminKey}`,
    },
    body: JSON.stringify({
      action: 'sync',
      up_next_tasks: board.up_next_tasks,
      in_progress_tasks: board.in_progress_tasks,
      in_review_tasks: board.in_review_tasks,
      done_tasks: board.done_tasks,
    }),
  });

  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED);
    throw new Error('Unauthorized — re-unlock to edit');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Sync failed (${res.status})`);
  }
}

/**
 * Historical board view — always read-only regardless of unlock state.
 */
export default function TasksHistorical() {
  const { streamNumber } = useParams();
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [sessionTitle, setSessionTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSession() {
      try {
        const res = await fetch(API.getTasksByStreamNumber(streamNumber));
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        if (cancelled) return;

        const data = json?.data || json;
        setBoard(buildBoard(data));
        setSessionTitle(data.title || `Session ${streamNumber}`);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load session');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSession();
    return () => { cancelled = true; };
  }, [streamNumber]);

  if (loading) {
    return (
      <div className="gg-page">
        <div className="gg-tasks-editor">
          <h1 className="gg-page-title">Tasks</h1>
          <p className="gg-page-subtitle">Loading session {streamNumber}…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gg-page">
        <div className="gg-tasks-editor">
          <Link to="/tasks" className="gg-back-link">← Live Tasks</Link>
          <h1 className="gg-page-title">Session not found</h1>
          <p className="gg-page-subtitle gg-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gg-page">
      <div className="gg-tasks-editor">
        <header className="gg-tasks-header">
          <div>
            <Link to="/tasks" className="gg-back-link">← Live Tasks</Link>
            <h1 className="gg-page-title">{sessionTitle}</h1>
            <p className="gg-page-subtitle">Session {streamNumber} — Historical</p>
          </div>
        </header>

        <div className="gg-session-notice">
          ⚡ Historical record — read-only view
        </div>

        <KanbanBoard initialBoard={board} editable={false} />
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { buildBoard } from './kanban/moveTask';
import RunButton, { getIsUnlocked } from './RunButton';
import { STORAGE_KEYS, POLL_INTERVALS } from './constants';
import './GrossGauntletPages.css';

const EMPTY_BOARD = buildBoard({});
const SYNC_DEBOUNCE_MS = 400;

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

export default function TasksEditor() {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [mode, setMode] = useState('standby');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamNumber, setStreamNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(getIsUnlocked);

  const writePendingRef = useRef(false);
  const syncTimerRef = useRef(null);
  const pendingBoardRef = useRef(null);

  const isReadOnly = !isStreaming || !isUnlocked;

  const flushSync = useCallback(async (boardToSync) => {
    writePendingRef.current = true;
    try {
      await syncBoardToApi(boardToSync);
      setSyncError(null);
    } catch (e) {
      setSyncError(e.message || 'Failed to save changes');
    } finally {
      writePendingRef.current = false;
      pendingBoardRef.current = null;
    }
  }, []);

  const handleBoardChange = useCallback(
    (newBoard) => {
      setBoard(newBoard);
      pendingBoardRef.current = newBoard;

      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        if (pendingBoardRef.current) flushSync(pendingBoardRef.current);
      }, SYNC_DEBOUNCE_MS);
    },
    [flushSync]
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchState() {
      try {
        const res = await fetch(API.getStreamState());
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        const metrics = data?.metrics || {};
        const activeStream = metrics.isStreaming === true;

        setMode(metrics.mode || 'standby');
        setIsStreaming(activeStream);
        setStreamNumber(metrics.streamNumber ?? null);
        setIsUnlocked(getIsUnlocked());

        if (!writePendingRef.current && data.board) {
          setBoard(buildBoard(data.board));
        }

        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchState();
    const interval = setInterval(fetchState, POLL_INTERVALS.STATE_SYNC);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
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

  return (
    <div className="gg-page">
      <div className="gg-tasks-editor">
        <header className="gg-tasks-header">
          <div>
            <h1 className="gg-page-title">Tasks</h1>
            <p className="gg-page-subtitle">
              {isStreaming ? '🔴 Live' : '⏸️ Offline'}
              {streamNumber != null && ` · Session ${streamNumber}`}
              {isReadOnly && !isStreaming && ' — Read-only (latest session)'}
              {isReadOnly && isStreaming && !isUnlocked && ' — Read-only (unlock to edit)'}
              {!isReadOnly && ' — Editable'}
            </p>
          </div>
          <div className="gg-tasks-header-actions">
            <RunButton
              isUnlocked={isUnlocked}
              onUnlock={() => setIsUnlocked(getIsUnlocked())}
            />
            <span className="gg-mode-badge">Mode: {mode}</span>
          </div>
        </header>

        {isReadOnly && (
          <div className="gg-session-notice">
            {!isStreaming
              ? '📖 No active stream. Showing latest session in read-only mode.'
              : '🔒 Stream is locked. Click Run and enter your admin key to edit.'}
          </div>
        )}

        {syncError && (
          <div className="gg-sync-error" role="alert">
            ⚠ {syncError}
          </div>
        )}

        <KanbanBoard
          initialBoard={board}
          editable={!isReadOnly}
          onBoardChange={handleBoardChange}
        />
      </div>
    </div>
  );
}

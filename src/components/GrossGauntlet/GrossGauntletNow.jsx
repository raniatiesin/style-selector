import { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { buildBoard } from './kanban/moveTask';
import RunButton, { getIsUnlocked } from './RunButton';
import GrossGauntletControl from './GrossGauntletControl';
import { STORAGE_KEYS, POLL_INTERVALS } from './constants';
import './GrossGauntletPages.css';

const EMPTY_BOARD = buildBoard({});

async function sendActionToApi(actionObj) {
  if (!actionObj) return;
  const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
  if (!adminKey) throw new Error('Not authenticated');

  const res = await fetch(API.postTask(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminKey}`,
    },
    body: JSON.stringify(actionObj),
  });

  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED);
    throw new Error('Unauthorized — re-unlock to edit');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
}

export default function GrossGauntletNow() {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [mode, setMode] = useState('standby');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamNumber, setStreamNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(getIsUnlocked);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);

  const writePendingRef = useRef(false);

  const isEditable = isUnlocked;

  const handleBoardChange = useCallback(
    async (newBoard, actionObj) => {
      setBoard(newBoard);
      if (!actionObj) return;

      writePendingRef.current = true;
      try {
        await sendActionToApi(actionObj);
        setSyncError(null);
      } catch (e) {
        setSyncError(e.message || 'Failed to save changes');
      } finally {
        writePendingRef.current = false;
      }
    },
    []
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
    };
  }, []);

  if (loading) {
    return (
      <div className="gg-tasks-editor">
        <h1 className="gg-page-title">Tasks</h1>
        <p className="gg-page-subtitle">Loading tasks…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gg-tasks-editor">
        <h1 className="gg-page-title">Tasks</h1>
        <p className="gg-page-subtitle gg-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="gg-tasks-editor">
      <header className="gg-tasks-header">
        <div>
          <h1 className="gg-page-title">Tasks</h1>
          <p className="gg-page-subtitle">
            {isStreaming ? '🔴 Live' : '⏸️ Offline'}
            {streamNumber != null && ` · Session ${streamNumber}`}
            {!isEditable && ' — Read-only (unlock to edit)'}
            {isEditable && ' — Editable'}
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

      {!isStreaming && (
        <div className="gg-session-notice">
          📖 Between streams. Board is active and edits will apply to the upcoming session.
        </div>
      )}

      {!isEditable && isStreaming && (
        <div className="gg-session-notice">
          🔒 Stream is locked. Click Run and enter your admin key to edit.
        </div>
      )}

      {syncError && (
        <div className="gg-sync-error" role="alert">
          ⚠ {syncError}
        </div>
      )}

      <KanbanBoard
        initialBoard={board}
        editable={isEditable}
        onBoardChange={handleBoardChange}
      />

      {isEditable && (
        <div style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <button
            onClick={() => setControlPanelOpen(o => !o)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.92)',
              padding: '8px 16px',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              marginBottom: controlPanelOpen ? 16 : 0
            }}
          >
            {controlPanelOpen ? 'HIDE' : 'CONTROL PANEL'}
          </button>
          {controlPanelOpen && <GrossGauntletControl />}
        </div>
      )}
    </div>
  );
}
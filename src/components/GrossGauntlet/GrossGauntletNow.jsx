import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { buildBoard } from './kanban/moveTask';
import GrossGauntletShell from './GrossGauntletShell';
import RunButton, { getIsUnlocked } from './RunButton';
import { STORAGE_KEYS, POLL_INTERVALS } from './constants';
import styles from './GrossGauntletSession.module.css';
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

async function pushStateUpdate(updatePayload) {
  const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
  if (!adminKey) throw new Error('Not authenticated');

  const res = await fetch(API.postMetrics(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminKey}`,
    },
    body: JSON.stringify(updatePayload),
  });

  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED);
    throw new Error('Unauthorized — re-unlock to edit');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Metric update failed (${res.status})`);
  }
}

export default function GrossGauntletNow() {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [mode, setMode] = useState('standby');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamNumber, setStreamNumber] = useState(null);
  const [sessionNumber, setSessionNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(getIsUnlocked);

  // Live metrics from poll
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [contentCount, setContentCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [totalGross, setTotalGross] = useState(0);
  const [alphaGross, setAlphaGross] = useState(0);
  const [timestamps, setTimestamps] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [standbySelection, setStandbySelection] = useState('Coming Soon');

  const writePendingRef = useRef(false);
  const stateRef = useRef(null);

  const isEditable = isUnlocked;

  // Keep stateRef synced with all live state for pushUpdate
  useEffect(() => {
    stateRef.current = {
      mode,
      isStreaming,
      streamNumber,
      sessionNumber,
      accumulatedTodaySeconds: todaySeconds,
      contentCount,
      salesCount,
      totalGross,
      alphaGross,
      timestamps,
      title,
      standbySelection,
      lastBreakEndTimestamp: Date.now(),
      modeTimestamp: Date.now(),
    };
  }, [mode, isStreaming, streamNumber, sessionNumber, todaySeconds,
      contentCount, salesCount, totalGross, alphaGross, timestamps, title, standbySelection]);

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

  /** Editable stat changed in sidebar — push to API via same path as control panel */
  const handleStatChange = useCallback(async (field, value) => {
    const base = stateRef.current;
    if (!base) return;

    const updatePayload = { ...base, [field]: value };
    writePendingRef.current = true;
    try {
      await pushStateUpdate(updatePayload);
      setSyncError(null);
    } catch (e) {
      setSyncError(e.message || 'Failed to save stat change');
    } finally {
      writePendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchState() {
      try {
        const res = await fetch(API.getStreamState());
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        const m = data?.metrics || {};
        const activeStream = m.isStreaming === true;

        setMode(m.mode || 'standby');
        setIsStreaming(activeStream);
        setStreamNumber(m.streamNumber ?? null);
        setSessionNumber(m.sessionNumber ?? null);
        setIsUnlocked(getIsUnlocked());

        setTodaySeconds(m.accumulatedTodaySeconds ?? 0);
        setContentCount(m.contentCount ?? 0);
        setSalesCount(m.salesCount ?? 0);
        setTotalGross(m.totalGross ?? 0);
        setAlphaGross(m.alphaGross ?? 0);
        setTimestamps(m.timestamps ?? '');
        setTitle(m.title ?? '');
        setNotes(m.notes ?? '');
        setStreamUrl(m.stream_url ?? '');
        setStandbySelection(m.standbySelection ?? 'Coming Soon');

        if (!writePendingRef.current && data.board) {
          setBoard(buildBoard(data.board));
        }

        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load stream state');
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

  /* ── derive done / total tasks from the board ── */
  const totalTasks = Object.values(board).flat().length;
  const doneTasks = board.done?.length ?? 0;

  /* ── build sessionData for the shell sidebar ── */
  const sessionData = {
    dayNumber: 'now',
    sessionNumber: sessionNumber ?? streamNumber ?? 1,
    today_seconds: todaySeconds,
    doneTasks,
    totalTasks,
    content_count: contentCount,
    sales_count: salesCount,
    total_gross: totalGross,
    alpha_gross: alphaGross,
    timestamps,
    stream_url: streamUrl,
    notes,
    title,
    mode,
    isStreaming,
  };

  /* ── loading / error states ── */
  if (loading) {
    return (
      <GrossGauntletShell>
        <div className={styles.loading}>Loading stream state…</div>
      </GrossGauntletShell>
    );
  }

  if (error) {
    return (
      <GrossGauntletShell>
        <div className={styles.loading}>{error}</div>
      </GrossGauntletShell>
    );
  }

  /* ── main render ── */
  return (
    <GrossGauntletShell
      sessionData={sessionData}
      editable={isEditable}
      onStatChange={handleStatChange}
    >
      <div className={styles.page}>
        <header className={styles.header}>
          <Link to="/grossgauntlet" className={styles.back}>← Back</Link>
          <div className={styles.headerMeta}>
            <div className={styles.headerMetaRow}>
              <span className={styles.dayLabel}>
                NOW · Session {sessionData.sessionNumber}
              </span>
              <span className={`${styles.liveBadge} ${isStreaming ? styles.live : styles.offline}`}>
                {isStreaming ? '🔴 LIVE' : '⏸️ OFFLINE'}
              </span>
            </div>
            <div className={styles.headerActions}>
              <RunButton
                isUnlocked={isUnlocked}
                onUnlock={() => setIsUnlocked(getIsUnlocked())}
              />
              <span className={styles.modeChip}>Mode: {mode}</span>
            </div>
          </div>
        </header>

        {syncError && (
          <div className="gg-sync-error" role="alert" style={{ marginBottom: 16 }}>
            ⚠ {syncError}
          </div>
        )}

        {!isStreaming && (
          <div className="gg-session-notice" style={{ marginBottom: 16 }}>
            📖 Between streams. Board and stats are active — edits apply to the upcoming session.
          </div>
        )}

        {!isEditable && isStreaming && (
          <div className="gg-session-notice" style={{ marginBottom: 16 }}>
            🔒 Stream is locked. Click Run and enter your admin key to edit.
          </div>
        )}

        <div className={styles.body}>
          <div className={styles.left}>
            <div className={styles.boardWrap}>
              <KanbanBoard
                initialBoard={board}
                editable={isEditable}
                onBoardChange={handleBoardChange}
              />
            </div>
          </div>
        </div>
      </div>
    </GrossGauntletShell>
  );
}
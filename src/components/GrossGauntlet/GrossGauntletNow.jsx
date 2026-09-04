import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import OBSWebSocket from 'obs-websocket-js';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { buildBoard } from './kanban/moveTask';
import GrossGauntletShell from './GrossGauntletShell';
import RunButton, { getIsUnlocked, getAdminKey } from './RunButton';
import { STORAGE_KEYS, POLL_INTERVALS, OBS_CONFIG, STANDBY_OPTIONS } from './constants';
import NowPanel from './NowPanel';
import styles from './GrossGauntletSession.module.css';
import useNotifications from './useNotifications';
import './GrossGauntletPages.css';

const EMPTY_BOARD = buildBoard({});

async function sendActionToApi(actionObj) {
  if (!actionObj) return null;
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

  const data = await res.json();
  return data?.board || null;
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
  const [streamUrl, setStreamUrl] = useState('');
  const [standbySelection, setStandbySelection] = useState('Coming Soon');
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTimestamp, setPausedTimestamp] = useState(null);
  const [lastBreakEndTimestamp, setLastBreakEndTimestamp] = useState(Date.now());
  const [modeTimestamp, setModeTimestamp] = useState(Date.now());

  // OBS WebSocket state
  const [obsConnected, setObsConnected] = useState(false);
  const obsRef = useRef(null);
  const obsSceneChangeRef = useRef(false);
  const uiSceneChangeRef = useRef(false);

  // Modal state
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explainTopicInput, setExplainTopicInput] = useState('');
  const [showStandbyModal, setShowStandbyModal] = useState(false);
  const [standbySelectedOption, setStandbySelectedOption] = useState('Coming Soon');

  const writePendingRef = useRef(false);
  const stateRef = useRef(null);
  const writeCooldownRef = useRef(0);
  const notesRef = useRef(null);

  const [blocs, setBlocs] = useState([]);
  const [activeBloc, setActiveBloc] = useState(null);

  const isEditable = isUnlocked;

  const { notifications: notifs, add: addNotif, dismiss: dismissNotif } = useNotifications();

  // Clear stale localStorage stash on mount — forces server-first board loading
  useEffect(() => {
    try { localStorage.removeItem('GG_STASHED_BOARD'); } catch { /* noop */ }
  }, []);

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
      isPaused,
      pausedTimestamp: pausedTimestamp ?? null,
      lastBreakEndTimestamp: lastBreakEndTimestamp || Date.now(),
      modeTimestamp: modeTimestamp || Date.now(),
    };
  }, [mode, isStreaming, streamNumber, sessionNumber, todaySeconds,
      contentCount, salesCount, totalGross, alphaGross, timestamps, title, standbySelection, isPaused, pausedTimestamp, lastBreakEndTimestamp, modeTimestamp]);

  const handleBoardChange = useCallback(
    async (newBoard, actionObj) => {
      writePendingRef.current = true;
      setBoard(newBoard);
      if (!actionObj) { writePendingRef.current = false; return; }

      // Log timestamp when a task enters "in progress"
      if (actionObj.action === 'move' && actionObj.toColumn === 'in_progress') {
        const task = newBoard.in_progress?.find(t => t.id === actionObj.taskId);
        const taskName = task?.name || 'Untitled';
        try {
          await pushStateUpdate({
            ...stateRef.current,
            timestamps: (stateRef.current?.timestamps || '')
              ? `${stateRef.current?.timestamps || ''}\n00:00 - in_progress - ${taskName}`
              : `00:00 - in_progress - ${taskName}`
          });
          addNotif({ type: 'info', action: 'auto_timestamp', endpoint: API.postMetrics(), message: `Auto-timestamped: in_progress - ${taskName}` });
        } catch (e) {
          // non-blocking
        }
      }

      const actionLabel = {
        create: 'Create Task',
        move: 'Move Task',
        rename: 'Rename Task',
        delete: 'Delete Task',
      }[actionObj.action] || actionObj.action;

      try {
        const returnedBoard = await sendActionToApi(actionObj);
        if (returnedBoard) {
          // Check if card survived delete — if so, force-purge it
          if (actionObj.action === 'delete' && actionObj.taskId) {
            const cardStillThere = Object.values(returnedBoard).some(
              col => Array.isArray(col) && col.some(t => String(t.id) === String(actionObj.taskId))
            );
            if (cardStillThere) {
              addNotif({ type: 'info', action: 'Force Delete', endpoint: API.postTask(), message: `Card ${actionObj.taskId.slice(0,8)}… still present after normal delete — issuing force purge.` });
              const forceRes = await fetch(API.postTask(), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY)}`,
                },
                body: JSON.stringify({ action: 'forceDelete', taskId: actionObj.taskId }),
              });
              if (forceRes.ok) {
                const forceData = await forceRes.json();
                setBoard(buildBoard(forceData.board || returnedBoard));
                addNotif({ type: 'success', action: 'Force Delete', endpoint: API.postTask(), statusCode: 200, message: `✓ Force-purged ${forceData.purgedCount || 0} ghost log entries for ghost card.` });
              } else {
                // Fallback: just accept the returned board as-is
                setBoard(buildBoard(returnedBoard));
              }
            } else {
              setBoard(buildBoard(returnedBoard));
            }
          } else if (actionObj.action === 'move' && actionObj.taskId) {
            // Check if card arrived at target column
            const inTarget = returnedBoard[actionObj.toColumn] || [];
            const atTarget = inTarget.some(t => String(t.id) === String(actionObj.taskId));
            if (!atTarget) {
              addNotif({ type: 'info', action: 'Force Move', endpoint: API.postTask(), message: `Card ${actionObj.taskId.slice(0,8)}… not in target after normal move — issuing force move.` });
              const forceRes = await fetch(API.postTask(), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY)}`,
                },
                body: JSON.stringify({ action: 'forceMove', taskId: actionObj.taskId, toColumn: actionObj.toColumn, fromColumn: actionObj.fromColumn }),
              });
              if (forceRes.ok) {
                const forceData = await forceRes.json();
                setBoard(buildBoard(forceData.board || returnedBoard));
                addNotif({ type: 'success', action: 'Force Move', endpoint: API.postTask(), statusCode: 200, message: `✓ Force-moved ghost card to ${actionObj.toColumn}.` });
              } else {
                setBoard(buildBoard(returnedBoard));
              }
            } else {
              setBoard(buildBoard(returnedBoard));
            }
          } else {
            setBoard(buildBoard(returnedBoard));
          }
          try { localStorage.setItem('GG_STASHED_BOARD', JSON.stringify(returnedBoard)); } catch { /* noop */ }
          const serverCardCount = Object.values(returnedBoard).reduce((s, col) => s + (col?.length || 0), 0);
          addNotif({ type: 'success', action: actionLabel, endpoint: API.postTask(), statusCode: 200, message: `✓ ${actionLabel} synced. Board now has ${serverCardCount} cards.` });
        }
        setSyncError(null);
      } catch (e) {
        setSyncError(e.message || 'Failed to save changes');
        addNotif({ type: 'error', action: actionLabel, endpoint: API.postTask(), message: `✗ ${actionLabel} FAILED — ${e.message}` });
      } finally {
        writePendingRef.current = false;
        writeCooldownRef.current = Date.now() + 4000;
      }
    },
    [addNotif]
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
      addNotif({ type: 'success', action: 'Update Stat', endpoint: API.postMetrics(), statusCode: 200, message: `✓ Updated ${field} = ${value}` });
    } catch (e) {
      setSyncError(e.message || 'Failed to save stat change');
      addNotif({ type: 'error', action: 'Update Stat', endpoint: API.postMetrics(), message: `✗ Failed to update ${field}: ${e.message}` });
    } finally {
      writePendingRef.current = false;
      writeCooldownRef.current = Date.now() + 4000;
    }
  }, [addNotif]);

  /* ── Mode change handler (same logic as control panel's setMode) ── */
  const handleModeChange = useCallback(async (targetMode) => {
    const current = stateRef.current;
    if (!current) return;

    const isExplainTarget = targetMode.startsWith('explain');
    const isExplainCurrent = current.mode.startsWith('explain');
    let modeStr = targetMode;
    let explainTopicTarget = '';

    if (isExplainTarget) {
      explainTopicTarget = targetMode.split('|').slice(1).join('|').trim();
      if (!explainTopicTarget) return;
      try { localStorage.setItem('EXPLAIN_TOPIC', explainTopicTarget); } catch { /* */ }
    }

    if (current.mode === modeStr) return;

    let nextAccumulated = current.accumulatedTodaySeconds || 0;
    let nextTimestamp = Date.now();

    const isWorkToExplain = (current.mode === 'work' && isExplainTarget);
    const isExplainToWork = (isExplainCurrent && modeStr === 'work');
    const isWorkToStandby = (current.mode === 'work' && modeStr === 'standby');
    const isStandbyToWork = (current.mode === 'standby' && modeStr === 'work');
    const isBreakToWork = (current.mode === 'break' && modeStr === 'work');

    if (current.isPaused) {
      nextAccumulated = current.accumulatedTodaySeconds || 0;
      nextTimestamp = modeStr === 'break' ? Date.now() : (current.modeTimestamp || Date.now());
    } else if (isWorkToExplain || isWorkToStandby) {
      if (current.modeTimestamp) {
        const elapsed = Math.max(0, Math.floor((Date.now() - current.modeTimestamp) / 1000));
        nextAccumulated = (current.accumulatedTodaySeconds || 0) + elapsed;
      }
      nextTimestamp = Date.now();
    } else if (isExplainToWork || isStandbyToWork || isBreakToWork) {
      nextAccumulated = current.accumulatedTodaySeconds || 0;
      nextTimestamp = Date.now();
    } else if (current.mode === 'work') {
      if (current.modeTimestamp) {
        const elapsed = Math.max(0, Math.floor((Date.now() - current.modeTimestamp) / 1000));
        nextAccumulated += elapsed;
      }
      nextTimestamp = Date.now();
    }

    const newState = {
      ...current,
      mode: modeStr,
      accumulatedTodaySeconds: nextAccumulated,
      lastBreakEndTimestamp: (isBreakToWork || isStandbyToWork) ? Date.now() : (current.lastBreakEndTimestamp || Date.now()),
      modeTimestamp: nextTimestamp,
      standbySelection: modeStr === 'standby' ? (standbySelectedOption || current.standbySelection || 'Coming Soon') : current.standbySelection,
      _skipPushCalc: true,
    };

    // Update local React state immediately for snappy feedback
    setMode(modeStr);
    setModeTimestamp(nextTimestamp);
    setTodaySeconds(nextAccumulated);
    if (isBreakToWork || isStandbyToWork) setLastBreakEndTimestamp(Date.now());

    // OBS scene change
    if (obsRef.current && obsConnected) {
      if (obsSceneChangeRef.current) {
        obsSceneChangeRef.current = false;
      } else {
        uiSceneChangeRef.current = true;
        setTimeout(() => { uiSceneChangeRef.current = false; }, 2000);
        const scene = modeStr === 'work' ? OBS_CONFIG.SCENES.WORK
          : isExplainTarget ? OBS_CONFIG.SCENES.EXPLAIN
          : modeStr === 'break' ? OBS_CONFIG.SCENES.BREAK
          : OBS_CONFIG.SCENES.STANDBY;

        obsRef.current.call('SetCurrentProgramScene', { sceneName: scene })
          .catch(e => console.error('OBS scene change failed:', e));
      }
    }

    // Push to API
    writePendingRef.current = true;
    try {
      await pushStateUpdate(newState);
      setSyncError(null);
      addNotif({ type: 'success', action: 'Mode Change', endpoint: API.postMetrics(), statusCode: 200, message: `✓ Mode switched to ${modeStr}${explainTopicTarget ? ' — ' + explainTopicTarget : ''}` });
    } catch (e) {
      setSyncError(e.message || 'Mode change failed');
      addNotif({ type: 'error', action: 'Mode Change', endpoint: API.postMetrics(), message: `✗ Mode change to ${modeStr} FAILED: ${e.message}` });
    } finally {
      writePendingRef.current = false;
      writeCooldownRef.current = Date.now() + 4000;
    }
  }, [obsConnected, standbySelectedOption, addNotif]);

  /* ── Modal handlers ── */
  const handleExplainConfirm = useCallback(() => {
    const topic = explainTopicInput.trim();
    if (!topic) return;
    setShowExplainModal(false);
    handleModeChange('explain|' + topic);
  }, [explainTopicInput, handleModeChange]);

  const handleStandbyConfirm = useCallback(() => {
    const text = standbySelectedOption || 'Coming Soon';
    setShowStandbyModal(false);
    setStandbySelection(text);
    handleModeChange('standby');
  }, [standbySelectedOption, handleModeChange]);

  useEffect(() => {
    let cancelled = false;

    async function fetchState() {
      try {
        const res = await fetch(API.getStreamState());
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (Date.now() < writeCooldownRef.current) return;

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
        setStreamUrl(m.stream_url ?? '');
        setStandbySelection(m.standbySelection ?? 'Coming Soon');
        setIsPaused(m.isPaused ?? false);
        setPausedTimestamp(m.pausedTimestamp ?? null);
        if (m.modeTimestamp) setModeTimestamp(Number(m.modeTimestamp));

        if (!writePendingRef.current && data.board) {
          const apiBoard = data.board;
          const boardCardCount = Object.values(apiBoard).reduce((s, col) => s + (col?.length || 0), 0);
          const hasCards = boardCardCount > 0;
          const hasSession = !!m.sessionNumber;
          if (hasCards) {
            setBoard(buildBoard(apiBoard));
            try { localStorage.setItem('GG_STASHED_BOARD', JSON.stringify(apiBoard)); } catch { /* noop */ }
          } else if (!hasSession) {
            // No session at all AND empty board — fall back to stash for offline-first
            const stashed = localStorage.getItem('GG_STASHED_BOARD');
            if (stashed) {
              try {
                const parsed = JSON.parse(stashed);
                if (parsed && Object.values(parsed).some(col => col && col.length > 0)) {
                  setBoard(buildBoard(parsed));
                }
              } catch { /* ignore corrupt stash */ }
            }
          }
          // If hasSession=true and board is empty, it's genuinely empty — show it as-is
        }

        setError(null);
        // Only notify on poll if there was a previous error (recovery)
        if (error) addNotif({ type: 'success', action: 'Poll Recovery', endpoint: API.getStreamState(), statusCode: res.status, message: `Poll recovered — session #${m.sessionNumber || '?'} OK` });
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load stream state');
          addNotif({ type: 'error', action: 'Poll', endpoint: API.getStreamState(), message: `✗ Poll FAILED — ${e.message}` });
        }
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

  /* ── OBS WebSocket connection ── */
  useEffect(() => {
    if (!isUnlocked) return;

    let keepConnecting = true;
    let reconnectTimer;

    const obs = new OBSWebSocket();
    obsRef.current = obs;

    async function connect() {
      if (!keepConnecting) return;
      try {
        const obsPassword = localStorage.getItem(STORAGE_KEYS.OBS_PASS) || '';
        await obs.connect(OBS_CONFIG.WS_URL, obsPassword);
        if (!keepConnecting) { obs.disconnect(); return; }
        setObsConnected(true);

        obs.on("CurrentProgramSceneChanged", (event) => {
          const map = {
            [OBS_CONFIG.SCENES.WORK]: "work",
            [OBS_CONFIG.SCENES.EXPLAIN]: "explain",
            [OBS_CONFIG.SCENES.BREAK]: "break",
            [OBS_CONFIG.SCENES.STANDBY]: "standby",
          };
          const mapped = map[event.sceneName];
          if (!mapped) return;

          obsSceneChangeRef.current = true;

          if (uiSceneChangeRef.current) {
            uiSceneChangeRef.current = false;
            setMode(mapped);
            setTimeout(() => { obsSceneChangeRef.current = false; }, 1000);
            return;
          }

          // OBS-initiated change: update local mode but don't push back (avoids loop)
          setMode(mapped);
          setTimeout(() => { obsSceneChangeRef.current = false; }, 1000);
        });

        obs.on("ConnectionClosed", () => {
          if (!keepConnecting) return;
          setObsConnected(false);
          reconnectTimer = setTimeout(connect, 5000);
        });
      } catch (err) {
        if (!keepConnecting) return;
        setObsConnected(false);
        reconnectTimer = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      keepConnecting = false;
      clearTimeout(reconnectTimer);
      if (obsRef.current) {
        obsRef.current.disconnect();
        obsRef.current = null;
      }
    };
  }, [isUnlocked]);

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
    title,
    mode,
    isStreaming,
  };

  /* ── Fetch blocs (NoteLogs) on mount (one-time) ── */
  useEffect(() => {
    let cancelled = false;
    async function fn() {
      try {
        const res = await fetch(API.getNotes(0, 0));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.notes)) setBlocs(json.notes);
      } catch (e) { console.error('Failed to fetch notes blocs:', e); }
    }
    fn();
    return () => { cancelled = true; };
  }, []);

  /* ── Bloc handlers ── */
  function handleBlocBlur(blocId, type, e) {
    const newContent = e.target.textContent || '';
    const bloc = blocs.find(b => b.bloc_id === blocId);
    if (!bloc) return;
    if (bloc.content === newContent) { setActiveBloc(null); return; }
    setBlocs(prev => prev.map(b => b.bloc_id === blocId ? { ...b, content: newContent } : b));
    setActiveBloc(null);
    const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
    if (!adminKey) return;
    fetch(API.postNote(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
      body: JSON.stringify({ bloc_id: blocId, type, content: newContent }),
    }).catch(e => console.error('Failed to save note:', e));
  }

  function handleBlocKeyDown(blocId, type, e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newId = crypto.randomUUID();
      const newBloc = { bloc_id: newId, type: 'normal', content: '' };
      const idx = blocs.findIndex(b => b.bloc_id === blocId);
      const updated = [...blocs];
      updated.splice(idx + 1, 0, newBloc);
      setBlocs(updated);
      setActiveBloc(newId);
      const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
      if (adminKey) {
        fetch(API.postNote(), {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify({ bloc_id: newId, type: 'normal', content: '' }),
        }).catch(e => console.error('Failed to create note:', e));
      }
      requestAnimationFrame(() => {
        const el = notesRef.current?.querySelector(`[data-bloc-id="${newId}"]`);
        if (el) el.focus();
      });
      return;
    }
    if (e.key === 'Backspace' && !e.target.textContent) {
      e.preventDefault();
      const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
      setBlocs(prev => prev.filter(b => b.bloc_id !== blocId));
      setActiveBloc(null);
      if (adminKey) {
        fetch(API.postNote(), {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify({ bloc_id: blocId, type, content: '' }),
        }).catch(e => console.error('Failed to delete note:', e));
      }
      return;
    }
    // Heading shortcut: type "# " at start of empty bloc
    if (e.key === ' ' && e.target.textContent === '#') {
      e.preventDefault();
      e.target.textContent = '';
      setBlocs(prev => prev.map(b => b.bloc_id === blocId ? { ...b, type: 'heading', content: '' } : b));
      const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
      if (adminKey) {
        fetch(API.postNote(), {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify({ bloc_id: blocId, type: 'heading', content: '' }),
        }).catch(e => console.error('Failed to convert to heading:', e));
      }
      return;
    }
    // Divider shortcut: type "--- " at start of bloc
    if (e.key === ' ' && e.target.textContent === '---') {
      e.preventDefault();
      e.target.textContent = '';
      const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
      setBlocs(prev => prev.map(b => b.bloc_id === blocId ? { ...b, type: 'divider', content: '' } : b));
      if (adminKey) {
        fetch(API.postNote(), {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify({ bloc_id: blocId, type: 'divider', content: '' }),
        }).catch(e => console.error('Failed to convert to divider:', e));
      }
      // Create a fresh empty normal bloc below the divider
      const newId = crypto.randomUUID();
      const newBloc = { bloc_id: newId, type: 'normal', content: '' };
      const idx = blocs.findIndex(b => b.bloc_id === blocId);
      const updated = [...blocs];
      updated.splice(idx + 1, 0, newBloc);
      setBlocs(updated);
      setActiveBloc(newId);
      if (adminKey) {
        fetch(API.postNote(), {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify({ bloc_id: newId, type: 'normal', content: '' }),
        }).catch(e => console.error('Failed to create note:', e));
      }
      requestAnimationFrame(() => {
        const el = notesRef.current?.querySelector(`[data-bloc-id="${newId}"]`);
        if (el) el.focus();
      });
      return;
    }
  }

  function handleEmptyLineBlur(e) {
    const content = e.target.textContent || '';
    if (!content.trim()) { e.target.textContent = ''; setActiveBloc(null); return; }
    const newId = crypto.randomUUID();
    const newBloc = { bloc_id: newId, type: 'normal', content };
    setBlocs(prev => [...prev, newBloc]);
    setActiveBloc(null);
    const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
    if (adminKey) {
      fetch(API.postNote(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ bloc_id: newId, type: 'normal', content }),
      }).catch(e => console.error('Failed to create note:', e));
    }
    e.target.textContent = '';
  }

  function handleEmptyLineKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = e.target.textContent || '';
      if (!content.trim()) return;
      const newId = crypto.randomUUID();
      const newBloc = { bloc_id: newId, type: 'normal', content };
      setBlocs(prev => [...prev, newBloc]);
      const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
      if (adminKey) {
        fetch(API.postNote(), {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify({ bloc_id: newId, type: 'normal', content }),
        }).catch(e => console.error('Failed to create note:', e));
      }
      e.target.textContent = '';
    }
  }

  function handleAddBloc() {
    const newId = crypto.randomUUID();
    const newBloc = { bloc_id: newId, type: 'normal', content: '' };
    setBlocs(prev => [...prev, newBloc]);
    setActiveBloc(newId);
    const adminKey = localStorage.getItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
    if (adminKey) {
      fetch(API.postNote(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ bloc_id: newId, type: 'normal', content: '' }),
      }).catch(e => console.error('Failed to create note:', e));
    }
    requestAnimationFrame(() => {
      const el = notesRef.current?.querySelector(`[data-bloc-id="${newId}"]`);
      if (el) el.focus();
    });
  }

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
      sidebarAction={
        <RunButton
          isUnlocked={isUnlocked}
          onUnlock={() => setIsUnlocked(getIsUnlocked())}
        />
      }
    >
      <div className={`${styles.page} ${styles.pageFlex}`}>
        <header className={styles.header}>
          <Link to="/grossgauntlet" className={styles.back}>← Back</Link>

          {isEditable && (
            <div className={styles.headerCenter}>
              <button
                className={`gg-mode-btn ${mode === 'work' ? 'active' : ''}`}
                onClick={() => handleModeChange('work')}
                title="Switch to Work scene"
              >
                Work
              </button>
              <button
                className={`gg-mode-btn ${mode.startsWith('explain') ? 'active' : ''}`}
                onClick={() => { setExplainTopicInput(''); setShowExplainModal(true); }}
                title="Switch to Explain scene"
              >
                Explain
              </button>
              <button
                className={`gg-mode-btn ${mode === 'break' ? 'active' : ''}`}
                onClick={() => handleModeChange('break')}
                title="Switch to Break scene"
              >
                Break
              </button>
              <button
                className={`gg-mode-btn ${mode === 'standby' ? 'active' : ''}`}
                onClick={() => { setStandbySelectedOption(standbySelection); setShowStandbyModal(true); }}
                title="Switch to Standby scene"
              >
                Standby
              </button>
            </div>
          )}

          <div className={styles.headerMeta}>
            <div className={styles.headerMetaRow}>
              <span className={`${styles.liveBadge} ${isStreaming ? styles.live : styles.offline}`}>
                <span className={isStreaming ? styles.liveDot : styles.offlineDot} />
                {isStreaming ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <div className={styles.headerActions}>
            </div>
          </div>
        </header>

        {syncError && (
          <div className="gg-sync-error" role="alert" style={{ marginBottom: 16 }}>
            ⚠ {syncError}
          </div>
        )}

        {!isEditable && isStreaming && (
          <div className="gg-session-notice" style={{ marginBottom: 16 }}>
            🔒 Stream is locked. Click Run and enter your admin key to edit.
          </div>
        )}

        <NowPanel
          blocs={blocs}
          activeBlocId={activeBloc}
          onBlocChange={setActiveBloc}
          isEditable={isEditable}
          notesContainerRef={notesRef}
          notifications={notifs}
          onDismissNotification={dismissNotif}
          kanbanContent={
            <KanbanBoard
              initialBoard={board}
              editable={isEditable}
              onBoardChange={handleBoardChange}
            />
          }
          renderBloc={(bloc) => {
            if (bloc.type === 'divider') {
              return (
                <div className={`${styles.noteBloc} ${styles.noteBlocDivider}`}>
                  <hr />
                </div>
              );
            }
            return (
              <div
                className={`${styles.noteBloc} ${bloc.type === 'heading' ? styles.noteBlocHeading : ''} ${bloc.bloc_id === activeBloc ? styles.noteBlocActive : ''}`}
                contentEditable={isEditable}
                suppressContentEditableWarning
                data-bloc-id={bloc.bloc_id}
                onClick={() => setActiveBloc(bloc.bloc_id)}
                onBlur={e => handleBlocBlur(bloc.bloc_id, bloc.type, e)}
                onKeyDown={e => handleBlocKeyDown(bloc.bloc_id, bloc.type, e)}
                dangerouslySetInnerHTML={{ __html: bloc.content || '' }}
              />
            );
          }}
          renderEmptyLine={() => (
            <div
              className={`${styles.noteBloc} ${styles.emptyLine} ${activeBloc === '__empty__' ? styles.noteBlocActive : ''}`}
              contentEditable={isEditable}
              suppressContentEditableWarning
              data-empty-line
              onClick={() => setActiveBloc('__empty__')}
              onBlur={handleEmptyLineBlur}
              onKeyDown={handleEmptyLineKeyDown}
              onFocus={() => setActiveBloc('__empty__')}
            />
          )}
        />

        {/* ── Explain Topic Modal ── */}
        {showExplainModal && (
          <div className="gg-modal-overlay" onClick={() => setShowExplainModal(false)}>
            <div className="gg-modal" onClick={e => e.stopPropagation()}>
              <div className="gg-modal-title">Explain Topic</div>
              <input
                type="text"
                className="gg-modal-input"
                placeholder="what are you explaining?"
                value={explainTopicInput}
                onChange={e => setExplainTopicInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleExplainConfirm(); }}
                autoFocus
              />
              <div className="gg-modal-actions">
                <button className="gg-modal-btn gg-modal-btn--confirm" onClick={handleExplainConfirm}>Switch</button>
                <button className="gg-modal-btn gg-modal-btn--cancel" onClick={() => setShowExplainModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Standby Selection Modal ── */}
        {showStandbyModal && (
          <div className="gg-modal-overlay" onClick={() => setShowStandbyModal(false)}>
            <div className="gg-modal" onClick={e => e.stopPropagation()}>
              <div className="gg-modal-title">Standby — What are you doing?</div>
              <div className="gg-modal-options">
                {STANDBY_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`gg-modal-option ${standbySelectedOption === opt ? 'selected' : ''}`}
                    onClick={() => setStandbySelectedOption(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="gg-modal-actions">
                <button className="gg-modal-btn gg-modal-btn--confirm" onClick={handleStandbyConfirm}>Switch</button>
                <button className="gg-modal-btn gg-modal-btn--cancel" onClick={() => setShowStandbyModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </GrossGauntletShell>
  );
}
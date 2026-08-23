import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import GrossGauntletShell from './GrossGauntletShell';
import { replayToTime } from './kanban/moveTask';
import styles from './GrossGauntletSession.module.css';
import './GrossGauntletPages.css';

const EMPTY_BOARD = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };

function getModeAtTime(timestamps, sessionStartTs, currentTime) {
  if (!timestamps || !sessionStartTs) return 'work';
  const sessionStart = new Date(sessionStartTs);
  let currentMode = 'work';
  for (const line of timestamps.split('\n').filter(Boolean)) {
    const match = line.match(/^(\d+):(\d+)(?::(\d+))?\s*-\s*(\w+)/);
    if (!match) continue;
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
    const lineTime = new Date(sessionStart.getTime() + seconds * 1000);
    if (lineTime <= currentTime) currentMode = match[4].toLowerCase();
    else break;
  }
  return currentMode;
}

export default function GrossGauntletSession() {
  const { dayNumber, sessionNumber } = useParams();
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sliderValue, setSliderValue] = useState(100);
  const [totalSessions, setTotalSessions] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError('');
      setSession(null);
      try {
        const fetchJson = async (url) => {
          const response = await fetch(url);
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            const error = new Error(payload.error || `Request failed (${response.status})`);
            error.status = response.status;
            throw error;
          }
          return payload;
        };
        const [sessionRes, eventsRes, dayRes] = await Promise.all([
          fetchJson(API.getSession(dayNumber, sessionNumber)),
          fetchJson(API.getEvents(dayNumber, sessionNumber)),
          fetchJson(API.getDay(dayNumber)),
        ]);
        const sessionData = sessionRes.session ?? sessionRes.data ?? null;
        setSession(sessionData);
        setEvents(Array.isArray(eventsRes.events) ? eventsRes.events : []);
        setTotalSessions(Array.isArray(dayRes.sessions) && dayRes.sessions.length ? dayRes.sessions.length : 1);
      } catch (error) {
        setSession(null);
        setEvents([]);
        setLoadError(error.status === 404 ? '' : 'Unable to load this session. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dayNumber, sessionNumber]);

  const startTime = events[0] ? new Date(events[0].occurred_at).getTime() : 0;
  const endTime = events.at(-1) ? new Date(events.at(-1).occurred_at).getTime() : 0;
  const totalMs = endTime - startTime || 1;
  const currentMs = startTime + (sliderValue / 100) * totalMs;
  const currentTime = new Date(currentMs);
  const board = events.length ? replayToTime(events, currentTime) : EMPTY_BOARD;
  const modeAtTime = getModeAtTime(session?.timestamps, session?.session_start_timestamp, currentTime);
  const isInactive = ['break', 'standby', 'explain'].includes(modeAtTime);
  const totalTasks = Object.values(board).flat().length;
  const doneTasks = board.done?.length ?? 0;
  const backPath = totalSessions > 1 ? `/grossgauntlet/${dayNumber}` : '/grossgauntlet';

  function formatElapsed(ms) {
    const s = Math.floor(Math.abs(ms) / 1000);
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  if (loading) return <GrossGauntletShell><div className={styles.loading}>Loading…</div></GrossGauntletShell>;
  if (loadError) return <GrossGauntletShell><div className={styles.loading}>{loadError}</div></GrossGauntletShell>;
  if (!session) return <GrossGauntletShell><div className={styles.loading}>Session not found.</div></GrossGauntletShell>;

  const sessionData = {
    dayNumber,
    sessionNumber,
    today_seconds: session.today_seconds ?? 0,
    doneTasks,
    totalTasks,
    content_count: session.content_count ?? 0,
    sales_count: session.sales_count ?? 0,
    timestamps: session.timestamps,
    stream_url: session.stream_url,
    notes: session.notes ?? '',
  };

  return (
    <GrossGauntletShell sessionData={sessionData}>
      <div className={styles.page}>
        <div className={styles.header}>
          <Link to={backPath} className={styles.back}>← Back</Link>
          <div className={styles.headerMeta}>
            <span className={styles.dayLabel}>DAY {dayNumber} · SESSION {sessionNumber}</span>
            <span className={styles.dateLabel}>{new Date(session.date || session.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.left}>
            {isInactive && <div className={styles.modeIndicator}>{modeAtTime === 'break' ? 'Break' : modeAtTime === 'standby' ? 'Standby' : 'Explain'}</div>}
            <div className={`${styles.boardWrap} ${isInactive ? styles.boardInactive : ''}`}><KanbanBoard initialBoard={board} editable={false} /></div>
          </div>
        </div>
      </div>

      {events.length > 0 && (
        <div className="gg-bottom-bar">
          <input
            className={styles.scrubber}
            type="range"
            min="0"
            max="100"
            step="0.01"
            value={sliderValue}
            aria-label="Replay position"
            onChange={e => setSliderValue(Number(e.target.value))}
          />
          <span className={styles.time}>{formatElapsed(currentMs - startTime)} / {formatElapsed(totalMs)}</span>
        </div>
      )}
    </GrossGauntletShell>
  );
}
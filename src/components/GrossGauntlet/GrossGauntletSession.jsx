import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { replayToTime } from './kanban/moveTask';
import { formatHMS } from './utils';
import styles from './GrossGauntletSession.module.css';

const EMPTY_BOARD = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };
const SPEEDS = [1, 2, 5, 10];

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
  const [sliderValue, setSliderValue] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [statsOpen, setStatsOpen] = useState(true);
  const [notes, setNotes] = useState('');
  const [totalSessions, setTotalSessions] = useState(1);
  const playRef = useRef(null);
  const notesTimerRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sessionRes, eventsRes, dayRes] = await Promise.all([
          fetch(API.getSession(dayNumber, sessionNumber)).then(r => r.json()),
          fetch(API.getEvents(dayNumber, sessionNumber)).then(r => r.json()),
          fetch(API.getDay(dayNumber)).then(r => r.json()),
        ]);
        setSession(sessionRes.session ?? sessionRes.data ?? null);
        setNotes(sessionRes.session?.notes ?? sessionRes.data?.notes ?? '');
        setEvents(eventsRes.events ?? []);
        setTotalSessions(dayRes.sessions?.length ?? 1);
      } catch {
        setSession(null);
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

  useEffect(() => {
    if (!isPlaying) { clearInterval(playRef.current); return undefined; }
    const tick = 100;
    const advance = (tick / totalMs) * 100 * speed;
    playRef.current = setInterval(() => setSliderValue(prev => {
      if (prev >= 100) { setIsPlaying(false); return 100; }
      return Math.min(prev + advance, 100);
    }), tick);
    return () => clearInterval(playRef.current);
  }, [isPlaying, speed, totalMs]);

  useEffect(() => () => {
    clearInterval(playRef.current);
    clearTimeout(notesTimerRef.current);
  }, []);

  function handleNotesChange(value) {
    setNotes(value);
    clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => fetch(API.postNotes(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayNumber: Number(dayNumber), sessionNumber: Number(sessionNumber), notes: value }),
    }), 800);
  }

  function formatElapsed(ms) {
    const s = Math.floor(Math.abs(ms) / 1000);
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!session) return <div className={styles.loading}>Session not found.</div>;

  return (
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
          {events.length > 0 && <div className={styles.scrubberWrap}>
            <div className={styles.scrubberControls}>
              <button className={styles.playBtn} onClick={() => setIsPlaying(p => !p)} aria-label={isPlaying ? 'Pause replay' : 'Play replay'}>{isPlaying ? '⏸' : '▶'}</button>
              <div className={styles.speeds}>{SPEEDS.map(s => <button key={s} className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`} onClick={() => setSpeed(s)}>{s}×</button>)}</div>
              <span className={styles.time}>{formatElapsed(currentMs - startTime)} / {formatElapsed(totalMs)}</span>
            </div>
            <input className={styles.scrubber} type="range" min="0" max="100" step="0.01" value={sliderValue} aria-label="Replay position" onChange={e => { setIsPlaying(false); setSliderValue(Number(e.target.value)); }} />
          </div>}
          {isInactive && <div className={styles.modeIndicator}>{modeAtTime === 'break' ? 'Break' : modeAtTime === 'standby' ? 'Standby' : 'Explain'}</div>}
          <div className={`${styles.boardWrap} ${isInactive ? styles.boardInactive : ''}`}><KanbanBoard initialBoard={board} editable={false} /></div>
        </div>
        <aside className={styles.rightPanel}>
          <button className={styles.panelHeader} onClick={() => setStatsOpen(p => !p)}><span className={styles.panelLabel}>STATS</span><span className={styles.panelToggle}>{statsOpen ? '−' : '+'}</span></button>
          <div className={`${styles.panelBody} ${!statsOpen ? styles.panelClosed : ''}`}>
            <div className={styles.statGroup}><div className={styles.stat}><span className={styles.statLabel}>today</span><span className={styles.statVal}>{formatHMS(session.today_seconds ?? 0)}</span></div><div className={styles.stat}><span className={styles.statLabel}>since break</span><span className={styles.statVal}>—</span></div></div>
            <div className={styles.divider} />
            <div className={styles.statGroup}><div className={styles.stat}><span className={styles.statLabel}>done</span><span className={styles.statVal}>{doneTasks} / {totalTasks}</span></div><div className={styles.stat}><span className={styles.statLabel}>content</span><span className={styles.statVal}>{session.content_count ?? 0}</span></div><div className={styles.stat}><span className={styles.statLabel}>sales</span><span className={styles.statVal}>{session.sales_count ?? 0}</span></div></div>
            <div className={styles.divider} />
            <p className={styles.sectionLabel}>NOTES</p><textarea className={styles.notes} value={notes} onChange={e => handleNotesChange(e.target.value)} placeholder="Stream notes…" />
            <div className={styles.divider} />
            {session.timestamps && <><p className={styles.sectionLabel}>TIMESTAMPS</p><pre className={styles.timestamps}>{session.timestamps}</pre></>}
            {session.stream_url && <><div className={styles.divider} /><a href={session.stream_url} target="_blank" rel="noopener noreferrer" className={styles.watchLink}>▶ Watch on YouTube</a></>}
          </div>
        </aside>
      </div>
    </div>
  );
}

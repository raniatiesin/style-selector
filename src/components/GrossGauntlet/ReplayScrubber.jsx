import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { replayToTime } from './kanban/moveTask';
import styles from './ReplayScrubber.module.css';

const SPEEDS = [1, 2, 5, 10];

export default function ReplayScrubber() {
  const { date, sessionNumber } = useParams();
  const [events, setEvents] = useState([]);
  const [session, setSession] = useState(null);
  const [board, setBoard] = useState({ todo: [], up_next: [], in_progress: [], in_review: [], done: [] });
  const [sliderValue, setSliderValue] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const [eventsRes, sessionRes] = await Promise.all([
          fetch(API.getEvents(date, sessionNumber)).then(r => r.json()),
          fetch(API.getSession(date, sessionNumber)).then(r => r.json()),
        ]);
        setEvents(eventsRes.events ?? []);
        setSession(sessionRes?.session ?? null);
      } catch {
        // Silently ignore load errors
      }
    }
    load();
  }, [date, sessionNumber]);

  const startTime = events[0] ? new Date(events[0].occurred_at).getTime() : 0;
  const endTime = events[events.length - 1] ? new Date(events[events.length - 1].occurred_at).getTime() : 0;
  const totalMs = endTime - startTime || 1;
  const currentMs = startTime + (sliderValue / 100) * totalMs;

  useEffect(() => {
    if (!events.length) return;
    setBoard(replayToTime(events, new Date(currentMs)));
  }, [sliderValue, events, currentMs]);

  useEffect(() => {
    if (!isPlaying) { clearInterval(playRef.current); return; }
    const TICK_MS = 100;
    const advancePerTick = (TICK_MS / totalMs) * 100 * speed;
    playRef.current = setInterval(() => {
      setSliderValue(prev => {
        if (prev >= 100) { setIsPlaying(false); return 100; }
        return Math.min(prev + advancePerTick, 100);
      });
    }, TICK_MS);
    return () => clearInterval(playRef.current);
  }, [isPlaying, speed, totalMs]);

  function formatElapsed(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  if (!events.length) {
    return (
      <div className={styles.empty}>
        <p>No replay data for this session yet.</p>
        <p>Task movements are recorded as you stream.</p>
        <Link to={`/grossgauntlet/${date}/${sessionNumber}`} className={styles.back} style={{ marginTop: 24, display: 'inline-block' }}>
          ← Back to session
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to={`/grossgauntlet/${date}/${sessionNumber}`} className={styles.back}>
        ← Back to session
      </Link>

      <h1 className={styles.title}>Day {session?.dayNumber ?? date} — Replay</h1>

      <div className={styles.controls}>
        <button className={styles.playBtn} onClick={() => setIsPlaying(p => !p)}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className={styles.speeds}>
          {SPEEDS.map(s => (
            <button
              key={s}
              className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scrubberRow}>
        <input
          type="range"
          min={0}
          max={100}
          step={0.01}
          value={sliderValue}
          onChange={e => { setIsPlaying(false); setSliderValue(Number(e.target.value)); }}
          className={styles.scrubber}
        />
        <span className={styles.time}>
          {formatElapsed(currentMs - startTime)} / {formatElapsed(totalMs)}
        </span>
      </div>

      <div className={styles.boardWrap}>
        <KanbanBoard initialBoard={board} editable={false} />
      </div>

      {session?.timestamps && (
        <div className={styles.timestampsSection}>
          <p className={styles.timestampsLabel}>TIMESTAMPS</p>
          <pre className={styles.timestamps}>{session.timestamps}</pre>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../../config/api';
import styles from './GrossGauntletShell.module.css';

function formatHours(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatHMS(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Inline-editable stat field */
function EditableStat({ label, value, field, editable, onSave, format }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const displayValue = format ? format(value) : value;

  function startEdit() {
    if (!editable) return;
    setDraft(String(value ?? 0));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commit() {
    const parsed = Number(draft);
    if (isNaN(parsed)) {
      setEditing(false);
      return;
    }
    setEditing(false);
    if (parsed !== Number(value ?? 0)) {
      onSave?.(field, parsed);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { inputRef.current?.blur(); }
    if (e.key === 'Escape') { setEditing(false); }
  }

  if (editing) {
    return (
      <div className={styles.statRow}>
        <span className={styles.statLabel}>{label}</span>
        <input
          ref={inputRef}
          className={styles.statInput}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  return (
    <div className={styles.statRow} onClick={startEdit} role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}>
      <span className={styles.statLabel}>
        {label}
        {editable && <span className={styles.statEditHint}> (click to edit)</span>}
      </span>
      <span className={`${styles.statValue} ${editable ? styles.statClickable : ''}`}>{displayValue}</span>
    </div>
  );
}

export default function GrossGauntletShell({ children, sessionData, editable, onStatChange }) {
  const [stats, setStats] = useState({
    totalDays: 0,
    totalHours: 0,
    avgDailyHours: 0,
    tasksDone: 0,
  });
  const [notes, setNotes] = useState('');
  const notesTimerRef = useRef(null);

  const isSession = sessionData !== null && sessionData !== undefined;

  useEffect(() => {
    if (isSession) return; // skip global stats fetch when rendering session sidebar

    let cancelled = false;

    async function fetchStats() {
      try {
        const res = await fetch(API.getAllDays());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const records = Array.isArray(json) ? json : (json?.data || []);

        const totalDays = records.length;
        let totalSeconds = 0;
        let tasksDone = 0;

        for (const day of records) {
          const sessions = Array.isArray(day.sessions) ? day.sessions : [];
          for (const session of sessions) {
            totalSeconds += session.today_seconds || 0;
            tasksDone += session.done_count || 0;
          }
        }

        const avgDailySeconds = totalDays > 0 ? totalSeconds / totalDays : 0;

        setStats({
          totalDays,
          totalHours: formatHours(totalSeconds),
          avgDailyHours: formatHours(avgDailySeconds),
          tasksDone,
        });
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to fetch shell stats:', e);
        }
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, [isSession]);

  useEffect(() => {
    if (sessionData && sessionData.notes !== undefined) {
      setNotes(sessionData.notes);
    }
  }, [sessionData]);

  useEffect(() => () => {
    clearTimeout(notesTimerRef.current);
  }, []);

  function handleNotesChange(value) {
    setNotes(value);
    clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => fetch(API.postNotes(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayNumber: Number(sessionData.dayNumber),
        sessionNumber: Number(sessionData.sessionNumber),
        notes: value,
      }),
    }), 800);
  }

  return (
    <div className={styles.shell}>
      <main className={styles.main}>{children}</main>

      <aside className={styles.sidebar}>
        {isSession ? (
          <>
            <div className={styles.sidebarTitle}>
              DAY {sessionData.dayNumber} · SESSION {sessionData.sessionNumber}
            </div>

            {sessionData.isStreaming !== undefined && (
              <div className={styles.sidebarStatusRow}>
                <span className={`${styles.statusDot} ${sessionData.isStreaming ? styles.liveDot : styles.offlineDot}`}>●</span>
                <span className={styles.sidebarStatusText}>
                  {sessionData.isStreaming ? 'LIVE' : 'OFFLINE'}
                  {sessionData.mode ? ` · ${sessionData.mode[0].toUpperCase() + sessionData.mode.slice(1)}` : ''}
                </span>
              </div>
            )}

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Today</span>
              <span className={styles.statValue}>{formatHMS(sessionData.today_seconds ?? 0)}</span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Done</span>
              <span className={styles.statValue}>{sessionData.doneTasks ?? 0} / {sessionData.totalTasks ?? 0}</span>
            </div>

            <EditableStat
              label="Content"
              value={sessionData.content_count ?? 0}
              field="contentCount"
              editable={editable}
              onSave={onStatChange}
            />

            <EditableStat
              label="Sales"
              value={sessionData.sales_count ?? 0}
              field="salesCount"
              editable={editable}
              onSave={onStatChange}
            />

            <EditableStat
              label="Gross"
              value={sessionData.total_gross ?? 0}
              field="totalGross"
              editable={editable}
              onSave={onStatChange}
              format={v => `$${Number(v).toLocaleString()}`}
            />

            <div className={styles.divider} />

            <div className={styles.sidebarTitle}>Notes</div>
            <textarea
              className={styles.sidebarTextarea}
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Stream notes…"
            />

            {sessionData.timestamps && (
              <>
                <div className={styles.divider} />
                <div className={styles.sidebarTitle}>Timestamps</div>
                <pre className={styles.sidebarPre}>{sessionData.timestamps}</pre>
              </>
            )}

            {sessionData.stream_url && (
              <>
                <div className={styles.divider} />
                <a href={sessionData.stream_url} target="_blank" rel="noopener noreferrer" className={styles.nowLink}>▶ Watch on YouTube</a>
              </>
            )}
          </>
        ) : (
          <>
            <div className={styles.sidebarTitle}>Gross Gauntlet</div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Days</span>
              <span className={styles.statValue}>{stats.totalDays}</span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Hours</span>
              <span className={styles.statValue}>{stats.totalHours}</span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Avg/Day</span>
              <span className={styles.statValue}>{stats.avgDailyHours}</span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Tasks Done</span>
              <span className={styles.statValue}>{stats.tasksDone}</span>
            </div>

            <div className={styles.divider} />

            <Link to="/grossgauntlet/now" className={styles.nowLink}>Now →</Link>
          </>
        )}
      </aside>
    </div>
  );
}
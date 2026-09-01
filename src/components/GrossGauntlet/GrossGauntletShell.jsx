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

/** Inline-editable content — uses contentEditable on the pre itself, no textbox */
function EditableTextarea({ label, value, field, editable, onSave }) {
  const preRef = useRef(null);

  function handleBlur() {
    const text = preRef.current?.textContent ?? '';
    if (text !== String(value ?? '')) {
      onSave?.(field, text);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (preRef.current) {
        preRef.current.textContent = String(value ?? '');
        preRef.current.blur();
      }
    }
  }

  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <pre
        ref={preRef}
        className={`${styles.sidebarPre} ${editable ? styles.preEditable : ''}`}
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >{value || ''}</pre>
    </div>
  );
}
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

export default function GrossGauntletShell({ children, sessionData, editable, onStatChange, sidebarAction }) {
  const [stats, setStats] = useState({
    totalDays: 0,
    totalHours: 0,
    avgDailyHours: 0,
    tasksDone: 0,
  });
  const [notes, setNotes] = useState('');
  const notesTimerRef = useRef(null);
  const [nextDayNumber, setNextDayNumber] = useState(null);
  const [nextSessionNumber, setNextSessionNumber] = useState(null);

  const isSession = sessionData !== null && sessionData !== undefined;

  useEffect(() => {
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
        let todaySessionCount = 0;
        const todayStr = new Date().toISOString().slice(0, 10);

        for (const day of records) {
          const sessions = Array.isArray(day.sessions) ? day.sessions : [];
          for (const session of sessions) {
            totalSeconds += session.today_seconds || 0;
            tasksDone += session.done_count || 0;
          }
          if (day.date === todayStr) {
            todaySessionCount = sessions.length;
          }
        }

        const avgDailySeconds = totalDays > 0 ? totalSeconds / totalDays : 0;

        setStats({
          totalDays,
          totalHours: formatHours(totalSeconds),
          avgDailyHours: formatHours(avgDailySeconds),
          tasksDone,
        });

        // Compute what the next day/session would be
        const DAY_OFFSET = new Date('2026-08-15');
        const dayNum = Math.floor((Date.now() - DAY_OFFSET) / 86400000) + 1;
        setNextDayNumber(dayNum);
        setNextSessionNumber(todaySessionCount + 1);
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

  return (
    <div className={styles.shell}>
      <main className={styles.main}>{children}</main>

      <aside className={styles.sidebar}>
        {isSession ? (
          <>
            <div className={styles.sidebarTitle}>
              {sessionData.dayNumber === 'now' && nextDayNumber
                ? `DAY ${nextDayNumber} · SESSION ${nextSessionNumber}`
                : `DAY ${sessionData.dayNumber} · SESSION ${sessionData.sessionNumber}`}
            </div>

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

            <hr className={styles.hr} />

            {sessionData.timestamps !== undefined && (
              <>
                <EditableTextarea
                  label="Timestamps"
                  value={sessionData.timestamps}
                  field="timestamps"
                  editable={editable}
                  onSave={onStatChange}
                />
              </>
            )}

            {sessionData.stream_url && (
              <>
                <div className={styles.divider} />
                <a href={sessionData.stream_url} target="_blank" rel="noopener noreferrer" className={styles.nowLink}>▶ Watch on YouTube</a>
              </>
            )}

            {sidebarAction && (
              <div style={{ marginTop: 'auto' }}>
                {sidebarAction}
              </div>
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
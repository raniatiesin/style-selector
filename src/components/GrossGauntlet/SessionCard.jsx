import { useRef } from 'react';
import TagPill from '../shared/TagPill';
import styles from './SessionCard.module.css';

function formatTime(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SessionCard({
  dayNumber,
  title,
  date,
  todaySeconds,
  taskCounts,
  isStreaming,
  streamUrl,
  onClick,
  sessionCount,
  dataMonth,
  dataWeek
}) {
  const cardRef = useRef(null);
  const totalTasks = taskCounts
    ? (taskCounts.todo || 0) + (taskCounts.up_next || 0) + (taskCounts.in_progress || 0) + (taskCounts.in_review || 0) + (taskCounts.done || 0)
    : 0;
  const doneTasks = taskCounts?.done || 0;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div
      ref={cardRef}
      className={styles.sessionCard}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      data-month={dataMonth}
      data-week={dataWeek}
    >
      <div className={styles.sessionCardHeader}>
        {sessionCount > 1 && (
          <TagPill label={`${sessionCount} SESSIONS`} />
        )}
        {isStreaming ? (
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} />
            LIVE
          </span>
        ) : null}
      </div>

      <h3 className={styles.sessionCardTitle}>{title || ''}</h3>
      <p className={styles.sessionCardDate}>{formatDate(date)}</p>

      {totalTasks > 0 && (
        <div className={styles.progressSection}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={styles.progressLabel}>
            {doneTasks}/{totalTasks} done
          </span>
        </div>
      )}

      <p className={styles.sessionCardTime}>{formatTime(todaySeconds)}</p>

      {streamUrl && (
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.watchBtn}
          onClick={(e) => e.stopPropagation()}
        >
          ▶ Watch
        </a>
      )}
    </div>
  );
}
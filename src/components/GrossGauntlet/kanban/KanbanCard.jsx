import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './KanbanCard.module.css';

const STATUS_VAR_MAP = {
  todo: 'todo',
  up_next: 'upnext',
  in_progress: 'progress',
  in_review: 'review',
  done: 'done',
  waiting: 'waiting',
};

function StaticCard({ task, accentVar }) {
  return (
    <div
      className={styles.card}
      data-status={task.status}
      data-flip-id={task.id}
      style={{ '--card-accent': `var(--status-${accentVar})` }}
    >
      <span className={styles.dot} />
      <span className={styles.name}>{task.name}</span>
    </div>
  );
}

function EditableCard({ task, accentVar, onDelete, onRename }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(task.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) setDraftName(task.name);
  }, [task.name, isEditing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
    '--card-accent': `var(--status-${accentVar})`,
  };

  function commit() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== task.name) onRename(task.id, trimmed);
    else setDraftName(task.name);
    setIsEditing(false);
  }

  function keyDown(e) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setDraftName(task.name); setIsEditing(false); }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      data-status={task.status}
      data-flip-id={task.id}
    >
      <span className={styles.handle} {...attributes} {...listeners} title="Drag to move" aria-label="Drag handle">⠿</span>
      <span className={styles.dot} />
      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.renameInput}
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onBlur={commit}
          onKeyDown={keyDown}
          maxLength={120}
        />
      ) : (
        <span className={styles.name} onDoubleClick={() => setIsEditing(true)} title="Double-click to rename">
          {task.name}
        </span>
      )}
      <button type="button" className={styles.deleteBtn} onClick={() => onDelete(task.id)} title="Delete task" aria-label={`Delete ${task.name}`}>×</button>
    </div>
  );
}

export default function KanbanCard({ task, editable, onDelete, onRename }) {
  const accentVar = STATUS_VAR_MAP[task.status] ?? 'todo';
  return editable
    ? <EditableCard task={task} accentVar={accentVar} onDelete={onDelete} onRename={onRename} />
    : <StaticCard task={task} accentVar={accentVar} />;
}
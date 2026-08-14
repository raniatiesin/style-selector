import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './KanbanCard.module.css';

function StaticCard({ task, statusColor }) {
  return (
    <div className={styles.card} data-status={task.status}>
      <span className={styles.dot} style={{ background: statusColor }} />
      <span className={styles.name}>{task.name}</span>
    </div>
  );
}

function EditableCard({ task, statusColor, onDelete, onRename }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

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
  };

  function handleRenameCommit() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== task.name) {
      onRename(task.id, trimmed);
    } else {
      setDraftName(task.name);
    }
    setIsEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleRenameCommit();
    if (e.key === 'Escape') {
      setDraftName(task.name);
      setIsEditing(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      data-status={task.status}
    >
      <span
        className={styles.handle}
        {...attributes}
        {...listeners}
        title="Drag to move"
        aria-label="Drag handle"
      >
        ⠿
      </span>

      <span className={styles.dot} style={{ background: statusColor }} />

      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.renameInput}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={handleRenameCommit}
          onKeyDown={handleKeyDown}
          maxLength={120}
        />
      ) : (
        <span
          className={styles.name}
          onDoubleClick={() => setIsEditing(true)}
          title="Double-click to rename"
        >
          {task.name}
        </span>
      )}

      <button
        type="button"
        className={styles.deleteBtn}
        onClick={() => onDelete(task.id)}
        title="Delete task"
        aria-label={`Delete ${task.name}`}
      >
        ×
      </button>
    </div>
  );
}

const STATUS_COLORS = {
  todo: '#808080',
  in_progress: '#2ECC71',
  up_next: '#8A4FFF',
  in_review: '#F0A500',
  done: '#E74C3C',
  waiting: '#808080',
};

export default function KanbanCard({ task, editable, onDelete, onRename }) {
  const color = STATUS_COLORS[task.status] ?? 'var(--white-35)';

  if (!editable) {
    return <StaticCard task={task} statusColor={color} />;
  }

  return (
    <EditableCard
      task={task}
      statusColor={color}
      onDelete={onDelete}
      onRename={onRename}
    />
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './KanbanCard.module.css';

function StaticCard({ task }) {
  return (
    <div
      className={styles.card}
      data-status={task.status}
      data-flip-id={task.id}
    >
      <span className={styles.name}>{task.name}</span>
    </div>
  );
}

function EditableCard({ task, onDelete, onRename }) {
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
    transition: isDragging ? 'none' : 'transform 80ms ease, opacity .15s',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
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
      {...attributes}
      {...listeners}
    >
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
  return editable
    ? <EditableCard task={task} onDelete={onDelete} onRename={onRename} />
    : <StaticCard task={task} />;
}
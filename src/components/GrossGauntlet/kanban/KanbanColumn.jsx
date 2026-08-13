import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import styles from './KanbanColumn.module.css';

function StaticColumn({ colKey, label, tasks }) {
  return (
    <div className={styles.column} data-col={colKey}>
      <header className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.count}>{tasks.length}</span>
      </header>
      <div className={styles.cardList}>
        {tasks.length === 0 && (
          <p className={styles.empty}>Empty</p>
        )}
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} editable={false} />
        ))}
      </div>
    </div>
  );
}

function EditableColumn({ colKey, label, tasks, onAddTask, onDeleteTask, onRenameTask }) {
  const [draft, setDraft] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: colKey });

  function handleAdd() {
    const name = draft.trim();
    if (!name) return;
    onAddTask(colKey, name);
    setDraft('');
    setIsAdding(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') {
      setDraft('');
      setIsAdding(false);
    }
  }

  return (
    <div
      className={`${styles.column} ${styles.editable} ${isOver ? styles.dropOver : ''}`}
      data-col={colKey}
    >
      <header className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.count}>{tasks.length}</span>
      </header>

      <SortableContext
        id={colKey}
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className={styles.cardList}>
          {tasks.length === 0 && !isAdding && (
            <p className={styles.empty}>Drop here</p>
          )}
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              editable={true}
              onDelete={onDeleteTask}
              onRename={onRenameTask}
            />
          ))}
        </div>
      </SortableContext>

      <div className={styles.addRow}>
        {isAdding ? (
          <input
            className={styles.addInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleAdd}
            placeholder="Task name…"
            maxLength={120}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setIsAdding(true)}
          >
            + Add task
          </button>
        )}
      </div>
    </div>
  );
}

export default function KanbanColumn({
  colKey,
  label,
  tasks,
  editable,
  onAddTask,
  onDeleteTask,
  onRenameTask,
}) {
  if (!editable) {
    return <StaticColumn colKey={colKey} label={label} tasks={tasks} />;
  }

  return (
    <EditableColumn
      colKey={colKey}
      label={label}
      tasks={tasks}
      onAddTask={onAddTask}
      onDeleteTask={onDeleteTask}
      onRenameTask={onRenameTask}
    />
  );
}

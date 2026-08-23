import React, { useState, useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/flip';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(Flip);
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import {
  COLUMNS,
  COLUMN_LABELS,
  moveTask,
  addTask,
  deleteTask,
  renameTask,
  generateTaskId,
  colKeyToStatus,
} from './moveTask';
import styles from './KanbanBoard.module.css';

function findCardColumn(board, cardId) {
  for (const col of COLUMNS) {
    if (board[col].some((t) => t.id === cardId)) return col;
  }
  return null;
}

function getDropIndex(board, overId, overCol) {
  if (COLUMNS.includes(overId)) return -1;
  const idx = board[overCol].findIndex((t) => t.id === overId);
  return idx === -1 ? -1 : idx;
}

export default function KanbanBoard({ initialBoard, editable, onBoardChange }) {
  const [board, setBoard] = useState(initialBoard);
  const [activeCard, setActiveCard] = useState(null);
  const [pendingFlip, setPendingFlip] = useState(0);
  const boardRef = useRef(null);
  const boardAtDragStart = useRef(null);
  const isDraggingRef = useRef(false);
  const pendingBoard = useRef(null);

  useEffect(() => {
    if (isDraggingRef.current) return;
    pendingBoard.current = initialBoard;
    setPendingFlip(s => s + 1);
  }, [initialBoard]);

  useGSAP(() => {
    if (!pendingBoard.current) return;
    const state = Flip.getState(boardRef.current.querySelectorAll('[data-flip-id]'));
    setBoard(pendingBoard.current);
    pendingBoard.current = null;
    requestAnimationFrame(() => {
      Flip.from(state, {
        targets: '[data-flip-id]',
        duration: 0.45,
        ease: 'power2.inOut',
        stagger: { amount: 0.12, from: 'start' },
        zIndex: 999,
        onEnter: elements => gsap.fromTo(elements,
          { opacity: 0 },
          { opacity: 1, duration: 0.25, delay: 0.15 }
        ),
        onLeave: elements => gsap.to(elements,
          { opacity: 0, duration: 0.2 }
        ),
      });
    });
  }, [pendingFlip]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const applyAndNotify = useCallback(
    (newBoard, actionObj) => {
      setBoard(newBoard);
      onBoardChange?.(newBoard, actionObj);
    },
    [onBoardChange]
  );

  const handleAddTask = useCallback(
    (colKey, name) => {
      const newTask = {
        id: generateTaskId(),
        name,
        status: colKeyToStatus(colKey),
        createdAt: Date.now(),
        completedAt: null,
        due: null,
      };
      applyAndNotify(addTask(board, colKey, newTask), {
        action: 'create',
        taskId: newTask.id,
        toColumn: colKey,
        name
      });
    },
    [board, applyAndNotify]
  );

  const handleDeleteTask = useCallback(
    (taskId) => {
      const col = findCardColumn(board, taskId);
      const task = col ? board[col].find(t => t.id === taskId) : null;
      applyAndNotify(deleteTask(board, taskId), {
        action: 'delete',
        taskId,
        fromColumn: col,
        name: task?.name || ''
      });
    },
    [board, applyAndNotify]
  );

  const handleRenameTask = useCallback(
    (taskId, newName) => {
      const col = findCardColumn(board, taskId);
      const task = col ? board[col].find(t => t.id === taskId) : null;
      applyAndNotify(renameTask(board, taskId, newName), {
        action: 'rename',
        taskId,
        oldName: task?.name || '',
        newName
      });
    },
    [board, applyAndNotify]
  );

  function handleDragStart({ active }) {
    isDraggingRef.current = true;
    boardAtDragStart.current = board;
    const col = findCardColumn(board, active.id);
    const card = col ? board[col].find((t) => t.id === active.id) : null;
    setActiveCard(card ?? null);
  }

  function handleDragOver({ active, over }) {
    if (!over) return;

    const activeCol = findCardColumn(board, active.id);
    const overCol = COLUMNS.includes(over.id)
      ? over.id
      : findCardColumn(board, over.id);

    if (!activeCol || !overCol || activeCol === overCol) return;

    const toIndex = getDropIndex(board, over.id, overCol);
    setBoard((prev) => moveTask(prev, active.id, activeCol, overCol, toIndex));
  }

  function handleDragEnd({ active, over }) {
    isDraggingRef.current = false;
    setActiveCard(null);

    if (!over) {
      if (boardAtDragStart.current) setBoard(boardAtDragStart.current);
      boardAtDragStart.current = null;
      return;
    }

    const activeCol = findCardColumn(board, active.id);
    const overCol = COLUMNS.includes(over.id)
      ? over.id
      : findCardColumn(board, over.id);

    if (!activeCol || !overCol) return;

    const toIndex = getDropIndex(board, over.id, overCol);
    const newBoard = moveTask(board, active.id, activeCol, overCol, toIndex);
    applyAndNotify(newBoard, {
      action: 'move',
      taskId: active.id,
      fromColumn: activeCol,
      toColumn: overCol
    });
    boardAtDragStart.current = null;
  }

  function handleDragCancel() {
    isDraggingRef.current = false;
    setActiveCard(null);
    if (boardAtDragStart.current) {
      setBoard(boardAtDragStart.current);
      boardAtDragStart.current = null;
    }
  }

  const columns = COLUMNS.map((colKey) => (
    <KanbanColumn
      key={colKey}
      colKey={colKey}
      label={COLUMN_LABELS[colKey]}
      tasks={board[colKey]}
      editable={editable}
      onAddTask={handleAddTask}
      onDeleteTask={handleDeleteTask}
      onRenameTask={handleRenameTask}
    />
  ));

  if (!editable) {
    return <div className={styles.board} ref={boardRef}>{columns}</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={styles.board} ref={boardRef}>{columns}</div>

      <DragOverlay>
        {activeCard ? (
          <div className={styles.dragOverlay}>
            <KanbanCard task={activeCard} editable={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

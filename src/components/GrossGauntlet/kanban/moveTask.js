/**
 * moveTask.js
 * Pure helper for Kanban array surgery.
 * No React, no side effects — fully testable in isolation.
 *
 * Column keys match the GrossGauntlet DB column names exactly:
 *   up_next_tasks | in_progress_tasks | in_review_tasks | done_tasks
 */

export const COLUMNS = ['todo', 'up_next', 'in_progress', 'in_review', 'done'];

export const COLUMN_LABELS = {
  todo: 'To-Do',
  up_next: 'Up Next',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

/**
 * Move a task from one column to another at a specific index.
 * Returns a new board state object — never mutates the original.
 */
export function moveTask(board, taskId, fromCol, toCol, toIndex) {
  const task = board[fromCol]?.find((t) => t.id === taskId);
  if (!task) return board;

  const newSource = board[fromCol].filter((t) => t.id !== taskId);

  let newDest;
  if (fromCol === toCol) {
    newDest = [...newSource];
    const insertAt = toIndex === -1 ? newDest.length : Math.min(toIndex, newDest.length);
    newDest.splice(insertAt, 0, task);
    return { ...board, [fromCol]: newDest };
  }

  newDest = [...board[toCol]];
  const insertAt = toIndex === -1 ? newDest.length : Math.min(toIndex, newDest.length);
  newDest.splice(insertAt, 0, { ...task, status: colKeyToStatus(toCol) });

  return {
    ...board,
    [fromCol]: newSource,
    [toCol]: newDest,
  };
}

export function addTask(board, colKey, task) {
  return {
    ...board,
    [colKey]: [...board[colKey], task],
  };
}

export function deleteTask(board, taskId) {
  const next = { ...board };
  for (const col of COLUMNS) {
    next[col] = next[col].filter((t) => t.id !== taskId);
  }
  return next;
}

export function renameTask(board, taskId, newName) {
  const next = { ...board };
  for (const col of COLUMNS) {
    next[col] = next[col].map((t) =>
      t.id === taskId ? { ...t, name: newName, updated_at: Date.now() } : t
    );
  }
  return next;
}

export function colKeyToStatus(colKey) {
  const map = {
    todo: 'todo',
    up_next: 'up_next',
    in_progress: 'in_progress',
    in_review: 'in_review',
    done: 'done',
  };
  return map[colKey] ?? 'up_next';
}

export function statusToColKey(status) {
  const map = {
    todo: 'todo',
    up_next: 'up_next',
    in_progress: 'in_progress',
    in_review: 'in_review',
    done: 'done',
    waiting: 'up_next',
    ongoing: 'in_progress',
    review: 'in_review',
    completed: 'done',
  };
  return map[status] ?? 'todo';
}

export function buildBoard({ todo, up_next, in_progress, in_review, done }) {
  return {
    todo: normalizeTaskList(todo),
    up_next: normalizeTaskList(up_next),
    in_progress: normalizeTaskList(in_progress),
    in_review: normalizeTaskList(in_review),
    done: normalizeTaskList(done),
  };
}

export function buildBoardFromTasks(tasks) {
  const board = buildBoard({});
  if (!Array.isArray(tasks)) return board;

  for (const task of tasks) {
    const col = statusToColKey(task.status);
    board[col].push(normalizeTask(task));
  }
  return board;
}

export function normalizeTask(task) {
  return {
    id: String(task.id),
    name: String(task.name || task.title || 'Untitled Task').trim(),
    status: task.status || 'up_next',
    createdAt: task.createdAt ?? task.created_at ?? Date.now(),
    completedAt: task.completedAt ?? task.completed_at ?? null,
    due: task.due ?? null,
  };
}

function normalizeTaskList(list) {
  return Array.isArray(list) ? list.map(normalizeTask) : [];
}

export function generateTaskId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Replay the board state at a specific point in time.
 * Applies all events with occurred_at <= targetTime in chronological order.
 * Returns a fresh board — never mutates inputs.
 */
export function replayToTime(events, targetTime) {
  const board = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };

  const relevant = events.filter(e => new Date(e.occurred_at) <= targetTime);

  for (const event of relevant) {
    switch (event.event_type) {
      case 'create':
        board[event.to_column]?.push({
          id: event.task_id,
          name: event.payload?.name ?? 'Untitled',
          status: event.to_column,
          createdAt: new Date(event.occurred_at).getTime()
        });
        break;
      case 'move': {
        let task = null;
        for (const col of Object.keys(board)) {
          const idx = board[col].findIndex(t => t.id === event.task_id);
          if (idx !== -1) { task = board[col].splice(idx, 1)[0]; break; }
        }
        if (task && event.to_column) board[event.to_column].push({ ...task, status: event.to_column });
        break;
      }
      case 'rename':
        for (const col of Object.keys(board)) {
          const task = board[col].find(t => t.id === event.task_id);
          if (task) { task.name = event.payload?.new ?? task.name; break; }
        }
        break;
      case 'delete':
        for (const col of Object.keys(board)) {
          const idx = board[col].findIndex(t => t.id === event.task_id);
          if (idx !== -1) { board[col].splice(idx, 1); break; }
        }
        break;
    }
  }
  return board;
}

/**
 * moveTask.js
 * Pure helper for Kanban array surgery.
 * No React, no side effects — fully testable in isolation.
 *
 * Column keys match the GrossGauntlet DB column names exactly:
 *   up_next_tasks | in_progress_tasks | in_review_tasks | done_tasks
 */

export const COLUMNS = ['up_next_tasks', 'in_progress_tasks', 'in_review_tasks', 'done_tasks'];

export const COLUMN_LABELS = {
  up_next_tasks: 'Up Next',
  in_progress_tasks: 'In Progress',
  in_review_tasks: 'In Review',
  done_tasks: 'Done',
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
    up_next_tasks: 'up_next',
    in_progress_tasks: 'in_progress',
    in_review_tasks: 'in_review',
    done_tasks: 'done',
  };
  return map[colKey] ?? 'up_next';
}

export function statusToColKey(status) {
  const map = {
    up_next: 'up_next_tasks',
    in_progress: 'in_progress_tasks',
    in_review: 'in_review_tasks',
    done: 'done_tasks',
    waiting: 'up_next_tasks',
    todo: 'up_next_tasks',
    ongoing: 'in_progress_tasks',
    review: 'in_review_tasks',
    completed: 'done_tasks',
  };
  return map[status] ?? 'up_next_tasks';
}

export function buildBoard({ up_next_tasks, in_progress_tasks, in_review_tasks, done_tasks }) {
  return {
    up_next_tasks: normalizeTaskList(up_next_tasks),
    in_progress_tasks: normalizeTaskList(in_progress_tasks),
    in_review_tasks: normalizeTaskList(in_review_tasks),
    done_tasks: normalizeTaskList(done_tasks),
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

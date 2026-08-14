# GrossGauntlet — Agent Execution Plan
### Starting point: Phase 1 Kanban drag-and-drop is integrated. Database migration is complete.
> Hand this document plus `GrossGauntlet-Database-Reference.md` and `GrossGauntlet-Master-Spec-v2.md` to the agent at the start of every session.

---

## Context

The Supabase database has been fully restructured. Two tables exist:
- `Sessions` — one row per stream session, composite PK `(date, session_number)`
- `Logs` — append-only event log, one row per board action, FK to Sessions

The old `GrossGauntlet` table no longer exists. All five task array columns (`todo_tasks`, `up_next_tasks`, etc.) have been dropped from the table — board state is now derived from `Logs` incrementally. All API endpoints currently reference the old table name and old schema and will be broken until updated.

Do not start any frontend work until the API layer is confirmed working.

---

## Execution Order

### STEP 1 — Update API endpoints to new schema
**Do this first. Everything else depends on it.**

Files to update: `api/stream/state.js`, `api/stream/metrics.js`, `api/stream/tasks.js`, `api/stream/webhook.js`

Changes required in every file:
- Replace all references to `GrossGauntlet` table with `Sessions`
- Replace `stream_number` with `session_number` in all queries
- Remove all reads/writes of `todo_tasks`, `up_next_tasks`, `in_progress_tasks`, `in_review_tasks`, `done_tasks` from `Sessions` queries — these columns no longer exist

#### `api/stream/state.js` — full rewrite of board loading logic

Old behavior: read task arrays directly from the `GrossGauntlet` row.

New behavior:
1. Query `Sessions` for the active row (`is_streaming = true`). If none, fall back to most recent row (`ORDER BY date DESC, session_number DESC LIMIT 1`).
2. Query all `Logs` rows where `session_date = session.date AND session_number = session.session_number`, ordered by `occurred_at ASC`.
3. Fold the log events into a board object:
```javascript
const board = {
  todo: [], up_next: [], in_progress: [], in_review: [], done: []
};
for (const event of logs) {
  if (event.event_type === 'create') {
    board[event.to_column].push({ id: event.task_id, name: event.payload.name, createdAt: event.occurred_at });
  }
  if (event.event_type === 'move') {
    const task = removeFromBoard(board, event.task_id);
    if (task) board[event.to_column].push(task);
  }
  if (event.event_type === 'rename') {
    updateInBoard(board, event.task_id, { name: event.payload.new });
  }
  if (event.event_type === 'delete') {
    removeFromBoard(board, event.task_id);
  }
}
```
4. Return the board object alongside session metrics in the response.

Response shape must include:
```json
{
  "success": true,
  "board": {
    "todo": [],
    "up_next": [],
    "in_progress": [],
    "in_review": [],
    "done": []
  },
  "metrics": {
    "mode": "work",
    "isStreaming": false,
    "isPaused": false,
    "todaySeconds": 0,
    "modeTimestamp": null,
    "sessionStartTimestamp": null,
    "contentCount": 0,
    "salesCount": 0,
    "sessionNumber": 1,
    "date": "2026-08-15",
    "title": null,
    "standbySelection": "Coming Soon",
    "timestamps": ""
  }
}
```

#### `api/stream/tasks.js` — rewrite board write logic

Old behavior: overwrite task arrays directly on the `GrossGauntlet` row.

New behavior — every board action inserts one row into `Logs`:
```javascript
// On create:
await supabase.from('Logs').insert({
  session_date: session.date,
  session_number: session.session_number,
  task_id: body.taskId,        // stable UUID from client
  event_type: 'create',
  from_column: null,
  to_column: body.toColumn,    // 'todo' | 'up_next' | 'in_progress' | 'in_review' | 'done'
  payload: { name: body.name },
  occurred_at: new Date().toISOString()
});

// On move:
await supabase.from('Logs').insert({
  session_date: session.date,
  session_number: session.session_number,
  task_id: body.taskId,
  event_type: 'move',
  from_column: body.fromColumn,
  to_column: body.toColumn,
  payload: {},
  occurred_at: new Date().toISOString()
});

// On rename:
await supabase.from('Logs').insert({
  session_date: session.date,
  session_number: session.session_number,
  task_id: body.taskId,
  event_type: 'rename',
  from_column: null,
  to_column: null,
  payload: { old: body.oldName, new: body.newName },
  occurred_at: new Date().toISOString()
});

// On delete:
await supabase.from('Logs').insert({
  session_date: session.date,
  session_number: session.session_number,
  task_id: body.taskId,
  event_type: 'delete',
  from_column: body.fromColumn,
  to_column: null,
  payload: { name: body.name },
  occurred_at: new Date().toISOString()
});
```

After inserting, return the updated board (re-fold or apply delta — either is acceptable, re-fold is simpler and correct).

Auth: `Authorization: Bearer ${WEBHOOK_SECRET}` — unchanged.

#### `api/stream/metrics.js`

- Replace `GrossGauntlet` with `Sessions` in all queries
- Replace `stream_number` with `session_number`
- Remove any reads/writes of task array columns
- Session creation logic: when `isStreaming: true` arrives and no active session exists, insert new row into `Sessions` with `date = TODAY, session_number = (max session_number for today) + 1`
- Title: accept `title` in the metrics payload and write it to `Sessions.title`

#### `api/stream/webhook.js`

- Replace `GrossGauntlet` with `Sessions`
- Replace `stream_number` with `session_number`
- Remove task array column references

---

### STEP 2 — Add new API endpoints

Create `api/grossgauntlet/days.js`:
- `GET /api/grossgauntlet/days` — returns all sessions grouped by date, ordered by date DESC. Used by the homepage grid. Each group includes: date, day_number (derived: `(date - 2026-08-15) + 1`), sessions array with title, session_number, today_seconds, is_streaming, stream_url, and task completion counts (query Logs to count `done` events per session).

Create `api/grossgauntlet/session.js`:
- `GET /api/grossgauntlet/days/:date/:sessionNumber` — returns full session row from `Sessions` plus the folded board from `Logs`. Used by historical session pages.

Create `api/grossgauntlet/events.js` (Phase 2, stub now):
- `GET /api/grossgauntlet/days/:date/:sessionNumber/events` — returns all `Logs` rows for a session ordered by `occurred_at ASC`. Return empty array for now, full implementation in Phase 2.

---

### STEP 3 — Update `src/config/api.js`

Replace all endpoint URLs to match new structure:

```javascript
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const API = {
  // Stream state (polling)
  getStreamState:  ()                      => `${BASE}/stream/state`,
  postMetrics:     ()                      => `${BASE}/stream/metrics`,
  postTask:        ()                      => `${BASE}/stream/tasks`,

  // Archive
  getAllDays:      ()                      => `${BASE}/grossgauntlet/days`,
  getSession:      (date, sessionNumber)   => `${BASE}/grossgauntlet/days/${date}/${sessionNumber}`,

  // Phase 2
  getEvents:       (date, sessionNumber)   => `${BASE}/grossgauntlet/days/${date}/${sessionNumber}/events`,
};
```

Remove all references to old endpoints: `getTasks`, `getLogByIndex`, `getReplayEvents` with slug, etc.

---

### STEP 4 — Update `vercel.json`

Replace all rewrites. Final state:

```json
{
  "rewrites": [
    { "source": "/GrossGauntlet/controls",       "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet/overlays/(.*)",  "destination": "/GrossGauntlet/index.html" },
    { "source": "/grossgauntlet/(.*)",           "destination": "/index.html" },
    { "source": "/grossgauntlet",                "destination": "/index.html" },
    { "source": "/((?!api/).*)",                 "destination": "/index.html" }
  ]
}
```

---

### STEP 5 — Rename and rewire frontend components

Rename files and component names. Do not change internal logic yet — just rename and update imports:

| Old name | New name | Route |
|----------|----------|-------|
| `TasksEditor.jsx` | `GrossGauntletNow.jsx` | `/grossgauntlet/now` |
| `LogIndex.jsx` | `GrossGauntletHome.jsx` | `/grossgauntlet` |
| `LogView.jsx` | `GrossGauntletDay.jsx` | `/grossgauntlet/:date` |
| `SessionView.jsx` | `GrossGauntletSession.jsx` | `/grossgauntlet/:date/:sessionNumber` |

Update `GrossGauntletRouter.jsx`:

```jsx
<Routes>
  <Route path="/grossgauntlet"                              element={<GrossGauntletHome />} />
  <Route path="/grossgauntlet/now"                          element={<GrossGauntletNow />} />
  <Route path="/grossgauntlet/:date"                        element={<GrossGauntletDay />} />
  <Route path="/grossgauntlet/:date/:sessionNumber"         element={<GrossGauntletSession />} />
  <Route path="/grossgauntlet/:date/:sessionNumber/replay"  element={<ReplayScrubber />} />
  <Route path="/overlay/tasks"                              element={<TasksOverlay />} />
</Routes>
```

Update `App.jsx` — route detection:
```javascript
const GROSSGAUNTLET_ROUTES = ['/grossgauntlet', '/overlay'];
```

Remove all `/tasks` and `/Logs` route references from `App.jsx` and `GrossGauntlet.jsx`.

---

### STEP 6 — Update `GrossGauntletNow.jsx` (was TasksEditor)

- Remove `isStreaming` from the editable condition. New condition: `const isEditable = isUnlocked` only.
- Update board initialization: read from `data.board` (the folded board from state.js) instead of individual task array columns.
- Update `onBoardChange` handler: instead of POSTing all five arrays as a sync, POST individual actions to `api/stream/tasks` with `{ action, taskId, fromColumn, toColumn, name, oldName, newName }` — one call per action, not a full sync.
- Remove all references to `slug`, `stream_number`, `log` terminology.
- Add between-stream message when `isStreaming === false`: subtle indicator only, board remains fully functional.

---

### STEP 7 — Add fifth column (To-Do) everywhere

- `moveTask.js` — add `todo` to `COLUMNS` array as first entry, add to `COLUMN_LABELS`, add to `colKeyToStatus` and `statusToColKey` maps
- `KanbanBoard.jsx` — no change needed, columns are derived from `COLUMNS` array
- `KanbanColumn.module.css` — no change needed
- `variables.css` — add status color tokens:
```css
--status-todo:       #808080;
--status-todo-bg:    rgba(160, 160, 160, 0.12);
--status-upnext:     #8A4FFF;
--status-upnext-bg:  rgba(138, 79, 255, 0.12);
--status-progress:   #2ECC71;
--status-progress-bg:rgba(46, 204, 113, 0.12);
--status-review:     #F0A500;
--status-review-bg:  rgba(240, 165, 0, 0.12);
--status-done:       #E74C3C;
--status-done-bg:    rgba(231, 76, 60, 0.12);
```
- `KanbanCard.jsx` — update `STATUS_COLORS` map to use new CSS variables
- `api/stream/tasks.js` — add `todo` to status mapping

---

### STEP 8 — OBS title sync

In `GrossGauntletControl.jsx`, find the stream-start handler (where `isStreaming: true` is sent to metrics). Add:

```javascript
// Fetch OBS stream title on stream start
const streamSettings = await obs.call('GetStreamServiceSettings');
const title = streamSettings?.streamServiceSettings?.server
  ?? await obs.call('GetProfileParameter', {
       parameterCategory: 'Info',
       parameterName: 'Name'
     }).catch(() => null)
  ?? `Day ${dayNumber} — Session ${sessionNumber}`;

// Include title in the metrics POST
body.title = title;
```

If OBS WebSocket doesn't expose the stream title cleanly, fall back to a manual title input field in the control panel UI — a simple text input that prepopulates with the default and can be edited before going live.

---

### STEP 9 — Strip all dead references

Search the entire codebase for these strings and remove/replace every occurrence:

```
"GrossGauntlet"     → "Sessions" in API files only. Frontend strings use "grossgauntlet" (lowercase URL) or display text.
"stream_number"     → "session_number"
"log"               → "day" or "session" depending on context (check each occurrence)
"/tasks"            → "/grossgauntlet/now"
"/Logs"             → "/grossgauntlet"
"todo_tasks"        → "todo"
"up_next_tasks"     → "up_next"
"in_progress_tasks" → "in_progress"
"in_review_tasks"   → "in_review"
"done_tasks"        → "done"
"slug"              → remove entirely
```

---

### STEP 10 — Verify build and test

```bash
npm run build
```

Must pass with zero errors.

Manual checks:
- [ ] `/grossgauntlet` loads (homepage grid, even if empty)
- [ ] `/grossgauntlet/now` loads in read-only mode
- [ ] Run button appears, password prompt works, board becomes editable on correct password
- [ ] Creating a task inserts a row into `Logs` in Supabase
- [ ] Moving a task inserts a `move` row into `Logs`
- [ ] `/overlay/tasks` loads with zero `@dnd-kit` imports (verify with grep)
- [ ] `/GrossGauntlet/controls` still loads (legacy OBS control panel)
- [ ] `/GrossGauntlet/overlays/work` still loads

```bash
grep -r "@dnd-kit" src/components/GrossGauntlet/TasksOverlay.jsx
```
Expected: only the documentation comment line.

---

## What Is Explicitly Out of Scope for This Session

- Phase 2 replay scrubber UI (stub endpoint only)
- YouTube embed on session pages
- Homepage grid visual design beyond basic functionality
- grossgauntlet.com domain

---

## Files the Agent Must Read Before Starting

1. `GrossGauntlet-Database-Reference.md` — table schemas, column roles, how board state works
2. `GrossGauntlet-Master-Spec-v2.md` — full product spec, URL structure, auth rules, visual identity
3. `src/config/api.js` — current endpoint map (needs full replacement in Step 3)
4. `api/stream/state.js` — current state endpoint (needs rewrite in Step 1)
5. `api/stream/tasks.js` — current task endpoint (needs rewrite in Step 1)
6. `src/components/GrossGauntlet/GrossGauntletRouter.jsx` — current routes
7. `vercel.json` — current rewrites

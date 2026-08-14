# GrossGauntlet — Master Specification v2
### Single source of truth. Hand this to any agent starting a new session.
> **Last updated:** August 2026  
> **Status:** Phase 1 active. Phase 2 designed, not yet built.  
> **Domain:** tiesin.me/grossgauntlet (future: grossgauntlet.com)

---

## Table of Contents

1. [What GrossGauntlet Is](#1-what-grossgauntlet-is)
2. [URL Structure](#2-url-structure)
3. [Data Model](#3-data-model)
4. [Column System & Colors](#4-column-system--colors)
5. [Authentication & Editing](#5-authentication--editing)
6. [Day & Session Lifecycle](#6-day--session-lifecycle)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Component Map](#8-component-map)
9. [Backend API Layer](#9-backend-api-layer)
10. [OBS Integration](#10-obs-integration)
11. [Visual Identity](#11-visual-identity)
12. [Phase 1 — Live Board](#12-phase-1--live-board-current)
13. [Phase 2 — Replay & Archive](#13-phase-2--replay--archive)
14. [Build Status](#14-build-status)
15. [Open Decisions Log](#15-open-decisions-log)
16. [Glossary](#16-glossary)

---

## 1. What GrossGauntlet Is

**GrossGauntlet** is a long-term creative challenge, documented live. The name is intentional and kept: *Gross* = the incoming profit margin (gross revenue), *Gauntlet* = the challenge itself. Repulsive and precise — that's the point.

It lives at `tiesin.me/grossgauntlet` and is a **dynamic archive**: every stream session is permanently recorded with its own Kanban board snapshot, timestamp log, accumulated stats, and (eventually) a replay scrubber and YouTube link. Viewers arrive via links dropped during livestreams. They can scroll back through every day of the challenge, replay the task movement, and cross-reference it with the YouTube VOD.

**It is not a dashboard. It is not a blog. It is not a project management tool.**  
It is a living, scrollable, replayable record of work being done in public.

The challenge has no fixed end date. It started on **August 14, 2026** (1st Rabi' al-Awwal in the Hijri lunar calendar). Every stream session is Day N of that challenge — Day 1 = August 14, Day 2 = August 15, and so on, counting calendar days from the start date.

---

## 2. URL Structure

### Canonical Structure

```
tiesin.me/grossgauntlet                     → Homepage. Grid of ALL days. This IS the archive.
tiesin.me/grossgauntlet/now                 → Current/live board. Always accessible.
tiesin.me/grossgauntlet/19                  → Day 19 of the challenge.
                                               • If 1 session that day  → opens that session directly
                                               • If 2+ sessions         → shows session selector cards
tiesin.me/grossgauntlet/19/1                → Session 1 of Day 19. Read-only archive.
tiesin.me/grossgauntlet/19/2                → Session 2 of Day 19. Read-only archive.
tiesin.me/grossgauntlet/19/replay           → Replay scrubber, Day 19 (Phase 2)
tiesin.me/grossgauntlet/19/1/replay         → Replay scrubber, Session 1 of Day 19 (Phase 2)
```

### Rules

- The number in the URL (`19`) is always the **challenge day number** — not a DB row ID, not a stream count, not a session index. Day 1 = August 14 2026. Day N = start date + (N-1) days.
- `/grossgauntlet/now` is **always online**, always showing the most current board. It does not go offline between streams.
- Historical day pages (`/grossgauntlet/19`, `/grossgauntlet/19/1`) are permanently read-only.
- The word "log" does not appear anywhere in any URL, label, or variable name. It is **"day"** everywhere.
- The word "tasks" does not appear in any URL. It was `/tasks` — it is now `/grossgauntlet/now`.

### Deprecated URLs (remove all references)

```
/tasks                   → DEAD. Replaced by /grossgauntlet/now
/tasks/:streamNumber     → DEAD. Replaced by /grossgauntlet/:day/:session
/tasks/:slug/replay      → DEAD. Replaced by /grossgauntlet/:day/replay
/Logs/*                  → DEAD. Replaced by /grossgauntlet/:day
/grossgauntlet/log:N     → DEAD. Replaced by /grossgauntlet/:day
```

### Vercel Rewrites (vercel.json) — Full Updated List

```json
{
  "rewrites": [
    { "source": "/GrossGauntlet/controls",        "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet/overlays/(.*)",   "destination": "/GrossGauntlet/index.html" },
    { "source": "/grossgauntlet/(.*)",            "destination": "/index.html" },
    { "source": "/grossgauntlet",                 "destination": "/index.html" },
    { "source": "/((?!api/).*)",                  "destination": "/index.html" }
  ]
}
```

Note the case distinction: `/GrossGauntlet/` (capital G) routes to the standalone OBS entry point. `/grossgauntlet/` (lowercase) routes to the main React SPA.

---

## 3. Data Model

### 3.1 `GrossGauntlet` Table — Master Session Row

One row per **stream session**. A calendar day can have multiple rows (multiple sessions). The `day_number` field ties sessions to their challenge day.

```sql
GrossGauntlet
─────────────────────────────────────────────────────────
id                      uuid / serial, primary key
day_number              integer         -- challenge day: 1 = Aug 14 2026, 2 = Aug 15, etc.
session_index           integer         -- session within that day: 1, 2, 3...
                                         -- Day 19 Session 1 → /grossgauntlet/19/1
                                         -- Day 19 Session 2 → /grossgauntlet/19/2
date                    date            -- calendar date (derived from day_number, kept for queries)
title                   text            -- session title, set from OBS on stream start
subtitle                text            -- optional, manually set
stream_url              text            -- YouTube VOD link, manually set after stream ends
stream_preview_url      text            -- YouTube thumbnail or embed URL, set with stream_url
is_streaming            boolean         -- live indicator ONLY — does NOT gate editing
is_paused               boolean
mode                    text            -- 'work' | 'break' | 'standby' | 'explain' | 'explain|<topic>'
today_seconds           integer         -- accumulated work seconds for this session
accumulated_seconds     integer         -- total accumulated seconds across all sessions
mode_timestamp          bigint
session_start_timestamp bigint
paused_timestamp        text
content_count           integer
sales_count             integer
standby_selection       text
timestamps              text            -- YouTube marker / session timestamp log (plain text)
stream_number           integer         -- global session count across ALL days (used internally)
todo_tasks              jsonb[]         -- ← NEW fifth column
up_next_tasks           jsonb[]
in_progress_tasks       jsonb[]
in_review_tasks         jsonb[]
done_tasks              jsonb[]
webhook_logs            jsonb[]
created_at              timestamptz
updated_at              timestamptz
```

### 3.2 Task Object Shape

Every task in every column array is this object and nothing more:

```json
{
  "id":         "uuid or crypto.randomUUID()",
  "name":       "Blade Scene Ratio",
  "status":     "in_progress",
  "createdAt":  1234567890000,
  "completedAt": null
}
```

No tags. No assignees. No priority. No description. No due date. Just the name and lifecycle timestamps. If fields are added later, they are added here first and documented in this spec.

### 3.3 Column Key → Status → URL Label Mapping

| DB Column Key      | `status` value  | URL / Display Label | Color       |
|--------------------|-----------------|----------------------|-------------|
| `todo_tasks`       | `todo`          | To-Do                | Gray        |
| `up_next_tasks`    | `up_next`       | Up Next              | Purple      |
| `in_progress_tasks`| `in_progress`   | In Progress          | Green       |
| `in_review_tasks`  | `in_review`     | In Review            | Amber/Gold  |
| `done_tasks`       | `done`          | Done                 | Red/Orange  |

### 3.4 `task_events` Table — Phase 2 Append-Only Log

```sql
task_events
─────────────────────────────────────────────────────────
id              uuid, primary key
session_id      references GrossGauntlet.id
task_id         text            -- stable task ID across moves
event_type      text            -- 'create' | 'move' | 'rename' | 'delete'
from_column     text (nullable) -- null on create
to_column       text (nullable) -- null on delete
payload         jsonb           -- old/new values depending on event_type
occurred_at     timestamptz     -- wall clock time of the change
```

**Rules:**
- Never update or delete rows in this table. It is append-only, forever.
- The `GrossGauntlet` row is always current state. `task_events` is how we got there.
- Replay is built by folding events in `occurred_at` order against a blank board.

**Payload shapes by event type:**
```json
// create
{ "title": "Blade Scene" }

// move
{ "from": "up_next", "to": "in_progress" }

// rename
{ "old": "Blade Scene", "new": "Blade Scene Ratio" }

// delete
{ "title": "Blade Scene Ratio", "from_column": "done" }
```

### 3.5 Day Number Calculation

```javascript
const CHALLENGE_START = new Date('2026-08-14T00:00:00Z'); // 1 Rabi' al-Awwal 1448H

export function toDayNumber(date = new Date()) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
             - Date.UTC(2026, 7, 14); // month is 0-indexed
  return Math.floor(diff / msPerDay) + 1; // Day 1 = Aug 14
}

export function fromDayNumber(n) {
  const d = new Date(CHALLENGE_START);
  d.setUTCDate(d.getUTCDate() + (n - 1));
  return d;
}
```

---

## 4. Column System & Colors

### Five Columns — Left to Right

```
To-Do      Up Next    In Progress    In Review    Done
```

### Exact Colors (matched from TwentyCRM kanban screenshot)

These are the colors already used in the OBS overlays and TwentyCRM integration. They are preserved exactly.

| Column      | Background (badge)  | Text (badge) | Dot / accent hex | Semantic |
|-------------|---------------------|--------------|------------------|----------|
| To-Do       | `rgba(160,160,160,0.15)` | `#A0A0A0`  | `#808080`        | Gray — neutral, not started |
| Up Next     | `rgba(130,80,255,0.15)`  | `#9B59F5`  | `#8A4FFF`        | Purple — queued, prioritized |
| In Progress | `rgba(50,180,100,0.15)`  | `#32B464`  | `#2ECC71`        | Green — active work |
| In Review   | `rgba(200,150,0,0.15)`   | `#C8960A`  | `#F0A500`        | Amber/Gold — pending feedback |
| Done        | `rgba(220,70,50,0.15)`   | `#DC4632`  | `#E74C3C`        | Red/Orange — completed |

These match the exact TwentyCRM badge colors visible in the screenshot: purple Waiting → Up Next here, green In Progress, amber/gold In Review, red/orange Done. Gray is new for To-Do.

### CSS Custom Properties to Add to variables.css

```css
/* Kanban column status colors */
--status-todo:        #808080;
--status-todo-bg:     rgba(160, 160, 160, 0.12);
--status-upnext:      #8A4FFF;
--status-upnext-bg:   rgba(138, 79, 255, 0.12);
--status-progress:    #2ECC71;
--status-progress-bg: rgba(46, 204, 113, 0.12);
--status-review:      #F0A500;
--status-review-bg:   rgba(240, 165, 0, 0.12);
--status-done:        #E74C3C;
--status-done-bg:     rgba(231, 76, 60, 0.12);
```

---

## 5. Authentication & Editing

### The Single Rule

**Editing requires only one condition: `grossgauntlet_unlocked === 'true'` in `localStorage`.**

`is_streaming` no longer gates editing. It is metadata. You can add, move, rename, and delete tasks at any time — before a stream, during, after. The board is always live, always manipulable with the password.

### Auth Flow

1. Visitor lands on `/grossgauntlet/now` → board renders in read-only mode.
2. "Run" button is always visible on `/grossgauntlet/now`. It is not visible on historical pages.
3. User clicks "Run" → password prompt appears.
4. Password validated against `STREAM_ADMIN_KEY` via `POST /api/stream/metrics` with `{ ping: true }`.
5. On success → `localStorage.setItem('grossgauntlet_unlocked', 'true')`.
6. Board immediately becomes editable. Drag handles appear. Add/delete buttons appear.
7. Unlock **survives page refresh** (localStorage, not sessionStorage).
8. Unlock is cleared only by "Disconnect & Lock" in the control panel.

### What Changes When Unlocked vs. Locked

| Element | Locked (read-only) | Unlocked (editable) |
|---------|--------------------|---------------------|
| Drag handles | Hidden | Visible |
| Add task button | Hidden | Visible per column |
| Delete (×) button | Hidden | Visible on hover |
| Double-click to rename | Disabled | Enabled |
| Run button | Visible | Hidden (already unlocked) |
| Board layout | Identical | Identical |

Historical pages (`/grossgauntlet/19`, `/grossgauntlet/19/1`) are **always read-only** and never check `localStorage`. They never render the Run button, drag handles, or any edit controls regardless of auth state.

---

## 6. Day & Session Lifecycle

### How a New Session Starts

```
OBS stream starts
  → OBS WebSocket fires event to GrossGauntletControl
  → Control panel calls POST /api/stream/metrics with:
      { isStreaming: true, streamNumber: N, mode: 'standby', ... }
  → metrics.js checks: does a row exist for today's day_number with is_streaming = false?
      YES → this is a second session today: create new row with session_index = 2
      NO  → create new row with session_index = 1
  → New row created with:
      day_number     = toDayNumber(today)
      session_index  = (count of rows with same day_number) + 1
      stream_number  = global max stream_number + 1
      is_streaming   = true
      title          = pulled from OBS stream title via WebSocket
      all task arrays = [] (empty — fresh board)
  → /grossgauntlet/now now shows this new row as the live session
```

### Title from OBS

When a stream starts, the session title is pulled from the OBS stream title via the WebSocket connection already present in `GrossGauntletControl.jsx`. This is the `title` field in the DB row. The control panel already has OBS WebSocket integration — the title fetch is an addition to the stream-start handler.

If the OBS title is not available or is empty, title defaults to `"Day {N} — Session {session_index}"`.

### How a Session Ends

```
OBS stream stops
  → OBS WebSocket fires event
  → Control panel calls POST /api/stream/metrics with { isStreaming: false }
  → metrics.js sets is_streaming = false on the active row
  → The row is now a permanent historical record
  → /grossgauntlet/now falls back to showing this row (still editable with password)
  → /grossgauntlet/{day_number} now includes this session in the day view
```

### Between Sessions

`/grossgauntlet/now` always shows the most recent row (highest `stream_number` or most recently updated). When `is_streaming = false`, the live badge is hidden and the stream timer shows the final accumulated time. The board remains editable.

### YouTube Link

Set manually after the stream ends. One YouTube link per session (per DB row). Set via control panel or directly in Supabase. Stored in `stream_url`. A thumbnail/embed URL stored in `stream_preview_url` (YouTube's thumbnail URL pattern: `https://img.youtube.com/vi/{videoId}/maxresdefault.jpg`).

---

## 7. Frontend Architecture

### Entry Points

```
src/main.jsx                    → Main SPA entry. Handles /grossgauntlet/* routes.
GrossGauntlet/index.html        → Standalone OBS entry. Handles /GrossGauntlet/overlays/*
                                   and /GrossGauntlet/controls.
```

### Route Detection in App.jsx

```javascript
const GROSSGAUNTLET_ROUTES = ['/grossgauntlet'];
// Note: lowercase. /GrossGauntlet/* is the OBS standalone entry, handled separately.
```

### React Router Routes

```jsx
// In GrossGauntletRouter.jsx
<Routes>
  <Route path="/grossgauntlet"                    element={<GrossGauntletHome />} />
  <Route path="/grossgauntlet/now"                element={<GrossGauntletNow />} />
  <Route path="/grossgauntlet/:day"               element={<GrossGauntletDay />} />
  <Route path="/grossgauntlet/:day/:session"      element={<GrossGauntletSession />} />
  <Route path="/grossgauntlet/:day/replay"        element={<ReplayScrubber />} />
  <Route path="/grossgauntlet/:day/:session/replay" element={<ReplayScrubber />} />
  <Route path="/overlay/tasks"                    element={<TasksOverlay />} />
</Routes>
```

### API Abstraction — src/config/api.js

**Every fetch in every GrossGauntlet component uses `API.*`. No hardcoded URLs.**

```javascript
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const API = {
  // Session reads
  getStreamState:       ()           => `${BASE}/stream/state`,
  getAllDays:            ()           => `${BASE}/grossgauntlet/days`,
  getDay:               (day)        => `${BASE}/grossgauntlet/days/${day}`,
  getSession:           (day, sess)  => `${BASE}/grossgauntlet/days/${day}/${sess}`,

  // Board writes
  syncBoard:            ()           => `${BASE}/stream/tasks`,
  postMetrics:          ()           => `${BASE}/stream/metrics`,

  // Phase 2
  getReplayEvents:      (day, sess)  => `${BASE}/grossgauntlet/days/${day}/${sess}/events`,
};
```

---

## 8. Component Map

### File Structure

```
src/components/GrossGauntlet/
├── index.js                        ← Central export
├── constants.js                    ← All magic strings, keys, intervals
├── utils.js                        ← Shared utility functions
├── variables.css                   ← Shared CSS custom properties (tokens)
│
├── GrossGauntletRouter.jsx         ← Route definitions
├── GrossGauntletApp.jsx            ← Legacy OBS overlay renderer
├── GrossGauntletControl.jsx        ← Admin control panel
├── GrossGauntletApp.css            ← Legacy overlay styles
├── GrossGauntletPages.css          ← Page-level styles
│
├── GrossGauntletHome.jsx           ← /grossgauntlet — day grid archive
├── GrossGauntletNow.jsx            ← /grossgauntlet/now — live board
├── GrossGauntletDay.jsx            ← /grossgauntlet/:day — day view / selector
├── GrossGauntletSession.jsx        ← /grossgauntlet/:day/:session — historical session
│
├── TasksOverlay.jsx                ← /overlay/tasks — OBS browser source (NO dnd-kit)
├── ReplayScrubber.jsx              ← Phase 2 placeholder → full implementation
│
└── kanban/
    ├── KanbanBoard.jsx             ← DndContext, drag overlay, board state
    ├── KanbanBoard.module.css
    ├── KanbanColumn.jsx            ← useDroppable + SortableContext (editable) or static
    ├── KanbanColumn.module.css
    ├── KanbanCard.jsx              ← useSortable (editable) or static
    ├── KanbanCard.module.css
    └── moveTask.js                 ← Pure helpers: moveTask, addTask, deleteTask, renameTask
```

### Component Responsibilities

#### `GrossGauntletHome` — `/grossgauntlet`
- Fetches all sessions grouped by `day_number`.
- Renders a scrollable grid of Day cards.
- Each Day card shows: day number, title, date, tasks completed / total, time accumulated, live badge if `is_streaming`.
- Clicking a card → `/grossgauntlet/:day` (or directly to session if only one).
- Smooth, addictive scroll. Uses tiesin.me existing card components.

#### `GrossGauntletNow` — `/grossgauntlet/now`
- Fetches the most recent row (`highest stream_number` or `ORDER BY updated_at DESC LIMIT 1`).
- Polls `/api/stream/state` every 5000ms (not 1500ms — this is not an overlay).
- Renders `<KanbanBoard editable={isUnlocked} />`.
- Shows: live badge (if `is_streaming`), session title, accumulated time, Run button (if locked).
- Does NOT go offline. Always renders something.

#### `GrossGauntletDay` — `/grossgauntlet/:day`
- Fetches all sessions for `day_number = :day`.
- If 1 session → renders `GrossGauntletSession` directly (no selector needed).
- If 2+ sessions → renders session selector cards showing session title, time, task count.
  - Clicking a card → `/grossgauntlet/:day/:session`.

#### `GrossGauntletSession` — `/grossgauntlet/:day/:session`
- Fetches the specific row where `day_number = :day AND session_index = :session`.
- Always read-only. Never checks `localStorage`. Never renders Run button or drag handles.
- Renders: session title, date, YouTube embed/link (if `stream_url` is set), `<KanbanBoard editable={false} />`, timestamp log, stats.
- Shows Phase 2 replay button if `task_events` rows exist for this session.
- Displays notice: "Day {N} — Session {session} · Historical record"

#### `KanbanBoard` — used by GrossGauntletNow + GrossGauntletSession
- Owns local board state (optimistic).
- When `editable=true`: wraps everything in `<DndContext>`. Handles drag lifecycle.
- When `editable=false`: renders identical layout with zero DnD imports/hooks active.
- Calls `onBoardChange(newBoard)` on every mutation → parent debounces and writes to API.

#### `TasksOverlay` — `/overlay/tasks`
- OBS browser source. Read-only. No dnd-kit. No drag imports of any kind.
- Polls `getStreamState()` every 2000ms with exponential backoff.
- Renders task columns in a compact format suitable for stream overlay.
- Stale data indicator: amber dot after 10 seconds without a successful fetch.
- Background: transparent. pointer-events: none on root.

---

## 9. Backend API Layer

### Endpoint Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `GET /api/stream/state` | GET | None | Current stream state + board arrays for polling |
| `POST /api/stream/metrics` | POST | Bearer | Push mode, timer, streaming flag, title |
| `POST /api/stream/tasks` | POST | Bearer | Full 4-column board sync (action: 'sync') |
| `GET /api/grossgauntlet/days` | GET | None | All days grouped, for homepage grid |
| `GET /api/grossgauntlet/days/:day` | GET | None | All sessions for a given day_number |
| `GET /api/grossgauntlet/days/:day/:session` | GET | None | Single session row |
| `GET /api/grossgauntlet/days/:day/:session/events` | GET | None | Phase 2: task_events for replay |

### `GET /api/stream/state` — Response Shape

Must include the raw column arrays at the top level. The merged `tasks` array alone is not sufficient for board initialization.

```json
{
  "success": true,
  "timestamp": 1234567890000,
  "board": {
    "todo_tasks":         [],
    "up_next_tasks":      [],
    "in_progress_tasks":  [],
    "in_review_tasks":    [],
    "done_tasks":         []
  },
  "tasks": [...merged flat array for OBS overlay backward compat...],
  "webhookLogs": [],
  "metrics": {
    "mode": "work",
    "isStreaming": true,
    "isPaused": false,
    "contentCount": 5,
    "salesCount": 3,
    "todayWorkSeconds": 3600,
    "previousDaysSeconds": 7200,
    "modeTimestamp": 1234567890000,
    "streamNumber": 12,
    "dayNumber": 4,
    "sessionIndex": 1,
    "title": "Day 4 — Carousel Drop",
    "standbySelection": "Beach",
    "timestamps": "STREAM 4\n00:00 - Stream Started\n..."
  }
}
```

### `POST /api/stream/tasks` — Board Sync Body

```json
{
  "action": "sync",
  "todo_tasks":         [...],
  "up_next_tasks":      [...],
  "in_progress_tasks":  [...],
  "in_review_tasks":    [...],
  "done_tasks":         [...]
}
```

Auth: `Authorization: Bearer ${WEBHOOK_SECRET}` header.

Targets the active row (`is_streaming = true`) if one exists. Otherwise targets the most recent row. Updates all five column arrays atomically.

### Status Mapping — tasks.js

```javascript
const STATUS_MAP = {
  // TwentyCRM → internal
  'new':           'todo',
  'waiting':       'todo',
  'todo':          'todo',
  'up_next':       'up_next',
  'upnext':        'up_next',
  'next':          'up_next',
  'up next':       'up_next',
  'ongoing':       'in_progress',
  'in_progress':   'in_progress',
  'contacted':     'in_progress',
  'in_review':     'in_review',
  'review':        'in_review',
  'done':          'done',
  'won':           'done',
  'completed':     'done',
};

const STATUS_TO_COLUMN = {
  'todo':        'todo_tasks',
  'up_next':     'up_next_tasks',
  'in_progress': 'in_progress_tasks',
  'in_review':   'in_review_tasks',
  'done':        'done_tasks',
};
```

---

## 10. OBS Integration

### Control Panel (`/GrossGauntlet/controls`)

The admin control panel is fully built. It handles:
- Mode switching (work / break / standby / explain)
- OBS WebSocket connection (scene switching, recording)
- YouTube timestamp markers
- Metrics (content count, sales count)
- Timer controls (pause / resume / reset)
- Authentication (STREAM_ADMIN_KEY + OBS password)
- Sets/clears `grossgauntlet_unlocked` in localStorage

### OBS Browser Sources (unchanged)

| Path | Mode |
|------|------|
| `/GrossGauntlet/overlays/explain` | Explain |
| `/GrossGauntlet/overlays/break` | Break |
| `/GrossGauntlet/overlays/work` | Work |
| `/GrossGauntlet/overlays/standby` | Standby |
| `/overlay/tasks` | Tasks (no dnd-kit) |

### Title Sync on Stream Start

When OBS stream starts (WebSocket event in `GrossGauntletControl`), the handler should:
1. Fetch current OBS stream title via `obs.call('GetStreamStatus')` or `obs.call('GetProfileParameter', { parameterCategory: 'Info', parameterName: 'Name' })`.
2. Include `title` in the `POST /api/stream/metrics` payload that creates the new session row.
3. If OBS title is empty, default: `"Day ${dayNumber} — Session ${sessionIndex}"`.

### `is_streaming` — Display Only

`is_streaming` drives these UI elements only:
- Live red badge on day cards in the homepage grid
- Live indicator on `/grossgauntlet/now`
- Session timer running state
- Stream start timestamp in the timestamp log

It does **not** gate editing. Editing is `grossgauntlet_unlocked` only.

### Bundle Isolation Rule

`TasksOverlay.jsx` must never import:
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

Verification: `grep -r "@dnd-kit" src/components/GrossGauntlet/TasksOverlay.jsx` — only the documentation comment should appear.

---

## 11. Visual Identity

### Core Principle: Conservation

GrossGauntlet uses the existing tiesin.me component system. New components built for GrossGauntlet **inherit** the existing identity — they do not introduce new design systems, new font families, new border-radius conventions, or new color systems. When in doubt, reuse an existing tiesin.me component rather than building a new one.

### Existing Token System (from variables.css)

```css
--bg: #000000;
--white-100: rgba(173, 181, 189, 1.00);
--white-92:  rgba(173, 181, 189, 0.92);
--white-82:  rgba(173, 181, 189, 0.82);
--white-70:  rgba(173, 181, 189, 0.70);
--white-55:  rgba(173, 181, 189, 0.55);
--white-45:  rgba(173, 181, 189, 0.45);
--white-35:  rgba(173, 181, 189, 0.35);
--white-25:  rgba(173, 181, 189, 0.25);
--white-12:  rgba(173, 181, 189, 0.12);
--white-10:  rgba(173, 181, 189, 0.10);
--white-07:  rgba(173, 181, 189, 0.07);
--white-06:  rgba(173, 181, 189, 0.06);
--panel-bg:  rgba(0, 0, 0, 0.62);
--font:      "Space Grotesk", system-ui, -apple-system, sans-serif;
```

### Status Colors (kanban-specific additions to variables.css)

```css
--status-todo:         #808080;
--status-todo-bg:      rgba(160, 160, 160, 0.12);
--status-upnext:       #8A4FFF;
--status-upnext-bg:    rgba(138, 79, 255, 0.12);
--status-progress:     #2ECC71;
--status-progress-bg:  rgba(46, 204, 113, 0.12);
--status-review:       #F0A500;
--status-review-bg:    rgba(240, 165, 0, 0.12);
--status-done:         #E74C3C;
--status-done-bg:      rgba(231, 76, 60, 0.12);
```

### Feel

The site is **function-based identity**. It should feel like a real tool that happens to be beautifully made, not a portfolio piece that happens to contain data. Smooth, fast, no loading states longer than necessary, no unnecessary animation. Addictive to scroll because the data is interesting, not because there are scroll-jacking effects.

The one aesthetic risk worth taking: the homepage grid of days should feel like a **record label discography page** — every day is an album, the kanban completion state is the tracklist, the time is the runtime. Dense, archival, proud.

---

## 12. Phase 1 — Live Board (Current)

### What Is Built ✅

- Full routing: `/grossgauntlet`, `/grossgauntlet/now`, `/grossgauntlet/:day`, `/grossgauntlet/:day/:session`
- `KanbanBoard`, `KanbanColumn`, `KanbanCard` components with `@dnd-kit`
- `moveTask.js` pure helper (moveTask, addTask, deleteTask, renameTask, buildBoard)
- CSS modules using existing token system
- Auth gate: RunButton → password check → localStorage unlock
- Debounced board sync (400ms) on every mutation
- OBS overlay (`TasksOverlay.jsx`) with polling + backoff + stale detection (no dnd-kit)
- `GrossGauntletControl` sets/clears `grossgauntlet_unlocked`
- Build passes cleanly, no dnd-kit in overlay (verified)

### What Is Not Yet Built ❌

- [ ] **Fifth column: `todo_tasks`** — add to DB schema, add to all API responses, add column to board left of Up Next, gray color (#808080)
- [ ] **Rename `TasksEditor` → `GrossGauntletNow`** and move to `/grossgauntlet/now` route
- [ ] **Rename `LogIndex` → `GrossGauntletHome`** with updated route
- [ ] **Rename `LogView` → `GrossGauntletDay`** with updated route `/grossgauntlet/:day`
- [ ] **Rename `SessionView` → `GrossGauntletSession`** with updated route
- [ ] **Remove all deprecated routes** (`/tasks`, `/tasks/:streamNumber`, `/Logs/*`)
- [ ] **Update vercel.json** rewrites to match new URL structure
- [ ] **Update `src/config/api.js`** endpoint paths to `/api/grossgauntlet/days/...`
- [ ] **`state.js`** must return `board: { todo_tasks, up_next_tasks, in_progress_tasks, in_review_tasks, done_tasks }` as top-level key
- [ ] **`tasks.js`** must handle `todo_tasks` in sync action
- [ ] **`day_number` and `session_index`** fields added to DB and populated on session create
- [ ] **Title sync from OBS** on stream start in `GrossGauntletControl`
- [ ] **`stream_url` and `stream_preview_url`** fields in DB, settable from control panel
- [ ] **Editing is NOT stream-gated** — remove `isStreaming` check from editable condition
- [ ] **Remove the word "log"** from all component names, variable names, and UI strings
- [ ] **`is_streaming` gates display only** — live badge, timer state — not editing

### Drag-and-Drop Constraints

- 5px pointer movement required before drag activates (prevents rename double-click conflicts)
- Same-column reorder: supported
- Cross-column move: supported, updates `status` field on the card object
- Keyboard drag-and-drop: supported via KeyboardSensor
- DragOverlay ghost card: slight rotation (1.5deg), reduced opacity, box-shadow
- On drop: optimistic update → 400ms debounce → API sync
- On API failure: non-blocking error banner, board stays in optimistic state

---

## 13. Phase 2 — Replay & Archive

### Overview

Phase 2 adds an append-only event log to every board mutation and builds a timeline scrubber UI that lets anyone replay a session like a video. This is built on top of Phase 1's write paths — every `onDragEnd`, `addTask`, `deleteTask`, and `renameTask` handler fires an additional insert to `task_events`.

### What Gets Logged

Every board mutation fires one insert to `task_events`:
- Card created → `event_type: 'create'`
- Card moved (column change or reorder) → `event_type: 'move'`
- Card renamed → `event_type: 'rename'`
- Card deleted → `event_type: 'delete'`

The log is **global** — it captures everything, including off-stream board manipulations. `occurred_at` is the wall clock timestamp.

### Replay Algorithm (Pure Function)

```javascript
function replayToTime(events, targetTime) {
  const board = {
    todo_tasks: [], up_next_tasks: [], in_progress_tasks: [],
    in_review_tasks: [], done_tasks: []
  };

  const relevant = events
    .filter(e => new Date(e.occurred_at) <= targetTime)
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));

  for (const event of relevant) {
    switch (event.event_type) {
      case 'create':
        board[statusToColKey(event.to_column)].push({
          id: event.task_id,
          name: event.payload.title,
          status: event.to_column,
          createdAt: new Date(event.occurred_at).getTime()
        });
        break;
      case 'move':
        const task = removeFromBoard(board, event.task_id);
        if (task) board[statusToColKey(event.to_column)].push(task);
        break;
      case 'rename':
        updateInBoard(board, event.task_id, { name: event.payload.new });
        break;
      case 'delete':
        removeFromBoard(board, event.task_id);
        break;
    }
  }
  return board;
}
```

### ReplayScrubber UI

```
┌─────────────────────────────────────────────────────────┐
│  Day 19 — Session 1 · Replay                            │
│  [▶ Play]  [1×] [2×] [5×]   ◀──────●────────▶   08:24  │
│                                                          │
│  ┌── To-Do ──┐ ┌── Up Next ──┐ ┌── In Progress ──┐ ... │
│  │           │ │  Blade Sc.  │ │  Carousel Gen.  │     │
│  └───────────┘ └─────────────┘ └─────────────────┘     │
│                                                          │
│  TIMESTAMPS LOG                                          │
│  ─────────────────────────────────────────────────────  │
│  00:07 - work - storyboarding                           │
│  38:20 - work - GENERATIONS                             │
│  56:30 - break                                          │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

**Controls:**
- Play/pause button
- Speed multiplier: 1×, 2×, 5×, 10× (an 8-hour session at 10× = 48 minutes)
- Scrubber slider: maps 0–100% to session start → session end timestamps
- Current time display (session-relative: 01:23:45 format)
- The board below the scrubber re-renders on every slider tick via `replayToTime()`

**Timestamps log:**
- The existing `timestamps` text field from the DB row (YouTube marker log) is displayed alongside the board during replay.
- A horizontal line or marker on the scrubber indicates major timestamps from this log.

**YouTube embed:**
If `stream_url` is set, a YouTube embed or thumbnail link appears above or beside the scrubber, so the viewer can watch the stream at the corresponding moment.

**Step control:**
- ← → arrow buttons to jump to the previous/next `task_event` in the log (for precise moment navigation).

### Phase 2 Build Order

1. Create `task_events` table in Supabase
2. Add event insert to every write path in `GrossGauntletNow` (create, move, rename, delete)
3. Build `replayToTime()` pure function — test independently, no UI needed
4. Build `ReplayScrubber.jsx` — slider, play/pause, speed control
5. Add `GET /api/grossgauntlet/days/:day/:session/events` endpoint
6. Wire `/grossgauntlet/:day/replay` and `/grossgauntlet/:day/:session/replay` routes
7. Add YouTube embed/link to `GrossGauntletSession` view
8. (Optional) Backfill existing raw webhook logs into `task_events` via migration script

---

## 14. Build Status

### Completed ✅
- Vite multi-page build (main + GrossGauntlet standalone)
- React Router routing (partial — needs rename/restructure per §12)
- KanbanBoard / KanbanColumn / KanbanCard with @dnd-kit
- moveTask.js pure helper
- Auth gate (RunButton + localStorage)
- Debounced board sync
- TasksOverlay (OBS, no dnd-kit, polling + backoff)
- GrossGauntletControl (admin panel, OBS WebSocket, mode switching)
- Shared utilities (utils.js, constants.js, variables.css)
- Build passes, dnd-kit verified absent from overlay

### In Progress 🔄
- URL restructure (rename routes, update vercel.json)
- Fifth column (todo_tasks) addition
- is_streaming decoupled from editing

### Not Started ❌
- Day/session numbering system in DB
- Title sync from OBS
- YouTube link fields
- Phase 2 (task_events, replay, scrubber)
- grossgauntlet.com domain (future)

---

## 15. Open Decisions Log

All previously open questions are now resolved. Logging here for traceability.

| Question | Resolution |
|----------|------------|
| Unit of a "day" — calendar day or session? | Each stream session is its own DB row. Day number = challenge calendar day from Aug 14 2026. Multiple sessions same day → same `day_number`, different `session_index`. |
| YouTube link — per day or per session? | Per session (per DB row). Each session has its own `stream_url` and `stream_preview_url`. |
| Session title — who sets it, when? | Pulled from OBS stream title via WebSocket on stream start. Falls back to `"Day {N} — Session {session_index}"` if empty. |
| Edit gate — password only or password + streaming? | Password only (`grossgauntlet_unlocked`). `is_streaming` does not gate editing. |
| Edit unlock persistence | `localStorage` — survives refresh, survives tab close, cleared only by "Disconnect & Lock" in control panel. |
| Column count | Five: To-Do, Up Next, In Progress, In Review, Done |
| Word for a session record | "Day" — never "Log", never "Session" in user-facing strings (though "session" is used in code for multi-session days) |
| Challenge start date | August 14, 2026 (1 Rabi' al-Awwal 1448H) |
| Challenge end date | Open-ended. No end date. |
| Domain | tiesin.me/grossgauntlet now. grossgauntlet.com when affordable. |
| Replay — personal tool or public? | Both. Primarily personal, but publicly accessible. |
| Deleted cards in replay | Show full history — cards appear and disappear as they were created/deleted. |

---

## 16. Glossary

| Term | Definition |
|------|------------|
| **Day** | One calendar day of the GrossGauntlet challenge. Day 1 = Aug 14 2026. Used in all URLs and UI labels. |
| **Session** | One stream within a day. A day can have 1 or more sessions. Each session is one DB row. |
| **day_number** | Integer. Challenge calendar day. `toDayNumber(date)`. Used in URLs. |
| **session_index** | Integer. Which session within that day (1, 2, ...). Used in URLs when a day has multiple sessions. |
| **stream_number** | Integer. Global ever-incrementing session count. Used internally, not in URLs. |
| **is_streaming** | Boolean. Whether OBS is currently live. Display flag only — does not gate editing. |
| **grossgauntlet_unlocked** | `localStorage` key. `'true'` means the admin password was entered. Gates editing. |
| **Dynamic archive** | The overall product vision: a live, replayable, publicly browsable record of work done in public. |
| **todo_tasks** | The fifth (leftmost) Kanban column. Gray. For not-started tasks. New addition. |
| **task_events** | Phase 2 append-only event log. One row per board mutation. Enables replay. |
| **Replay** | Phase 2 feature. A scrubber that replays task movements from `task_events` against a blank board. |
| **timestamps** | The YouTube marker text log stored per session. Format: `"HH:MM - mode - description"`. |
| **Run button** | The password prompt on `/grossgauntlet/now`. Unlocks editing. |
| **`/grossgauntlet/now`** | The live board. Always online. Always the most recent session. |
| **`/grossgauntlet/19`** | Day 19 of the challenge. |
| **`/grossgauntlet/19/1`** | Session 1 of Day 19. Historical, read-only. |
| **GrossGauntlet** | The challenge and the site section. Gross = profit margins. Gauntlet = the challenge. |

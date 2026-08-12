# GrossGauntlet — Complete System Architecture & Operations Manual

> **Purpose:** This document is the single source of truth for the GrossGauntlet ecosystem. It covers frontend routing, backend API functions, the Supabase data model, the OBS overlay system, authentication, slug normalization, event logging, and deployment. Any developer starting a new chat about GrossGauntlet should begin here.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Frontend Architecture](#2-frontend-architecture)
   - 2.1 Route Hierarchy & Component Map
   - 2.2 App Shell Integration (multi-entry)
   - 2.3 Access Control Matrix
   - 2.4 Component Tree
3. [Backend API Layer](#3-backend-api-layer)
   - 3.1 API Endpoint Reference
   - 3.2 API Abstraction Layer (`src/config/api.js`)
   - 3.3 Serverless Function Details
4. [Data Model (Supabase)](#4-data-model-supabase)
   - 4.1 `GrossGauntlet` Table Schema
   - 4.2 Field Mapping: API ↔ Database
   - 4.3 Session Lifecycle & `is_streaming` Flag
   - 4.4 Phase 2: `task_events` Append-Only Log
5. [Slug System](#5-slug-system)
   - 5.1 `generateSlug()` Algorithm
   - 5.2 Deterministic URL Guarantees
6. [Authentication & Authorization](#6-authentication--authorization)
   - 6.1 Admin Gate (`grossgauntlet_unlocked`)
   - 6.2 Stream-Gated Editing (`is_streaming`)
   - 6.3 Historical Page Immutability
7. [OBS Overlay System](#7-obs-overlay-system)
   - 7.1 Overlay Architecture
   - 7.2 Polling & Backoff Strategy
   - 7.3 Stale Data Detection
   - 7.4 Bundle Isolation (no dnd-kit)
8. [Legacy Overlay Compatibility](#8-legacy-overlay-compatibility)
   - 8.1 OBS Browser Source Paths
   - 8.2 Control Panel Paths
9. [Kanban Board Spec (Phase 1 & 2)](#9-kanban-board-spec-phase-1--2)
   - 9.1 Phase 1: Live Board
   - 9.2 Phase 2: Event Replay
   - 9.3 Drag-and-Drop Flow
10. [Styling & Visual System](#10-styling--visual-system)
11. [Deployment & Environment](#11-deployment--environment)
    - 11.1 Environment Variables
    - 11.2 Vercel Configuration
    - 11.3 Build & Verification Checklist
12. [Development Guide](#12-development-guide)
    - 12.1 Running Locally
    - 12.2 Adding a New Route
    - 12.3 Adding a New API Endpoint
    - 12.4 Testing the Overlay

---

## 1. System Overview

GrossGauntlet is a **stream-integrated task management, logging, and OBS overlay subsystem** embedded within the web application. It provides:

- **Public log/session archives** — numbered sequentially by stream session (Log 1, Log 2, ...), each an immutable historical record.
- **Streaming-gated task editor** — a live Kanban board that's only editable when the stream is active AND the admin password is unlocked.
- **OBS overlays** — lightweight, zero-overhead browser sources for streaming software, with resilient polling and stale-data detection.
- **Control panel** — an admin dashboard for managing stream state, OBS scenes, YouTube markers, and metrics.
- **Phase 2: Event replay** — an append-only event log that enables timeline-based scrubber playback of any session.

**Key architectural decisions:**

- **Row unit = stream session**, not calendar day. Multiple streams on the same date produce separate rows with distinct URLs. This cleanly handles midnight-crossing sessions (e.g., 23:44 → 08:00).
- **`is_streaming` flag** is the canonical "is there a live session?" indicator, checked on every state poll.
- **Historical pages are permanently read-only** — they ignore the unlock flag entirely, even for authenticated users.
- **All API calls funnel through `src/config/api.js`** — no hardcoded fetch URLs in UI components.
- **The OBS overlay is a separate component** that explicitly excludes `@dnd-kit` to minimize memory footprint in the browser source.

---

## 2. Frontend Architecture

### 2.1 Route Hierarchy & Component Map

| Path | Component | File | Access | Description |
|------|-----------|------|--------|-------------|
| `/grossgauntlet` | `LogIndex` | `LogIndex.jsx` | Public | Master grid of all recorded stream logs, numbered sequentially by row position (Log 1, Log 2, ...). |
| `/grossgauntlet/log:logNumber` | `LogView` | `LogView.jsx` | Public | Log detail page. Direct link if single-session; selector cards showing `stream_number`, subtitle, and derived slug if multi-session. |
| `/grossgauntlet/log:logNumber/:slug` | `SessionView` | `SessionView.jsx` | Public (Read-Only) | Immutable archive view. Strictly ignores auth/unlock state. Displays title, date, tasks list, metrics. |
| `/tasks` | `TasksEditor` | `TasksEditor.jsx` | Gated | Interactive task editor. Requires **both** `is_streaming === true` AND `grossgauntlet_unlocked === 'true'`. Falls back to read-only showing latest session. |
| `/tasks/:slug/replay` | `ReplayScrubber` | `ReplayScrubber.jsx` | Public (Phase 2) | Step-by-step event timeline scrubber. Currently renders a Phase 2 placeholder banner. |
| `/overlay/tasks` | `TasksOverlay` | `TasksOverlay.jsx` | Public (OBS) | Zero-overhead task list overlay. Auto-polls with backoff and stale data detection. No dnd-kit imports. |

### 2.2 App Shell Integration (Multi-Entry)

The application has **two entry points** that share components:

**Entry 1: `src/main.jsx` (main website)**
- Wraps `<App />` in `<BrowserRouter>`.
- `App.jsx` detects the current route via `useLocation()`.
- If the path starts with `/grossgauntlet`, `/tasks`, or `/overlay` → renders `<GrossGauntletRouter />`.
- Otherwise → renders the existing style quiz flow (Background, Welcome, Quiz, Output, Confirmation).

**Entry 2: `src/GrossGauntlet.jsx` (standalone OBS page)**
- Loaded by `GrossGauntlet/index.html` (multi-page Vite entry).
- Handles legacy overlay paths (`overlays/explain`, `overlays/break`, `overlays/work`, `overlays/standby`) by rendering `GrossGauntletApp` with the appropriate `displayMode`.
- Handles the control panel (`/controls` or `?controls`) by rendering `GrossGauntletControl`.
- For all other paths, renders the same `<BrowserRouter>` + `<Routes>` config as the main app.

**Vite Multi-Page Config (`vite.config.js`):**
```javascript
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),
      GrossGauntlet: resolve(__dirname, 'GrossGauntlet/index.html'),
    },
  },
},
```

**Dev Server Rewrites (`vite.config.js` vercelRewritesPlugin):**
- `/GrossGauntlet/controls` → `/GrossGauntlet/index.html`
- `/GrossGauntlet/overlays/*` → `/GrossGauntlet/index.html`
- `/GrossGauntlet*` → `/GrossGauntlet/index.html`

### 2.3 Access Control Matrix

| State | `/tasks` Behavior | Historical Pages | Overlay |
|-------|-------------------|------------------|---------|
| No stream, no unlock | Read-only fallback (latest session) | Read-only | Read-only |
| No stream, unlocked | Read-only fallback (latest session) | Read-only | Read-only |
| Streaming, no unlock | Read-only (shows "unlock to edit") | Read-only | Read-only |
| Streaming, unlocked | **Fully editable** | Read-only | Read-only |

### 2.4 Component Tree

```
<BrowserRouter>                          // in main.jsx or GrossGauntlet.jsx
  └─ <App />                             // route detection in App.jsx
       ├─ <GrossGauntletRouter />         // if GG route detected
       │    ├─ <LogIndex />               // /grossgauntlet
       │    ├─ <LogView />                // /grossgauntlet/log:logNumber
       │    ├─ <SessionView />            // /grossgauntlet/log:logNumber/:slug
       │    ├─ <TasksEditor />            // /tasks
       │    ├─ <ReplayScrubber />         // /tasks/:slug/replay
       │    └─ <TasksOverlay />           // /overlay/tasks
       └─ Quiz flow                       // non-GG routes
            ├─ <Background />
            ├─ <Welcome />
            ├─ <Quiz />
            ├─ <OutputScreen />
            └─ <Confirmation />

<GrossGauntletApp />                     // legacy OBS overlays
  └─ displayMode: explain | break | work | standby

<GrossGauntletControl />                 // admin control panel
```

---

## 3. Backend API Layer

### 3.1 API Endpoint Reference

All endpoints are Vercel serverless functions under `/api/`.

| Endpoint | Method | Auth | Purpose | File |
|----------|--------|------|---------|------|
| `/api/stream/state` | GET | None | Fetch current stream state, metrics, and tasks | `api/stream/state.js` |
| `/api/stream/metrics` | POST | Bearer token | Push stream metrics (mode, timers, counts) | `api/stream/metrics.js` |
| `/api/stream/tasks` | POST/DELETE | Bearer token | Webhook for task CRUD operations | `api/stream/tasks.js` |
| `/api/stream/webhook` | POST | Bearer token | Legacy webhook for Kanban updates | `api/stream/webhook.js` |
| `/api/stream/minecraft` | GET/POST | Varies | Minecraft server state (separate subsystem) | `api/stream/minecraft.js` |

### 3.2 API Abstraction Layer (`src/config/api.js`)

**File:** `src/config/api.js`

**Rule:** Every HTTP fetch in any GrossGauntlet component **must** use `API.*` from this file. Hardcoded URL strings in JSX/component files are forbidden.

```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const API = {
  getAllLogs: () => `${API_BASE}/grossgauntlet/logs`,
  getLogByIndex: (logNumber) => `${API_BASE}/grossgauntlet/logs/${logNumber}`,
  getSession: (logNumber, slug) => `${API_BASE}/grossgauntlet/logs/${logNumber}/${slug}`,
  getStreamState: () => `${API_BASE}/stream/state`,
  getTasks: () => `${API_BASE}/stream/tasks`,
  postMetrics: () => `${API_BASE}/stream/metrics`,
  getReplayEvents: (slug) => `${API_BASE}/stream/replay/${slug}`,
};
```

**Base URL:** All endpoints use relative `/api/` paths for same-origin requests under the main domain (e.g., `tiesin.me/api/...`). Override via `VITE_API_BASE_URL` env variable for local dev or proxied setups.

**Backend route structure:**
- `/api/grossgauntlet/logs/:logNumber` — public log archives (plural RESTful)
- `/api/stream/state|metrics|tasks|replay` — live stream & task controls

**No placeholder URLs** — the config uses clean relative paths with no hardcoded domain names. The single `VITE_API_BASE_URL` env variable is optional and only needed for non-standard local dev setups.

### 3.3 Serverless Function Details

#### `api/stream/state.js` — State Polling Endpoint

The most frequently called endpoint (every 1500ms in overlays, every 5000ms in TasksEditor).

**What it does:**
1. Queries Supabase `GrossGauntlet` table for a row where `is_streaming = true`.
2. If no active stream, falls back to today's date row.
3. Calculates `previousDaysSeconds` from all past rows (uses `accumulated_seconds` if any row has manually set it, otherwise sums `today_seconds`).
4. If the current mode is `work` AND streaming, calculates `activeOffset` from `session_start_timestamp` or `mode_timestamp`.
5. Combines `in_progress_tasks`, `in_review_tasks`, `up_next_tasks`, `done_tasks` into a single `tasks` array.

**Response shape:**
```json
{
  "success": true,
  "timestamp": 1234567890000,
  "tasks": [ { "id": "1", "name": "Task", "status": "in_progress", "createdAt": 1234567890000, "completedAt": null } ],
  "webhookLogs": [ "[12:00:00] Webhook: 'Task' -> in_progress" ],
  "metrics": {
    "mode": "work",
    "contentCount": 5,
    "salesCount": 3,
    "previousDaysSeconds": 7200,
    "todayWorkSeconds": 3600,
    "isStreaming": true,
    "standbySelection": "Beach",
    "timestamps": "STREAM 1\n...",
    "streamNumber": 1,
    "accumulatedTodaySeconds": 3600,
    "modeTimestamp": 1234567890000,
    "isPaused": false,
    "pausedTimestamp": null,
    "totalDays": 42
  }
}
```

#### `api/stream/metrics.js` — Metrics Push Endpoint

**Auth:** Requires `Authorization: Bearer ${WEBHOOK_SECRET}` header.

**What it does:**
1. Validates incoming payload (mode validity, isStreaming boolean, isPaused boolean, non-negative accumulated time).
2. Determines active date (uses active stream's date if exists, otherwise today).
3. Upserts the `GrossGauntlet` row with field-by-field mapping.
4. Special handling for active streams: updates the existing record without changing its `date` field (preserves midnight-crossing continuity).

**Key field mappings:**
| Payload Field | DB Column | Notes |
|--------------|-----------|-------|
| `mode` | `mode` | `work`, `break`, `standby`, `explain`, or `explain\|topic` |
| `contentCount` | `content_count` | |
| `salesCount` | `sales_count` | |
| `accumulatedTodaySeconds` | `today_seconds` | |
| `modeTimestamp` | `mode_timestamp` | |
| `sessionStartTimestamp` | `session_start_timestamp` | Preserves live session timing across day boundaries |
| `isStreaming` | `is_streaming` | Boolean |
| `standbySelection` | `standby_selection` | |
| `timestamps` | `timestamps` | YouTube marker text |
| `streamNumber` | `stream_number` | |
| `isPaused` | `is_paused` | Boolean |
| `pausedTimestamp` | `paused_timestamp` | |

#### `api/stream/tasks.js` — Task Webhook Endpoint

**Auth:** Multi-method — checks `Authorization`, `x-api-key`, body `secret`, or query `secret` against `WEBHOOK_SECRET`.

**What it does:**
1. Fetches existing task arrays from the active stream's row.
2. Maps various status strings from Twenty CRM or other sources to the overlay's internal statuses (`waiting`, `in_progress`, `up_next`, `in_review`, `done`).
3. Removes the task from all arrays first (to prevent duplicates), then adds it to the appropriate array.
4. Supports `action: 'sync'` for full array replacement, and `action: 'delete'` for removal.
5. Maintains a `webhook_logs` array (last 30 entries) for debugging.

**Status mapping table:**
| Source Status | Mapped Status |
|--------------|---------------|
| `new`, `waiting`, `todo` | `waiting` |
| `ongoing`, `in_progress`, `contacted`, `qualified` | `in_progress` |
| `in_review`, `review` | `in_review` |
| `up_next`, `upnext`, `next`, `up next` | `up_next` |
| `won`, `lost`, `converted`, `unqualified`, `done`, `completed` | `done` |

---

## 4. Data Model (Supabase)

### 4.1 `GrossGauntlet` Table Schema

```sql
GrossGauntlet
------------------------------------------------
id                  serial / uuid, primary key
date                date              -- descriptive date (NOT used for numbering)
title               text              -- session title/name
subtitle            text              -- optional subtitle
mode                text              -- 'work' | 'break' | 'standby' | 'explain' | 'explain|<topic>'
is_streaming        boolean           -- true for at most one row: the current live session
is_paused           boolean           -- pause state for the live timer
today_seconds       integer           -- accumulated work seconds for this session
accumulated_seconds integer           -- total accumulated seconds across all sessions
mode_timestamp      bigint            -- timestamp when mode last changed
session_start_timestamp bigint        -- preserved across day boundaries
paused_timestamp    text              -- ISO timestamp when paused
content_count       integer           -- content/contacted metric
sales_count         integer           -- sales/converted metric
standby_selection   text              -- standby screen title
timestamps          text              -- YouTube marker log
stream_number       integer           -- stream session number
in_progress_tasks   jsonb[]           -- array of task objects { id, name, status, createdAt, completedAt, due }
in_review_tasks     jsonb[]           -- array of task objects
up_next_tasks       jsonb[]           -- array of task objects
done_tasks          jsonb[]           -- array of task objects
webhook_logs        jsonb[]           -- array of log strings
created_at          timestamptz
updated_at          timestamptz
```

### 4.2 Field Mapping: API ↔ Database

| JavaScript (frontend) | JavaScript (API) | SQL Column |
|----------------------|------------------|------------|
| `isStreaming` | `isStreaming` | `is_streaming` |
| `isPaused` | `isPaused` | `is_paused` |
| `accumulatedTodaySeconds` | `accumulatedTodaySeconds` | `today_seconds` |
| `modeTimestamp` | `modeTimestamp` | `mode_timestamp` |
| `sessionStartTimestamp` | `sessionStartTimestamp` | `session_start_timestamp` |
| `contentCount` | `contentCount` / `contactedCount` | `content_count` |
| `salesCount` | `salesCount` / `convertedCount` | `sales_count` |
| `standbySelection` | `standbySelection` | `standby_selection` |
| `streamNumber` | `streamNumber` | `stream_number` |
| `inProgressTasks` | `inProgressTasks` | `in_progress_tasks` |
| `inReviewTasks` | `inReviewTasks` | `in_review_tasks` |
| `upNextTasks` | `upNextTasks` | `up_next_tasks` |
| `doneTasks` | `doneTasks` | `done_tasks` |

### 4.3 Session Lifecycle & `is_streaming` Flag

```
STREAM START (OBS event):
  → Create new row with is_streaming = true
  → Set stream_number = previous_max + 1
  → Set mode = 'standby'
  → Initialize timestamps with "STREAM {N}"

MODE CHANGE (user action):
  → Update mode, accumulatedTodaySeconds, modeTimestamp
  → Add YouTube marker

STREAM STOP (OBS event):
  → Capture elapsed work time into accumulatedTodaySeconds
  → Set is_streaming = false
  → Add separator line to timestamps
  → The row is now a permanent historical record

BETWEEN SESSIONS:
  → /tasks shows the most recent row (highest stream_number) in read-only mode
  → "Run" button creates the next row

NEW STREAM START:
  → Always creates a new row, never reuses a prior row
  → Increments stream_number
```

### 4.4 Phase 2: `task_events` Append-Only Log

```sql
task_events
------------------------------------------------
id              serial / uuid, primary key
day_id          references GrossGauntlet.id
task_id         text             -- stable ID, survives across moves
event_type      text             -- 'create' | 'move' | 'rename' | 'delete' | 'update'
from_column     text (nullable)  -- null on create
to_column       text (nullable)  -- null on delete
payload         jsonb            -- snapshot of relevant change (old/new title, etc.)
occurred_at     timestamptz
```

**Key rules:**
- This table is **append-only** — never update or delete rows.
- The `GrossGauntlet` row is always "current state." The event table is "how we got here."
- Replay is built by replaying this table in timestamp order against a blank board.
- Event types and their payload shapes:
  ```json
  // create:  { "event_type": "create", "to_column": "UP_NEXT", "payload": { "title": "Task" } }
  // move:    { "event_type": "move", "from_column": "UP_NEXT", "to_column": "IN_PROGRESS", "payload": {} }
  // rename:  { "event_type": "rename", "payload": { "old_title": "Old", "new_title": "New" } }
  // delete:  { "event_type": "delete", "from_column": "DONE", "payload": { "title": "Task" } }
  ```

---

## 5. Slug System

### 5.1 `generateSlug()` Algorithm

**File:** `src/utils/slug.js`

```javascript
export function generateSlug(streamTitle) {
  if (!streamTitle) return 'session';
  const parts = streamTitle.split(/[:—–-]/);
  const rawSub = parts[parts.length - 1] || streamTitle;

  return rawSub
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // Strip spaces, symbols, punctuation
    .slice(0, 40);              // Hard cap at 40 chars
}
```

**Step-by-step:**
1. **Delimiter Split:** Splits on `:`, `—`, `–`, or `-` and isolates the final segment (the subtitle).
2. **Character Filtering:** Strips all non-alphanumeric characters (spaces, symbols, punctuation).
3. **Casing:** Converts to lowercase.
4. **Truncation:** Caps the result at 40 characters maximum.

### 5.2 Deterministic URL Guarantees

The slug is **deterministic** — given the same stream title, it always produces the same slug. This guarantees:

- URLs are stable and bookmarkable.
- A session's URL never changes after it's created.
- The slug can be regenerated at any time for matching/comparison.

**Example conversions:**
| Input | Output |
|-------|--------|
| `"Gross Gauntlet — Log 7: Chapter 1 shipped"` | `"chapter1shipped"` |
| `"Log 5: Fixing the pipeline"` | `"fixingthepipeline"` |
| `"Just chatting – Q&A session"` | `"qasession"` |
| `"Debugging the build"` | `"debuggingthebuild"` |

**Helper function:**
```javascript
export function matchesSlug(streamTitle, slug) {
  if (!slug) return false;
  return generateSlug(streamTitle) === slug;
}
```

---

## 6. Authentication & Authorization

### 6.1 Admin Gate (`grossgauntlet_unlocked`)

**Key:** `localStorage.getItem('grossgauntlet_unlocked') === 'true'`

**Origin:** The unlock flag is set by the **control panel** (`GrossGauntletControl.jsx`) when the user enters the correct admin password. The same password check that gates OBS scene switching also sets this flag.

**Behavior:**
- Survives page refreshes (stored in `localStorage`).
- Removed when the user clicks "Disconnect & Lock" in the control panel.
- Checked by `TasksEditor.jsx` on every state poll to determine editable state.

**Code pattern:**
```javascript
const UNLOCK_KEY = 'grossgauntlet_unlocked';

function getIsUnlocked() {
  try {
    return localStorage.getItem(UNLOCK_KEY) === 'true';
  } catch {
    return false;
  }
}
```

### 6.2 Stream-Gated Editing (`is_streaming`)

Editing the `/tasks` board requires **both** conditions to be `true`:
1. `is_streaming === true` (from the API's `metrics.isStreaming` field)
2. `getIsUnlocked() === true` (from `localStorage`)

If either condition fails, the board renders in **read-only mode**:
- If `isStreaming === false` → "No active stream. Showing latest session in read-only mode."
- If `isStreaming === true` but not unlocked → "Stream is locked. Enable unlock in control panel to edit."

### 6.3 Historical Page Immutability

Historical session pages (`/grossgauntlet/log:logNumber/:slug`) are **permanently read-only**. They:
- Never call `getIsUnlocked()`.
- Never check `localStorage`.
- Never render drag handles, edit buttons, or interactive controls.
- Display a notice: "⚡ Historical record — read-only view"

This is a deliberate design decision: historical records are frozen snapshots and should never be mutated, even by an authenticated user.

---

## 7. OBS Overlay System

### 7.1 Overlay Architecture

**File:** `src/components/GrossGauntlet/TasksOverlay.jsx`

The overlay is a **separate, minimal component** designed for OBS browser sources. It is **not** the same component as the interactive board — it's a dedicated, read-only, polling-based task list.

**Key design goals:**
- Minimal memory footprint (browser sources are typically resource-constrained).
- No drag-and-drop code at all (prevents accidental drag handles on stream).
- Resilient to network failures (exponential backoff).
- Transparent background (for chroma/alpha blending in OBS).

### 7.2 Polling & Backoff Strategy

```
Normal operation:   poll every 2000ms
On error:           backoffRef *= 2, up to MAX_BACKOFF_MS = 30000ms
On success:         reset backoffRef to POLL_INTERVAL_MS = 2000ms
```

**Implementation:**
```javascript
async function poll() {
  if (cancelled) return;
  await fetchTasks();
  if (cancelled) return;
  timeoutId = setTimeout(poll, backoffRef.current);
}
```

The polling uses `setTimeout` recursion (not `setInterval`) to ensure the backoff timing is correct — the next poll doesn't fire until the current one completes (including the backoff delay).

### 7.3 Stale Data Detection

A separate `setInterval` at 1000ms checks whether data has become stale:

```javascript
const staleInterval = setInterval(() => {
  if (lastFetchTime && Date.now() - lastFetchTime > STALE_THRESHOLD_MS) {
    setIsStale(true);
  } else {
    setIsStale(false);
  }
}, 1000);
```

**Visual indicator:** A subtle amber dot (●) appears next to the "Tasks" header when data is stale (>10 seconds since last successful fetch). The dot pulses with an opacity animation.

### 7.4 Bundle Isolation (no dnd-kit)

**This is a critical constraint.** The `TasksOverlay` component must **never** import:

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- Any other drag-and-drop library

**Verification command:**
```bash
findstr /I "@dnd-kit" src\components\GrossGauntlet\TasksOverlay.jsx
```

Expected output: only the documentation comment line, no actual `import` statements.

**Why this matters:** OBS browser sources are embedded in the streaming software's process. Loading unnecessary JavaScript increases memory usage, CPU time, and the risk of rendering glitches on stream. The overlay is intentionally kept as a standalone module with no dependencies beyond React and the API config.

---

## 8. Legacy Overlay Compatibility

### 8.1 OBS Browser Source Paths

The original OBS overlays are preserved for backward compatibility:

| Path | Display Mode | Description |
|------|-------------|-------------|
| `/GrossGauntlet/overlays/explain` | `explain` | Explain mode with topic banner, webcam, and accumulated hours |
| `/GrossGauntlet/overlays/break` | `break` | Break screen with timer, "Will Be Back" message, and task list |
| `/GrossGauntlet/overlays/work` | `work` | Work mode with timeline, hero timer, session timer, and progress bar |
| `/GrossGauntlet/overlays/standby` | `standby` | Standby screen with customizable title and clock |

**Note:** These are rendered by `GrossGauntletApp.jsx` which uses direct DOM manipulation via `requestAnimationFrame` for the clock animation loop. This is separate from the React-based routing system.

### 8.2 Control Panel Paths

| Path | Description |
|------|-------------|
| `/GrossGauntlet/controls` | Full admin control panel |
| `/GrossGauntlet?controls` | Alternative access via query parameter |

The control panel (`GrossGauntletControl.jsx`) provides:
- **Mode switching:** Work, Break, Explain (with topic input), Standby (with dropdown selection)
- **OBS integration:** Scene switching, recording start/stop, WebSocket connection
- **YouTube markers:** Timestamp logging with manual mark and clear
- **Metrics:** Content/Sales count with +/- buttons
- **Timer controls:** Pause/Resume, Reset overlay clocks
- **Log viewer:** Floating log messages with auto-dismiss
- **Authentication:** Password gate with admin key and OBS password

---

## 9. Kanban Board Spec (Phase 1 & 2)

### 9.1 Phase 1: Live Board

**Current state:** Phase 1 routing and components are implemented. The `TasksEditor.jsx` component provides the basic task list view. Drag-and-drop integration (`@dnd-kit`) is **not yet wired** — the board renders statically.

**Pending Phase 1 work:**
1. Install `@dnd-kit` (`@dnd-kit/core`, `@dnd-kit/sortable`) — already in `package.json`
2. Create `KanbanBoard.jsx` — top-level component taking `{ dayId, editable, mode }` props
3. Create `KanbanColumn.jsx` × 4 — Up Next / In Progress / In Review / Done
4. Create `KanbanCard.jsx` — with `useSortable()` gated behind `editable` prop
5. Build `moveTask()` helper — pure function for array manipulation
6. Build `onDragEnd` handler → optimistic update → API write
7. Build `RunButton` + auth gate
8. Wire `/tasks/:day` route for historical board view

### 9.2 Phase 2: Event Replay

**Current state:** The `/tasks/:slug/replay` route renders a placeholder banner. The `task_events` table needs to be created in Supabase.

**Pending Phase 2 work:**
1. Create `task_events` table in Supabase
2. Add event-log insert to every write path (create/move/rename/delete)
3. Build the replay fold function (pure, testable in isolation)
4. Build `ReplayScrubber.jsx` — slider + play/pause + speed control
5. Wire `/tasks/:day/replay` route
6. (Optional) Backfill script for existing raw logs

### 9.3 Drag-and-Drop Flow

```
1. User picks up a card → @dnd-kit tracks locally, no network calls
2. User drops → onDragEnd fires with source, destination, index
3. moveTask() computes new arrays (remove from source, insert at destination)
4. Optimistic update → Zustand state updates immediately
5. Fire API write → PATCH the GrossGauntlet row
6. (Phase 2 only) → Insert task_event row
7. If API write fails → log error, surface non-blocking indicator
```

**Task object shape:**
```json
{
  "id": "task_abc123",
  "name": "Blade Scene Ratio",
  "status": "in_progress",
  "createdAt": 1234567890000,
  "completedAt": null,
  "due": null
}
```

---

## 10. Styling & Visual System

### CSS Files

| File | Purpose |
|------|---------|
| `src/components/GrossGauntlet/GrossGauntletApp.css` | Legacy OBS overlay styles (1136 lines) — positions, animations, break/standby screens |
| `src/components/GrossGauntlet/GrossGauntletPages.css` | New page/overlay styles — LogIndex, LogView, SessionView, TasksEditor, TasksOverlay |

### Design Tokens (CSS Custom Properties)

GrossGauntlet uses its own set of CSS custom properties (defined in `GrossGauntletApp.css` and `GrossGauntletPages.css`), which mirror the main app's tokens but with slightly different values optimized for the dark overlay theme:

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
--panel-bg: rgba(0, 0, 0, 0.62);
--font: "Space Grotesk", system-ui, -apple-system, sans-serif;
```

### Status Color Mapping

| Status | Dot Color | Hex |
|--------|-----------|-----|
| `in_progress` | Green | `#4DAA57` |
| `up_next` | Blue | `#2F6690` |
| `in_review` | Amber | `#FFBA08` |
| `done` | Red | `#F95738` |
| `waiting` | Purple | `#9113A4` |

### Overlay Transparency

`TasksOverlay.jsx` container maintains `background: transparent` to support chroma/alpha blending in streaming software. The overlay uses `pointer-events: none` on the root container, so it doesn't interfere with OBS interactions.

---

## 11. Deployment & Environment

### 11.1 Environment Variables

**Vercel Environment Variables (Serverless):**

| Variable | Description | Required By |
|----------|-------------|-------------|
| `SUPABASE_URL` | Supabase project URL | `state.js`, `metrics.js`, `tasks.js` |
| `SUPABASE_SERVICE_KEY` | Service role key (bypasses RLS) | `state.js`, `metrics.js`, `tasks.js` |
| `WEBHOOK_SECRET` | Shared secret for API auth | `metrics.js`, `webhook.js` |
| `STREAM_ADMIN_KEY` | Fallback webhook secret | `tasks.js`, `webhook.js` |
| `OVERLAY_WEBHOOK_SECRET` | Alternative webhook secret name | `tasks.js`, `metrics.js` |

**Vite Environment Variables (Client):**

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | API base URL for all GrossGauntlet endpoints | `'/api'` (relative) |

### 11.2 Vercel Configuration

**File:** `vercel.json`

```json
{
  "rewrites": [
    { "source": "/GrossGauntlet/controls", "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet/overlays/(.*)", "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet", "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet/(.*)", "destination": "/GrossGauntlet/index.html" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/images/(.*)",
      "headers": [ { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ]
    },
    {
      "source": "/manifest.json",
      "headers": [ { "key": "Cache-Control", "value": "public, max-age=86400" } ]
    }
  ]
}
```

**Rewrite rules explained:**
1. `/GrossGauntlet/controls` → standalone control panel HTML
2. `/GrossGauntlet/overlays/*` → standalone overlay HTML
3. `/GrossGauntlet` and `/GrossGauntlet/*` → standalone entry HTML
4. Everything else (except `/api/*`) → main app HTML (SPA fallback)
5. `/api/*` → Vercel serverless functions (not rewritten)

### 11.3 Build & Verification Checklist

- [ ] **Environment variables set** in Vercel project dashboard
- [ ] **API base URL** — verify `VITE_API_BASE_URL` is set correctly in production `.env` if non-standard proxy is used
- [ ] **No dnd-kit in overlay** — run `findstr /I "@dnd-kit" src\components\GrossGauntlet\TasksOverlay.jsx`
- [ ] **Vite multi-page build** — `npm run build` should produce both `/dist/index.html` and `/dist/GrossGauntlet/index.html`
- [ ] **Route integrity** — verify all routes render correctly:
  - `http://localhost:3000/grossgauntlet`
  - `http://localhost:3000/grossgauntlet/log1`
  - `http://localhost:3000/tasks`
  - `http://localhost:3000/overlay/tasks`
  - `http://localhost:3000/` (should still show quiz flow)
- [ ] **Legacy overlay paths** — verify `GrossGauntlet/index.html` loads:
  - `http://localhost:3000/GrossGauntlet/controls`
  - `http://localhost:3000/GrossGauntlet/overlays/work`
  - `http://localhost:3000/GrossGauntlet/overlays/break`
  - `http://localhost:3000/GrossGauntlet/overlays/explain`
  - `http://localhost:3000/GrossGauntlet/overlays/standby`

---

## 12. Development Guide

### 12.1 Running Locally

```bash
# Start dev server with hot-reload
npx vite --port 3000 --host

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server includes a `vercelRewritesPlugin` that mimics the production rewrite rules for the standalone GrossGauntlet entry point.

### 12.2 Adding a New Route

1. Create the component in `src/components/GrossGauntlet/`
2. Add the `<Route>` to `GrossGauntletRouter.jsx`
3. Update `GROSSGAUNTLET_ROUTES` array in `App.jsx` if the new route path should trigger the GrossGauntlet router
4. Update the standalone entry in `src/GrossGauntlet.jsx` if needed
5. Add page styles to `GrossGauntletPages.css`
6. Update this documentation

### 12.3 Adding a New API Endpoint

1. Create the serverless function in `api/stream/` (or appropriate directory)
2. Add the endpoint URL builder to `src/config/api.js`
3. Add the `// TODO: Replace with real endpoint` comment
4. Update the endpoint reference table in this documentation

### 12.4 Testing the Overlay

```bash
# 1. Start the dev server
npx vite --port 3000 --host

# 2. Open in OBS as a browser source:
#    URL: http://localhost:3000/overlay/tasks
#    Width: 320
#    Height: auto

# 3. Simulate stale data:
#    - Stop the dev server
#    - Observe the amber dot appearing after ~10 seconds

# 4. Simulate backoff recovery:
#    - Restart the dev server
#    - Observe data returning and the amber dot disappearing
```

---

## Appendix A: Key File Index

| File | Purpose | Lines |
|------|---------|-------|
| `src/main.jsx` | App bootstrap with BrowserRouter | ~22 |
| `src/App.jsx` | Route detector (GG vs Quiz) | ~80 |
| `src/GrossGauntlet.jsx` | Standalone entry point | ~90 |
| `src/config/api.js` | API endpoint abstraction | ~30 |
| `src/utils/slug.js` | Slug normalization | ~20 |
| `src/components/GrossGauntlet/GrossGauntletRouter.jsx` | Route definitions | ~40 |
| `src/components/GrossGauntlet/LogIndex.jsx` | Log index grid | ~110 |
| `src/components/GrossGauntlet/LogView.jsx` | Session selector | ~140 |
| `src/components/GrossGauntlet/SessionView.jsx` | Immutable session | ~140 |
| `src/components/GrossGauntlet/TasksEditor.jsx` | Stream-gated editor | ~150 |
| `src/components/GrossGauntlet/ReplayScrubber.jsx` | Phase 2 placeholder | ~30 |
| `src/components/GrossGauntlet/TasksOverlay.jsx` | OBS overlay | ~130 |
| `src/components/GrossGauntlet/GrossGauntletPages.css` | Page/overlay styles | ~350 |
| `src/components/GrossGauntlet/GrossGauntletApp.jsx` | Legacy overlay app | ~540 |
| `src/components/GrossGauntlet/GrossGauntletApp.css` | Legacy overlay styles | ~1136 |
| `src/components/GrossGauntlet/GrossGauntletControl.jsx` | Admin control panel | ~978 |
| `api/stream/state.js` | State polling endpoint | ~176 |
| `api/stream/metrics.js` | Metrics push endpoint | ~186 |
| `api/stream/tasks.js` | Task webhook endpoint | ~242 |
| `api/stream/webhook.js` | Legacy webhook endpoint | ~79 |
| `kanban-board-spec.md` | Full Kanban board specification | ~239 |

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Log** | A single stream session record in the `GrossGauntlet` table. Numbered sequentially (Log 1, Log 2, ...). |
| **Session** | A contiguous stream period within a log. A log can have multiple sessions if the stream had multiple segments. |
| **Slug** | A URL-safe identifier derived from the stream title's subtitle. Deterministic, capped at 40 chars. |
| **is_streaming** | Boolean flag indicating whether a stream is currently live. Only one row can have this flag at a time. |
| **grossgauntlet_unlocked** | `localStorage` key indicating the user has entered the admin password. |
| **Overlay** | An OBS browser source that displays read-only information on stream. |
| **Control Panel** | The admin dashboard (`GrossGauntletControl`) for managing stream state and OBS. |
| **Phase 1** | Live board with drag-and-drop, view/edit split, historical pages. |
| **Phase 2** | Event log with timeline replay/scrubber UI. |
| **Replay** | A timeline scrubber that replays task events in chronological order. |
| **Backoff** | An exponential delay strategy for retrying failed network requests. |

---

> **Document version:** 1.0  
> **Last updated:** 2026-08-12  
> **Maintainer:** GrossGauntlet subsystem  
> **Next review:** When Phase 1 drag-and-drop or Phase 2 replay is implemented
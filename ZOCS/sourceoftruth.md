# GrossGauntlet — Complete System Architecture & Operations Manual

> **Purpose:** This document is the single source of truth for the GrossGauntlet ecosystem. It covers frontend routing, backend API functions, the Supabase data model, the OBS overlay system, authentication, event logging, and deployment. Any developer starting a new chat about GrossGauntlet should begin here.

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
   - 4.1 `Sessions` Table Schema
   - 4.2 `Logs` Table Schema
   - 4.3 Field Mapping: API ↔ Database
   - 4.4 Session Lifecycle & `is_streaming` Flag
   - 4.5 Board State Derivation
5. [URL Structure & Day Number System](#5-url-structure--day-number-system)
   - 5.1 URL Pattern
   - 5.2 Day Number Resolution
   - 5.3 Navigation Logic
6. [Authentication & Authorization](#6-authentication--authorization)
   - 6.1 Admin Gate (`grossgauntlet_unlocked`)
   - 6.2 Unlock-Based Editing
   - 6.3 Historical Page Immutability
7. [OBS Overlay System](#7-obs-overlay-system)
   - 7.1 Overlay Architecture
   - 7.2 Polling & Backoff Strategy
   - 7.3 Stale Data Detection
   - 7.4 Bundle Isolation (no dnd-kit)
8. [Legacy Overlay Compatibility](#8-legacy-overlay-compatibility)
   - 8.1 OBS Browser Source Paths
   - 8.2 Control Panel Paths
9. [Kanban Board System](#9-kanban-board-system)
   - 9.1 Column Configuration
   - 9.2 Task Operations
   - 9.3 Drag-and-Drop Flow
10. [Event Replay System](#10-event-replay-system)
    - 10.1 Replay Function
    - 10.2 Inline Scrubber Implementation
    - 10.3 Mode-Aware Board State
11. [Styling & Visual System](#11-styling--visual-system)
12. [Deployment & Environment](#12-deployment--environment)
    - 12.1 Environment Variables
    - 12.2 Vercel Configuration
    - 12.3 Build & Verification Checklist
13. [Development Guide](#13-development-guide)
    - 13.1 Running Locally
    - 13.2 Adding a New Route
    - 13.3 Adding a New API Endpoint
    - 13.4 Testing the Overlay

---

## 1. System Overview

GrossGauntlet is a **stream-integrated task management, logging, and OBS overlay subsystem** embedded within the web application. It provides:

- **Public log/session archives** — organized by challenge day number with session-specific details, each an immutable historical record.
- **Streaming-gated task editor** — a live Kanban board that's only editable when the admin password is unlocked (editing is NOT gated by `is_streaming`).
- **OBS overlays** — lightweight, zero-overhead browser sources for streaming software, with resilient polling and stale-data detection.
- **Control panel** — an admin dashboard for managing stream state, OBS scenes, YouTube markers, and metrics.
- **Event replay system** — an append-only event log that enables timeline-based scrubber playback of any session.

**Key architectural decisions:**

- **Row unit = stream session**, not calendar day. Multiple streams on the same date produce separate rows with distinct URLs using `(date, session_number)` composite primary key. This cleanly handles midnight-crossing sessions (e.g., 23:44 → 08:00).
- **Event-driven state management** — board state is maintained in `Logs` table as append-only events, not as task arrays in the session row.
- **`is_streaming` flag** is the canonical "is there a live session?" indicator, checked on every state poll. It does NOT gate editing.
- **Historical pages are permanently read-only** — they ignore the unlock flag entirely, even for authenticated users.
- **All API calls funnel through `src/config/api.js`** — no hardcoded fetch URLs in UI components.
- **The OBS overlay is a separate component** that explicitly excludes `@dnd-kit` to minimize memory footprint in the browser source.
- **URL structure uses day numbers** — derived from challenge start date (Aug 15, 2026), not calendar dates.

---

## 2. Frontend Architecture

### 2.1 Route Hierarchy & Component Map

| Path | Component | File | Access | Description |
|------|-----------|------|--------|-------------|
| `/grossgauntlet` | `GrossGauntletHome` | `GrossGauntletHome.jsx` | Public | Master grid of all challenge days, numbered sequentially (Day 1, Day 2, ...). |
| `/grossgauntlet/now` | `GrossGauntletNow` | `GrossGauntletNow.jsx` | Gated | Live task editor. Requires `grossgauntlet_unlocked === 'true'`. Falls back to read-only showing latest session. |
| `/grossgauntlet/:dayNumber` | `GrossGauntletDay` | `GrossGauntletDay.jsx` | Public | Day view. Single session → redirects to session view. Multi-session → shows session selector. |
| `/grossgauntlet/:dayNumber/:sessionNumber` | `GrossGauntletSession` | `GrossGauntletSession.jsx` | Public (Read-Only) | Immutable archive view with inline replay scrubber. Strictly ignores auth/unlock state. |
| `/GrossGauntlet/controls` | `GrossGauntletControl` | `GrossGauntletControl.jsx` | Gated | Admin control panel for OBS integration. |
| `/GrossGauntlet/overlays/*` | `GrossGauntletApp` | `GrossGauntletApp.jsx` | Public (OBS) | Legacy OBS overlays (explain, break, work, standby). |

### 2.2 App Shell Integration (Multi-Entry)

The application has **two entry points** that share components:

**Entry 1: `src/main.jsx` (main website)**
- Wraps `<App />` in `<BrowserRouter>`.
- `App.jsx` detects the current route via `useLocation()`.
- If the path starts with `/grossgauntlet` → renders `<GrossGauntletRouter />`.
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

| State | `/grossgauntlet/now` Behavior | Historical Pages | Overlay |
|-------|---------------------------|------------------|---------|
| No unlock | Read-only (shows latest session) | Read-only | Read-only |
| Unlocked | **Fully editable** | Read-only | Read-only |

**Note:** `is_streaming` flag does NOT gate editing. It is purely a display indicator. Only the `grossgauntlet_unlocked` localStorage flag controls edit access.

### 2.4 Component Tree

```
<BrowserRouter>                          // in main.jsx or GrossGauntlet.jsx
  └─ <App />                             // route detection in App.jsx
       ├─ <GrossGauntletRouter />         // if GG route detected
       │    ├─ <GrossGauntletHome />       // /grossgauntlet
       │    ├─ <GrossGauntletNow />         // /grossgauntlet/now
       │    ├─ <GrossGauntletDay />        // /grossgauntlet/:dayNumber
       │    └─ <GrossGauntletSession />     // /grossgauntlet/:dayNumber/:sessionNumber
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
| `/api/stream/state` | GET | None | Fetch current stream state, metrics, and folded board | `api/stream/state.js` |
| `/api/stream/metrics` | POST | Bearer token | Push stream metrics (mode, timers, counts) | `api/stream/metrics.js` |
| `/api/stream/tasks` | POST/DELETE | Multi-method | Event-based task operations (create/move/rename/delete) | `api/stream/tasks.js` |
| `/api/grossgauntlet/days` | GET | None | Archive data (multiple query patterns) | `api/grossgauntlet/days.js` |
| `/api/grossgauntlet/notes` | POST | Bearer token | Notes autosave endpoint | `api/grossgauntlet/notes.js` |

### 3.2 API Abstraction Layer (`src/config/api.js`)

**File:** `src/config/api.js`

**Rule:** Every HTTP fetch in any GrossGauntlet component **must** use `API.*` from this file. Hardcoded URL strings in JSX/component files are forbidden.

```javascript
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const API = {
  // Stream state (polling)
  getStreamState:  ()                      => `${BASE}/stream/state`,
  postMetrics:     ()                      => `${BASE}/stream/metrics`,
  postTask:        ()                      => `${BASE}/stream/tasks`,

  // Archive — query-param based, all through /days
  getAllDays:      ()                      => `${BASE}/grossgauntlet/days`,
  getDay:          (dayNumber)             => `${BASE}/grossgauntlet/days?dayNumber=${encodeURIComponent(Number(dayNumber))}`,
  getSession:      (dayNumber, sessionNumber) => `${BASE}/grossgauntlet/days?dayNumber=${encodeURIComponent(Number(dayNumber))}&sessionNumber=${encodeURIComponent(Number(sessionNumber))}`,
  getEvents:       (dayNumber, sessionNumber) => `${BASE}/grossgauntlet/days?dayNumber=${encodeURIComponent(Number(dayNumber))}&sessionNumber=${encodeURIComponent(Number(sessionNumber))}&events=true`,

  // Notes autosave
  postNotes:       ()                      => `${BASE}/grossgauntlet/notes`,
};
```

**Base URL:** All endpoints use relative `/api/` paths for same-origin requests under the main domain (e.g., `tiesin.me/api/...`). Override via `VITE_API_BASE_URL` env variable for local dev or proxied setups.

**Backend route structure:**
- `/api/grossgauntlet/days` — public archive with multiple query patterns
- `/api/stream/state|metrics|tasks` — live stream & task controls

**No placeholder URLs** — the config uses clean relative paths with no hardcoded domain names. The single `VITE_API_BASE_URL` env variable is optional and only needed for non-standard local dev setups.

### 3.3 Serverless Function Details

#### `api/stream/state.js` — State Polling Endpoint

The most frequently called endpoint (every 1500ms in overlays, every 5000ms in TasksEditor).

**What it does:**
1. Queries Supabase `Sessions` table for a row where `is_streaming = true`.
2. If no active stream, falls back to most recent row (`ORDER BY date DESC, session_number DESC LIMIT 1`).
3. Calculates `previousDaysSeconds` from all past rows (uses maximum `today_seconds` per date).
4. If the current mode is `work` AND streaming, calculates `activeOffset` from `session_start_timestamp` or `mode_timestamp`.
5. Queries `Logs` table for all events belonging to the session.
6. Folds events into board state using event replay logic.
7. Returns combined board + metrics response.

**Response shape:**
```json
{
  "success": true,
  "timestamp": 1234567890000,
  "board": {
    "todo": [],
    "up_next": [],
    "in_progress": [],
    "in_review": [],
    "done": []
  },
  "metrics": {
    "mode": "work",
    "isStreaming": true,
    "isPaused": false,
    "todayWorkSeconds": 3600,
    "accumulatedTodaySeconds": 3600,
    "previousDaysSeconds": 7200,
    "modeTimestamp": 1234567890000,
    "sessionStartTimestamp": 1234567890000,
    "contentCount": 5,
    "salesCount": 3,
    "sessionNumber": 1,
    "date": "2026-08-16",
    "title": "Day 1 — First Session",
    "standbySelection": "Beach",
    "timestamps": "STREAM 1\n...",
    "totalDays": 42,
    "pausedTimestamp": null,
    "streamNumber": 1
  },
  "tasks": [],
  "webhookLogs": []
}
```

#### `api/stream/metrics.js` — Metrics Push Endpoint

**Auth:** Requires `Authorization: Bearer ${WEBHOOK_SECRET}` header.

**What it does:**
1. Validates incoming payload (mode validity, isStreaming boolean, isPaused boolean, non-negative accumulated time).
2. Determines active date (uses active stream's date if exists, otherwise today).
3. Upserts the `Sessions` row with field-by-field mapping.
4. Special handling for active streams: updates the existing record without changing its `date` field (preserves midnight-crossing continuity).
5. When `isStreaming: true` arrives with no active session, creates new row with auto-incremented `session_number`.

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
| `title` | `title` | Session title |
| `streamUrl` | `stream_url` | YouTube VOD link |
| `notes` | `notes` | Session notes |
| `isPaused` | `is_paused` | Boolean |
| `pausedTimestamp` | `paused_timestamp` | |

#### `api/stream/tasks.js` — Task Webhook Endpoint

**Auth:** Multi-method — checks `Authorization`, `x-api-key`, body `secret`, or query `secret` against `WEBHOOK_SECRET`.

**What it does:**
1. Finds active session (streaming) or falls back to most recent session.
2. Inserts event row into `Logs` table based on action type.
3. Refolds all events for the session to return updated board state.
4. Supports `action: 'sync'` for full array replacement (deletes all logs first, then rebuilds).
5. Supports individual actions: create, move, rename, delete.

**Event insertion patterns:**
```javascript
// create:
{
  session_date: session.date,
  session_number: session.session_number,
  task_id: body.taskId,
  event_type: 'create',
  to_column: body.toColumn,
  payload: { name: body.name },
  occurred_at: new Date().toISOString()
}

// move:
{
  session_date: session.date,
  session_number: session.session_number,
  task_id: body.taskId,
  event_type: 'move',
  from_column: body.fromColumn,
  to_column: body.toColumn,
  payload: {},
  occurred_at: new Date().toISOString()
}

// rename:
{
  session_date: session.date,
  session_number: session.session_number,
  task_id: body.taskId,
  event_type: 'rename',
  payload: { old: body.oldName, new: body.newName },
  occurred_at: new Date().toISOString()
}

// delete:
{
  session_date: session.date,
  session_number: session.session_number,
  task_id: body.taskId,
  event_type: 'delete',
  from_column: body.fromColumn,
  payload: { name: body.name },
  occurred_at: new Date().toISOString()
}
```

**Status mapping table:**
| Source Status | Mapped Status |
|--------------|---------------|
| `new`, `waiting`, `todo` | `todo` |
| `ongoing`, `in_progress`, `contacted`, `qualified` | `in_progress` |
| `in_review`, `review` | `in_review` |
| `up_next`, `upnext`, `next`, `up next` | `up_next` |
| `won`, `lost`, `converted`, `unqualified`, `done`, `completed` | `done` |

#### `api/grossgauntlet/days.js` — Multi-Pattern Archive Endpoint

**Query patterns:**

**Pattern 1: All days (homepage)**
- No query params
- Returns all sessions grouped by date, ordered by date DESC
- Includes `dayNumber` (derived from challenge start date)
- Includes `taskCounts` derived from Logs

**Pattern 2: Single day with sessions**
- Query param: `dayNumber`
- Resolves dayNumber to date using `dayNumberToDate()`
- Returns all sessions for that day ordered by session_number ASC

**Pattern 3: Single session with board**
- Query params: `dayNumber` + `sessionNumber`
- Returns session row + folded board from Logs
- Used by session view

**Pattern 4: Events for replay**
- Query params: `dayNumber` + `sessionNumber` + `events=true`
- Returns all Logs rows for that session ordered by occurred_at ASC
- Used by inline replay scrubber

**Day number resolution:**
```javascript
function dayNumberToDate(dn) {
  const startDate = new Date('2026-08-15');
  const targetDate = new Date(startDate);
  targetDate.setDate(targetDate.getDate() + (Number(dn) - 1));
  return targetDate.toISOString().split('T')[0];
}
```

#### `api/grossgauntlet/notes.js` — Notes Autosave Endpoint

**Auth:** Requires `Authorization: Bearer ${WEBHOOK_SECRET}` header.

**What it does:**
- Accepts body: `{ dayNumber, sessionNumber, notes }`
- Resolves dayNumber to date
- Updates `Sessions.notes` field
- Returns `{ success: true }`

---

## 4. Data Model (Supabase)

### 4.1 `Sessions` Table Schema

**Purpose:** One row per stream session with composite primary key `(date, session_number)`.

```sql
Sessions
------------------------------------------------
date                  date              NOT NULL, PK part 1
session_number        integer           NOT NULL DEFAULT 1, PK part 2
title                 text
mode                  text              DEFAULT 'work'
is_streaming          boolean           DEFAULT false
is_paused             boolean           DEFAULT false
today_seconds         integer           DEFAULT 0
mode_timestamp        bigint
session_start_timestamp bigint
paused_timestamp      timestamptz
standby_selection      text              DEFAULT 'Coming Soon'
timestamps            text              DEFAULT ''
content_count         integer           DEFAULT 0
sales_count           integer           DEFAULT 0
stream_url            text
notes                 text
updated_at            timestamptz       DEFAULT now()
```

**Column Details:**

| Column | Type | Role |
|--------|------|------|
| `date` | date | PK component. Calendar date of the session. |
| `session_number` | integer | PK component. Session sequence within date (1, 2, 3...). |
| `title` | text | Session title from OBS stream title or manual entry. |
| `mode` | text | Current OBS mode: `work`, `break`, `standby`, `explain`, `explain\|<topic>`. |
| `is_streaming` | boolean | Live stream indicator. Display flag only — does NOT gate editing. |
| `is_paused` | boolean | Work timer pause state. |
| `today_seconds` | integer | Accumulated work seconds for this session only. |
| `mode_timestamp` | bigint | Unix ms timestamp of last mode change. |
| `session_start_timestamp` | bigint | Unix ms timestamp of stream start. Preserved across midnight-crossing. |
| `paused_timestamp` | timestamptz | ISO timestamp when timer was paused. |
| `standby_selection` | text | Title displayed on standby OBS overlay screen. |
| `timestamps` | text | YouTube marker log. Format: "HH:MM - mode - description". |
| `content_count` | integer | Content/contacted metric. |
| `sales_count` | integer | Sales/converted metric. |
| `stream_url` | text | YouTube VOD link for this session. |
| `notes` | text | Free-form session notes. Autosaved from frontend. |
| `updated_at` | timestamptz | Last write timestamp. |

### 4.2 `Logs` Table Schema

**Purpose:** Append-only event log for all board actions. Canonical source of truth for task state.

```sql
Logs
------------------------------------------------
id                    bigint            PK, auto-incrementing
session_date          date              FK → Sessions(date)
session_number        integer           FK → Sessions(session_number)
task_id               text              NOT NULL, stable UUID
event_type            text              NOT NULL
from_column           text
to_column             text
payload               jsonb
occurred_at           timestamptz      DEFAULT now()
```

**Column Details:**

| Column | Type | Role |
|--------|------|------|
| `id` | bigint | PK. Auto-incrementing. |
| `session_date` | date | FK component to Sessions.date. Groups events by session. |
| `session_number` | integer | FK component to Sessions.session_number. Completes foreign key. |
| `task_id` | text | Stable UUID for task. Generated client-side via `crypto.randomUUID()`. |
| `event_type` | text | Event classification: `create`, `move`, `rename`, `delete`. |
| `from_column` | text | Source column for move events. Null on create. |
| `to_column` | text | Destination column. Null on delete. |
| `payload` | jsonb | Event-specific data. |
| `occurred_at` | timestamptz | Wall clock time of event. |

**Valid column values** (for `from_column` and `to_column`):
```
todo, up_next, in_progress, in_review, done
```

**Payload structures by event_type:**
```json
// create
{ "name": "Task Name" }

// move
{ }

// rename
{ "old": "Old Name", "new": "New Name" }

// delete
{ "name": "Deleted Task Name" }
```

### 4.3 Field Mapping: API ↔ Database

| JavaScript (frontend) | JavaScript (API) | SQL Column |
|----------------------|------------------|------------|
| `isStreaming` | `isStreaming` | `is_streaming` |
| `isPaused` | `isPaused` | `is_paused` |
| `accumulatedTodaySeconds` | `accumulatedTodaySeconds` | `today_seconds` |
| `modeTimestamp` | `modeTimestamp` | `mode_timestamp` |
| `sessionStartTimestamp` | `sessionStartTimestamp` | `session_start_timestamp` |
| `contentCount` | `contentCount` | `content_count` |
| `salesCount` | `salesCount` | `sales_count` |
| `standbySelection` | `standbySelection` | `standby_selection` |
| `streamNumber` | `streamNumber` | `session_number` |
| `title` | `title` | `title` |
| `streamUrl` | `streamUrl` | `stream_url` |
| `notes` | `notes` | `notes` |

### 4.4 Session Lifecycle & `is_streaming` Flag

```
STREAM START (OBS event):
  → Create new row with is_streaming = true
  → Set session_number = (max session_number for today) + 1
  → Set mode = 'standby'
  → Initialize timestamps with "STREAM {N}"

MODE CHANGE (user action):
  → Update mode, today_seconds, mode_timestamp
  → Add YouTube marker

STREAM STOP (OBS event):
  → Capture elapsed work time into today_seconds
  → Set is_streaming = false
  → Add separator line to timestamps
  → The row is now a permanent historical record

BETWEEN SESSIONS:
  → /grossgauntlet/now shows the most recent row (highest session_number) in read-only mode
  → "Run" button creates the next row (when unlocked)

NEW STREAM START:
  → Always creates a new row, never reuses a prior row
  → Increments session_number
```

### 4.5 Board State Derivation

**Current State (API Layer):**
```javascript
function deriveCurrentBoard(logs) {
  const board = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };
  
  for (const event of logs) {
    switch (event.event_type) {
      case 'create':
        board[event.to_column].push({
          id: event.task_id,
          name: event.payload.name,
          status: event.to_column,
          createdAt: event.occurred_at
        });
        break;
      case 'move':
        const task = removeFromBoard(board, event.task_id);
        if (task) {
          task.status = event.to_column;
          board[event.to_column].push(task);
        }
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

**Replay State (Phase 2):**
```javascript
function replayToTime(logs, targetTime) {
  const board = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };
  const relevant = logs.filter(e => new Date(e.occurred_at) <= targetTime);
  
  for (const event of relevant) {
    // Same folding logic as above
  }
  return board;
}
```

---

## 5. URL Structure & Day Number System

### 5.1 URL Pattern

**Current URL structure:**
```
/grossgauntlet                    → Homepage (day grid)
/grossgauntlet/now                → Live board editor
/grossgauntlet/:dayNumber         → Day view (single/multi session)
/grossgauntlet/:dayNumber/:sessionNumber → Session view with inline replay
```

**Examples:**
- `/grossgauntlet/1/1` → Day 1, Session 1
- `/grossgauntlet/7/2` → Day 7, Session 2
- `/grossgauntlet/now` → Current live board

### 5.2 Day Number Resolution

**Challenge start date:** August 15, 2026

**Day number calculation:**
```javascript
dayNumber = (new Date(date) - new Date('2026-08-15')) / 86400000 + 1
```

**Day number to date conversion:**
```javascript
function dayNumberToDate(dn) {
  const startDate = new Date('2026-08-15');
  const targetDate = new Date(startDate);
  targetDate.setDate(targetDate.getDate() + (Number(dn) - 1));
  return targetDate.toISOString().split('T')[0];
}
```

**Examples:**
- Day 1 = August 15, 2026
- Day 2 = August 16, 2026
- Day 7 = August 21, 2026

### 5.3 Navigation Logic

**Homepage cards:**
```javascript
// If single session for the day
navigate(`/grossgauntlet/${dayNumber}/1`);

// If multiple sessions for the day
navigate(`/grossgauntlet/${dayNumber}`);
```

**Session view back button:**
```javascript
// If multiple sessions for the day
backPath = `/grossgauntlet/${dayNumber}`;

// If single session for the day
backPath = '/grossgauntlet';
```

---

## 6. Authentication & Authorization

### 6.1 Admin Gate (`grossgauntlet_unlocked`)

**Implementation:**
```javascript
// localStorage key
const STORAGE_KEYS = {
  GROSSGAUNTLET_UNLOCKED: 'grossgauntlet_unlocked',
  STREAM_ADMIN_KEY: 'stream_admin_key'
};

// Check function
export function getIsUnlocked() {
  return localStorage.getItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED) === 'true';
}
```

**Usage:**
- Used in `GrossGauntletNow.jsx` to determine editability
- Set via `RunButton.jsx` component
- Stored client-side only, not in database

### 6.2 Unlock-Based Editing

**Current model:**
```javascript
const isEditable = isUnlocked;  // Only unlock state matters
```

**Edit condition:**
- `isStreaming` flag does NOT gate editing
- Only `grossgauntlet_unlocked` localStorage flag controls edit access
- Historical pages are permanently read-only regardless of unlock state

### 6.3 Historical Page Immutability

**Rule:** Historical pages (`/grossgauntlet/:dayNumber/:sessionNumber`) are permanently read-only.

**Implementation:**
```jsx
// GrossGauntletSession.jsx
<KanbanBoard initialBoard={board} editable={false} />
```

**Rationale:**
- Historical records should never be modified
- Prevents accidental changes to past sessions
- Archive integrity is maintained

---

## 7. OBS Overlay System

### 7.1 Overlay Architecture

**Multi-entry Vite configuration:**
```javascript
input: {
  main: resolve(__dirname, 'index.html'),
  GrossGauntlet: resolve(__dirname, 'GrossGauntlet/index.html'),
}
```

**Entry point routing:**
- Main site: Uses `src/main.jsx` → `App.jsx` → `GrossGauntletRouter`
- OBS overlays: Uses `src/GrossGauntlet.jsx` → `GrossGauntletApp` with displayMode

### 7.2 Polling & Backoff Strategy

**Current implementation:**
- Base polling interval: 1500ms for overlays
- Backoff on errors with exponential increase
- Stale data detection after N consecutive failures
- Reconnection logic when connection restored

### 7.3 Stale Data Detection

**Implementation:**
- Tracks consecutive fetch failures
- Shows warning indicator when data is stale
- Attempts reconnection with backoff
- Graceful degradation when offline

### 7.4 Bundle Isolation (no dnd-kit)

**Rule:** OBS overlay components explicitly exclude `@dnd-kit` imports.

**Rationale:**
- Minimize memory footprint in OBS browser sources
- Reduce bundle size for overlay performance
- Overlays are read-only, don't need drag-and-drop

---

## 8. Legacy Overlay Compatibility

### 8.1 OBS Browser Source Paths

**Legacy overlay paths:**
- `/GrossGauntlet/overlays/explain` → Explanation screen
- `/GrossGauntlet/overlays/break` → Break screen with timer
- `/GrossGauntlet/overlays/work` → Work screen with task board
- `/GrossGauntlet/overlays/standby` → Standby screen with selection

### 8.2 Control Panel Paths

**Control panel paths:**
- `/GrossGauntlet/controls` → Main control panel
- `?controls` query parameter → Control panel mode

---

## 9. Kanban Board System

### 9.1 Column Configuration

**Five columns:**
```javascript
export const COLUMNS = ['todo', 'up_next', 'in_progress', 'in_review', 'done'];

export const COLUMN_LABELS = {
  todo: 'To-Do',
  up_next: 'Up Next',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};
```

### 9.2 Task Operations

**Core functions in `moveTask.js`:**
- `moveTask(board, taskId, fromCol, toCol, toIndex)` - Move task between columns
- `addTask(board, colKey, task)` - Add new task to column
- `deleteTask(board, taskId)` - Remove task from board
- `renameTask(board, taskId, newName)` - Rename task
- `buildBoard({ todo, up_next, in_progress, in_review, done })` - Create board from arrays
- `generateTaskId()` - Generate stable UUID for tasks

### 9.3 Drag-and-Drop Flow

**Library:** `@dnd-kit/core` and `@dnd-kit/sortable`

**Flow:**
1. User drags card → `onDragEnd` fires
2. Component calls `handleBoardChange` with new board state and action object
3. API call to `/api/stream/tasks` with event details
4. API inserts event into `Logs` table
5. API returns refolded board state
6. Component updates local state with new board

---

## 10. Event Replay System

### 10.1 Replay Function

**Location:** `src/components/GrossGauntlet/kanban/moveTask.js`

**Implementation:**
```javascript
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
```

### 10.2 Inline Scrubber Implementation

**Location:** `GrossGauntletSession.jsx`

**Features:**
- Full-width timeline scrubber
- Play/pause controls
- Speed controls (1x, 2x, 5x, 10x)
- Time display (current position / total duration)
- Defaults to 100% (final state) on load
- Board re-renders on scrub

**State management:**
```javascript
const [sliderValue, setSliderValue] = useState(100);      // 0-100 range
const [isPlaying, setIsPlaying] = useState(false);
const [speed, setSpeed] = useState(1);
const SPEEDS = [1, 2, 5, 10];
```

**Time calculation:**
```javascript
const startTime = events[0] ? new Date(events[0].occurred_at).getTime() : 0;
const endTime = events.at(-1) ? new Date(events.at(-1).occurred_at).getTime() : 0;
const totalMs = endTime - startTime || 1;
const currentMs = startTime + (sliderValue / 100) * totalMs;
const currentTime = new Date(currentMs);
const board = events.length ? replayToTime(events, currentTime) : EMPTY_BOARD;
```

### 10.3 Mode-Aware Board State

**Mode detection:**
```javascript
function getModeAtTime(timestamps, sessionStartTs, currentTime) {
  if (!timestamps || !sessionStartTs) return 'work';
  const sessionStart = new Date(sessionStartTs);
  let currentMode = 'work';
  for (const line of timestamps.split('\n').filter(Boolean)) {
    const match = line.match(/^(\d+):(\d+)(?::(\d+))?\s*-\s*(\w+)/);
    if (!match) continue;
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
    const lineTime = new Date(sessionStart.getTime() + seconds * 1000);
    if (lineTime <= currentTime) currentMode = match[4].toLowerCase();
    else break;
  }
  return currentMode;
}
```

**Visual feedback:**
```jsx
const modeAtTime = getModeAtTime(session?.timestamps, session?.session_start_timestamp, currentTime);
const isInactive = ['break', 'standby', 'explain'].includes(modeAtTime);

// Board grays out during inactive modes
<div className={`${styles.boardWrap} ${isInactive ? styles.boardInactive : ''}`}>
  <KanbanBoard initialBoard={board} editable={false} />
</div>

// Mode indicator shows current state
{isInactive && (
  <div className={styles.modeIndicator}>
    {modeAtTime === 'break' ? 'Break' : modeAtTime === 'standby' ? 'Standby' : 'Explain'}
  </div>
)}
```

---

## 11. Styling & Visual System

### Design System Foundation

**Typography scale (from `global.css`):**
```css
--font: 'Space Grotesk', system-ui, -apple-system, sans-serif;
--white-92:  rgba(255, 255, 255, 0.92);
--white-70:  rgba(255, 255, 255, 0.70);
--white-45:  rgba(255, 255, 255, 0.45);
--white-25:  rgba(255, 255, 255, 0.25);
--white-12:  rgba(255, 255, 255, 0.12);
```

**Spacing scale (from `global.css`):**
```css
--space-8, --space-12, --space-16, --space-20, --space-24,
--space-28, --space-36, --space-40, --space-48, --space-60, --space-72
```

### Glass Card Pattern

**Reference implementation (from `Welcome.module.css`):**
```css
.card {
  background: rgba(10, 10, 10, 0.62);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
```

**Application status:**
- ✅ Applied in `GrossGauntletSession.module.css`
- ⚠️ Not applied in `GrossGauntletPages.css`
- ⚠️ Not applied in Kanban components
- ❌ Not applied in SessionCard (CSS missing)

### Button Pattern

**Reference implementation (from `Welcome.module.css`):**
```css
font-family: var(--font);
font-size: 0.875rem;
letter-spacing: 0.08em;
text-transform: uppercase;
color: var(--white-92);
background: transparent;
border: 1px solid rgba(255,255,255,0.25);
border-radius: 0;
padding: 14px 36px;
```

**Application status:**
- ⚠️ Inconsistently applied across components
- ❌ RunButton uses different styling
- ❌ Watch buttons lack proper styling

### Shared Components

**TagPill component:**
- Location: `src/components/shared/TagPill.jsx`
- Status: ✅ Complete and functional
- Usage: ⚠️ Not used in Home/Day pages (uses inline divs instead)

---

## 12. Deployment & Environment

### 12.1 Environment Variables

**Required variables:**
```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Authentication
OVERLAY_WEBHOOK_SECRET=your_webhook_secret
WEBHOOK_SECRET=your_webhook_secret
STREAM_ADMIN_KEY=your_admin_key

# Optional
VITE_API_BASE_URL=/api  # Only for non-standard setups
```

### 12.2 Vercel Configuration

**Current `vercel.json`:**
```json
{
  "rewrites": [
    { "source": "/GrossGauntlet", "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet/", "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet/controls", "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet/overlays/(.*)", "destination": "/GrossGauntlet/index.html" },
    { "source": "/GrossGauntlet/(.*)", "destination": "/GrossGauntlet/index.html" },
    { "source": "/grossgauntlet/(.*)", "destination": "/index.html" },
    { "source": "/grossgauntlet", "destination": "/index.html" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

### 12.3 Build & Verification Checklist

**Build verification:**
```bash
npm run build  # ✅ Currently passing
npm run dev    # ✅ Development server functional
```

**Manual testing checklist:**
- [ ] `/grossgauntlet` loads with day grid
- [ ] `/grossgauntlet/now` loads in read-only mode
- [ ] Run button appears, password prompt works
- [ ] Board becomes editable with correct password
- [ ] Task creation/move/delete works
- [ ] Inline replay scrubber functions
- [ ] OBS overlays load correctly
- [ ] Control panel functions

---

## 13. Development Guide

### 13.1 Running Locally

**Development server:**
```bash
npm run dev
```

**Multi-page development:**
- Main site: `http://localhost:5173/`
- OBS page: `http://localhost:5173/GrossGauntlet/`

### 13.2 Adding a New Route

**Steps:**
1. Add route to `GrossGauntletRouter.jsx`
2. Create component file in `src/components/GrossGauntlet/`
3. Add route detection logic to `App.jsx` if needed
4. Add corresponding API endpoint if data fetching required
5. Update Vercel rewrites if path doesn't match existing patterns

### 13.3 Adding a New API Endpoint

**Steps:**
1. Create file in `api/` directory
2. Export default async function handler
3. Add CORS headers for GET requests
4. Add authentication if required (Bearer token or multi-method)
5. Add endpoint to `src/config/api.js`
6. Test endpoint locally before deployment

### 13.4 Testing the Overlay

**Testing OBS browser source:**
1. Start development server
2. Navigate to overlay URL (e.g., `http://localhost:5173/GrossGauntlet/overlays/work`)
3. Verify content loads correctly
4. Test polling mechanism (check network tab)
5. Verify @dnd-kit is not imported (check bundle size)

**Testing control panel:**
1. Navigate to `/GrossGauntlet/controls`
2. Verify WebSocket connection to OBS
3. Test stream start/stop controls
4. Verify mode switching works
5. Test metrics updates

---

## Implementation Status Summary

**Overall Completion:** 75% Complete

- **Backend API Layer:** 95% Complete (core functionality done, minor cleanup needed)
- **Database Schema:** 100% Complete (Sessions/Logs structure fully implemented)
- **Frontend Components:** 70% Complete (functional but needs design system application)
- **Design System Application:** 20% Complete (foundation exists, not consistently applied)
- **OBS Integration:** 100% Complete (legacy system functional and stable)
- **Event Replay System:** 80% Complete (exceeds original specifications)

**Critical Path Forward:**
1. Apply glass card pattern to all GrossGauntlet components
2. Integrate SessionCard component with proper CSS
3. Add GSAP entrance animations to all pages
4. Complete CSS organization and visual polish
5. Final verification and testing

---

**Document Version:** 2.0  
**Last Updated:** 2026-08-20  
**Status:** Current Source of Truth
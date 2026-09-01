# GrossGauntlet /now Page — Context & Architecture

## Overview

The `/now` page (`GrossGauntletNow.jsx`) is the live control surface for the
GrossGauntlet Kanban system. It provides real-time task editing, mode switching,
metrics display, and OBS scene control. This document covers every change made
to the /now page and its supporting backend.

---

## Files Touched

| File | Role |
|---|---|
| `src/components/GrossGauntlet/GrossGauntletNow.jsx` | Frontend — the /now page itself |
| `src/config/api.js` | API endpoint definitions |
| `api/stream/state.js` | Polling endpoint — serves board + metrics |
| `api/stream/metrics.js` | Write endpoint — persists metrics, detects mode changes, records SessionLogs |
| `api/stream/tasks.js` | Write endpoint — persists task actions, nulls session fields when offline |
| `api/stream/mode.js` | **New** — dedicated mode-change endpoint, records SessionLogs |
| `api/stream/webhook.js` | Unchanged — Kanban webhook from external sources |
| `api/grossgauntlet/note.js` | NoteLogs endpoint — session resolution fallback, null session fields offline |
| `api/grossgauntlet/sessionlogs.js` | **New** — public GET endpoint for SessionLogs |
| `api/grossgauntlet/days.js` | Renamed `Logs` → `TaskLogs` table references |
| `src/components/GrossGauntlet/GrossGauntletSession.jsx` | Replay scrubber — added sessionLogs mode dots |
| `src/components/GrossGauntlet/GrossGauntletSession.module.css` | Scrubber dot styles |

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser (/now page)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Poll (every 2s) → GET /api/stream/state            │    │
│  │  Returns: { board, metrics, tasks }                  │    │
│  │  Guarded by writeCooldownRef (1s after any write)    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Task change → POST /api/stream/tasks                │    │
│  │  Board change → POST /api/stream/tasks               │    │
│  │  Mode change → POST /api/stream/metrics              │    │
│  │              + fire-and-forget POST /api/stream/mode  │    │
│  │  Stat change → POST /api/stream/metrics              │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Tables

| Table | Purpose | Offline session fields |
|---|---|---|
| `Sessions` | One row per stream session. Stores metrics, mode, timestamps. | N/A |
| `TaskLogs` | Event log for Kanban task operations (create, move, rename, delete). | `session_date` + `session_number` = `null` when written offline |
| `SessionLogs` | Mode change log. Each row records a switch between work/break/standby/explain. | `session_date` + `session_number` = `null` when written offline |
| `NoteLogs` | Bloc-based notes system. Upsert on `bloc_id`. | `session_date` + `session_number` = `null` when written offline; existing blocs preserve their session fields |

---

## Session Resolution Patterns

Every endpoint that needs to write to a session follows one of three patterns:

### Pattern A: Active stream → Absolute latest (tasks.js, state.js, mode.js)
```
1. Query Sessions WHERE is_streaming = true
2. If null, query Sessions ORDER BY date DESC, session_number DESC LIMIT 1
3. If still null, return 404
```

### Pattern B: Active stream → Absolute latest → explicit params (note.js POST)
```
1. Query Sessions WHERE is_streaming = true
2. If null, query Sessions ORDER BY date DESC, session_number DESC LIMIT 1
3. If still null, use dayNumber/sessionNumber from request body
4. If nothing resolves, return 400
```

### Pattern C: Active stream → Today's latest (metrics.js)
```
1. Query Sessions WHERE is_streaming = true
2. If null, query Sessions WHERE date = today ORDER BY session_number DESC LIMIT 1
3. If null and payload.isStreaming === true, create new session
4. If null and not streaming, return 200 with "No record created"
```
---

## Offline / NULL Session Fields

When the system is offline (no active `is_streaming` session), all three log
tables write with `session_date = NULL` and `session_number = NULL`. These are
called **floating logs**.

### Floating Log Claiming

When a new stream starts (`POST /api/stream/metrics` with `isStreaming: true`),
the stream-start insert path runs three UPDATE queries after the Sessions row
is created:

```sql
UPDATE TaskLogs   SET session_date = :newDate, session_number = :newNum
  WHERE session_date IS NULL AND session_number IS NULL
UPDATE NoteLogs   SET session_date = :newDate, session_number = :newNum
  WHERE session_date IS NULL AND session_number IS NULL
UPDATE SessionLogs SET session_date = :newDate, session_number = :newNum
  WHERE session_date IS NULL AND session_number IS NULL
```

This attaches all orphaned logs to the new session.

### NoteLogs Special Case

For `NoteLogs`, the upsert conflicts on `bloc_id`. When offline, the code
checks if the bloc already exists **before** upserting. If it does, the
existing `session_date`/`session_number` are preserved (not overwritten with
null). If it doesn't exist, the new bloc gets null session fields.

---

## Mode Change Flow

### Frontend (`handleModeChange` in `GrossGauntletNow.jsx`)

1. Reads `stateRef.current` (reflecting all live state)
2. Guards against same-mode and explain-without-topic
3. Computes `nextAccumulated` (work seconds) and `nextTimestamp` based on transition type
4. Creates `newState` with mode, accumulated seconds, timestamps
5. Updates local React state immediately for snappy feedback
6. Switches OBS scene if connected
7. Calls `pushStateUpdate(newState)` → `POST /api/stream/metrics` (awaited — blocks flow)
8. Fires `fetch(API.postMode(), { mode })` → `POST /api/stream/mode` (fire-and-forget, not awaited)

### Backend (`api/stream/mode.js`)

1. Validates mode: `['work', 'break', 'standby', 'explain']` or starts with `'explain'`
2. Resolves session: active stream → absolute latest session → 404
3. Updates `Sessions.mode` for the resolved session
4. If mode differs from stored mode, inserts into `SessionLogs`:
   - `session_date` / `session_number` = session values if streaming, else null
5. Returns `{ success: true, mode }`

### Backend (`api/stream/metrics.js` — active stream path)
---

## Board Folding

The board is built by replaying `TaskLogs` events in chronological order:

```
1. 'create'  → push card { id, name, createdAt } into target column
2. 'move'    → find card by task_id across all columns, remove, push into new column
3. 'rename'  → find card by task_id, update its .name
4. 'delete'  → find and remove card by task_id
```

In `api/stream/state.js`, the board is folded **twice**:
1. First from the resolved session's TaskLogs (filtered by session_date + session_number)
2. Then from all NULL-session TaskLogs (floating logs) — this runs unconditionally

---

## Write Cooldown (Race Condition Fix)

### Problem

Two race conditions caused a "clip-back" effect — the user's change would
briefly appear, then snap back to the old value for 1-2 seconds before
correcting itself:

1. **Metrics race**: The poll (`GET /api/stream/state`) updates `setMode`,
   `setTodaySeconds`, etc. **unconditionally** — no guard. If a poll fires
   during `pushStateUpdate`, the server returns stale data and overwrites
   the optimistic local state.

2. **Board race**: `writePendingRef` only blocks the poll during the write.
   After the `finally` block, the next poll can arrive before the DB has
   committed the `TaskLogs` insert, returning the old board.

### Solution

A single `writeCooldownRef` with a 1-second cooldown:

```
All three write handlers (board, mode, stat):
  finally {
    writePendingRef.current = false;
    writeCooldownRef.current = Date.now() + 1000;  // added
  }

Poll handler:
  if (Date.now() < writeCooldownRef.current) return;  // skip entire response
```

---

## Key API Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/stream/state` | GET | None | Poll: returns board + metrics for active/latest session, plus NULL-session board folding |
| `/api/stream/metrics` | POST | Bearer | Write: persists metrics, detects mode changes, records SessionLogs, claims floating logs on stream start |
| `/api/stream/tasks` | POST | Bearer | Write: task actions (create/move/rename/delete/sync), nulls session fields when offline |
| `/api/stream/mode` | POST | Bearer | Write: dedicated mode change, updates Sessions.mode + inserts SessionLogs |
| `/api/stream/webhook` | POST | Bearer | Write: external Kanban webhook (unchanged) |
| `/api/grossgauntlet/note` | GET/POST | POST requires Bearer | Read/Write: NoteLogs, null session fields when offline |
| `/api/grossgauntlet/sessionlogs` | GET | None | Read: returns SessionLogs for a session (used by replay scrubber dots) |
| `/api/grossgauntlet/days` | GET | None | Read: multi-pattern endpoint (days, sessions, events, task counts) |

---

## Renames

| Old Name | New Name | Reason |
|---|---|---|
| `Logs` (table) | `TaskLogs` | Clarify purpose — this table stores task operation events, distinct from SessionLogs |
| N/A | `SessionLogs` (table) | New table for mode-change timeline |
| N/A | `NoteLogs` (table) | New table for bloc-based notes |

---

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `SUPABASE_URL` | All API files | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | All API files | Service role key for write access |
| `OVERLAY_WEBHOOK_SECRET` | metrics.js, mode.js, webhook.js | Primary auth secret for overlay/stream endpoints |
| `WEBHOOK_SECRET` | metrics.js, mode.js, note.js, tasks.js, webhook.js | Fallback auth secret |
| `STREAM_ADMIN_KEY` | note.js, tasks.js | Tertiary fallback auth secret |
| `VITE_SUPABASE_URL` | note.js, days.js | Fallback Supabase URL (Vite env) |
| `VITE_SUPABASE_ANON_KEY` | note.js, days.js | Fallback anon key (Vite env) |

---

## Board Folding

The board is built by replaying `TaskLogs` events in chronological order:

```
1. 'create'  → push card { id, name, createdAt } into target column
2. 'move'    → find card by task_id across all columns, remove, push into new column
3. 'rename'  → find card by task_id, update its .name
4. 'delete'  → find and remove card by task_id
```

In `api/stream/state.js`, the board is folded **twice**:
1. First from the resolved session's TaskLogs (filtered by session_date + session_number)
2. Then from all NULL-session TaskLogs (floating logs) — this runs unconditionally

---

## SessionLogs Mode Dots on Replay Scrubber

In `GrossGauntletSession.jsx`, the replay scrubber now shows mode marker dots
along the timeline:

- **Fetch**: A fourth parallel fetch in the `Promise.all` calls `API.getSessionLogs(dayNumber, sessionNumber)`
- **Derivation**: `modeDots` array computed from `sessionLogs` by mapping `occurred_at` → percentage position (0–100) using `startTime` and `totalMs`
- **Rendering**: Absolutely positioned `<span>` elements inside a relative wrapper, overlaid on the scrubber track
- **Colors**:
  - `work` → `#2ECC71`
  - `break` → `#F0A500`
  - `standby` → `rgba(255,255,255,0.45)`
  - `explain` → `#8A4FFF`
- **Hover**: Scales up 1.5× with a smooth transition
- **Pointer events**: Dots do not capture pointer events (overlay is `pointer-events: none`)
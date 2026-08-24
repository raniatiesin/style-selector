# GrossGauntlet Overlay & Control System — Master Document

> **Purpose:** Single source of truth for the live streaming overlay system. Covers control panel, overlay screens, API sync, timer logic, mode transitions, OBS integration, and the roadmap for embedding the control panel into the `/now` page.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Control Panel — Complete Function Reference](#2-control-panel--complete-function-reference)
3. [Overlay Screens — Complete Reference](#3-overlay-screens--complete-reference)
4. [Timer Logic & Display Rules](#4-timer-logic--display-rules)
5. [Mode Transitions — Complete Decision Matrix](#5-mode-transitions--complete-decision-matrix)
6. [Data Sync Flow](#6-data-sync-flow)
7. [OBS Integration](#7-obs-integration)
8. [Authentication & Access Control](#8-authentication--access-control)
9. [Database Schema (Sessions Table)](#9-database-schema-sessions-table)
10. [Known Issues & Technical Debt](#10-known-issues--technical-debt)
11. [Roadmap: Embedding Control Panel in /now](#11-roadmap-embedding-control-panel-in-now)
12. [Testing Procedures](#12-testing-procedures)

---

## 1. System Architecture

```
+------------------------------------------------------------------------------------------+
|                                BROWSER TAB 1 (Control Panel)                              |
|  GrossGauntletControl.jsx                                                                  |
|                                                                                           |
|  +-------------+  +----------+  +-----------+  +----------------------+                  |
|  | Mode Buttons|  | Metrics  |  | Stream    |  | OBS WebSocket        |                  |
|  | Work/Break  |  | +/- btns |  | GO LIVE   |  | (ws://localhost:4455)|                  |
|  | Explain/    |  | ALPHA $  |  | END STREAM|  | auto-connects on     |                  |
|  | Standby     |  | input    |  |           |  | unlock               |                  |
|  +------+------+  +----+-----+  +-----+-----+  +----------+-----------+                  |
|         |              |              |                     |                              |
|         +-------+------+------+-------+                     |                              |
|                 |             |                             |                              |
|                 v             v                             v                              |
|          +----------------------------------------------------------+                    |
|          |  pushUpdate(newState)                                     |                    |
|          |  1-3: Guards (adminKey, validate, changed)                |                    |
|          |  4-6: Fold elapsed, sentinel, lastBreakEndTs              |                    |
|          |  7. POST /api/stream/metrics   8. 401->logout  9. setState|                    |
|          +----------------------------------------------------------+                    |
|                                                                                           |
|  +------------------------------------------+                                              |
|  | loadMetrics() -- poll GET /api/stream/state every 2000ms          |                    |
|  +------------------------------------------+                                              |
+------------------------------------------------------------------------------------------+

+------------------------------------------------------------------------------------------+
|                              BROWSER TAB 2 (Overlay)                                      |
|  GrossGauntletApp.jsx                                                                     |
|                                                                                           |
|  Mode: urlMode = window.location.pathname.toLowerCase().split('/').pop()                   |
|                                                                                           |
|  +------------------------------------------+                                              |
|  | fetchState() -- poll GET /api/stream/state every 1500ms                                 |
|  | Updates liveStateRef. modeTimestamp = Date.now() on mode change ONLY.                   |
|  | modeTimestamp NEVER from server.                                                        |
|  +------------------------------------------+                                              |
|                                                                                           |
|  +------------------------------------------+                                              |
|  | tick() -- requestAnimationFrame ~60fps    |                                              |
|  | todaySecs = accumulated + (now - modeTs)   |                                              |
|  | sessionSecs = now - lastBreakEndTs        |                                              |
|  | breakSecs = now - modeTs                  |                                              |
|  +------------------------------------------+                                              |
+------------------------------------------------------------------------------------------+

+------------------------------------------------------------------------------------------+
|                                VERCEL API                                                  |
|  POST /api/stream/metrics  <- Control panel writes                                       |
|  GET  /api/stream/state    <- Both tabs poll                                              |
|  Auth: Bearer token from WEBHOOK_SECRET env var                                            |
+------------------------------------------------------------------------------------------+

+------------------------------------------------------------------------------------------+
|                                SUPABASE (Sessions table)                                   |
|  Primary key: (date, session_number)  |  is_streaming flag  |  today_seconds              |
+------------------------------------------------------------------------------------------+
```

### Key Design Decisions

1. **Separate browser tabs.** Control panel and overlay NEVER share JS context. No CustomEvents, no postMessage. Only polling syncs them.
2. **Overlay leads the timer display.** Database lags intentionally. Overlay adds live elapsed on top of last synced value.
3. **modeTimestamp is LOCAL to the overlay.** Never taken from server. On poll that detects mode change, overlay sets modeTimestamp = Date.now().
4. **pushUpdate is the single write path.** Every save goes through pushUpdate(). No other code writes to database.

---

## 2. Control Panel — Complete Function Reference

### 2.1 File: GrossGauntletControl.jsx

**Initial State:** contentCount: 0, salesCount: 0, mode: 'work', accumulatedTodaySeconds: 0, lastBreakEndTimestamp: Date.now(), modeTimestamp: Date.now(), isStreaming: false, standbySelection: 'Coming Soon', streamNumber: 1, sessionNumber: 1, title: '', timestamps: '', alphaGross: 0, totalGross: 0

**UI Sections (top to bottom):**
- **Header Box:** Session title input (text, saves on blur), GO LIVE / END STREAM button, Reset Overlay Clocks button
- **Mode Panel:** Work button -> setMode('work'), Break button -> setMode('break'), Explain text input + button -> setMode('explain|topic'), Standby dropdown + button -> setMode('standby')
- **Metrics Panel:** CONTENT +/- -> handleMetric('contentCount', +/-1), SALES +/- -> handleMetric('salesCount', +/-1), ALPHA $ input -> saves with totalGross computation on blur, Pause/Resume button -> togglePause()
- **YouTube Timestamps:** + MARKER button -> addYtMarker(text), RESET TIMELINE button -> resets timeline to 00:00
- **Webhook Activity:** Read-only log of webhook events
- **Floating Logs:** Auto-dismiss after 10 seconds

### 2.2 toggleStream() — GO LIVE / END STREAM

The ONLY way to set isStreaming: true without OBS. Creates or ends a session row in the database.

**On GO LIVE (was false -> true):** Sets isStreaming: true, modeTimestamp: now, lastBreakEndTimestamp: now, sessionStartTimestamp if not set. Pushes to API which INSERTs a new session row.

**On END STREAM (was true -> false):** Folds any elapsed work time into accumulatedTodaySeconds. Sets isStreaming: false. Appends divider to timestamps. API finalizes the session.

**Critical:** Without clicking GO LIVE first, no session row exists. The API returns "No record created" silently for all other actions.

### 2.3 setMode(mode) — Mode Button Click

Reads stateRef.current, guards against same mode and explain-without-topic. Determines transition type from 5 named variables (isWorkToExplain, isExplainToWork, isWorkToStandby, isStandbyToWork, isBreakToWork). Computes nextAccumulated and nextTimestamp. Creates newState with all fields. If OBS connected, switches scene via SetCurrentProgramScene. Calls pushUpdate.

OBS guard: sets uiSceneChangeRef = true before OBS call, OBS handler checks this to avoid circular updates. Cleared after 2s timeout.

### 2.4 handleMetric(key, delta) — calls pushUpdate with incremented value

### 2.5 togglePause() — Pause/Resume Timer

Pausing: Only in work mode. Folds elapsed into accumulatedTodaySeconds. Sets isPaused: true, pausedTimestamp: now. Keeps modeTimestamp unchanged (for accurate resume).

Resuming: Sets isPaused: false, pausedTimestamp: null. Sets modeTimestamp: now.

### 2.6 resetDay() — Reset Overlay Clocks

Sends accumulatedTodaySeconds: -1 sentinel. pushUpdate transforms -1 to 0 before sending to API. Resets mode to standby, contentCount and salesCount to 0.

### 2.7 pushUpdate(newState) — The Single Write Function

**THIS IS THE MOST CRITICAL FUNCTION.** Every database write flows through here.

```js
1. Guard: if (!adminKey) return;
2. Guard: if (!validateState(newState)) { addLog('validation failed'); return; }
3. Guard: if (!stateChanged) return;
4. Fold elapsed: if (mode==='work' && isStreaming && !isPaused && modeTimestamp)
   -> accumulatedTodaySeconds += (now - modeTimestamp) / 1000, modeTimestamp = now
5. Sentinel: if (accumulatedTodaySeconds === -1) { set to 0, mode = standby, timestamp = now }
6. Ensure lastBreakEndTimestamp in payload
7. POST /api/stream/metrics with Authorization: Bearer adminKey
8. If 401 -> alert("Unauthorized!") + logout()
9. If success -> update local React state
```

### 2.8 validateState(s) — State Consistency

Checks: isPaused without pausedTimestamp, negative accumulated (except -1), invalid mode. Returns true/false.

### 2.9 loadMetrics() — Polling Timer

Polls GET /api/stream/state every 2000ms. Updates every field from API response into local React state. Ensures control panel shows current DB state.

---

## 3. Overlay Screens — Complete Reference

### 3.1 File: GrossGauntletApp.jsx

**URL Mode Detection:** const urlMode = window.location.pathname.toLowerCase().split('/').pop(); The last path segment IS the mode (work/break/standby/explain). Render uses urlMode || modeReact.

**Live State Ref:** Mutable ref holding mode, accumulatedTodaySeconds, modeTimestamp, previousDaysSeconds, totalDays, isStreaming, isPaused, lastBreakEndTimestamp, etc. Updated by poll, read by tick().

**Polling (fetchState, 1500ms):** Updates liveStateRef from API. Monotonic guard prevents accumulatedTodaySeconds from decreasing. Detects mode change and sets modeTimestamp = Date.now(). On match: leaves modeTimestamp untouched. NEVER takes modeTimestamp from server.

**Timer Loop (tick, ~60fps via requestAnimationFrame):**
- if streaming+work+!paused: todaySecs = accumulated + (now - modeTimestamp)/1000. sessionSecs = (now - lastBreakEndTimestamp)/1000.
- if streaming+break: breakSecs = (now - modeTimestamp)/1000.
- All other combos: timers frozen at 0.

**Screens:** work/explain shows context-shell (big timer, day hours, content/sales, clock) + task timeline + progress strip. break shows break timer + task list + clock. standby shows title + clock.

---

## 4. Timer Logic & Display Rules

**Work Timer:** todaySecs = accumulatedTodaySeconds + (Date.now() - modeTimestamp)/1000. Only when mode=work AND isStreaming=true AND !isPaused.

**Session Timer ("since last break"):** sessionSecs = (Date.now() - lastBreakEndTimestamp)/1000. Only when mode=work AND isStreaming=true AND !isPaused. Resets on break->work AND standby->work.

**Break Timer:** breakSecs = (Date.now() - modeTimestamp)/1000. Only when mode=break AND isStreaming=true.

**All timers frozen** when: !isStreaming, isPaused, mode=standby, mode=explain.

**Accumulation events** (elapsed saved to accumulatedTodaySeconds): mode change exiting work, metric increment while working, pause, end stream.

---

## 5. Mode Transitions — Complete Decision Matrix

| From | To | accumulatedTodaySeconds | modeTimestamp | lastBreakEndTimestamp |
|------|----|------------------------|---------------|-----------------------|
| work | explain | accumulated + elapsed | Date.now() | unchanged |
| work | standby | accumulated + elapsed | Date.now() | unchanged |
| work | break | accumulated + elapsed | Date.now() | unchanged |
| explain | work | unchanged | Date.now() | unchanged |
| standby | work | unchanged | Date.now() | Date.now() — RESET |
| break | work | unchanged | Date.now() | Date.now() — RESET |
| explain | break | unchanged | Date.now() | unchanged |
| standby | break | unchanged | Date.now() | unchanged |
| break | explain | unchanged | Date.now() | unchanged |
| break | standby | unchanged | Date.now() | unchanged |
| explain | standby | unchanged | Date.now() | unchanged |
| standby | explain | unchanged | Date.now() | unchanged |

**Paused interaction:** When isPaused=true, no elapsed calculated, modeTimestamp preserved. Exception: entering break from paused resets modeTimestamp.

**Code paths:** Button click -> setMode(). OBS scene change -> CurrentProgramSceneChanged handler (same logic, duplicated).

---

## 6. Data Sync Flow

**Write Path:** User action -> pushUpdate() -> POST /api/stream/metrics -> Supabase
- metrics.js: validates auth, validates payload, maps camelCase to snake_case
- Active stream exists -> UPDATE that session row (monotonic guard blocks decreasing today_seconds)
- No active stream + isStreaming:true -> INSERT new session row
- No active stream + has today session -> UPDATE latest today session
- Else -> "No record created"

**Read Path:** Supabase -> GET /api/stream/state -> Both tabs poll
- state.js: finds active stream (is_streaming=true) or latest today session or returns defaults

**Characteristics:** Eventual consistency. Overlay leads, DB lags. Monotonic guard prevents backward movement.

**On POST failure:** Folded time is lost. Next poll overwrites local state with old DB value.

---

## 7. OBS Integration

**Connection:** ws://localhost:4455, password from localStorage OBS_PASS, auto-connects on unlock.

**Scene mapping:** work->"work", explain->"explain", break->"break", standby->"standby".

**Events:**
- CurrentProgramSceneChanged: maps scene to mode, same elapsed-folding as setMode, guards prevent circular updates (uiSceneChangeRef, obsSceneChangeRef)
- StreamStateChanged: creates session row on start, finalizes on stop. NOTE: manual start/stop in OBS Studio does NOT fire this.

**Limitations:** Requires obs-websocket plugin, OBS 28+. If disconnected, panel shows red dot but buttons still work (save to DB directly).

---

## 8. Authentication & Access Control

**Admin Key:** localStorage STREAM_ADMIN_KEY. Must match WEBHOOK_SECRET or OVERLAY_WEBHOOK_SECRET env var in Vercel. Empty -> pushUpdate returns silently. Wrong -> 401 -> alert + logout.

**OBS Password:** localStorage OBS_PASS. Only for OBS WebSocket, unrelated to API auth.

**/now page:** Uses grossgauntlet_unlocked flag. RunButton checks same STREAM_ADMIN_KEY.

---

## 9. Database Schema (Sessions Table)

**Key columns:** date (DATE), session_number (INTEGER) — composite PK, mode (TEXT), today_seconds (NUMERIC), mode_timestamp (TIMESTAMP), session_start_timestamp (TIMESTAMP), is_streaming (BOOLEAN), is_paused (BOOLEAN), paused_timestamp (TIMESTAMP), content_count (INTEGER), sales_count (INTEGER), title (TEXT), timestamps (TEXT), standby_selection (TEXT), stream_url (TEXT), total_gross (NUMERIC), alpha_gross (NUMERIC), notes (TEXT).

**Lifecycle:** Created on GO LIVE or OBS stream start. Updated on every action. Finalized on END STREAM or stream stop. Archived automatically.

---

## 10. Known Issues & Technical Debt

**Fixed:** Added GO LIVE button. Removed isSyncingRef (7 dead refs). Fixed OBS handler missing isWorkToStandby and missing if gate. Deleted write-control.cjs template.

**Moderate:** No retry on failed POST (time lost). pushUpdate folds elapsed on metric actions (cosmetic timer jump). Duplicate elapsed-folding logic in setMode vs OBS handler. No offline queue.

**Dead code eliminated:** isSyncingRef, displayMode prop, todayWorkSeconds, dispatchEvent broadcast, write-control.cjs.

---

## 11. Roadmap: Embedding Control Panel in /now

**Current:** Collapsible panel below Kanban board, renders full GrossGauntletControl. Button toggles "CONTROL PANEL" / "HIDE".

**Plan:** Short-term -> CSS scoping, prevent duplicate polling, share auth. Long-term -> Extract useStreamState hook, merge polling loops, make embeddable widget.

**Auth:** Already shared via STREAM_ADMIN_KEY (RunButton and control panel read same key).

---

## 12. Testing Procedures

1. **GO LIVE:** Click GO LIVE, check Supabase for new session row with is_streaming=true
2. **Mode saves time:** Work 10s -> Break -> Work, check accumulated shows ~10s
3. **Overlay sync:** Open overlay in separate tab, work 30s, check overlay shows ~30s
4. **Session timer reset:** Work->Break->Work, check "since last break" ~0. Work->Standby->Work, check same
5. **Pause:** Click Pause, wait 10s, Resume, check timer continues without pause time
6. **END STREAM:** Click END STREAM, check is_streaming becomes false in DB
7. **Reset:** Click Reset, confirm, check accumulated=0, mode=standby

---

## Document Maintenance

This document must be updated whenever: mode transitions change, pushUpdate changes, tick() logic changes, OBS handler changes, new API endpoint added, auth model changes.

**Version:** 1.0
**Last Updated:** 2026-08-24
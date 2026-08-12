# GrossGauntlet Kanban Board — Full Build Spec

## 0. What This Is

A live, public, drag-and-drop Kanban board for tracking stream challenge tasks. Anyone can view it live at any time. Only you can edit it, gated behind the same credentials as your OBS control panel. Every day of the challenge gets its own permanent, browsable historical record. Every single change to the board — moves, creates, deletes, renames — gets logged with a timestamp, so a full day can eventually be replayed like a video scrubber.

Two phases:

- **Phase 1** — live board, view/edit split, drag-and-drop, historical day pages.
- **Phase 2** — full change-event log + replay/scrubber UI.

Phase 1 is a complete, shippable product on its own. Phase 2 is additive and doesn't require touching Phase 1's architecture — it hooks into the same write path you'll already have built.

---

## 1. Stack Recap (what we're building with, and deliberately not using)

- **Framework**: Vite + React 19, ESM.
- **Drag-and-drop**: `@dnd-kit` (headless — no styling opinions, no Tailwind dependency).
- **Styling**: your existing CSS modules + global CSS. New styles are additive (drag states, drop indicators), not a new system.
- **State**: Zustand, same as the rest of the app.
- **Backend**: existing serverless functions in `/api` (extend `tasks.js`, add new endpoints as needed).
- **DB**: Supabase, same client you already use.
- **Deliberately skipped**: Tailwind, shadcn, any new provider/context pattern, any new ID library (reuse whatever ID scheme your tasks already have unless a gap is found).

---

## 2. Data Model

### 2.1 Phase 1 — `challenge_days` table (or repurpose existing `stream_metrics` row-per-day)

**Important correction from initial draft**: the row unit is a **stream session**, not a calendar day. You stream a variable number of hours, and sometimes twice in one calendar date — so "day_number" really means "session number," incrementing every time a stream starts, independent of the date. Two streams on the same date produce two separate rows (`day_number` 5 and 6), each with its own URL and its own replay log. The `date` column is purely descriptive (for display, e.g. "Day 6 — Aug 12") and never drives numbering or routing. This also cleanly handles sessions that cross midnight (per your own webhook log, which ran 23:44 → past 08:00 in one continuous session) — a session is bounded by start/end, not by the clock date.

```
challenge_days
------------------------------------------------
id                  serial / uuid, primary key
day_number          int              -- session count: 1, 2, 3... maps to /tasks/5
                                      -- increments per stream START, not per calendar date
date                date              -- descriptive only, e.g. for display
up_next_tasks       jsonb[]          -- array of task objects
in_progress_tasks   jsonb[]
in_review_tasks     jsonb[]
done_tasks          jsonb[]
is_live             boolean          -- true for at most one row: the current session
created_at          timestamptz       -- session start
ended_at            timestamptz       -- session end (null while live)
```

**`is_live` lifecycle**: flipped `true` when you start streaming (tied to whatever already triggers your stream-start webhook/signal), flipped `false` when the stream ends. Starting a new stream always creates a **new row** with the next `day_number` — it never reactivates or reuses a prior row, even same-day.

**What `/tasks` shows between sessions** (nothing currently live): falls back to rendering the most recent row (highest `day_number`) in the same forced read-only mode historical pages already use, rather than a blank/offline state. No new code path — it's the exact same "fetch by day_number, render read-only" logic as `/tasks/:day`, just defaulting to "most recent" instead of a specific number. The `Run` button remains visible and, when used, creates the next new row and flips it live.

**Task object shape** (inside each array):

```json
{
  "id": "task_abc123",
  "title": "Blade Scene Ratio",
  "created_at": "2026-08-12T23:44:35Z",
  "updated_at": "2026-08-12T23:45:30Z"
}
```

Keep the task object itself minimal for Phase 1. Resist the urge to add fields you don't have a UI for yet (tags, assignees, etc.) — add them when a real need shows up.

`is_live` is how `/tasks` knows which row to fetch and write to, without needing to compute "today" via date logic on every request — it's an explicit flag you flip when a challenge day starts/ends. Simpler and less error-prone than date-math, especially across late-night streams that cross midnight (your own logs show a session running from 23:44 to past 08:00 — "today" by date would be wrong here).

### 2.2 Phase 2 — `task_events` table (append-only log)

```
task_events
------------------------------------------------
id              serial / uuid, primary key
day_id          references challenge_days.id
task_id         text             -- stable ID, survives across moves
event_type      text             -- 'create' | 'move' | 'rename' | 'delete' | 'update'
from_column     text (nullable)  -- null on create
to_column       text (nullable)  -- null on delete
payload         jsonb            -- snapshot of relevant change (old/new title, etc.)
occurred_at     timestamptz
```

This is intentionally separate from `challenge_days`. The day row is always "current state." The event table is "how we got here." Replay is built entirely by replaying this table in timestamp order against a blank board — it never touches or depends on the current-state arrays.

**Why append-only matters**: you never update or delete rows in this table, even if a task is later deleted from the board. The event log is the permanent record; the board is just the latest frame.

---

## 3. Routing

| URL | Behavior |
|---|---|
| `/tasks` | Fetches the row where `is_live = true`. If no row is live (between sessions), falls back to the row with the highest `day_number` and renders it read-only. Editable if unlocked *and* a session is actually live — Run button starts a new session/row if none is live. |
| `/tasks/5` | Fetches the row where `day_number = 5`. Renders board in permanent read-only mode, regardless of auth state — this is true even if session 5 happens to still be `is_live`. |
| `/tasks/5/replay` *(Phase 2)* | Fetches `task_events` for `day_id` matching day 5, renders the scrubber/playback UI. |

One board component (`KanbanBoard.jsx`) serves all three. It takes props like `dayId`, `editable`, `mode` (`"live"` / `"historical"` / `"replay"`) rather than being three separate components. This keeps your card/column styling in exactly one place.

---

## 4. Auth: View/Edit Gate

- **No new auth system.** Reuse whatever currently gates the OBS control panel — same password check, same endpoint if possible.
- `/tasks` loads in **view mode by default**, always, for everyone. No login wall to see the board.
- A **"Run" button** triggers a login form (password only, matching OBS panel). On success:
  - Store an unlock flag in `localStorage` (not `sessionStorage`) — confirmed: stays unlocked until the browser tab is closed **and** survives refreshes in the meantime. If you want it to also survive tab close (persist indefinitely until manually logged out), `localStorage` does that too; confirm which of "survives refresh, dies on tab close" vs. "survives everything until I log out" you actually want, since both are one-line differences (`sessionStorage` vs `localStorage`).
  - Flip `editable = true` for the board component. This activates `DndContext`, drag handles, add/delete buttons — literally the same component tree, just with interactivity switched on.
- `/tasks/N` (historical) **ignores the unlock flag entirely** — always read-only, even if you're logged in. Historical days are frozen by design; there's nothing to edit.

---

## 5. Component Architecture

```
KanbanBoard.jsx           -- top level, takes { dayId, editable, mode }
  ├─ DndContext            -- only mounted/active when editable=true
  ├─ KanbanColumn.jsx × 4  -- Up Next / In Progress / In Review / Done
  │    └─ useDroppable()   -- only wired when editable=true
  │    └─ KanbanCard.jsx × N
  │         └─ useSortable() -- only wired when editable=true
  ├─ RunButton.jsx          -- auth gate trigger, only shown on /tasks
  └─ ReplayScrubber.jsx     -- Phase 2 only, only on /tasks/N/replay
```

Key principle: `KanbanColumn` and `KanbanCard` are your existing components with drag hooks **conditionally attached**, not two versions of each component. When `editable=false`, they render identically to now but skip calling `useDroppable`/`useSortable` — same markup, same CSS module, zero interactivity.

---

## 6. Drag-and-Drop Flow (Phase 1)

1. User picks up a card → `@dnd-kit` tracks it locally, no network calls yet.
2. User drops it → `onDragEnd` fires with source column, destination column, and destination index.
3. Compute the new arrays (remove from source, insert at index in destination) — a single pure helper function, e.g. `moveTask(state, taskId, fromCol, toCol, toIndex)`.
4. **Optimistic update**: write the new arrays to Zustand state immediately — board updates instantly, no waiting on network.
5. **Fire API write**: PATCH the `challenge_days` row (`up_next_tasks`, `in_progress_tasks`, etc.) with the new arrays.
6. **(Phase 2 only)** — in the same handler, also insert a row into `task_events`: `{ task_id, event_type: 'move', from_column, to_column, occurred_at: now() }`.
7. If the API write fails: log it, surface a small non-blocking error indicator. Given this is a solo-use internal tool, don't over-build rollback/conflict logic — a manual refresh is an acceptable fallback if a write genuinely fails.

Same pattern applies to create/rename/delete — one helper function per action, one optimistic update, one API write, one (Phase 2) event log insert.

---

## 7. OBS Overlay Consideration

The OBS browser source should **not** load the same interactive board component. Build a separate, minimal `TasksOverlay.jsx` that:

- Fetches the live row the same way (`is_live = true`) via the existing polling loop pattern (`GET /api/stream/state`, ~1500–3000ms interval) that your other overlay elements already use.
- Renders the four columns and cards **read-only**, no `@dnd-kit` import at all — lighter weight for the browser source, and guarantees drag handles/hover states never accidentally show up on stream.
- Shares CSS where sensible (card look should probably match between editor and overlay) but doesn't share the interactive board component itself.

This keeps drag-and-drop code entirely out of the thing OBS renders, which is both simpler and safer.

---

## 8. Phase 2 — Event Log & Replay, In Detail

### 8.1 What gets logged

Everything, as you specified: create, delete, move, rename, and any other field update. Not just column changes.

Event types and their `payload` shape:

```json
// create
{ "event_type": "create", "to_column": "UP_NEXT", "payload": { "title": "Blade Scene" } }

// move
{ "event_type": "move", "from_column": "UP_NEXT", "to_column": "IN_PROGRESS", "payload": {} }

// rename
{ "event_type": "rename", "payload": { "old_title": "Blade Scene", "new_title": "Blade Scene Ratio" } }

// delete
{ "event_type": "delete", "from_column": "DONE", "payload": { "title": "Blade Scene Ratio" } }
```

### 8.2 How replay actually works

Replay is a pure function over the event log, not a special stored "replay state":

1. Fetch all `task_events` for a given `day_id`, sorted by `occurred_at` ascending.
2. Start from an empty board (`{ UP_NEXT: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] }`).
3. Step through events one at a time, applying each to the board state (create adds a card, move relocates it, rename updates its title, delete removes it).
4. At any point, the board state you're holding *is* "what the board looked like at that timestamp."
5. The scrubber UI is just a slider bound to timestamp — dragging it re-runs the fold from the start up to that timestamp (cheap for a day's worth of events — almost certainly under a few hundred rows) and re-renders the board snapshot.
6. "Play" is the same mechanism on a timer, advancing the scrubber automatically and stepping through events at whatever speed multiplier you want (real-time is likely too slow for an 8+ hour stream day — a "compressed to N minutes" playback speed is worth building in from the start).

This is the same pattern as a video editing timeline or a `git log` walkthrough — nothing exotic, just a fold over sorted events.

### 8.3 Your existing raw logs — how they fit in

The webhook log format and the session-timestamp log you already have are useful **prior art for the payload shape**, not something to migrate wholesale. They show you already think in this format naturally, which is a good sign the schema above will feel natural to work with. For actual production logging going forward, events should be written as structured rows (per the schema above) at the moment they happen, rather than parsed out of a text log after the fact — parsing freeform strings like `"[23:44:35] Webhook: 'Unknown Task' -> IN_PROGRESS"` back into structured events is fragile (note the multiple `"Unknown Task"` and `"Untitled Task"` entries in your own sample — that ambiguity is exactly what a proper `task_id` in the event row prevents going forward).

If you want your *existing* historical webhook logs to be replayable too, that's a one-time backfill script (parse the text, insert into `task_events` with best-effort task-id matching) — doable, but treat it as optional cleanup, not a blocker for shipping Phase 2 with fresh data going forward.

### 8.4 Open decisions for Phase 2 specifically

- **Playback speed default** — real-time vs. compressed. Compressed (e.g., whole day in 2–5 minutes) is almost certainly what you actually want for a highlight-reel feel.
- **Does replay show deleted cards reappearing/disappearing**, or only cards that survive to end-of-day? Showing the full history (including deleted cards) is more "true" but needs the UI to handle a card popping in and out cleanly.
- **Do you want a "jump to next event" step control** in addition to continuous scrub/play, for scrubbing precisely to a specific moment (useful if you're clipping stream highlights against board state)?

---

## 9. Build Order

### Phase 1
1. Confirm `challenge_days` table shape in Supabase (or adapt existing `stream_metrics` row into this shape).
2. Zustand store: fetch live row, hold board state, no drag yet — static render using existing card/column components.
3. Install `@dnd-kit` (`@dnd-kit/core`, `@dnd-kit/sortable`).
4. Wrap existing `KanbanCard`/`KanbanColumn` with `useSortable`/`useDroppable`, gated behind `editable` prop.
5. Build `moveTask` helper + `onDragEnd` handler → optimistic update → API write.
6. Build `RunButton` + auth gate reusing OBS panel credentials check.
7. Build `/tasks/:day` route → fetch by `day_number` → render board in forced read-only mode.
8. Build `TasksOverlay.jsx` for OBS — separate, read-only, polling-based.
9. Manual test pass: drag on desktop, keyboard drag-and-drop, mobile touch if relevant, refresh mid-edit, historical page while live page has unsaved-looking state.

### Phase 2
1. Create `task_events` table.
2. Add event-log insert to every existing write path (create/move/rename/delete) — one line added per action, no architecture change.
3. Build the replay fold function (pure, testable in isolation from any UI).
4. Build `ReplayScrubber.jsx` — slider + play/pause + speed control.
5. Wire `/tasks/:day/replay` route.
6. (Optional) backfill script for existing raw logs if you want old days replayable too.

---

## 10. Things Worth Deciding Before You Start Coding

**Resolved:**
- `is_live` flip is tied to stream start/end (existing webhook/signal) — confirmed.
- Edit-unlock stays until tab close — confirmed. (Still need `localStorage` vs `sessionStorage` pick per §4 — functionally near-identical for this use case, just confirm intended behavior on tab close vs. indefinite.)
- Replay is a manual scrub slider over the log, not autoplay-only — confirmed. Playback speed / autoplay can still be a nice-to-have on top of the slider, not a requirement.
- Row unit is per-session, not per-calendar-day, so multiple streams in one date are naturally separate rows/URLs — resolved in §2.1.

**Still open:**
- Whether deleted cards should reappear during replay when scrubbing past their deletion point.
- Whether historical/past-session days ever need editing after the fact (fixing a typo) — spec assumes no; flag now if that's wrong.
- `/tasks` fallback between sessions: confirmed to show most recent session read-only (§3) — flag if you'd rather show an explicit "offline" state instead.
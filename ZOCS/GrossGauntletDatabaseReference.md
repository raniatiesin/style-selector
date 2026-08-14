# GrossGauntlet — Database Reference

> Supabase project. Two tables: `Sessions` and `Logs`.
> All GrossGauntlet API endpoints read/write these two tables exclusively.

---

## Table: `Sessions`

**One row per stream session.** Primary key is composite `(date, session_number)`.

A calendar day can have multiple sessions (e.g. streamed twice on Aug 15 → two rows, same `date`, `session_number` 1 and 2). The frontend derives the challenge day number from `date` — it is not stored.

Challenge start date: **August 15, 2026**.

| Column | Type | Nullable | Default | Role |
|--------|------|----------|---------|------|
| `date` | date | NO | `CURRENT_DATE` | PK. Calendar date of the session. |
| `session_number` | integer | NO | `1` | PK. Which session within that date (1, 2, ...). |
| `title` | text | YES | null | Session title. Pulled from OBS stream title on stream start. Falls back to `"Day {N} — Session {session_number}"`. |
| `mode` | text | YES | `'work'` | Current OBS mode: `work`, `break`, `standby`, `explain`, `explain\|<topic>`. |
| `is_streaming` | boolean | YES | `false` | Whether OBS is currently live. **Display flag only — does not gate editing.** |
| `is_paused` | boolean | YES | `false` | Whether the work timer is paused. |
| `today_seconds` | integer | YES | `0` | Accumulated work seconds for this session only. |
| `mode_timestamp` | bigint | YES | null | Unix ms timestamp of the last mode change. Used to calculate live timer offset. |
| `session_start_timestamp` | bigint | YES | null | Unix ms timestamp of stream start. Preserved across midnight-crossing sessions. |
| `paused_timestamp` | timestamptz | YES | null | When the timer was paused. Used to calculate elapsed pause time. |
| `standby_selection` | varchar | YES | `'Coming Soon'` | Title shown on the standby OBS overlay screen. |
| `timestamps` | text | YES | `''` | YouTube marker log. Plain text, one entry per line. Format: `"HH:MM - mode - description"`. |
| `content_count` | integer | YES | `0` | Content/contacted metric. Incremented from control panel. |
| `sales_count` | integer | YES | `0` | Sales/converted metric. Incremented from control panel. |
| `stream_url` | text | YES | null | YouTube VOD link for this session. Set manually after stream ends. Thumbnail derived from this URL on the frontend — not stored separately. |
| `updated_at` | timestamptz | YES | `now()` | Last write timestamp. Updated on every API write. |

---

## Table: `Logs`

**One row per board event. Append-only — rows are never updated or deleted.**

This is the canonical task state system. The current board state (what's in each column) is maintained as an incremental snapshot in the API layer — each new event is applied as a delta to the current arrays rather than replaying all events. Full replay (for the Phase 2 scrubber) folds all rows for a session in `occurred_at` order against a blank board.

| Column | Type | Nullable | Role |
|--------|------|----------|------|
| `id` | bigint | NO | PK. Auto-incrementing. |
| `session_date` | date | YES | FK → `Sessions(date)`. Which session this event belongs to. |
| `session_number` | integer | YES | FK → `Sessions(session_number)`. Which session this event belongs to. |
| `task_id` | text | NO | Stable UUID for the task. Consistent across moves, renames. Generated client-side via `crypto.randomUUID()`. |
| `event_type` | text | NO | What happened: `create`, `move`, `rename`, `delete`. |
| `from_column` | text | YES | Source column. Null on `create`. |
| `to_column` | text | YES | Destination column. Null on `delete`. |
| `payload` | jsonb | YES | Event-specific data (see below). |
| `occurred_at` | timestamptz | YES | `now()` | Wall clock time of the event. |

### Column Values

**Column name strings** used in `from_column` and `to_column`:
```
todo        up_next        in_progress        in_review        done
```

**`payload` shape by event type:**
```json
// create
{ "name": "Blade Scene" }

// move
{}

// rename
{ "old": "Blade Scene", "new": "Blade Scene Ratio" }

// delete
{ "name": "Blade Scene Ratio" }
```

---

## Relationship

```
Sessions (date, session_number)  ←──  Logs (session_date, session_number)
         [composite PK]                        [composite FK]
         one session                           many events
```

One session has many log events. A log event belongs to exactly one session.

---

## How Board State Works

The API maintains the current board as five in-memory arrays per session, derived incrementally:

1. On session load → query all `Logs` for that session, fold into board state once.
2. On every board action → insert one row into `Logs`, apply the delta to the cached arrays, write back to the client.
3. Never store the board arrays in `Sessions` — `Logs` is the source of truth.
4. Phase 2 replay → fold all `Logs` rows for a session in `occurred_at` order against a blank board, up to a given timestamp.

---

## Key Rules

- `Sessions` primary key is `(date, session_number)` — not a single auto-increment ID.
- `is_streaming` does not gate editing. It drives display only (live badge, timer state).
- Editing is gated by `grossgauntlet_unlocked` in the client's `localStorage` only.
- `Logs` is append-only. No `UPDATE` or `DELETE` ever runs against it.
- `stream_url` YouTube thumbnails are derived on the frontend, never stored.
- Challenge day number is derived on the frontend: `dayNumber = (date - 2026-08-15) + 1`.

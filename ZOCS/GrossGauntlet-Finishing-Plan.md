# GrossGauntlet — Finishing Plan
### Everything remaining to complete the project
> Hand this doc alongside `GrossGauntlet-Database-Reference.md` and `GrossGauntlet-Master-Spec-v2.md`
> Read all three before touching anything.

---

## LOCKED FILES — DO NOT TOUCH UNDER ANY CIRCUMSTANCES

These files are working perfectly. The agent must not modify them:

```
api/stream/state.js
api/stream/metrics.js
api/stream/webhook.js
src/App.jsx
src/components/GrossGauntlet/GrossGauntletApp.jsx
src/components/GrossGauntlet/GrossGauntletApp.css
src/components/GrossGauntlet/GrossGauntletControl.jsx   ← EXCEPT Step 2 below, surgical only
src/components/GrossGauntlet/TasksOverlay.jsx            ← being deleted in Step 0
src/styles/global.css
vercel.json                                              ← EXCEPT adding one rewrite in Step 0
```

The OBS overlays (work/break/standby/explain) are perfect. Do not go near them.

---

## Step 0 — Cleanup (do first, one commit)

**0a. Delete TasksOverlay:**
- Delete `src/components/GrossGauntlet/TasksOverlay.jsx`
- Delete its CSS file if it exists
- In `GrossGauntletRouter.jsx` — remove the `/overlay/tasks` route and TasksOverlay import
- In `App.jsx` — remove TasksOverlay import and the `overlays/tasks` render line

**0b. vercel.json — remove the `/overlay/tasks` rewrite if it exists**

Commit: `"cleanup: remove TasksOverlay"`
Verify: `npm run build` passes.

---

## Step 1 — Kanban Restyling (one commit)

The kanban board must match the tiesin.me design language exactly.
The reference is `Welcome.module.css` and `global.css` — use those values verbatim.

### The core problem to fix
Current kanban CSS uses generic dark UI patterns. It needs to use the site's glass card system, token scale, and typography exactly.

### KanbanColumn.module.css — full restyle

```css
/* Column container — glass card, same as Welcome.module.css .card */
.column {
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 260px;
  flex: 1;
  background: rgba(10, 10, 10, 0.62);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 16px;
  overflow: hidden;
  transition: border-color 0.18s ease;
}

.editable:hover {
  border-color: rgba(255, 255, 255, 0.18);
}

.dropOver {
  border-color: rgba(255, 255, 255, 0.30);
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.label {
  font-family: var(--font);
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}

.count {
  font-family: var(--font);
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.25);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 0;
  padding: 2px 8px;
  letter-spacing: 0.08em;
}

/* Card list */
.cardList {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-12);
  flex: 1;
  min-height: 60px;
}

.empty {
  font-family: var(--font);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.20);
  text-align: center;
  padding: var(--space-16) 0;
  margin: 0;
  letter-spacing: 0.06em;
}

/* Add row */
.addRow {
  padding: var(--space-8) var(--space-12) var(--space-12);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.addBtn {
  width: 100%;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 0;
  color: rgba(255, 255, 255, 0.35);
  font-family: var(--font);
  font-size: 0.72rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  padding: 8px 12px;
  cursor: pointer;
  text-align: left;
  transition: color 0.18s ease, border-color 0.18s ease;
}

.addBtn:hover {
  color: rgba(255, 255, 255, 0.70);
  border-color: rgba(255, 255, 255, 0.25);
}

.addInput {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 0;
  color: rgba(255, 255, 255, 0.92);
  font-family: var(--font);
  font-size: 0.82rem;
  padding: 6px 0;
  outline: none;
  box-sizing: border-box;
}

.addInput::placeholder {
  color: rgba(255, 255, 255, 0.25);
}
```

### KanbanCard.module.css — full restyle

```css
/* Base card — glass, blurred */
.card {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-family: var(--font);
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.82);
  transition: background 0.15s ease, border-color 0.15s ease;
  user-select: none;
  min-height: 40px;
}

.card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
}

/* Being dragged */
.dragging {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}

/* Drag handle */
.handle {
  cursor: grab;
  color: rgba(255, 255, 255, 0.20);
  font-size: 13px;
  flex-shrink: 0;
  transition: color 0.1s;
  user-select: none;
  line-height: 1;
}

.handle:hover { color: rgba(255, 255, 255, 0.50); }
.handle:active { cursor: grabbing; }

/* Status dot — color injected inline from STATUS_COLORS map */
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Task name */
.name {
  flex: 1;
  line-height: 1.4;
  word-break: break-word;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.82);
}

/* Rename input */
.renameInput {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.30);
  outline: none;
  color: rgba(255, 255, 255, 0.92);
  font-family: var(--font);
  font-size: 0.82rem;
  padding: 0;
  line-height: 1.4;
  border-radius: 0;
}

/* Delete button — hidden until hover */
.deleteBtn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 0;
  color: rgba(255, 255, 255, 0.25);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: color 0.12s;
  opacity: 0;
  pointer-events: none;
}

.card:hover .deleteBtn {
  opacity: 1;
  pointer-events: auto;
}

.deleteBtn:hover { color: #E74C3C; }
```

### KanbanBoard.module.css — update

```css
.board {
  display: flex;
  gap: var(--space-12);
  align-items: flex-start;
  width: 100%;
  overflow-x: auto;
  padding-bottom: var(--space-4);
}

/* Ghost card under pointer during drag */
.dragOverlay {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  border-radius: 10px;
  transform: rotate(1deg);
  opacity: 0.88;
  pointer-events: none;
}
```

### KanbanCard.jsx — update STATUS_COLORS

Replace the existing STATUS_COLORS map with exact values matching the TwentyCRM screenshot and the site's token system:

```javascript
const STATUS_COLORS = {
  todo:        '#808080',
  up_next:     '#8A4FFF',
  in_progress: '#2ECC71',
  in_review:   '#F0A500',
  done:        '#E74C3C',
  waiting:     '#808080',
};
```

Commit: `"style: restyle kanban to match tiesin.me design language"`
Verify: build passes, board looks correct at `/grossgauntlet/now`.

---

## Step 2 — stream_url in Control Panel (one commit)

**File to modify: `GrossGauntletControl.jsx` — surgical addition only**

Add a "YouTube Link" input field to the control panel UI. This is the only change to this file.

Find the section in `GrossGauntletControl.jsx` that renders stream metrics or session info. Add after it:

```jsx
{/* YouTube VOD Link */}
<div className="gg-control-section">
  <label className="gg-control-label">YOUTUBE LINK</label>
  <div className="gg-control-row">
    <input
      type="url"
      className="gg-control-input"
      placeholder="https://youtube.com/watch?v=..."
      value={streamUrl}
      onChange={e => setStreamUrl(e.target.value)}
    />
    <button
      className="gg-control-btn"
      onClick={handleSaveStreamUrl}
    >
      Save
    </button>
  </div>
</div>
```

Add state and handler:
```javascript
const [streamUrl, setStreamUrl] = useState('');

async function handleSaveStreamUrl() {
  if (!streamUrl.trim()) return;
  await fetch('/api/stream/metrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminKey}` // use existing adminKey state
    },
    body: JSON.stringify({ streamUrl: streamUrl.trim() })
  });
}
```

**`api/stream/metrics.js` — add stream_url handling:**

In the upsert/update block, add:
```javascript
if (body.streamUrl !== undefined) {
  updateFields.stream_url = body.streamUrl;
}
```

This is the only change to `metrics.js`. Nothing else in that file changes.

Commit: `"feat: add stream_url field to control panel"`

---

## Step 3 — Stats on Session Pages (one commit)

**File: `GrossGauntletSession.jsx`**

The stats row exists but is not showing real data. Fix the data binding.

The API response from `GET /api/grossgauntlet/days/:date/:sessionNumber` includes:
```json
{
  "session": {
    "today_seconds": 14400,
    "content_count": 5,
    "sales_count": 3,
    "stream_url": "https://youtube.com/watch?v=..."
  },
  "board": { "todo": [], "up_next": [], "in_progress": [], "in_review": [], "done": [] }
}
```

In `GrossGauntletSession.jsx`:

```jsx
// Derive stats from board + session
const totalTasks = Object.values(board).flat().length;
const doneTasks = board.done?.length ?? 0;
const workedFormatted = formatHMS(session.today_seconds ?? 0);

// Stats row
<div className={styles.statsRow}>
  <span className={styles.stat}>
    <span className={styles.statValue}>{workedFormatted}</span> worked
  </span>
  <span className={styles.statDivider}>·</span>
  <span className={styles.stat}>
    <span className={styles.statValue}>{doneTasks}/{totalTasks}</span> done
  </span>
  <span className={styles.statDivider}>·</span>
  <span className={styles.stat}>
    <span className={styles.statValue}>{session.content_count ?? 0}</span> content
  </span>
  <span className={styles.statDivider}>·</span>
  <span className={styles.stat}>
    <span className={styles.statValue}>{session.sales_count ?? 0}</span> sales
  </span>
</div>
```

Use the existing `formatHMS` utility from `utils.js` — it's already in the codebase.

**Also in `GrossGauntletSession.jsx` — wire the YouTube embed:**

```jsx
{session.stream_url && (
  <div className={styles.youtubeSection}>
    <iframe
      className={styles.youtubeEmbed}
      src={`https://www.youtube.com/embed/${getYoutubeId(session.stream_url)}`}
      title="Stream recording"
      frameBorder="0"
      allowFullScreen
    />
    <a
      href={session.stream_url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.watchLink}
    >
      Watch on YouTube →
    </a>
  </div>
)}
```

Helper (add at top of file):
```javascript
function getYoutubeId(url) {
  const match = url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
  return match?.[1] ?? null;
}
```

CSS additions to `GrossGauntletPages.css`:
```css
.youtubeSection { margin-bottom: var(--space-28); }
.youtubeEmbed {
  width: 100%;
  aspect-ratio: 16/9;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 10px;
  background: rgba(10,10,10,0.62);
}
.watchLink {
  display: inline-block;
  margin-top: var(--space-12);
  font-family: var(--font);
  font-size: 0.78rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  text-decoration: none;
  transition: color 0.18s ease;
}
.watchLink:hover { color: rgba(255,255,255,0.82); }
```

**Also in `GrossGauntletHome.jsx` — wire stream_url to Watch button on day cards:**

The `SessionCard` component already has a Watch button — confirm it receives `streamUrl` from the API response and only renders when `streamUrl` is not null.

Commit: `"feat: stats, YouTube embed on session pages"`
Verify: `/grossgauntlet/now` shows stats, session pages show YouTube embed when URL is set.

---

## Step 4 — Phase 2: Replay Scrubber (one commit)

### What it is
A timeline scrubber on `/grossgauntlet/:date/:sessionNumber/replay` that replays every card movement from the `Logs` table. The board re-renders at each point in time as you scrub.

### Data
```javascript
GET /api/grossgauntlet/days/:date/:sessionNumber/events
// Returns all Logs rows for this session, ordered by occurred_at ASC:
[
  { id, task_id, event_type, from_column, to_column, payload, occurred_at },
  ...
]
```

This endpoint already exists as a stub — make it return real data:
```javascript
const { data } = await supabase
  .from('Logs')
  .select('*')
  .eq('session_date', date)
  .eq('session_number', sessionNumber)
  .order('occurred_at', { ascending: true });

return res.json({ success: true, events: data ?? [] });
```

### Pure replay function (add to `moveTask.js`)

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

### `ReplayScrubber.jsx` — full implementation

```
Layout:
─────────────────────────────────────────────────────────
← Back to session          DAY {N} — Replay

─────────────────────────────────────────────────────────

[▶ Play]  [1×] [2×] [5×] [10×]

[────────────────●───────────────────]   01:23:45 / 04:22:10

─────────────────────────────────────────────────────────

[Kanban board — read only, re-renders on scrub]

─────────────────────────────────────────────────────────

TIMESTAMPS LOG
──────────────
00:07 - work - storyboarding
38:20 - work - GENERATIONS
...
─────────────────────────────────────────────────────────
```

**Implementation:**

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../../config/api';
import KanbanBoard from './kanban/KanbanBoard';
import { replayToTime } from './kanban/moveTask';
import styles from './ReplayScrubber.module.css';

const SPEEDS = [1, 2, 5, 10];

export default function ReplayScrubber() {
  const { date, sessionNumber } = useParams();
  const [events, setEvents] = useState([]);
  const [session, setSession] = useState(null);
  const [board, setBoard] = useState({ todo: [], up_next: [], in_progress: [], in_review: [], done: [] });
  const [sliderValue, setSliderValue] = useState(0);   // 0–100
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playRef = useRef(null);

  // Fetch events + session
  useEffect(() => {
    async function load() {
      const [eventsRes, sessionRes] = await Promise.all([
        fetch(API.getEvents(date, sessionNumber)).then(r => r.json()),
        fetch(API.getSession(date, sessionNumber)).then(r => r.json()),
      ]);
      setEvents(eventsRes.events ?? []);
      setSession(sessionRes.session ?? null);
    }
    load();
  }, [date, sessionNumber]);

  // Derive time bounds from events
  const startTime = events[0] ? new Date(events[0].occurred_at).getTime() : 0;
  const endTime = events[events.length - 1] ? new Date(events[events.length - 1].occurred_at).getTime() : 0;
  const totalMs = endTime - startTime || 1;

  // Current time from slider
  const currentMs = startTime + (sliderValue / 100) * totalMs;

  // Re-render board when slider moves
  useEffect(() => {
    if (!events.length) return;
    setBoard(replayToTime(events, new Date(currentMs)));
  }, [sliderValue, events]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) { clearInterval(playRef.current); return; }
    const TICK_MS = 100;
    const advancePerTick = (TICK_MS / totalMs) * 100 * speed;
    playRef.current = setInterval(() => {
      setSliderValue(prev => {
        if (prev >= 100) { setIsPlaying(false); return 100; }
        return Math.min(prev + advancePerTick, 100);
      });
    }, TICK_MS);
    return () => clearInterval(playRef.current);
  }, [isPlaying, speed, totalMs]);

  function formatElapsed(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  if (!events.length) return (
    <div className={styles.empty}>
      <p>No replay data for this session yet.</p>
      <p>Task movements are recorded as you stream.</p>
    </div>
  );

  return (
    <div className={styles.page}>
      <Link to={`/grossgauntlet/${date}/${sessionNumber}`} className={styles.back}>
        ← Back to session
      </Link>

      <h1 className={styles.title}>Day {session?.dayNumber} — Replay</h1>

      {/* Controls */}
      <div className={styles.controls}>
        <button className={styles.playBtn} onClick={() => setIsPlaying(p => !p)}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className={styles.speeds}>
          {SPEEDS.map(s => (
            <button
              key={s}
              className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber */}
      <div className={styles.scrubberRow}>
        <input
          type="range"
          min={0}
          max={100}
          step={0.01}
          value={sliderValue}
          onChange={e => { setIsPlaying(false); setSliderValue(Number(e.target.value)); }}
          className={styles.scrubber}
        />
        <span className={styles.time}>
          {formatElapsed(currentMs - startTime)} / {formatElapsed(totalMs)}
        </span>
      </div>

      {/* Board */}
      <div className={styles.boardWrap}>
        <KanbanBoard initialBoard={board} editable={false} />
      </div>

      {/* Timestamps log */}
      {session?.timestamps && (
        <div className={styles.timestampsSection}>
          <p className={styles.timestampsLabel}>TIMESTAMPS</p>
          <pre className={styles.timestamps}>{session.timestamps}</pre>
        </div>
      )}
    </div>
  );
}
```

### `ReplayScrubber.module.css`

```css
.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-40) var(--space-24);
}

.back {
  font-family: var(--font);
  font-size: 0.75rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  text-decoration: none;
  transition: color 0.18s ease;
  display: inline-block;
  margin-bottom: var(--space-24);
}
.back:hover { color: rgba(255,255,255,0.70); }

.title {
  font-family: var(--font);
  font-size: 1.4rem;
  font-weight: 400;
  color: rgba(255,255,255,0.92);
  margin-bottom: var(--space-28);
}

.controls {
  display: flex;
  align-items: center;
  gap: var(--space-16);
  margin-bottom: var(--space-16);
}

.playBtn {
  font-size: 1.1rem;
  color: rgba(255,255,255,0.82);
  background: transparent;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 0;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease;
}
.playBtn:hover { border-color: rgba(255,255,255,0.45); }

.speeds { display: flex; gap: var(--space-8); }

.speedBtn {
  font-family: var(--font);
  font-size: 0.72rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  background: transparent;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 0;
  padding: 6px 12px;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease;
}
.speedBtn:hover { color: rgba(255,255,255,0.70); border-color: rgba(255,255,255,0.25); }
.speedActive { color: rgba(255,255,255,0.92) !important; border-color: rgba(255,255,255,0.45) !important; }

.scrubberRow {
  display: flex;
  align-items: center;
  gap: var(--space-16);
  margin-bottom: var(--space-36);
}

.scrubber {
  flex: 1;
  accent-color: rgba(255,255,255,0.70);
  cursor: pointer;
}

.time {
  font-family: var(--font);
  font-size: 0.78rem;
  color: rgba(255,255,255,0.45);
  white-space: nowrap;
  letter-spacing: 0.06em;
}

.boardWrap { margin-bottom: var(--space-40); }

.timestampsSection { margin-top: var(--space-36); }

.timestampsLabel {
  font-family: var(--font);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin-bottom: var(--space-12);
}

.timestamps {
  font-family: var(--font);
  font-size: 0.78rem;
  color: rgba(255,255,255,0.50);
  line-height: 1.8;
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
  white-space: pre-wrap;
}

.empty {
  padding: var(--space-60) var(--space-24);
  text-align: center;
  font-family: var(--font);
  color: rgba(255,255,255,0.35);
  font-size: 0.88rem;
  line-height: 2;
}
```

### Wire the replay route

In `GrossGauntletRouter.jsx` — the route already exists as a placeholder:
```jsx
<Route path="/grossgauntlet/:date/:sessionNumber/replay" element={<ReplayScrubber />} />
```
Replace the placeholder import with the real component. No other routing changes.

### Wire the "Replay This Session" button

In `GrossGauntletSession.jsx` — the button already exists. Confirm it links to:
```jsx
<Link to={`/grossgauntlet/${date}/${sessionNumber}/replay`}>
  Replay This Session →
</Link>
```

Commit: `"feat: Phase 2 replay scrubber"`
Verify: navigate to a session page → click Replay → scrubber loads → dragging the slider re-renders the board.

---

## Build Order Summary

```
Step 0 — Delete TasksOverlay               → commit, verify build
Step 1 — Kanban restyling                  → commit, verify visually
Step 2 — stream_url in control panel       → commit, verify saves to DB
Step 3 — Stats + YouTube on session pages  → commit, verify data shows
Step 4 — Phase 2 replay scrubber           → commit, verify scrubber works
```

One step. One commit. Verify before moving to the next.
Never touch a working file unless explicitly named in that step.

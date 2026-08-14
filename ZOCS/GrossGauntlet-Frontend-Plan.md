# GrossGauntlet — Frontend Pages Plan
### Homepage, Day View, Session View — built with tiesin.me components
> Hand this doc alongside `GrossGauntlet-Database-Reference.md` and `GrossGauntlet-Master-Spec-v2.md`

---

## Design System — What Exists, What To Use

Before writing a single line of GrossGauntlet page code, internalize this:

### The glass card — your primary container primitive
From `Welcome.module.css .card`:
```css
background: rgba(10, 10, 10, 0.62);
backdrop-filter: blur(24px);
-webkit-backdrop-filter: blur(24px);
border: 1px solid rgba(255, 255, 255, 0.10);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
```
Every card in every GrossGauntlet page uses this exact pattern. Not a new card system — this one. Copy the values verbatim into `GrossGauntletPages.css`.

### The pill — your tag/label primitive
`src/components/shared/TagPill.jsx` + `TagPill.module.css`:
- Uppercase, letter-spaced, 0.75rem, transparent background
- `border: 1px solid rgba(255,255,255,0.12)`, zero border-radius
- Used for: status labels, day numbers, session counts, mode indicators

**Import and use `<TagPill />` directly.** Do not recreate it.

### Typography scale (from global.css)
```
--font: 'Space Grotesk', system-ui, -apple-system, sans-serif;
--white-92  → primary text
--white-70  → secondary text
--white-45  → tertiary / metadata
--white-25  → placeholder / disabled
--white-12  → subtle borders
--white-07  → subtle backgrounds
```

### Spacing scale (from global.css)
```
--space-8, --space-12, --space-16, --space-20, --space-24,
--space-28, --space-36, --space-40, --space-48, --space-60, --space-72
```
Use these everywhere. No magic pixel numbers.

### Animation pattern — GSAP, not CSS transitions
Every page mount uses the same pattern from `Welcome.jsx`:
```javascript
gsap.fromTo(ref.current,
  { opacity: 0, y: 14 },
  { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
);
```
Cards fade+slide in on mount. Stagger child elements with `-=0.2` offsets.
Import GSAP — it's already in the project. Do not use CSS `animation:` keyframes for entrance animations.

### Button pattern (from Welcome.module.css .makeBtn)
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
transition: border-color 0.18s ease, color 0.18s ease;
```
Hover: `border-color: rgba(255,255,255,0.7)`. Zero border-radius — this is the site's button language. Use it everywhere in GrossGauntlet pages.

### Background
The animated background (`Background.jsx`) runs on the main site. GrossGauntlet pages sit on top of it — `--bg: #0a0a0a` is the base. Pages do not need their own background treatment; the existing one shows through glass cards.

---

## Page 1 — `GrossGauntletHome.jsx` (`/grossgauntlet`)

### What it is
The archive grid. Every challenge day as a card. The face of the entire project.
Feel: a record label discography page — dense, proud, chronological, each day an entry with its own identity.

### Data
```javascript
GET /api/grossgauntlet/days
// Returns array of day groups, ordered by date DESC (newest first):
[
  {
    date: "2026-08-15",
    dayNumber: 1,           // derived: (date - 2026-08-15) + 1
    sessions: [
      {
        sessionNumber: 1,
        title: "Day 1 — First Drop",
        todaySeconds: 14400,
        isStreaming: false,
        streamUrl: "https://youtube.com/watch?v=...",
        taskCounts: { todo: 0, up_next: 2, in_progress: 0, in_review: 0, done: 5 }
      }
    ]
  }
]
```

`taskCounts` is derived by the API from `Logs` — count events per column per session. `done` = number of unique `task_id`s whose last event was `to_column: 'done'`. Total tasks = all unique `task_id`s in this session.

### Layout

```
/grossgauntlet
─────────────────────────────────────────────────────
[HEADER]
  GrossGauntlet          ← h1, --white-92, Space Grotesk
  Day {N} of the Gauntlet  ← subtitle, --white-45, smaller

[GRID]
  responsive grid, 1 col mobile / 2 col tablet / 3 col desktop
  gap: --space-20
  each item = <DayCard />
─────────────────────────────────────────────────────
```

### `DayCard` component (internal to GrossGauntletHome)

```
┌──────────────────────────────────────────┐
│  DAY 1          [LIVE ●] or [2 sessions] │  ← TagPill for day number, status
│                                          │
│  Day 1 — First Drop                      │  ← title, --white-92, 1.1rem
│  Aug 15 2026                             │  ← date, --white-45, 0.8rem
│                                          │
│  ████████████░░░░  5/7 done              │  ← progress bar + fraction
│                                          │
│  4h 22m                                  │  ← todaySeconds formatted
│                                          │
│  [▶ Watch]                               │  ← only if streamUrl exists
└──────────────────────────────────────────┘
```

**Styles:**
- Glass card pattern (exact values from Welcome.module.css above)
- `border-radius: 16px`
- `padding: --space-28 --space-28`
- Hover: `border-color: rgba(255,255,255,0.22)`, `transform: translateY(-2px)`, `transition: 0.2s ease`
- Cursor: pointer — whole card is clickable → `/grossgauntlet/{date}`
- Live badge: `background: rgba(231,76,60,0.15)`, `color: #E74C3C`, pulsing dot animation

**Progress bar:**
```css
.track { height: 2px; background: var(--white-07); border-radius: 1px; }
.fill  { height: 100%; background: var(--white-35); border-radius: 1px; transition: width 0.3s ease; }
```
Width = `(doneTasks / totalTasks) * 100%`. If no tasks yet, bar is empty, no fraction shown.

**Day number pill:** use `<TagPill label={`DAY ${dayNumber}`} />` — no onClick.

**Multi-session indicator:** if `sessions.length > 1`, show `<TagPill label={`${sessions.length} SESSIONS`} />` alongside the day pill.

**Watch button:** use the site button pattern above. Opens `streamUrl` in new tab. Only renders if `streamUrl` is set.

**Empty state (no days yet):**
```jsx
<div className={styles.empty}>
  <p>The gauntlet hasn't started yet.</p>
  <p>Check back on Aug 15.</p>
</div>
```
Text: `--white-45`, centered, same glass card.

### Mount animation
```javascript
useEffect(() => {
  gsap.fromTo(headerRef.current,
    { opacity: 0, y: 14 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
  );
  gsap.fromTo(cardRefs.current,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.06 }
  );
}, []);
```

---

## Page 2 — `GrossGauntletDay.jsx` (`/grossgauntlet/:date`)

### What it is
Router page. Single job: fetch sessions for this date and decide what to render.

### Logic
```javascript
const { date } = useParams();
const { data } = useFetch(API.getDay(date)); // GET /api/grossgauntlet/days/:date

if (data.sessions.length === 1) {
  // Render GrossGauntletSession directly with the session data
  return <GrossGauntletSession prefetchedData={data.sessions[0]} />;
}

if (data.sessions.length > 1) {
  // Render session selector
  return <SessionSelector sessions={data.sessions} date={date} dayNumber={data.dayNumber} />;
}
```

### `SessionSelector` (internal, only rendered for multi-session days)

```
/grossgauntlet/2026-08-15  (when 2 sessions exist)
─────────────────────────────────────────────────────
  DAY 1 — Aug 15 2026        ← header

  [Session 1 card]           → /grossgauntlet/2026-08-15/1
  [Session 2 card]           → /grossgauntlet/2026-08-15/2
─────────────────────────────────────────────────────
```

Each session card is the same `DayCard` pattern — glass card, title, time, task count, watch button if URL exists. Clicking navigates to the specific session URL.

---

## Page 3 — `GrossGauntletSession.jsx` (`/grossgauntlet/:date/:sessionNumber`)

### What it is
The historical session archive. The deepest page. A viewer lands here from the day grid or a direct link. They see the frozen board, the timestamp log, and (eventually) the replay and YouTube embed.

This is the most important page for the "dynamic archive" vision.

### Data
```javascript
GET /api/grossgauntlet/days/:date/:sessionNumber
// Returns:
{
  session: {
    date, sessionNumber, title, todaySeconds,
    isStreaming: false,
    streamUrl, timestamps, contentCount, salesCount,
    mode, standbySelection
  },
  board: {
    todo: [], up_next: [], in_progress: [], in_review: [], done: []
  }
}
```
Board is derived from `Logs` by the API (full fold for historical sessions).

### Layout

```
/grossgauntlet/2026-08-15/1
─────────────────────────────────────────────────────────────────

[BACK]  ← GrossGauntlet          ← breadcrumb, TagPill style, links to /grossgauntlet

DAY 1 — Session 1                ← h1
Aug 15 2026                      ← --white-45

─────────────────────────────────────────────────────────────────

[LEFT COLUMN ~60%]               [RIGHT COLUMN ~40%]

YouTube embed / thumbnail         TIMESTAMPS
(if streamUrl exists)             ──────────
  ┌───────────────────┐           00:07 - work - storyboarding
  │  ▶  thumbnail     │           38:20 - work - GENERATIONS
  │                   │           56:30 - break
  └───────────────────┘           1:10:46 - work - GENERATIONS
  [Watch on YouTube →]            ...
                                  (scrollable, monospace font)

─────────────────────────────────────────────────────────────────

KANBAN BOARD (read-only, full width)
<KanbanBoard editable={false} initialBoard={board} />

─────────────────────────────────────────────────────────────────

STATS ROW
  4h 22m worked    ·    5 done    ·    12 content    ·    3 sales

─────────────────────────────────────────────────────────────────

[REPLAY THIS SESSION →]          ← button, only if Logs exist for this session
                                    links to /grossgauntlet/2026-08-15/1/replay
                                    (Phase 2 — renders placeholder for now)
─────────────────────────────────────────────────────────────────
```

### YouTube embed
If `streamUrl` is set:
```javascript
function getYoutubeThumbnail(url) {
  const match = url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
  return match ? `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg` : null;
}
function getYoutubeEmbed(url) {
  const match = url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}
```
Render as `<iframe>` embed (preferred) or thumbnail image with play button linking to YouTube. If no `streamUrl` → section is hidden entirely, no placeholder.

### Timestamps log
The `timestamps` field from `Sessions` is plain text, one entry per line:
```
00:07 - work - storyboarding
38:20 - work - GENERATIONS
```
Render as a `<pre>` or line-by-line `<div>` inside a scrollable container.
```css
.timestamps {
  font-family: 'Space Grotesk', monospace;
  font-size: 0.78rem;
  color: var(--white-55);
  line-height: 1.8;
  max-height: 280px;
  overflow-y: auto;
  scrollbar-width: thin;
}
```

### Historical notice
Small text at top of board section:
```
⚡ Historical record — read-only
```
Color: `--white-25`. Does not use TagPill — just a `<p>`.

### Stats row
```css
.statsRow {
  display: flex;
  gap: var(--space-24);
  align-items: center;
  padding: var(--space-20) 0;
  border-top: 1px solid var(--white-10);
  border-bottom: 1px solid var(--white-10);
}
.stat { font-size: 0.82rem; color: var(--white-55); }
.statValue { color: var(--white-82); font-weight: 500; margin-right: 4px; }
```

### KanbanBoard integration
```jsx
<KanbanBoard
  initialBoard={board}
  editable={false}
  onBoardChange={undefined}
/>
```
Read-only — `editable={false}` suppresses all drag handles, delete buttons, add inputs. The board looks identical to the live board but nothing is interactive.

### Mount animation
```javascript
gsap.fromTo(pageRef.current,
  { opacity: 0 },
  { opacity: 1, duration: 0.4, ease: 'power2.out' }
);
gsap.fromTo([titleRef.current, boardRef.current, statsRef.current],
  { opacity: 0, y: 16 },
  { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.08, delay: 0.1 }
);
```

---

## Page 4 — `GrossGauntletNow.jsx` — refinements (`/grossgauntlet/now`)

This page already works. These are refinements only:

### Header
```
GROSS GAUNTLET                    ← TagPill, uppercase
Day {N}  ·  {title if set}        ← h1
{date formatted}                  ← --white-45

[● LIVE]  or  [Last session: {date}]  ← conditional on isStreaming
```

### Between-stream state
When `isStreaming === false`:
```jsx
<p className={styles.offlineNotice}>
  Stream offline — board is editable, changes save automatically
</p>
```
Color: `--white-35`. Small. Does not block anything.

### Run button (when locked)
Use exact site button pattern:
```css
font-size: 0.875rem;
letter-spacing: 0.08em;
text-transform: uppercase;
border: 1px solid rgba(255,255,255,0.25);
border-radius: 0;
padding: 14px 36px;
```

### Sync indicator
When a board action fires and the API write is in flight:
Small dot in top-right of board area: `●  Saving…` — `--white-25`, disappears on success.
On error: `● Sync failed` — `#E74C3C`, stays visible until next successful write.

---

## New Shared Component — `SessionCard.jsx`

Extract the day card into a shared component since it's used in both `GrossGauntletHome` and `SessionSelector`:

**File:** `src/components/GrossGauntlet/SessionCard.jsx`

```jsx
// Props:
// dayNumber    {number}
// title        {string}
// date         {string}  "2026-08-15"
// todaySeconds {number}
// taskCounts   { todo, up_next, in_progress, in_review, done }
// isStreaming  {boolean}
// streamUrl    {string|null}
// onClick      {fn}
// sessionCount {number}  — if > 1, shows multi-session pill

export default function SessionCard({ dayNumber, title, date, todaySeconds, taskCounts, isStreaming, streamUrl, onClick, sessionCount }) { ... }
```

---

## CSS — What Goes Where

**Do not create new CSS files for each page.** Add all GrossGauntlet page styles to the existing `GrossGauntletPages.css`.

Sections to add:
```css
/* ── Shared glass card (copy from Welcome.module.css) ── */
/* ── GrossGauntletHome ── */
/* ── SessionCard ── */
/* ── GrossGauntletDay / SessionSelector ── */
/* ── GrossGauntletSession ── */
/* ── GrossGauntletNow refinements ── */
```

---

## API Changes Needed

### `api/grossgauntlet/days.js` — add taskCounts

The homepage needs task completion counts per session. The API must query `Logs` to derive them.

For each session, run:
```javascript
const logs = await supabase
  .from('Logs')
  .select('task_id, event_type, to_column')
  .eq('session_date', session.date)
  .eq('session_number', session.session_number);

// Derive final column per task_id by folding logs
const taskFinalColumn = {};
for (const log of logs) {
  if (log.event_type === 'create') taskFinalColumn[log.task_id] = log.to_column;
  if (log.event_type === 'move')   taskFinalColumn[log.task_id] = log.to_column;
  if (log.event_type === 'delete') delete taskFinalColumn[log.task_id];
}
const taskCounts = { todo: 0, up_next: 0, in_progress: 0, in_review: 0, done: 0 };
for (const col of Object.values(taskFinalColumn)) {
  if (taskCounts[col] !== undefined) taskCounts[col]++;
}
```

Include `taskCounts` and `dayNumber` in the response. `dayNumber = (new Date(date) - new Date('2026-08-15')) / 86400000 + 1`.

---

## Build Order

Execute in this exact order. Confirm each step builds before moving to the next.

1. **API: add `taskCounts` and `dayNumber` to `days.js` response** — frontend depends on this
2. **`SessionCard.jsx`** — the shared card component, used by home + selector
3. **`GrossGauntletHome.jsx`** — grid of SessionCards, empty state, mount animation
4. **`GrossGauntletDay.jsx`** — route logic, single-session passthrough, SessionSelector
5. **`GrossGauntletSession.jsx`** — full session view: YouTube, timestamps, board, stats, replay button
6. **`GrossGauntletNow.jsx` refinements** — header, offline notice, sync indicator, button style fix
7. **CSS additions to `GrossGauntletPages.css`** — all new styles in one file
8. **Build verify** — `npm run build` zero errors
9. **Manual test** — hit each route, confirm data loads, confirm animations fire, confirm board is read-only on session pages

---

## What Not To Do

- Do not install any new UI library or component kit
- Do not use CSS `animation:` keyframes for entrance — use GSAP
- Do not create new border-radius conventions — use `16px` (cards) or `0` (buttons/pills)
- Do not add new font families — Space Grotesk only
- Do not hardcode colors — use `--white-*` tokens and status color variables
- Do not create new card styles — use the glass card pattern verbatim
- Do not use `<TagPill onClick={...}>` for navigation — wrap the whole card in a button or anchor instead

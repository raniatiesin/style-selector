# GrossGauntlet — Final Refinement Plan
### URL fix, kanban recraft, inline replay, stats panel, notes, back button
> Read `GrossGauntlet-Database-Reference.md` and `GrossGauntlet-Master-Spec-v2.md` before starting.
> One step. One commit. Verify before moving on. Never touch locked files.

---

## LOCKED FILES — DO NOT TOUCH

```
api/stream/state.js
api/stream/metrics.js        ← EXCEPT Step 1b, surgical only
api/stream/webhook.js
src/App.jsx                  ← EXCEPT removing /replay route if present
src/components/GrossGauntlet/GrossGauntletApp.jsx
src/components/GrossGauntlet/GrossGauntletApp.css
src/components/GrossGauntlet/GrossGauntletControl.jsx
src/styles/global.css
```

---

## Database Changes (already applied)

Both columns now exist on `Sessions`:
- `day_number` integer — challenge day (Day 1 = Aug 16 2026)
- `notes` text — free-form session notes, autosaved

Every API that reads or writes a session must include these two fields.

---

## Step 1 — Fix URL Structure (one commit)

### The correct URL pattern
```
/grossgauntlet/:dayNumber/:sessionNumber

Examples:
/grossgauntlet/1/1    → Day 1, Session 1
/grossgauntlet/7/2    → Day 7, Session 2
/grossgauntlet/now    → Current live board
/grossgauntlet        → Homepage archive grid
```

The date is never in the URL. Day number is always the challenge day count from Aug 16 2026.

### How the API resolves day_number → DB row

Since the DB primary key is `(date, session_number)` but URLs use `day_number`, every API endpoint that accepts `:dayNumber` must first resolve it:

```javascript
// Helper used in every endpoint
async function resolveSession(supabase, dayNumber, sessionNumber) {
  const { data } = await supabase
    .from('Sessions')
    .select('*')
    .eq('day_number', dayNumber)
    .eq('session_number', sessionNumber)
    .single();
  return data;
}
```

### Files to update

**`GrossGauntletRouter.jsx` — update route params:**
```jsx
<Route path="/grossgauntlet"                                element={<GrossGauntletHome />} />
<Route path="/grossgauntlet/now"                            element={<GrossGauntletNow />} />
<Route path="/grossgauntlet/:dayNumber"                     element={<GrossGauntletDay />} />
<Route path="/grossgauntlet/:dayNumber/:sessionNumber"      element={<GrossGauntletSession />} />
```

Remove the `/replay` route entirely — replay is now inline on the session page.

**`GrossGauntletHome.jsx` — fix navigation on card click:**
```javascript
// When clicking a day card, navigate to:
navigate(`/grossgauntlet/${dayNumber}`);          // if multiple sessions
navigate(`/grossgauntlet/${dayNumber}/1`);        // if single session
```

**`GrossGauntletDay.jsx` — fix params and navigation:**
```javascript
const { dayNumber } = useParams();
// Fetch: GET /api/grossgauntlet/days/${dayNumber}
// Navigate to: /grossgauntlet/${dayNumber}/${sessionNumber}
```

**`GrossGauntletSession.jsx` — fix params:**
```javascript
const { dayNumber, sessionNumber } = useParams();
// Fetch: GET /api/grossgauntlet/days/${dayNumber}/${sessionNumber}
```

**API endpoints — update to accept dayNumber:**

`api/grossgauntlet/days/[dayNumber]/index.js`:
- Receives `dayNumber` as param
- Queries: `SELECT * FROM Sessions WHERE day_number = $dayNumber ORDER BY session_number ASC`
- Returns all sessions for that day with `taskCounts` derived from Logs

`api/grossgauntlet/days/[dayNumber]/[sessionNumber].js`:
- Receives `dayNumber` + `sessionNumber`
- Queries: `SELECT * FROM Sessions WHERE day_number = $dayNumber AND session_number = $sessionNumber`
- Returns session row + folded board from Logs + full events array (for inline replay)

`api/grossgauntlet/days/[dayNumber]/[sessionNumber]/events.js`:
- Queries Logs by resolving dayNumber → date first, then fetching events
- Returns `{ events: [...] }` ordered by `occurred_at ASC`

`api/grossgauntlet/days.js` (homepage):
- Already returns `day_number` — confirm it's using the DB column not computing it

Commit: `"fix: URL structure to dayNumber/sessionNumber pattern"`
Verify: clicking a day card navigates to `/grossgauntlet/1/1` not `/grossgauntlet/2026-08-16/1`

---

## Step 2 — Add notes to API (one commit)

**`api/stream/metrics.js` — surgical addition only:**

In the upsert block, add `notes` handling:
```javascript
if (body.notes !== undefined) {
  updateFields.notes = body.notes;
}
```

**`api/grossgauntlet/days/[dayNumber]/[sessionNumber].js`:**

Include `notes` in the session response:
```javascript
// Already returning full session row — confirm notes is included
// If SELECT * is used, it's already there. No change needed.
```

Add a new endpoint for autosave:
`api/grossgauntlet/notes.js` — `POST`:
```javascript
// Body: { dayNumber, sessionNumber, notes }
// Resolves dayNumber to date, updates Sessions.notes
// Auth: Bearer WEBHOOK_SECRET (same as metrics)
// Returns: { success: true }
```

Commit: `"feat: notes autosave endpoint"`

---

## Step 3 — Recraft Session Page (one commit)

This is the most important step. The session page is being rebuilt from scratch visually. The data fetching logic stays — only the layout and styling changes.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                              DAY 1  ·  SESSION 1        │
│                                      Aug 16 2026                 │
├──────────────────────────────────────────────┬──────────────────┤
│                                              │  STATS      [−]  │
│  [REPLAY SCRUBBER — full width]              │  ──────────────  │
│  ▶  1× 2× 5× 10×                            │  4h 22m today    │
│  ◀────────────────────────────●──▶  04:22   │  12h 08m total   │
│                                              │  1h 14m / break  │
│                                              │                  │
│  [KANBAN BOARD]                              │  7 / 12 done     │
│                                              │  5 content       │
│  [grayed when break/standby]                 │  3 sales         │
│                                              │                  │
│                                              │  NOTES           │
│                                              │  ──────────────  │
│                                              │  [text area]     │
│                                              │                  │
│                                              │  TIMESTAMPS      │
│                                              │  ──────────────  │
│                                              │  00:07 - work    │
│                                              │  38:20 - break   │
│                                              │  ...             │
└──────────────────────────────────────────────┴──────────────────┘
```

Left column: ~68% width — replay scrubber + kanban board
Right column: ~32% width — collapsible stats panel

### Back button

```javascript
const { dayNumber, sessionNumber } = useParams();

// Fetch total sessions for this day
// If totalSessions > 1 → back goes to /grossgauntlet/${dayNumber}
// If totalSessions === 1 → back goes to /grossgauntlet
const backPath = totalSessions > 1
  ? `/grossgauntlet/${dayNumber}`
  : `/grossgauntlet`;
```

Render:
```jsx
<Link to={backPath} className={styles.back}>← Back</Link>
```

Style — matches site button language:
```css
.back {
  font-family: var(--font);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  text-decoration: none;
  transition: color 0.18s ease;
}
.back:hover { color: rgba(255, 255, 255, 0.82); }
```

### Inline replay scrubber

The scrubber lives at the top of the left column, above the board. It is always visible — no button to reveal it. Slider defaults to 100% (final state).

```jsx
const [sliderValue, setSliderValue] = useState(100);
const [isPlaying, setIsPlaying] = useState(false);
const [speed, setSpeed] = useState(1);

// Board state derived from slider position
const currentTime = new Date(startTime + (sliderValue / 100) * totalMs);
const board = replayToTime(events, currentTime);
```

Scrubber bar styling — clean, minimal:
```css
.scrubberWrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  margin-bottom: var(--space-20);
  padding: var(--space-16) var(--space-20);
  background: rgba(10, 10, 10, 0.62);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.scrubberControls {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.playBtn {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.82);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.18s ease;
  flex-shrink: 0;
}
.playBtn:hover { border-color: rgba(255, 255, 255, 0.45); }

.speeds { display: flex; gap: var(--space-4); }

.speedBtn {
  font-family: var(--font);
  font-size: 0.68rem;
  letter-spacing: 0.10em;
  color: rgba(255, 255, 255, 0.30);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  padding: 4px 8px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.speedBtn:hover { color: rgba(255, 255, 255, 0.60); }
.speedActive {
  color: rgba(255, 255, 255, 0.92) !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
}

.scrubberRow {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.scrubber {
  flex: 1;
  height: 2px;
  accent-color: rgba(255, 255, 255, 0.70);
  cursor: pointer;
}

.time {
  font-family: var(--font);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  min-width: 80px;
  text-align: right;
}
```

### Board state during break/standby

When replaying through a break or standby moment, gray out the board:

```javascript
// Determine the mode at the current replay time
function getModeAtTime(session, currentTime) {
  // Parse timestamps log to find the mode at currentTime
  // timestamps format: "HH:MM - mode - description"
  // session_start_timestamp gives us the wall clock reference
  // Return: 'work' | 'break' | 'standby' | 'explain'
}

const modeAtTime = getModeAtTime(session, currentTime);
const isInactive = ['break', 'standby', 'explain'].includes(modeAtTime);
```

```jsx
<div className={`${styles.boardWrap} ${isInactive ? styles.boardInactive : ''}`}>
  <KanbanBoard initialBoard={board} editable={false} />
</div>
```

```css
.boardWrap {
  transition: opacity 0.4s ease, filter 0.4s ease;
}
.boardInactive {
  opacity: 0.35;
  filter: grayscale(0.8);
  pointer-events: none;
}
```

Show a mode indicator when inactive:
```jsx
{isInactive && (
  <div className={styles.modeIndicator}>
    {modeAtTime === 'break' ? '☕ Break' : modeAtTime === 'standby' ? '⏳ Standby' : '💬 Explain'}
  </div>
)}
```

```css
.modeIndicator {
  font-family: var(--font);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  padding: var(--space-8) 0;
}
```

### Right panel — collapsible stats

```jsx
const [statsOpen, setStatsOpen] = useState(true);

<div className={styles.rightPanel}>
  <div className={styles.panelHeader} onClick={() => setStatsOpen(p => !p)}>
    <span className={styles.panelLabel}>STATS</span>
    <span className={styles.panelToggle}>{statsOpen ? '−' : '+'}</span>
  </div>

  <div className={`${styles.panelBody} ${!statsOpen ? styles.panelClosed : ''}`}>

    {/* Time stats */}
    <div className={styles.statGroup}>
      <div className={styles.stat}>
        <span className={styles.statVal}>{formatHMS(session.today_seconds)}</span>
        <span className={styles.statLabel}>today</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statVal}>{formatHMS(totalAccumulatedSeconds)}</span>
        <span className={styles.statLabel}>total</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statVal}>{formatHMS(secondsSinceBreak)}</span>
        <span className={styles.statLabel}>since break</span>
      </div>
    </div>

    <div className={styles.divider} />

    {/* Task stats */}
    <div className={styles.statGroup}>
      <div className={styles.stat}>
        <span className={styles.statVal}>{doneTasks}/{totalTasks}</span>
        <span className={styles.statLabel}>done</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statVal}>{session.content_count}</span>
        <span className={styles.statLabel}>content</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statVal}>{session.sales_count}</span>
        <span className={styles.statLabel}>sales</span>
      </div>
    </div>

    <div className={styles.divider} />

    {/* Notes */}
    <p className={styles.panelSectionLabel}>NOTES</p>
    <textarea
      className={styles.notes}
      value={notes}
      onChange={e => handleNotesChange(e.target.value)}
      placeholder="Stream notes..."
    />

    <div className={styles.divider} />

    {/* Timestamps */}
    <p className={styles.panelSectionLabel}>TIMESTAMPS</p>
    <pre className={styles.timestamps}>{session.timestamps}</pre>

    {/* YouTube */}
    {session.stream_url && (
      <>
        <div className={styles.divider} />
        <a
          href={session.stream_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.watchLink}
        >
          ▶ Watch on YouTube
        </a>
      </>
    )}

  </div>
</div>
```

**Notes autosave handler:**
```javascript
const notesTimerRef = useRef(null);
const [notes, setNotes] = useState(session?.notes ?? '');

function handleNotesChange(value) {
  setNotes(value);
  if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
  notesTimerRef.current = setTimeout(async () => {
    await fetch('/api/grossgauntlet/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayNumber: Number(dayNumber),
        sessionNumber: Number(sessionNumber),
        notes: value
      })
    });
  }, 800);
}
```

**Panel CSS:**
```css
.rightPanel {
  width: 300px;
  flex-shrink: 0;
  background: rgba(10, 10, 10, 0.62);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  align-self: flex-start;
  position: sticky;
  top: var(--space-24);
}

.panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-16) var(--space-20);
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.15s ease;
}
.panelHeader:hover { background: rgba(255, 255, 255, 0.03); }

.panelLabel {
  font-family: var(--font);
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.40);
}

.panelToggle {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.25);
  line-height: 1;
}

.panelBody {
  padding: var(--space-20);
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  max-height: 80vh;
  overflow-y: auto;
  scrollbar-width: thin;
  transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
}

.panelClosed {
  max-height: 0 !important;
  opacity: 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  overflow: hidden;
}

.statGroup {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.statVal {
  font-family: var(--font);
  font-size: 0.92rem;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 500;
}

.statLabel {
  font-family: var(--font);
  font-size: 0.68rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.30);
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0;
}

.panelSectionLabel {
  font-family: var(--font);
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.30);
  margin: 0 0 var(--space-8) 0;
}

.notes {
  width: 100%;
  min-height: 100px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.70);
  font-family: var(--font);
  font-size: 0.78rem;
  line-height: 1.6;
  padding: var(--space-8) var(--space-12);
  resize: vertical;
  outline: none;
  transition: border-color 0.18s ease;
  box-sizing: border-box;
}
.notes:focus { border-color: rgba(255, 255, 255, 0.20); }
.notes::placeholder { color: rgba(255, 255, 255, 0.20); }

.timestamps {
  font-family: var(--font);
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.40);
  line-height: 1.8;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  scrollbar-width: thin;
  margin: 0;
}

.watchLink {
  font-family: var(--font);
  font-size: 0.72rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  text-decoration: none;
  transition: color 0.18s ease;
}
.watchLink:hover { color: rgba(255, 255, 255, 0.70); }
```

### Kanban board restyle

The board needs to feel like it belongs on tiesin.me. The core issues: columns feel heavy, cards feel generic, spacing is wrong, typography doesn't match.

**KanbanColumn.module.css — key fixes:**
- Column background: `rgba(255, 255, 255, 0.03)` — barely visible, almost transparent
- Border: `1px solid rgba(255, 255, 255, 0.06)` — very subtle
- Border-radius: `12px`
- No backdrop-filter on columns — only on cards
- Header label: `0.65rem`, `letter-spacing: 0.16em`, `rgba(255,255,255,0.30)`
- Count badge: no border, no background — just `rgba(255,255,255,0.20)` text

**KanbanCard.module.css — key fixes:**
- Card background: `rgba(255, 255, 255, 0.05)`
- Backdrop-filter: `blur(8px)` — subtle glass
- Border: `1px solid rgba(255, 255, 255, 0.07)`
- Border-radius: `8px`
- Font-size: `0.80rem`
- Color: `rgba(255, 255, 255, 0.75)`
- No box-shadow at rest — only on drag
- Status dot: `5px` diameter
- Drag handle: only visible on hover, `rgba(255,255,255,0.15)`
- Delete button: only visible on hover

**Status dot colors (exact):**
```javascript
const STATUS_COLORS = {
  todo:        'rgba(255,255,255,0.20)',   // gray — very subtle for To-Do
  up_next:     '#8A4FFF',
  in_progress: '#2ECC71',
  in_review:   '#F0A500',
  done:        '#E74C3C',
};
```

Commit: `"feat: recraft session page — inline replay, stats panel, notes, back button, kanban restyle"`

---

## Step 4 — Delete ReplayScrubber page + redirect (one commit)

The `/grossgauntlet/:dayNumber/:sessionNumber/replay` route no longer needs its own page — replay is inline on the session page.

- Remove the route from `GrossGauntletRouter.jsx`
- Delete `ReplayScrubber.jsx` and `ReplayScrubber.module.css`
- Any link that pointed to `/replay` is already removed (the "Replay This Session" button was deleted in the previous finishing plan)

Commit: `"cleanup: remove standalone replay page"`

---

## Step 5 — Verify everything (no commit)

Check in browser:

- [ ] `/grossgauntlet` — day cards navigate to `/grossgauntlet/1` not `/grossgauntlet/2026-08-16`
- [ ] `/grossgauntlet/1/1` — session page loads correctly
- [ ] Scrubber starts at 100% (final board state)
- [ ] Scrubbing left replays card movements
- [ ] Board grays out during break/standby moments
- [ ] Back button goes to `/grossgauntlet` (single session) or `/grossgauntlet/1` (multiple)
- [ ] Stats panel shows correct data
- [ ] Stats panel collapses/expands smoothly
- [ ] Notes textarea autosaves (check Supabase Sessions table after typing)
- [ ] YouTube link shows if `stream_url` is set
- [ ] `/grossgauntlet/now` still works
- [ ] OBS overlays still work

---

## What the agent must NOT do

- Do not touch `GrossGauntletApp.jsx`, `GrossGauntletApp.css`, or any overlay component
- Do not touch `api/stream/state.js` or `api/stream/webhook.js`
- Do not redesign `GrossGauntletHome.jsx` or `GrossGauntletNow.jsx`
- Do not install new libraries
- Do not add new CSS files — all new styles go in `GrossGauntletPages.css` or the kanban CSS modules
- Do not use CSS keyframe animations for the panel collapse — use `max-height` transition
- Do not use `sessionStorage` or `localStorage` for notes — autosave to API only

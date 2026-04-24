# TIESIN AXIOMATIC BLUEPRINT
### v3.0 — Final Architecture Specification
*Last updated: April 7, 2026*

---

> **How to read this document.**
> Every section is a decision, not a suggestion. If it's written here, it's locked. If something here conflicts with the v2.0 draft, this version wins. All v2.0 comments have been resolved and incorporated.

---

## 1. THEME & VISUAL SYSTEM

### 1.1 Base Theme
**Iridium** — installed via Obsidian Community Themes. No modifications to core theme files.

One CSS snippet file only: `.obsidian/snippets/tiesin-overrides.css`
Used exclusively for minor overrides: font swap (IBM Plex Sans / IBM Plex Mono if desired), border color tuning, and removing UI chrome that Iridium doesn't hide by default. If Iridium already handles it natively — don't touch it.

### 1.2 Component Visual Language — Twenty CRM

> ⚠️ **CRITICAL IMPLEMENTATION NOTE**
>
> Twenty CRM (`twenty.com`) is a full-stack open-source CRM built with React, TypeScript, NestJS, and PostgreSQL. **Its npm packages and component library cannot be imported into Datacore.** Datacore runs Preact in a sandboxed codeblock environment — there is no webpack, no npm resolution, no build chain available at render time.
>
> **What "using Twenty" means in this vault:**
> The visual language, layout patterns, and component design of Twenty CRM are the **reference and inspiration** for all Datacore JSX components. Every component written for this vault should look and feel like it belongs inside Twenty's interface: its table rows, kanban cards, chip-style status badges, sidebar navigation, record detail panels, and KPI stat blocks. This is achieved through inline styles and CSS variables in each `datacorejsx` codeblock — not through external imports.
>
> **In practice:** Open `twenty.com`, observe a component. Replicate its structure and visual weight using Preact JSX + inline styles. That is the workflow.

The following Twenty UI patterns are the direct references:

| Pattern | Where It's Used in Tiesin |
|---|---|
| Table row with avatar, name, status chip | `PipelineTable` view |
| Kanban column with draggable cards | `TaskKanban` view |
| 2×2 priority grid | `TaskMatrix` view |
| KPI stat blocks (number + label + delta) | `ProspectKPIs` view |
| Card grid with cover image + title | `ExcalidrawGrid` view |
| Activity feed / note list | `PlaybookNotesFeed` view |

---

## 2. VAULT STRUCTURE

```
/
├── HOME.md
│
├── 0 — Peripherals/
│   ├── 1 — Data/
│   │   ├── prospects.csv
│   │   └── prospects_inbox.csv
│   ├── 2 — Automations/
│   │   └── [n8n workflow .json files]
│   ├── 3 — Workflows/
│   │   └── [ComfyUI workflow .json files]
│   ├── 4 — Views/
│   │   ├── TaskMatrix.md
│   │   ├── TaskKanban.md
│   │   ├── ProspectKPIs.md
│   │   ├── PipelineTable.md
│   │   ├── ExcalidrawGrid.md
│   │   └── PlaybookNotesFeed.md
│   └── 5 — Assets/
│       ├── 0 — Templates/
│       ├── 1 — Recordings/
│       ├── 2 — Images/
│       ├── 3 — Videos/
│       ├── 4 — Documents/
│       ├── 5 — Sketches/
│       ├── 6 — Graphs/
│       └── 7 — Others/
│
├── 1 — Playbook/
│   ├── ICP.md
│   ├── Offer.md
│   ├── Platform Mechanics.md
│   └── [Playbook Notes — .md files created here on demand]
│
├── 2 — Prospecting/
│   └── Pipeline.md
│
├── 3 — Production/
│   └── [Reserved — empty until first paying client]
│
└── 4 — Progression/
    ├── YYYY-MM-DD.md  [Templater-generated daily files]
    └── Whiteboards/
        └── [*.excalidraw.md files]
```

### Folder Rules

- `0 — Peripherals` is never interacted with manually, except to drop files into `2 — Automations/` or `3 — Workflows/`.
- `5 — Assets/` holds media only. Templater `.md` scripts live in `4 — Views/` alongside view components — they are code, not media.
- `1 — Playbook/` holds constants. If a note changes week to week, it's not a Playbook Note.
- `4 — Progression/Whiteboards/` is the only location for `.excalidraw.md` files. No exceptions.
- `3 — Production/` is a placeholder. Do not add structure to it until it is needed.

---

## 3. THE MODULAR VIEW SYSTEM

This is the architectural spine of the vault.

### Core Principle

Each file in `0 — Peripherals/4 — Views/` contains one or more named `datacorejsx` codeblock sections. Every consumer — `HOME.md`, `Pipeline.md`, daily files in `4 — Progression/` — imports these components using `dc.require(dc.headerLink(...))`. One component definition. Zero duplication. One change propagates everywhere.

```javascript
// Consumer syntax (used inside any .md file that needs a view)
const { PipelineTable } = await dc.require(
  dc.headerLink("0 — Peripherals/4 — Views/PipelineTable.md", "PipelineTable")
);
```

### ⚠️ Immutability Rule

The filenames inside `0 — Peripherals/4 — Views/` are **permanent once set**. Every `dc.require` call across the vault is a hard-coded path reference. Renaming a view file breaks every file that imports it. Name them correctly the first time. Never rename them.

---

## 4. VIEW SPECIFICATIONS

### 4.1 `TaskMatrix.md` & `TaskKanban.md` — Two Views, One Task Object

Tasks are a single object type. They have two display properties, rendering into two separate view files.

**Task syntax (written anywhere in the vault):**
```
- [ ] #task [status:: Critical] [stage:: In Progress] Description of task here
```

**`status` property — Eisenhower Matrix values:**

| Status Value | Urgency | Importance | Meaning |
|---|---|---|---|
| `Critical` | Urgent | Important | Do it today. Non-negotiable. |
| `Strategic` | Not Urgent | Important | Schedule it. Don't lose it. |
| `Overhead` | Urgent | Not Important | Automate or delegate. |
| `Void` | Not Urgent | Not Important | Eliminate it. |

**`stage` property — Kanban values:**
`Waiting` → `Up Next` → `In Progress` → `In Review` → `Done`

`TaskMatrix.md` renders tasks into a 2×2 grid by `status`, styled after Twenty's priority grid. Checkbox clicks write the completed state back to the source file via `dc.app.vault.modify()` — no need to navigate to the origin file to check a task off.

`TaskKanban.md` renders the same tasks as columns by `stage`, styled after Twenty's kanban board with draggable card patterns.

---

### 4.2 `ProspectKPIs.md`

Queries `0 — Peripherals/1 — Data/prospects.csv` and renders KPI stat blocks styled after Twenty's metric cards.

Output: `Sent` count · `Replied` count · `Qualified` count · Reply rate %

---

### 4.3 `PipelineTable.md`

The CRM table. Reads `prospects.csv`. Accepts two optional filter parameters passed at import time: `status` (filter by prospect status) and `limit` (row count cap).

Styled after Twenty's record table: rows with name, platform link, subscriber count, status chip, score, and an action button column. Status changes (clicking a chip) mutate the corresponding CSV row via `dc.app.vault` file write.

**Pagination:** Renders 50 rows maximum per session. No full-CSV DOM render ever.

---

### 4.4 `ExcalidrawGrid.md`

Queries `4 — Progression/Whiteboards/` for `.excalidraw.md` files. Accepts an optional `date` filter.

Renders a card grid styled after Twenty's object card layout: PNG preview (auto-exported by Excalidraw's "Auto-export PNG" setting — this **must** be enabled) as cover image, filename as title. Click opens the file in the Excalidraw pane.

> **Prerequisite:** Enable Excalidraw plugin setting: `Auto-export SVG/PNG → PNG`. Without this, card covers will be blank.

---

### 4.5 `PlaybookNotesFeed.md`

Queries `1 — Playbook/` for files tagged `type: playbook-note`. Accepts an optional `date` filter and `limit`.

Renders as a feed of note cards: title, creation date, first 2 lines of content as preview. Styled after Twenty's activity feed component.

---

## 5. FILE SPECIFICATIONS

### 5.1 `HOME.md` — The Dashboard

Read-only. Never written to manually. Imports and renders:

| Module | View Used | Config |
|---|---|---|
| KPI Block | `ProspectKPIs` | no filter |
| Task Matrix | `TaskMatrix` | no filter |
| Task Board | `TaskKanban` | no filter |
| Pipeline Snapshot | `PipelineTable` | `status: "Qualified"`, `limit: 5` |
| Playbook Feed | `PlaybookNotesFeed` | `limit: 3` |

---

### 5.2 `2 — Prospecting/Pipeline.md` — The Full CRM

The command center for all prospecting activity. One file. Contains:

- `ProspectKPIs` (no filter)
- `PipelineTable` (no filter, paginated 50)
- **Refresh button** → fires HTTP GET to n8n webhook → n8n scrapes and writes new rows to `prospects_inbox.csv`
- **Merge button** → merges `prospects_inbox.csv` into `prospects.csv` on demand (prevents live-write collision)
- **Sync button** → fires HTTP POST to n8n with current CSV state for any downstream processing

---

### 5.3 `4 — Progression/YYYY-MM-DD.md` — The Daily File

Generated each morning by Templater. Structure:

```
---
date: YYYY-MM-DD
---

## Morning Capture
[blank — free write, brain dump]

## Daily Target
[one line: what does winning today look like]

---
[TaskMatrix view — no date filter, full vault]
[TaskKanban view — no date filter, full vault]
---

## Today's Outreach
[PipelineTable — status: "Crawled", limit: 50]
[Sync button — POST to n8n with session results]

---
## Notes Created Today
[PlaybookNotesFeed — date: today]

## Sketches Today
[ExcalidrawGrid — date: today]

---
## End of Day
[blank — what broke, what succeeded]
```

The daily file is a **date-filtered window** into shared data. There is no structural duplication. No data is stored inside the daily file itself — it only renders views.

---

### 5.4 `1 — Playbook/` Notes

**Playbook Notes** are concept-level captures: ICP refinements, framework insights, pattern observations, lessons from outreach. They are not date-bound. They reference concepts, not calendar days.

Frontmatter standard:
```yaml
---
id: 202604071530
title: "Why Operator-to-Operator Writers Fail the ICP Filter"
type: playbook-note
tags: [icp, filter, mechanics]
---
```

Rule: A daily file is *"I noticed something today."* A Playbook Note is *"Here is how that thing works."* The Playbook Note never references the date. It references the concept.

---

## 6. DATA FLOW

```
n8n (cron or manual trigger)
    ↓
Apify scraper crawls target Substack authors
    ↓
n8n parses raw JSON → applies 6-factor scoring
    ↓
Writes rows to: prospects_inbox.csv
    ↓
[You click Merge in Pipeline.md]
    ↓
prospects_inbox.csv merges into prospects.csv
    ↓
PipelineTable view reads updated prospects.csv
    ↓
Daily file renders today's 50 "Crawled" prospects
    ↓
You work through them, click status chips to update rows
    ↓
Datacore writes state changes back to prospects.csv
    ↓
[End of session: click Sync]
    ↓
HTTP POST to n8n → downstream processing
```

**Why the two-file CSV approach:** n8n writes to `prospects_inbox.csv`. You control when that data enters `prospects.csv` via the Merge button. This eliminates the concurrency collision where n8n writes and Datacore writes to the same file simultaneously, causing corruption or data loss.

---

## 7. THREAT ANALYSIS

### Threat 1 — CSV Concurrency ✅ RESOLVED
Two-file system (inbox + master) with manual merge. n8n never touches `prospects.csv` directly.

### Threat 2 — Datacore JSX Scope Limits
Each `dc.require`'d component manages its own internal state. You cannot share React state between two imported components on the same page. This is fine for this vault's use case — all views are independent. Do not attempt to build cross-component interactions (e.g., clicking a task in `TaskMatrix` to update `TaskKanban` on the same page). If you need that, it goes into a single unified view file, not two separate imports.

### Threat 3 — Broken `dc.require` Paths
View filenames in `0 — Peripherals/4 — Views/` are permanent. A rename breaks every consumer silently — no error thrown, the view just stops rendering. Treat this folder as immutable after initial setup.

### Threat 4 — Missing `#task` Tag
The `TaskMatrix` query sweeps the entire vault for `#task`. If you write a task without the tag, it disappears from all dashboards. The discipline is simple: no `#task` tag = not a real task. Build the habit or the system is blind.

### Threat 5 — Excalidraw PNG Export Not Enabled
`ExcalidrawGrid` requires auto-exported PNG files to render card previews. If the Excalidraw plugin setting is not enabled, the grid renders with blank cards. Check this setting before building the view.

### Threat 6 — Daily File Template Bloat
If the Templater template for daily files renders with too many sections, you won't use it. The template must render clean and minimal — only the matrix, the board, and a body. If it looks like a form, the design has failed. The template is a servant, not a structure.

---

## 8. WHAT IS NOT YET DEFINED

**The 6-factor prospect scoring criteria** — this determines how n8n scores and filters prospects before writing them to the inbox CSV. It also determines what columns exist in `prospects.csv` and therefore what `PipelineTable` renders per row. This must be defined before any JSX is written for `PipelineTable`.

No other architectural gaps remain.

---

*Tiesin Blueprint v3.0 — Built from conversations on February 28, March 18, and April 7, 2026.*

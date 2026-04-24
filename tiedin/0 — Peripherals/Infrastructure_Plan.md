# Tiesin Infrastructure Plan

**Goal:** Build a fully local, high-performance project management hub in Obsidian powered by Datacore, mimicking the exact layout, structure, and aesthetic of `un.ms/research`.

## Core Concept
1. **Mimic `un.ms/research`:** The UI must feel like a dedicated desktop application. Minimalist, focused, zero friction. We'll use Datacore React components to build app-like views (sidebars, grids, reading panes).
2. **Merge BRAIN + OPERATION:** We are dropping the separation of "Thinking" and "Doing". Everything lives in a unified **Workspace**. Journaling, planning, writing, and tracking will happen in one fluid environment.
3. **Technical Assets Hub:** We need dedicated robust storage for `n8n` workflows, exported automations, and `Generative AI` prompts.
4. **CRM-First Start:** The first major functional build is the Prospect Pipeline. It must handle thousands of prospects seamlessly without slowing down Obsidian.
5. **Automations Later:** Webhooks and actual n8n triggers will exist, but we will focus on UI and structure first.

## Proposed Vault Structure

- **`00_DASHBOARD/`** 
  - `HOME.md` (The main application entry point, rendering the React layout)
- **`01_WORKSPACE/`** (The unified Brain + Operation)
  - Daily Journals, Task Lists, Scratchpads, and Deep Work/Writing.
- **`02_CRM/`**
  - Prospect Pipeline (High performance Datacore Grid)
  - Outreach Tracking
- **`03_SYSTEM_ASSETS/`**
  - `n8n_Automations/`
  - `AI_Workflows/`
- **`04_DELIVERING/`**
  - *(Under Construction)*
- **`_RESOURCES/`**
  - Datacore JSX components (React), CSS snippets, Icons, and System Dependencies.
- **`_ARCHIVE_OLD/`**
  - Your current `0` through `4` folders will be backed up here safely.

## Phase 1 Actions
1. Backup your existing folders into an Archive folder.
2. Setup the root application wrapper representing the sleek UI.
3. Integrate the Prospect Pipeline as the first tab in our Application.
4. Create the Daily unified pipeline (tasks + journaling).

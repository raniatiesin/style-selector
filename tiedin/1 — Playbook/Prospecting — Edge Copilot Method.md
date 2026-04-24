---
date: 2026-03-21
updated: 2026-03-24
tags: [tiesin, prospecting, tools]
---

# Prospecting — Edge Copilot Method

**Related:** [[Prospecting]] · [[ICP and Niche]]

---

## THE BASE PROMPT

*Always include this. Every session starts here.*

```markdown
I'm prospecting for newsletter writers on Substack. Read all open pages. For each writer you find, evaluate them against these six filters and give me a table with a score.
BEFORE scoring anyone: I am providing you with a CSV file of writers I have already contacted or reviewed. Cross-reference every writer you find against the "title" column in that CSV. If a writer's name matches any entry in the CSV, mark their entire row with ⛔ ALREADY CONTACTED — SKIP and do not score them. The match does not need to be exact — use your judgment for name variations (e.g. "John Brewton" vs "John Brewton "). Do not omit them from the table; just flag them visibly so I can see who to skip at a glance.
The six filters:
1. Subscriber count — 🟢 Thousands of paid (1K–9.9K) | 🟡 Hundreds of paid | 🟠 Tens of thousands | 🔴 No paid tier / unknown
2. Content structure — 🟢 Frameworks, numbers, steps | 🟡 Mix of structured + narrative | 🟠 Mostly narrative / reflective | 🔴 Personal diary / emotional
3. Audience — 🟢 Aspirational, teachable, mechanics-first | 🟡 Mixed — some aspirational, some peer | 🟠 Peer-to-peer with aspirational moments | 🔴 Peer-to-peer operator content
4. Niche — 🟢 Business mechanics / founder story | 🟡 Adjacent — ops, leadership, product | 🟠 Semi-adjacent — sales, strategy | 🔴 Marketing / AI / self-help / finance / HR / coaching / crypto / personal brand
5. Video presence — 🟢 Zero, confirmed nowhere | 🟡 Inactive — old posts, no recent content | 🟠 LinkedIn video only | 🔴 Active on TikTok / Reels / Shorts
6. Strong idea in last 3 posts — 🟢 Clear hook, specific lesson | 🟡 One strong post out of three | 🟠 Vague, hard to visualize | 🔴 Abstract, emotional, or theoretical
Score each writer 0–100% based on how well they satisfy all six filters. Use the color scale: 🔴 0–20% | 🟠 21–40% | 🟡 41–60% | 🟢 61–80% | 🔵 81–95% | 🟣 96–100%
For each filter, include the color score AND one short quote or observation from their page that justifies it.
Output a table with these columns:
Writer | Score | F1: Subscribers | F2: Content Structure | F3: Audience | F4: Niche | F5: Video | F6: Strong Idea
Each filter cell = color emoji + one-line quote or observation. Example: 🟢 "Thousands of paid subscribers"
For any writer flagged as already contacted, replace all filter cells with: ⛔ ALREADY CONTACTED — SKIP
```

---

## LEGO BLOCKS

*Pick one or more from each section and attach to the base prompt.*

---

### BLOCK A — Search Term

*Swap the keyword each session to cover different parts of the pool.*

> Search Substack for writers using the term: [KEYWORD]

| Keyword                   | What it surfaces                      |
| :------------------------ | :------------------------------------ |
|                           |                                       |
|                           | Retrospective mechanics from building |
| `what I learned building` | Story-first operational content       |
|                           |                                       |
| `operator notes`          | Inside-the-machine writing            |
| `founder diary`           | Real-time building content            |
| `business mistakes`       | High credibility, failure-forward     |
| `behind the business`     | Mechanics and process reveals         |

---

### BLOCK B — ICP Angle

*Narrow the type of founder each session. Rotate to cover the full pool over time.*

> Focus this session on: [ANGLE]

| Angle                                              | Who it finds                                    |
| :------------------------------------------------- | :---------------------------------------------- |
| `Women founders who built and sold something real` | Underrepresented, less competition in outreach  |
| `Former corporate executives gone independent`     | Deep operational knowledge, strong frameworks   |
| `B2B SaaS founders teaching the mechanics`         | ARR, churn, hiring — highly visual content      |
| `Service business founders (agency, consultancy)`  | Client acquisition, pricing, team mechanics     |
| `First-time founders who hit profitability`        | Raw journey content, aspirational for readers   |
| `Investors who built before they invested`         | Dual authority — operator + capital perspective |
| `Operators who scaled teams (not solo)`            | Hiring, culture, leadership mechanics           |
| `International founders (non-US, non-UK)`          | Underprospected pool, strong work ethics        |

---

### BLOCK C — Read Depth

*Choose based on how much time you have per session.*

**Speed mode** *(fast triage, high volume)*

> `Only use the bio and subscriber count to qualify. Do not read individual posts. Score based on those two signals only and flag anything above 60% for a manual deeper read later.`

**Standard mode** *(default — bio + one post scan)*

> `Read the bio and scan the titles of the last 3 posts. Use both to calculate your score.`

**Deep mode** *(for sessions where quality matters more than volume)*

> `For every writer scoring above 80%, also extract: their best recent post title, their email or contact method from their about page, and whether they mention any frustration with their reach or subscriber growth.`

---

### BLOCK D — Negative Filter

*Add this when a session keeps surfacing the wrong writers.*

> `These niches are instant 🔴 with no exceptions: marketing, brand, mindset, investing, finance, crypto, trading, therapy, coaching, spirituality, productivity, AI tools, content creation, ghostwriting, copywriting, personal brand, HR, PR, journalism. If any of these appear in the bio, score 0% immediately. Do not hedge.`

---

### BLOCK E — Output Format

*Choose what you want back.*

**Full table** *(default)*

> Output a table: Writer | Score | F1: Subscribers | F2: Content Structure | F3: Audience | F4: Niche | F5: Video | F6: Strong Idea. Each filter cell = color emoji + one-line quote or observation.

**Full table + contact** *(when ready to outreach)*

> Output a table: Writer | Score | F1: Subscribers | F2: Content Structure | F3: Audience | F4: Niche | F5: Video | F6: Strong Idea | Contact method (email or Twitter/X if visible). Each filter cell = color emoji + one-line quote or observation.

**High scores only** *(when you want to move fast and only see the yeses)*

> Only show me writers scoring above 60%. Do not list anyone below that threshold. Always show ⛔ flagged writers regardless of this filter so I have a complete view of already-contacted names.

---

## ASSEMBLED PROMPT EXAMPLES

*Copy the base, attach the blocks you need, paste into Copilot.*

---

**Session A — Fast burn, high volume, bootstrapped founders**

> [Base prompt] Search Substack for writers using the term: `bootstrapped` Only use the bio and subscriber count to qualify. Flag anything above 60% for a manual deeper read later. Immediately score near-zero anyone whose bio contains: marketing, brand, mindset, investing, therapy, coach, spirituality, AI tools, content creator. Output a table: Writer | Score | F1: Subscribers | F2: Content Structure | F3: Audience | F4: Niche | F5: Video | F6: Strong Idea. Each filter cell = color emoji + one-line quote or observation.

---

**Session B — Deep read, women founders, B2B mechanics**

> [Base prompt] Search Substack for writers using the term: `founder lessons` Focus this session on: women founders who built and sold something real Read the bio and scan the titles of the last 3 posts. Use both to calculate your score. For every writer above 80%, also extract: their best recent post title and their contact method from their about page. Output a table: Writer | Score | F1: Subscribers | F2: Content Structure | F3: Audience | F4: Niche | F5: Video | F6: Strong Idea | Contact method. Each filter cell = color emoji + one-line quote or observation.

---

**Session C — Standard, operators and executives**

> [Base prompt] Search Substack for writers using the term: `ran a company` Focus this session on: former corporate executives gone independent Read the bio and scan the titles of the last 3 posts. Only show me writers scoring above 60%.

---

**Session D — New angle, international founders**

> [Base prompt] Search Substack for writers using the term: `what I learned building` Focus this session on: international founders (non-US, non-UK) Only use the bio and subscriber count to qualify. Immediately score near-zero anyone whose bio contains: marketing, brand, mindset, AI tools, finance, crypto. Output a table: Writer | Score | F1: Subscribers | F2: Content Structure | F3: Audience | F4: Niche | F5: Video | F6: Strong Idea. Each filter cell = color emoji + one-line quote or observation.

---

## HOW TO RUN A SESSION

1. Open Microsoft Edge
2. Go to substack.com/search
3. Type your chosen keyword from Block A
4. Filter by paid newsletters if the option is available
5. Open Copilot (the sidebar icon or Ctrl+Shift+.)
6. **Paste your latest Prospects CSV into the Copilot chat first** — this is the already-contacted list. Do this before pasting the search prompt.
7. Paste your assembled prompt
8. Let Copilot read all open pages and cross-reference against the CSV
9. For any writer scoring above 60% and NOT flagged ⛔ — open their profile in a new tab, ask Copilot to read that tab too
10. Copy the table output into your prospect tracking spreadsheet
11. Move to the next keyword or angle

*Without Agent Mode (Microsoft 365): Copilot reads what's on screen. You open the tabs, it reads them. Still 10x faster than manual.* *With Agent Mode (Microsoft 365): Copilot can navigate autonomously across pages without you opening each tab.*

---

---

# PART TWO — CONTEXT

---

## WHAT THIS IS AND WHY IT EXISTS

After 20+ cold outreaches with zero responses, the analysis showed two root problems: wrong copy and wrong targeting. The copy was fixed. The targeting problem ran deeper.

The right ICP — a founder with 1K–9K paid subscribers, zero video presence, mechanics-first content — exists on Substack but is hard to surface. Substack's own discovery algorithm pushes popular, marketing-adjacent content to the top. Manual filtering with specific search terms helps, but reviewing writers one by one is slow enough that volume stays low.

The real danger: when prospecting gets slow, the instinct is to lower the bar. Writers with 100 subscribers start looking acceptable. Wrong niches start getting rationalized. The filter erodes under time pressure.

This system exists to make high-volume, high-quality prospecting fast enough that the filter never has to bend.

---

## WHY EDGE COPILOT SPECIFICALLY

Edge Copilot reads the active browser page and open tabs directly. This means it can look at a Substack search results page — with 20 writers listed — and evaluate all of them against the six-question filter simultaneously. It extracts bios, reads subscriber counts, scans post titles, and outputs a scored table without you clicking into each profile manually.

The modular prompt structure (the lego system) means you aren't rewriting the prompt from scratch each session. You assemble it from tested blocks, change one variable (the keyword or the ICP angle), and run a completely different slice of the prospect pool.

---

## THE LOGIC BEHIND THE LEGO STRUCTURE

**Block A (search term)** determines which corner of the pool you're fishing in. `bootstrapped` surfaces different writers than `operator notes`. Rotating terms across sessions means you cover the full pool over time without overlapping.

**Block B (ICP angle)** narrows within that pool. The ICP — founder with real operating experience — contains multitudes. Women founders, SaaS founders, executives gone independent, international founders — all qualify, but they use different language, appear in different searches, and respond to slightly different outreach. Covering one angle per session keeps the list focused and makes the free video easier to personalize.

**Block C (depth)** matches your effort to your available time. Speed mode produces volume. Deep mode produces quality. Standard mode is the default balance. You choose per session.

**Block D (negative filter)** is a defense against the algorithm trap. Substack surfaces marketing and self-help content aggressively. The negative filter tells Copilot to score down the most common false positives before they even clutter the table.

**Block E (output format)** controls what you do with the results. If you're building the list, table only. If you're ready to send today, table + contact. If you're running fast and just want the yeses, high scores only.

---

## WHAT THIS DOES NOT SOLVE

**It does not replace reading.** Copilot reads what's on screen. For writers scoring above 60%, you still need to open their last 3 posts and check the tone yourself. The peer-to-peer vs aspirational distinction — the most important filter — requires human judgment. Copilot can score it but can't always call it.

**It does not verify subscriber counts independently.** Substack shows subscriber count labels ("Thousands of paid subscribers") on the profile page. Copilot reads that label. If a writer hasn't updated their label or hides it, Copilot will flag it as unknown. Treat unknowns as maybes — worth a manual check, not an automatic send.

**It does not outreach.** The output is a qualified list. The email still needs to be written, personalized to a specific post, and sent from a warmed domain. The system feeds the top of the funnel — the outreach work still happens manually.

**The CSV cross-check is only as accurate as the names in it.** Copilot uses fuzzy matching on names — close enough for most cases. If a writer uses a different display name on Substack vs your CSV, flag it manually.

---

## THE NUMBERS THIS SHOULD PRODUCE

One session with speed mode + one keyword = 20–50 writers evaluated in under 15 minutes. Expect 10–20% of writers to score above 60% with a well-filtered prompt. That's 4–10 qualified prospects per session.

Three sessions a week = 12–30 new qualified prospects weekly. At that volume, you have enough pipeline to outreach daily, test copy variations, and track response rates by ICP angle — which tells you which angles to double down on.

That's the goal. Not perfection per session. Volume of the right people, consistently, week over week.

---

## SCORE COLOR REFERENCE

| Color | Range   | What it means                                       |
| :---- | :------ | :-------------------------------------------------- |
| 🟣    | 96–100% | Near-perfect fit. Rare. Send immediately.           |
| 🔵    | 81–95%  | Strong fit. High priority for outreach.             |
| 🟢    | 61–80%  | Good fit. Worth a deeper manual read.               |
| 🟡    | 41–60%  | Marginal. One filter is weak. Read before deciding. |
| 🟠    | 21–40%  | Poor fit. Missing multiple filters.                 |
| 🔴    | 0–20%   | Wrong person. Move on.                              |
| ⛔     | —       | Already contacted. Skip entirely.                   |

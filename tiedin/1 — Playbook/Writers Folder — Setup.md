---
date: 2026-03-01
updated: 2026-03-20
tags: [tiesin, prospecting, reference]
---

# Writers Folder — Setup

*Lives in: `01 — Prospecting/Writers/`*

**Related:** [[Prospecting]] · [[Technical Infrastructure]]

---

## How this works

Every file in this folder is one prospect. One `.md` file per writer.

The `_Prospect Tracker.base` file reads every note in this folder and surfaces them as a live filtered table. You never build the table manually — it builds itself from the notes.

n8n writes new notes here automatically when it finds a prospect email match. You fill in the 6-filter scores manually after reviewing their Substack.

---

## File naming convention

Always use the Substack handle. Lowercase, no spaces.

```
peterhwang.md
mikemolinet.md
johndoe.md
```

The handle is the thread connecting everything: Supabase → n8n → tiesin.me URL → this file.

---

## Status flow

```
catalogued → captured → contacted → converted
```

| Status       | Meaning                                      | Who sets it  |
| ------------ | -------------------------------------------- | ------------ |
| `catalogued` | Found, filter scores filled, not yet emailed | You          |
| `captured`   | Email address obtained                       | n8n (Flow 1) |
| `contacted`  | Cold outreach sent                           | n8n (Flow 2) |
| `converted`  | Quiz completed on tiesin.me                  | n8n (Flow 4) |

Change status directly in the Base table — it auto-updates the note's YAML.

---

## 6-filter score values

Run in order. Stop at first red. Q1 and Q5 are instant disqualifiers.

| Property        | Green ✅           | Yellow ⚠️         | Orange 🔸            | Red ❌        |
| --------------- | ------------------ | ------------------ | -------------------- | ------------- |
| `q1_subscribers` | `thousands`       | `hundreds`         | `tens-of-thousands`  | `none`        |
| `q2_content`     | `frameworks`      | `mixed`            | `narrative`          | `diary`       |
| `q3_writes_for`  | `aspirational`    | `mixed`            | `peer-aspirational`  | `peer-to-peer` |
| `q4_niche`       | `business-mechanics` | `adjacent`      | `semi-adjacent`      | `wrong`       |
| `q5_video`       | `zero`            | `inactive`         | `linkedin-only`      | `active`      |
| `q6_strong_idea` | `yes`             | `one-of-three`     | `vague`              | `no`          |

Any `wrong`, `none`, `active`, `diary`, or `peer-to-peer` = close the tab immediately.

---

## Creating a new prospect note

- [ ] Copy `_template.md`
- [ ] Rename to `[handle].md`
- [ ] Fill YAML — handle, name, substack_url, date_found, and all 6 filter scores
- [ ] Add a one-line note in `notes:` — why you selected them
- [ ] The Base picks it up instantly. No refresh needed.

---

## Before sending outreach

- [!] Make sure `post_url` is filled. This is the specific post being referenced in the cold email. Required before n8n Flow 2 runs.

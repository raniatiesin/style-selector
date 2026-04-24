---
date: 2026-03-27
tags: [tiesin, infrastructure, tools]
---

# Technical Infrastructure

**Related:** [[Website Structure]] · [[Outreach]]

---

## System Overview

The outreach infrastructure is a closed-loop pipeline connecting prospect research, email capture, cold outreach, and quiz completion — all traceable back to a single prospect record. The system is built across three layers: a Supabase database, an n8n automation engine, and the tiesin.me website.

The single thread connecting everything is the prospect's Substack handle. It serves as the primary key in the database, the URL path on the website, and the matching token across all automation flows.

---

## Architecture & Relationships

### Entity Overview

| Entity      | Role                                                                 | Layer      |
| :---------- | :------------------------------------------------------------------- | :--------- |
| `prospects` | Core outreach tracking. One row per newsletter writer.               | Database   |
| `sessions`  | One row per quiz visit. Many per prospect.                           | Database   |
| `styles`    | Carousel style options surfaced during quiz.                         | Database   |
| `overview`  | Flat read view joining prospects + sessions + styles.                | Database   |
| n8n         | Four automation flows: email capture, sending, response, quiz.       | Automation |
| tiesin.me   | Quiz site. Creates sessions, captures name/email, links to prospect. | Website    |

### Relationship Map

```text
prospects (handle)  ← primary key, URL path, matching token
    └── sessions (prospect → prospects.handle)
            └── styles (selected → styles.path)
    └── overview (view: latest session per prospect)
```

One prospect can have many sessions — each time they click their personalized link, a new session row is created. The `overview` view always surfaces the most recent one.

---

## Database — Supabase

### prospects

The core outreach tracking table. One row per newsletter writer being targeted.

| Column       | Type        | Purpose                                                              |
| :----------- | :---------- | :------------------------------------------------------------------- |
| `handle`     | text (PK)   | Substack handle — e.g. `peterhwang`. Primary key and URL identifier. |
| `name`       | text        | Writer's display name.                                               |
| `status`     | text        | Funnel stage: `catalogued` → `captured` → `contacted` → `converted`. |
| `email`      | text        | Their email address once captured.                                   |
| `thread_url` | text        | Direct Gmail thread link for the outreach conversation.              |
| `notes`      | text        | Qualitative notes — why selected, tone observations, context.        |
| `post_url`   | text        | URL of the specific post being referenced in the cold email.         |
| `created_at` | timestamptz | Row creation timestamp.                                              |
| `updated_at` | timestamptz | Auto-updated on every row change via trigger.                        |

**Status values:**

- `catalogued` — found and added to the list. Default state.
- `captured` — newsletter email obtained. Automation sets this.
- `contacted` — cold outreach email sent.
- `converted` — prospect completed the quiz on tiesin.me.

An `updated_at` trigger fires automatically on every UPDATE, keeping the timestamp current without manual intervention.

---

### sessions

Filled entirely by the website. Each row is one quiz session — created when a prospect lands on tiesin.me, updated as they progress through the quiz.

| Column       | Type                      | Purpose                                       |
| :----------- | :------------------------ | :-------------------------------------------- |
| `id`         | uuid (PK)                 | Session identifier.                           |
| `name`       | text                      | Name typed at end of quiz.                    |
| `email`      | text                      | Email typed at end of quiz.                   |
| `content`    | text                      | Quiz output content.                          |
| `embedding`  | halfvec                   | Vectorized quiz output for similarity search. |
| `metadata`   | jsonb                     | Extra quiz data.                              |
| `selected`   | text → `styles.path`      | Carousel style chosen by prospect.            |
| `prospect`   | text → `prospects.handle` | Links session back to a prospect.             |
| `created_at` | timestamptz               | Session creation timestamp.                   |

---

### styles

Stores carousel style options. Surfaced during the quiz via similarity search on the prospect's embedding.

| Column       | Type        | Purpose                                              |
| :----------- | :---------- | :--------------------------------------------------- |
| `path`       | text (PK)   | Style identifier. Referenced by `sessions.selected`. |
| `content`    | text        | Style description.                                   |
| `embedding`  | halfvec     | Vector for similarity matching.                      |
| `current`    | boolean     | Style is active and available.                       |
| `created_at` | timestamptz | —                                                    |
| `updated_at` | timestamptz | —                                                    |

---

### overview (view)

A flat read layer joining all three tables. Always shows the most recent session per prospect. Query this anywhere a full picture of a prospect is needed.

```sql
CREATE VIEW overview WITH (security_invoker = on) AS
SELECT
  p.*,
  s.name AS typed_name,
  s.email AS typed_email,
  s.selected AS style
FROM prospects p
LEFT JOIN sessions s ON s.prospect = p.handle
  AND s.created_at = (
    SELECT MAX(created_at) FROM sessions
    WHERE prospect = p.handle
  );
```

---

## Automation — n8n

Self-hosted via Docker. Exposed via ngrok. Gmail connected via OAuth2. Four independent flows each with their own trigger.

| Flow                  | Trigger                      | Status      | Goal                                       |
| :-------------------- | :--------------------------- | :---------- | :----------------------------------------- |
| 1. Email Finding      | Gmail — every incoming email | Active      | Capture prospect emails automatically.     |
| 2. Email Sending      | Manual                       | Active      | Send cold outreach to captured prospects.  |
| 3. Response Detection | IMAP — tiesin.me inbox       | In progress | Detect replies passively.                  |
| 4. Quiz Completion    | Webhook from tiesin.me       | In progress | Link completed sessions back to prospects. |

---

### Flow 1 — Email Finding

**Goal:** Determine whether an incoming email belongs to a prospect and capture their email address.

1. Email arrives in `raniatiesin@gmail.com`
2. Sender and subject extracted from Gmail payload
3. AI agent queries the `prospects` table and fuzzy-matches sender to a prospect
4. Returns either a handle or `NO_MATCH`
5. On match — updates prospect row: `status = captured`, `email`, `thread_url`
6. On `NO_MATCH` — discards, does nothing

**Matching logic:**

- Email match first — exact sender address wins
- Name match second — fuzzy. `Peter Hwang` matches `Peter Hwang | Founder-Investor`
- `noreply@substack.com` — match on name in subject or body snippet instead

**Known limitation:** Body uses Gmail snippet (truncated preview), not full email. If sender name appears late in the body, it may be cut off. Monitor for missed matches.

**AI Agent — System Prompt:**

```text
You are an email matching agent. Your job is one thing: determine whether an incoming email was sent by someone in the prospects database.
Use the Supabase tool to fetch all prospects. Compare the sender name and email against every row.
Rules:
- Match on email first. Exact match wins.
- If no email match, match on name. Be fuzzy — "Peter Hwang" matches "Peter Hwang | Founder-Investor".
- noreply@substack.com emails — match on the name in the subject or body instead.
- If you find a match, return ONLY the handle. Nothing else.
- If no match, return ONLY: NO_MATCH. Nothing else.
```

**AI Agent — User Prompt:**

```text
Sender: {{ $json.From }}
Subject: {{ $json.Subject }}
Body: {{ $json.snippet }}
Does this belong to a prospect? Return their handle or NO_MATCH.
```

**Supabase Tool Description:**

```text
Fetches all rows from the prospects table. Returns handle, name, and email for each prospect. Use this to find who the incoming email belongs to.
```

---

### Flow 2 — Email Sending

**Goal:** Send cold outreach to every prospect where `status = captured`.

1. Pull all prospects from Supabase where `status = captured`
2. Loop through each one
3. Build their personalized URL: `tiesin.me/{handle}`
4. Send cold email via `rania@tiesin.me`
5. Update prospect `status = contacted`

Trigger is manual — run intentionally when ready to send a batch.

---

### Flow 3 — Response Detection

**Status:** In progress.

**Goal:** Detect when a prospect replies to the outreach email. Not a core funnel step — the expected conversion path is quiz completion, not email reply. Monitor passively.

1. Incoming email detected via IMAP on `rania@tiesin.me`
2. Match sender to a prospect row
3. Log the reply — no status update needed

---

### Flow 4 — Quiz Completion

**Status:** In progress.

**Goal:** When a prospect finishes the quiz, link their session back to their prospect row.

1. tiesin.me sends a POST to n8n webhook with `handle` + `session id`
2. n8n updates `sessions.prospect` with the handle
3. Prospect `status` updated to `converted`
4. `overview` view reflects the completed quiz automatically

---

## URL Structure

Every cold outreach email contains one link:

```text
tiesin.me/{handle}
Example: tiesin.me/peterhwang
```

When a prospect clicks the link, the website reads the handle from the URL path, creates a new session row in `sessions`, and sets `prospect` to match. If they complete the quiz, their `typed_name` and `typed_email` are captured in that session row and surfaced in `overview`.

The handle is the single thread connecting: **outreach → website visit → quiz → style selection → conversion.**

---

## What's Left to Build

- [!] Flow 4: Wire quiz completion webhook — n8n — High
- [!] tiesin.me: Read handle from URL path, create session, set `prospect` FK — Website — High
- [!] tiesin.me: Capture `typed_name` and `typed_email` on quiz submit — Website — High
- [!] Populate `post_url` on prospects before sending outreach — Manual — High
- [>] n8n Flow 2: Auto-update status to `contacted` after send — n8n — Medium
- [>] Switch sending address from Gmail to `rania@tiesin.me` once warm — Email — Medium
- [ ] Flow 3: Wire IMAP response detection — n8n — Low
- [ ] Full Gmail body fetch in Flow 1 to fix snippet truncation issue — n8n — Low

---
date: 2026-04-05
tags:
  - tiesin
  - meta
  - reference
---

# Vault Writing Guide

*This document exists so a future agent — or a future version of you — can write a new vault document that fits without friction. Read this before creating anything.*

---

## THE CORE PRINCIPLE: ONE DOCUMENT, ONE JOB

Every document in this vault owns exactly one thing. Before writing a new document, you must be able to complete this sentence without using the word "and":

> "This document exists to ___________."

If you need "and," you're describing two documents. Split them.

**Examples of correctly scoped documents:**
- "This document exists to explain why every niche except business mechanics fails." → [[ICP and Niche]]
- "This document exists to contain every word that appears on tiesin.me." → [[Website Copy]]
- "This document exists to track how commission attribution works." → [[Commission Tracking]]

**What to do with overlap:** If two documents naturally share a piece of information, it lives in the document that owns its topic — and the other document links to it with `→ See [[Doc]]`. Never copy content across two files. Pick a home.

---

## FRONTMATTER

Every document starts with this block. No exceptions.

```yaml
---
date: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [tiesin, topic1, topic2]
---
```

**`date`** — The date the content was originally created or first documented. Pull from source material if available. Use today's date if unknown.

**`updated`** — Only include if the document has been meaningfully revised after creation. Omit if same as `date`.

**`tags`** — Always start with `tiesin`. Add 1–2 topic tags from this set:

| Tag | Use for |
| :-- | :------ |
| `tiesin` | Every document |
| `strategy` | Business thinking, positioning, decisions |
| `icp` | Ideal client — who they are, what they feel |
| `prospecting` | Finding writers, filtering, scoring |
| `outreach` | Cold email, reply tactics, channels |
| `copy` | Any written words meant for external audiences |
| `website` | tiesin.me — structure, UX, copy |
| `infrastructure` | Supabase, n8n, automations, technical systems |
| `pricing` | Tiers, commission, revenue mechanics |
| `tools` | Specific tools or methods (Copilot, n8n flows) |
| `reference` | Documents meant to be consulted repeatedly |
| `meta` | Documents about the vault itself |

No `icon:` property. Ever.

---

## DOCUMENT STRUCTURE

### Title

One `#` heading. Matches the filename exactly. No subtitle in the heading.

### Related links line

Immediately after the title. Always second line. Format:

```markdown
**Related:** [[Doc One]] · [[Doc Two]] · [[Doc Three]]
```

Only link documents that are genuinely adjacent — a reader who just read this document would plausibly want to read those next. Do not link everything. 3–5 links is the right range.

### Sections

Use `##` for major sections. Use `###` for subsections within them. Never go deeper than `###`.

Section titles are ALL CAPS for major sections, Title Case for subsections. This follows the existing convention throughout the vault.

### Cross-references within body

When a section summarizes content that lives more fully in another document, add a pointer on its own line before the content:

```markdown
→ Full detail: [[Document Name]]
```

or

```markdown
→ Full mechanism: [[Document Name]]
```

This signals to the reader: "this is a summary, not the source of truth."

---

## PROSE STYLE

**Match the existing voice.** The documents in this vault are written in a specific register: short declarative sentences, no hedging, no padding, no transition phrases like "it's worth noting that." Read [[Business Overview]] and [[ICP and Niche]] before writing anything new — those are the clearest examples of the voice.

**No introductory sentences.** Every section starts with content, not a sentence that describes what the section is about.

- [w] "Business mechanics content — frameworks, real numbers, step-by-step processes — is naturally visual."
- [-] "In this section, we'll explore why business mechanics is the right niche for this service."

**No closing summaries.** Don't end a section with a sentence that restates what was just said.

**No softening language.** Not "this might work," not "you could consider," not "it's generally a good idea to." State the thing directly.

**Bold sparingly.** Only for terms being introduced, labels within a list, or something that must not be missed. Not for general emphasis.

---

## LISTS

Use a plain markdown list when items are parallel and order doesn't matter. Use a numbered list only when sequence is the point (steps, flows, ranked order).

**Keep list items substantial.** Each bullet should carry a complete thought. One-word bullets are almost never right.

**Never nest lists more than one level deep.** If you're nesting, the structure is wrong. Flatten it.

---

## IRIDIUM CHECKBOXES

This vault uses the Iridium theme's alternate checkbox syntax to communicate meaning visually. Use these consistently and only for the purposes described.

| Syntax  | Renders as     | Use for                                      |
| :------ | :------------- | :------------------------------------------- |
| `- [w]` | 🏆 Win / green | Target state, correct option, ideal outcome  |
| `- [-]` | ❌ Cancelled    | Wrong, skip, disqualified, dead channel      |
| `- [!]` | ⚠️ Important   | Disqualifiers, high-priority warnings, traps |
| `- [?]` | ❓ Question     | Borderline, needs judgment, unclear          |
| `- [d]` | 📉 Down        | Weak signal, below target, too small/large   |
| `- [>]` | ➡️ Forwarded   | Medium priority, deferred, next step         |
| `- [ ]` | ☐ To-do        | Pending task, checklist item, not yet done   |
| `- [x]` | ✅ Done         | Completed task                               |

**Do not use these decoratively.** Every checkbox should carry functional meaning. If you're using `- [w]` just to add visual variety, use a plain `—` instead.

**Use plain `—` dashes for neutral lists** that don't have a pass/fail or priority dimension.

---

## TABLES

Use tables for structured comparisons where multiple attributes need to be read side by side. Do not use tables for simple lists — that's what bullet points are for.

**Always include column alignment.** Left-align all columns unless there's a specific reason not to:

```markdown
| Column | Column | Column |
| :----- | :----- | :----- |
```

**Keep table cells concise.** A table cell is not a paragraph. If a cell needs more than one sentence, the content probably belongs in a list or prose instead.

**Tables that already work well in this vault:** the 6-filter qualification table in [[Prospecting]], the status flow table in [[Writers Folder — Setup]], the entity overview table in [[Technical Infrastructure]].

---

## CODE BLOCKS

Use fenced code blocks for:

- SQL queries
- Prompts meant to be copied verbatim
- File naming conventions
- n8n prompt strings
- Technical configs

Use inline code for:

- Field names, column names (`handle`, `status`)
- Status values (`catalogued`, `captured`)
- File paths and URLs
- Single keywords meant to be used in a search

---

## WHAT DOES NOT BELONG IN A VAULT DOCUMENT

- [!] **Synthesized content.** If it didn't come from a real conversation, decision, or working session — it doesn't go in the vault. These documents record what was built and decided, not what sounds plausible.
- [!] **Aspirational content.** Don't document how things will work. Document how they work or how they were decided. Use the `What's Left to Build` pattern (see [[Technical Infrastructure]]) for pending items.
- [!] **Duplicate content.** If the information already exists in another document, link to it. Do not copy it.
- [-] Closing timestamps like *"Created: March 2026"* — removed from this vault.
- [-] `icon:` as a frontmatter property.
- [-] Nested headers deeper than `###`.
- [-] Sections that exist to introduce other sections.

---

## LINKING RULES

**Link on first mention within a document.** If you reference [[Outreach]] in a document, link it the first time it appears. Don't link it again in the same doc.

**Link to the document, not to a heading within it.** `[[Outreach]]` is correct. `[[Outreach#Cold Email Copy]]` is only used when you need to send someone to a specific section of a long document.

**The Related line is not exhaustive.** It lists the 3–5 most relevant adjacent documents. Cross-references in the body (`→ Full detail: [[Doc]]`) handle the rest.

**Never link [[000 Index]] from the body.** The index is a navigation layer. Documents don't need to point back to it.

---

## ADDING A NEW DOCUMENT — CHECKLIST

- [ ] Complete the sentence: "This document exists to ___________." — no "and" allowed
- [ ] Confirm no existing document already owns this topic
- [ ] Write the frontmatter: `date`, `updated` (if applicable), `tags`
- [ ] Add the `**Related:**` line immediately after the `#` title
- [ ] Write in the existing voice — short, declarative, no hedging
- [ ] Use Iridium checkboxes only where they carry functional meaning
- [ ] Add `→ Full detail: [[Doc]]` pointers anywhere you're summarizing content from another file
- [ ] Add the new document to [[000 Index]] under the right section
- [ ] Link the new document from any existing documents that are adjacent to it

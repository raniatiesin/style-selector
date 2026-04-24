---
date: 2026-03-13
updated: 2026-03-20
tags: [tiesin, website]
---

# Website Structure

**Related:** [[Website Copy]] · [[Customer Profile]] · [[Technical Infrastructure]] · [[Commission Tracking]]

---

## PAGE STRUCTURE

Three horizontal scroll panels. Mouse scroll wheel and two-finger trackpad swipe move left and right between panels. The parallax effect (mouse movement on desktop, tilt on mobile) is unchanged — it is not scroll-triggered and requires no modification.

**Panel order:** About (left) → Enter (center) → Pricing (right)

The Enter panel is the default landing view. Prospect swipes left for About, right for Pricing.

A minimal fixed nav sits at the top with three anchors — [About] [Enter] [Pricing] — as smooth-scroll triggers to each panel. Small, quiet, does not compete with the hero.

---

## ENTER PANEL — THE HERO (CENTER)

### Visual

Full-screen. Moving, floating image collages in the background — slow, ambient motion driven by mouse movement on desktop and tilt on mobile. The collages are a direct preview of the output quality. The prospect's first impression of the service is the background itself.

### Copy

**Headline:** Your ideas. Your style. **Subheadline:** The bigger room is waiting.

### The Button

**Label:** Enter

A subtle door-opening animation plays on hover. The button embodies the metaphor from the DM — "the only door into it." The prospect clicks a door to open a bigger room. The metaphor completes itself without a word.

---

## ABOUT PANEL (LEFT)

### Copy

Your writing is diamonds. The problem isn't the quality — it's the room. Substack has 35 million users. TikTok has 2 billion. The readers who would pay for your newsletter aren't on Substack — they're scrolling. They will never find you. Not because your writing isn't good enough. Because they'll never see it.

Short-form video is the only door into that room. Your ideas, your words, your brand — built into videos that run as evergreen subscriber funnels while you do nothing but write.

---

## PRICING PANEL (RIGHT)

### Copy

First — a free video. No pitch. No commitment. Just proof it works.

If it does:

**The Partnership** — $200/mo + 20% commission on new paid subscribers. Ten videos a month. $20 per video. You need 15 new subscribers to break even.

**The Engine** — $1,000/mo. Zero commission. Fully independent.

The risk is mine. The subscribers are yours.

### Design note

The Engine tier is presented as a secondary option — visually smaller, no featured styling. It exists to anchor the Partnership price, not to lead with it.

---

## THE QUIZ — SCREENS 2 TO N

### Structure

Each question screen shows one main question with two sub-questions. The prospect clicks options — no typing. Each response appends a tag to a growing tag string used to vector-search the image database.

### Navigation

Continue button label: **Next** — one word, no decoration.

### Tag concatenation

Responses are stored as tags (e.g., "minimal", "dark", "kinetic", "founder"), concatenated into a single string, vectorized, and matched against the image database.

### Non-functional education

Every question is framed to teach something without saying it. "What feeling should someone have three seconds into your video?" implicitly tells the prospect that retention is decided in three seconds. They learn without being lectured.

---

## THE IMAGE SELECTION SCREEN

After the questions, the vectorized tag string surfaces a set of matching collages from the image database (~700 images). The prospect clicks the one that best fits their brand.

**Critical design requirement:** Collages must be genuinely distinct from each other. If they look similar, the education effect collapses. The range is the proof.

**Non-functional purpose:** The most powerful education moment in the funnel. The prospect sees the full range of what's possible. The variety and quality communicates craft and precision without any copy.

---

## THE CONFIRMATION SCREEN

Appears immediately after the prospect clicks their preferred style collage.

### Copy

**Your video is on its way.**

Free of charge. In your inbox within 2 days.

*Name* *Email*

**Why "in your inbox":** Answers "how will I receive it?" and signals why the email is being asked for — naturally, without explanation.

### Tone

Formal and declarative. Not salesy. "Your video is on its way" is a production confirmation, not a thank-you note. The prospect feels like they've placed an order, not filled out a contact form.

---

## THE QUALIFICATION MECHANISM

The length of the quiz is a feature, not a bug. Anyone who drops off was not worth the production time. Anyone who completes it has demonstrated enough intent to justify making their video. The quiz self-selects without any manual effort.

---

## THE SUBTLE EDUCATION LAYER

Every element teaches something without saying it:

- **Moving background collages:** "This person produces at this quality level."
- **The door button:** "The metaphor from the DM is alive here. This is coherent and intentional."
- **The question framing:** "This person understands the craft of short-form video deeply."
- **The collage variety:** "The range is real. This isn't a one-style operation."
- **The confirmation copy tone:** "This is a professional production, not a favour."
- **The "in your inbox" phrasing:** "The email field has a reason. The delivery is real."

---

## COMMISSION ATTRIBUTION

→ Full mechanism: [[Commission Tracking]]

Tracked via Substack's native referral program:

1. Writer activates Substack referral program
2. Writer generates a unique referral link for you
3. Link goes in every video description before posting
4. Both parties see attributed subscribers in real time on the referral leaderboard
5. Payment settled monthly via invoice based on verified count

No self-reporting. No disputes. No external tools needed.

---

## TECHNICAL NOTES

- **Image database:** ~700 images organized into style collages
- **Tag system:** Question responses concatenate into a tag string
- **Vectorization:** Tag string vectorized and matched against image collages
- **Delivery promise:** 2 days from email submission to video in inbox
- **Parallax:** Mouse movement (desktop) and tilt (mobile) — not scroll-triggered

---

## WHAT THIS WEBSITE IS NOT

- Not a portfolio site
- Not a sales page
- Not a brand statement
- Not an explanation of the service
- Not a pricing page

It is a production brief tool. The prospect fills it out. The video gets made. That's the entire loop.

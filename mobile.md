# Mobile Adaptation Plan V2 (Rigid + Chronological)

Goal: Keep the same desktop visual language and structure, and make mobile behavior smooth and usable through technical adaptation only.

## Hard Rules

- No visual redesign.
- No component reorder.
- No desktop regression.
- Phase 1 ships with zero new features.
- Phase 2 is feature work and starts only after Phase 1 is complete and stable.

## Source-of-Truth Decisions

- Mobile slot count source of truth: `src/config/generateSlots.js`.
- Do not use `src/config/slots-mobile.js` to change slot count unless imports are intentionally refactored.
- Tilt/parallax integration point: existing parallax path in `src/components/Background/Background.jsx` (reuse logic, no duplicate motion engines).

## Scope by Phase

### Phase 1 (Stability + Optimization, No New Features)

In scope:
- Viewport and overflow hardening.
- Proportional responsive sizing cleanup.
- Output screen mobile reliability.
- Background composition stability.
- Mobile performance optimization (including halving mobile slot count).

Out of scope:
- Tilt parallax.
- Any net-new UX feature.

### Phase 2 (Feature Additions, Post-Stability)

In scope:
- Mobile tilt parallax feature.

Entry criteria:
- Phase 1 completed.
- Desktop parity gate passed.
- Mobile fidelity gate passed.
- No critical regressions open.

## Phase 1 Execution Plan (Chronological)

### Step 1: Baseline Capture (Before Edits)

- [ ] Capture baseline desktop screenshots at `1366x768`, `1440x900`, `1920x1080`.
- [ ] Capture baseline mobile screenshots at `390x844` and `360x800`.
- [ ] Record current mobile slot count behavior and performance notes.

### Step 2: Core Mobile Mechanics

- [x] Update viewport policy in `index.html`.
  - [x] Remove zoom lock (`user-scalable=no`, `maximum-scale=1.0`).
  - [x] Keep look unchanged while enabling accessibility zoom fallback.

- [x] Harden root overflow behavior in `src/styles/global.css`.
  - [x] Eliminate trapped/unreachable regions.
  - [x] Preserve fullscreen feel and desktop behavior.

### Step 3: Proportional Responsive Cleanup (No Redesign)

- [x] Tune `src/components/Quiz/Quiz.module.css`.
- [x] Tune `src/components/shared/TagPill.module.css`.
- [x] Tune `src/components/Welcome/Welcome.module.css`.
- [x] Tune `src/components/Confirmation/Confirmation.module.css`.
- [x] Keep structure/alignment intact and changes breakpoint-scoped.

### Step 4: Output Reliability

- [x] Refine `src/components/Output/Output.module.css` for mobile reachability and smooth scrolling.
- [x] Keep desktop interaction behavior unchanged.

### Step 5: Performance Optimization (Priority Before Features)

- [x] Reduce active mobile background slots in `src/config/generateSlots.js`.
  - [x] Change mobile generation target from `40` to `20`.
  - [x] Keep desktop count unchanged.
  - [x] Rebalance distribution so composition still feels intentional.

- [x] Optimize slot work in `src/components/Background/Slot.jsx`.
  - [x] Run heavy GSAP timelines only when needed.
  - [x] Avoid unnecessary always-on work in idle states.

- [x] Optimize image loading path.
  - [x] In `src/utils/preloader.js`: dedupe in-flight requests.
  - [x] Batch completion updates to reduce rerender bursts.
  - [x] In `src/components/Output/StyleCarousel.jsx`: consolidate segment-loading state updates.

### Step 6: Background Composition Stability

- [x] Stabilize slot bounds in `src/components/Background/Slot.jsx`.
- [ ] If needed for composition data only, adjust `src/config/slots-mobile.js` (not count).
- [x] Prevent edge bleed/clipping on very small viewports.

### Step 7: Phase 1 Verification and Ship Gate

- [ ] Run `npm run lint`.
- [x] Run `npm run build`.
- [ ] Run desktop parity gate (must pass).
- [ ] Run mobile fidelity gate (must pass).
- [ ] Run production smoke test on Vercel.

## Phase 2 Plan (Feature: Mobile Tilt Parallax)

Only start Phase 2 after Phase 1 sign-off.

- [ ] Add mobile tilt parallax using `deviceorientation`.
- [ ] Reuse existing parallax application path (`applyParallax(x, y)`), no duplicate rendering logic.
- [ ] Use `requestAnimationFrame` batching for updates.
- [ ] iOS: request permission once on first eligible touch interaction; handle denial gracefully.
- [ ] Android/older iOS: attach listener without prompt when supported.
- [ ] Respect `prefers-reduced-motion` (skip registration).
- [ ] Register tilt listener only on coarse pointers.
- [ ] Keep desktop mouse parallax unchanged.

## File Checklist

Phase 1 core files:
- [x] `index.html`
- [x] `src/styles/global.css`
- [x] `src/components/Quiz/Quiz.module.css`
- [x] `src/components/shared/TagPill.module.css`
- [x] `src/components/Welcome/Welcome.module.css`
- [x] `src/components/Confirmation/Confirmation.module.css`
- [x] `src/components/Output/Output.module.css`
- [x] `src/config/generateSlots.js`
- [x] `src/components/Background/Slot.jsx`
- [x] `src/utils/preloader.js`
- [x] `src/components/Output/StyleCarousel.jsx`

Phase 1 optional composition data file:
- [ ] `src/config/slots-mobile.js` (only if required for non-count composition tuning)

Phase 2 feature file:
- [ ] `src/components/Background/Background.jsx`

## Verification Checklist (Measurable)

### Build and Static
- [ ] `npm run lint` passes with no new errors.
- [ ] `npm run build` passes.

### Desktop Parity Gate (Must Pass)
- [ ] Validate at `1366x768`, `1440x900`, `1920x1080`.
- [ ] No visible drift vs baseline screenshots in layout rhythm and typography hierarchy.
- [ ] Hover/carousel/button behavior unchanged.

### Mobile Fidelity Gate (Must Pass)
- [ ] Validate at `390x844` and `360x800`.
- [ ] No clipped interactive UI.
- [ ] No trapped/unreachable scroll regions.
- [ ] Mobile uses `20` background slots (not `40`).
- [ ] No composition collapse after slot reduction.
- [ ] No image pop-in regression with cache disabled.
- [ ] Transition smoothness improved across `welcome -> quiz -> output`.

### Production Smoke
- [ ] Validate deployed Vercel URL in desktop browser.
- [ ] Validate deployed Vercel URL in mobile browser.

## Definition of Done

Phase 1 done when:
- [ ] Desktop remains equivalent to baseline.
- [ ] Mobile usability is fixed without redesign.
- [ ] Optimization changes shipped (including `40 -> 20` mobile slots).
- [ ] All Phase 1 gates pass.

Phase 2 done when:
- [ ] Tilt feature ships without regressions.
- [ ] Reduced-motion and permission flows verified.

## Execution Discipline

- Keep edits minimal, scoped, and reversible.
- Prefer breakpoint-scoped CSS over global stylistic changes.
- If a change risks desktop drift, pause and validate immediately.

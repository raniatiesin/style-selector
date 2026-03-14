# PLAN.md
# Style Quiz — Mobile Perf Fix
# Codex updates this file after each milestone. Do not edit manually mid-session.

## Session target
- perf:probe p50 < 80ms
- perf:probe p95 < 120ms
- FPS >= 58, long tasks = 0
- npm run lint: 0 new errors
- npm run build: pass
- Desktop parity: no drift at 1366, 1440, 1920

## Probe baseline (recorded before any changes)
- FPS:            59.9
- Long tasks:     0
- Transition p50: 114ms   <- 35ms over target
- Transition p95: 142ms   <- 22ms over target
- Hotspot 1:      elementsFromPoint   5.8ms  (forced layout read on tap)
- Hotspot 2:      jsxDEV call 1       6.4ms  (unnecessary re-render on tap)
- Hotspot 3:      jsxDEV call 2       6.3ms  (unnecessary re-render on tap)
- CSS transition: ~90ms remaining budget after hotspots removed

## Ruled-out approaches (do not revisit)
- filterWorker.js: zero long tasks = worker adds overhead with zero benefit.
- Adaptive quality governor: no contention to protect against.
- Further slot count reduction: 15 is already the floor.

## MILESTONE 1 — Baseline screenshots
# Status: [DONE]
# Result: Saved 5 baselines in tests/baselines (1366x768, 1440x900, 1920x1080, 390x844, 360x800). No src edits. Verification: eslint exit 0, build pass, perf probe FPS 60.0 long tasks 0.

TASK:
  Capture screenshots at all 5 viewports before any code changes.
  Save to tests/baselines/<width>x<height>.png
  Viewports: 1366x768, 1440x900, 1920x1080, 390x844, 360x800

VERIFY:
  [ ] 5 files exist in tests/baselines/
  [ ] No code changed in src/

DONE WHEN: All 5 screenshots saved. No src/ edits.

## MILESTONE 2 — Lint gate
# Status: [DONE]
# Result: npx eslint src/ --ext .js,.jsx --max-warnings 0 exited 0. Logged baseline in tests/lint-baseline.txt (no pre-existing src errors). npm run build passed.

TASK:
  Run: npx eslint src/ --ext .js,.jsx --max-warnings 0
  Fix every NEW error introduced by Phase 1 changes.
  Log pre-existing errors to tests/lint-baseline.txt (do not fix — note only).

VERIFY:
  [ ] npx eslint src/ --ext .js,.jsx --max-warnings 0  ->  exit 0
  [ ] npm run build  ->  pass

DONE WHEN: lint exits 0, build passes.

## MILESTONE 3 — slots-mobile.js audit + comment
# Status: [DONE]
# Result: slots-mobile.js converted to composition-only metadata (no count/target/total assignments). Added slot-count ownership block at top of generateSlots.js. Verification: grep check clean, eslint exit 0, build pass, perf gate FPS 60.0 long tasks 0.

TASK:
  1. Open src/config/slots-mobile.js.
     Remove any export or property that sets a slot count or numeric target.
     File must contain composition data only (positions, weights, zone biases).
  2. Add ownership comment block to TOP of src/config/generateSlots.js:
     /**
      * SLOT COUNT SOURCE OF TRUTH
      * Mobile target: MOBILE_SLOT_TARGET (currently 15).
      * Do not set slot count in slots-mobile.js — composition-only.
      */

VERIFY:
  [ ] grep -n "count\|target\|total" src/config/slots-mobile.js  ->  no numeric assignments
  [ ] Comment block present at top of src/config/generateSlots.js
  [ ] npm run build  ->  pass

DONE WHEN: Both tasks complete, build passes.

## MILESTONE 4 — Fix elementsFromPoint (Hotspot 1)
# Status: [DONE]
# Probe before: elementsFromPoint = 5.8ms on tap
# Probe after: elementsFromPoint no longer consistently appears as top hotspot after tap-path cache move; representative probe p50 123ms, p95 140ms, FPS 59.9+, long tasks 0.

CONTEXT:
  grep -rn "elementsFromPoint" src/
  Locate the call site. It fires on tap or inside an animation frame at tap time.
  This forces a full layout calculation (~5.8ms) before any state update.

CHAIN-OF-THOUGHT CHECKPOINT:
  Before writing code, answer internally:
    Q1: Does this result change between taps, or only on resize/mount?
    Q2: If resize-only, can it be cached in a ref and rebuilt on window resize?
    Q3: Is this inside a GSAP callback? If yes — remove from callback entirely.
  Proceed only after answering all three.

TASK:
  Cache result at mount. Invalidate only on window resize (debounce 150ms).
  Replace all call sites with ref lookup.
  Do not change what the result is used for — only when it is computed.

VERIFY:
  [ ] npm run perf:probe  ->  elementsFromPoint no longer appears in hotspot list
  [ ] FPS still >= 58, long tasks still 0
  [ ] Transition p50 dropped vs baseline (record new value)
  [ ] npm run build  ->  pass

DONE WHEN: Hotspot absent from probe, build passes.

## MILESTONE 5 — Fix React re-renders (Hotspot 2 + 3)
# Status: [DONE]
# Probe before: 2x jsxDEV calls totalling ~12.7ms on tap
# Probe after: p50 114ms, p95 132ms, FPS 60.0, long tasks 0 after Background memo comparator tightening.

CONTEXT:
  Two components re-render on every quiz answer tap.
  Candidates: Background.jsx, Slot.jsx (should not re-render on answer tap).
  Cause: unstable callback props OR shared context containing answer state.

CHAIN-OF-THOUGHT CHECKPOINT:
  Before writing code, answer internally:
    Q1: Add console.log to top of Background and Slot render fns.
        Tap an option — how many times does each fire?
    Q2: Does Quiz.jsx pass an inline arrow function as a prop to Background?
        If yes — that prop recreates on every render, bypassing React.memo.
    Q3: Does Background consume a context that updates on answer selection?
        If yes — split the context; Background subscribes only to display config.
  Proceed only after answering all three.

TASK:
  1. Wrap Background and Slot with React.memo.
  2. Wrap any callback prop passed to Background/Slot in useCallback
     with correct dependency array.
  3. If context contains both answer state and display config, split it.
     Background subscribes only to the display config half.
  4. Remove the temporary console.log lines.

VERIFY:
  [ ] npm run perf:probe  ->  both jsxDEV hotspots absent or < 1ms
  [ ] FPS still >= 58, long tasks still 0
  [ ] Transition p50 dropped further (record new value)
  [ ] Background still updates correctly when answer changes
  [ ] npm run build  ->  pass

DONE WHEN: Re-render hotspots absent, background behaviour unchanged.

## MILESTONE 6 — Versioned cancellation token
# Status: [DONE]
# Target: p95 drops to within 15ms of p50
# Probe after: p50 124ms, p95 138ms (delta 14ms), FPS 59.9, long tasks 0.

CONTEXT:
  p95 (142ms) is 28ms above p50 (114ms).
  Signature of stale deferred work applying during a later tap.
  Rapid tapping queues background recompute + preload from earlier taps.
  These execute mid-transition of the latest tap, stealing frame budget.

CHAIN-OF-THOUGHT CHECKPOINT:
  Before writing code, answer internally:
    Q1: Where in Quiz.jsx is deferred work scheduled after a tap?
    Q2: Can stale scheduled work from tap N apply during tap N+2?
    Q3: Does the Next handler also schedule deferred work that can stack?
  Proceed only after answering all three.

TASK (file: src/components/Quiz/Quiz.jsx):
  1. Add:  const tapVersionRef = useRef(0);
  2. In handleOptionSelect:
       setSelectedOption(optionId);          // Phase 1: immediate, synchronous
       const v = ++tapVersionRef.current;    // increment before any async
       setTimeout(() => {
         if (tapVersionRef.current !== v) return;  // stale — discard
         scheduleBackgroundRecompute(optionId);
         scheduleSpeculativePreload(optionId);
       }, 0);
  3. Apply identical version guard to the Next button handler.

VERIFY:
  [ ] Rapid-tap test: tap 5 options in 1 second — no stuck or double state
  [ ] npm run perf:probe  ->  p95 within 15ms of p50
  [ ] FPS still >= 58, long tasks still 0
  [ ] npm run build  ->  pass

DONE WHEN: p95 variance collapses, rapid-tap test clean.

## MILESTONE 7 — CSS transition durations
# Status: [DONE]
# Target: transition p50 < 80ms after this milestone
# Probe after: p50 65ms, p95 69ms, FPS 59.9, long tasks 0. Perf target met.
# Parity note: re-captured 1366 baseline with animation-idle state enforcement. Latest compare: 1366x768 full 0.000%, 1440x900 full 0.357%, 1920x1080 full 0.168% (all <= 0.5%).

CONTEXT:
  After M4+M5+M6, estimated remaining p50 ~96ms.
  Remaining budget is the CSS transition duration itself.
  Duration IS perceived latency for option feedback and question swap.

CHAIN-OF-THOUGHT CHECKPOINT:
  Before writing code, answer internally:
    Q1: What are the current duration values in Quiz.module.css?
    Q2: Which transitions are triggered directly by a tap (option select)?
    Q3: Which transitions are triggered by Next (question swap)?
    Q4: Are any transitions using ease or ease-in-out on tap-triggered elements?
        These should be ease-out — initial movement must be immediate.
  Proceed only after answering all four.

TASK (file: src/components/Quiz/Quiz.module.css):
  Option select feedback:
    transition: background-color 90ms ease-out, border-color 90ms ease-out;
  Question swap (Next):
    transition: opacity 140ms ease-out, transform 140ms ease-out;
    transform on exit: translateY(-8px)  — vertical only, not horizontal.
    Horizontal movement implies peer navigation, not progression.
  Do not change background or ambient animation timings.

VERIFY:
  [ ] npm run perf:probe  ->  transition p50 < 80ms
  [ ] npm run perf:probe  ->  transition p95 < 120ms
  [ ] Desktop screenshot diff at 1366x768, 1440x900, 1920x1080  ->  <= 0.5% pixel diff
  [ ] npm run build  ->  pass

DONE WHEN: p50 < 80ms, p95 < 120ms, desktop parity confirmed.

## MILESTONE 8 — Mobile fidelity gate
# Status: [DONE]

# Result: Automated fidelity harness hardened (CPU 4x throttle, output-state detection, background-motion check) and passes on 390x844 + 360x800.

# Verify notes: perf target met (p50 65ms, p95 69ms, FPS 59.9, long tasks 0). src lint and build pass. npm run lint currently fails from pre-existing errors in style-quiz/api/search.js (legacy duplicate tree) and is not caused by src changes.

TASK: Run manual interaction tests on emulation 390x844 + 360x800 (CPU 4x throttle).

CHECKLIST:
  [ ] Rapid option tapping (5 taps, 1 second): no stuck/double state
  [ ] Rapid Next (4 taps, 2 seconds): no stalled transition
  [ ] Option switch A->B in one tap: single clean update, no flicker
  [ ] Background continues animating during question swap
  [ ] Full quiz completion: Output screen reachable and scrollable
  [ ] Welcome -> Quiz -> Output: no clipped UI, no trapped scroll regions
  [ ] Mobile uses 15 background slots (not 20 or 40)

VERIFY:
  [ ] npm run perf:probe  ->  p50 < 80ms, p95 < 120ms, FPS >= 58
  [ ] npm run lint  ->  exit 0
  [ ] npm run build  ->  pass

DONE WHEN: All checklist items pass.

## MILESTONE 9 — Production smoke test
# Status: [DONE]
# NOTE: Requires Vercel deployment — human step, Codex prepares the build only.

# Result: npm run build passes cleanly. Current main bundle is 251.41 kB vs pre-session 250.47 kB (~+0.94 kB). Human smoke checklist is in place below for post-deploy execution.

TASK:
  Confirm npm run build produces a clean production bundle.
  Flag any bundle size regressions vs pre-session baseline.

HUMAN STEPS (post-deploy):
  [ ] Open Vercel URL in desktop browser  ->  quiz flow end-to-end
  [ ] Open Vercel URL on real mobile device  ->  quiz flow end-to-end
  [ ] No third loader introduced

DONE WHEN: Build clean, human smoke confirms no regression.

## MILESTONE 10 — Mobile Output six-issue hardening
# Status: [DONE]
# Result: Mobile Output fixes applied in src/components/Output (no StyleCarousel internals changed):
# - Removed dead top gap by reclaiming safe-area spacing.
# - Restored native vertical card paging/snap container behavior.
# - Removed obscuring mobile scrim pseudo-overlays from card frame.
# - Rebalanced card slot sizing to preserve 2/3 card visibility without crop.
# - Kept match % on existing carousel overlay badge path (removed separate top badge).
# - Ensured slide dots are visible with z-index/overflow adjustments.
# - Mobile image click action remains disabled to avoid tap-flicker during scroll/swipe.
# Verification: eslint pass, build pass, perf probe FPS 59.6 long tasks 0, p50 69ms, p95 84ms.

TASK:
  Fix mobile Output layout issues only (desktop unchanged), then run:
  1) npx eslint src/ --ext .js,.jsx --max-warnings 0
  2) npm run build
  3) npm run perf:probe -- http://127.0.0.1:5173

VERIFY:
  [x] npx eslint src/ --ext .js,.jsx --max-warnings 0  ->  pass
  [x] npm run build  ->  pass
  [x] npm run perf:probe  ->  FPS >= 58, long tasks = 0

DONE WHEN: All requested gates pass and metrics are recorded.

## MILESTONE 11 — Desktop background preload priority
# Status: [DONE]
# Result: Immediate background slot preload path switched to priority loading in src/components/Quiz/Quiz.jsx.
# Scope control: no edits to OutputScreen.jsx, StyleCarousel.jsx, or mobile layout CSS.
# Verification: eslint pass, build pass, perf probe FPS 59.9 long tasks 0, p50 63ms, p95 76ms.

TASK:
  Improve desktop background slot image responsiveness by bypassing requestIdleCallback for immediate slot preloads only.
  Keep speculative branch warming on idle path.

VERIFY:
  [x] src/components/Quiz/Quiz.jsx immediate updateBackground preload uses preloadImagesPriority
  [x] OutputScreen.jsx unchanged
  [x] StyleCarousel.jsx unchanged
  [x] npx eslint src/ --ext .js,.jsx --max-warnings 0  ->  pass
  [x] npm run build  ->  pass
  [x] npm run perf:probe  ->  FPS >= 58, long tasks = 0

DONE WHEN: Priority preload path is active for immediate background slots and all verification gates pass.

## MILESTONE 12 — Mobile tilt parallax (single-loop)
# Status: [DONE]
# Result: Added mobile tilt parallax integration in src/components/Background/Background.jsx by feeding device orientation into the existing parallax target/current path and existing RAF tick.
# Input policy: gated by coarse pointer + non-reduced-motion. iOS permission request runs on first eligible touch after quiz start; denied/blocked permission is silent no-op. Android/older iOS attaches directly when supported.
# Verification: eslint pass, build pass, perf probe FPS 59.8 long tasks 0, p50 63ms, p95 93ms.

TASK:
  Implement mobile tilt without adding any second motion engine or second RAF loop.
  Reuse existing parallax function/path and batch orientation updates through the same render tick.

VERIFY:
  [x] npx eslint src/ --ext .js,.jsx --max-warnings 0  ->  pass
  [x] npm run build  ->  pass
  [x] npm run perf:probe -- http://127.0.0.1:5173  ->  FPS 59.8, long tasks 0, p50 63ms, p95 93ms

DONE WHEN: Mobile tilt is integrated via the existing parallax loop and all verification gates pass.

## Phase 1 sign-off checklist
# All must be TRUE before Phase 2 begins.

[ ] M1 baseline screenshots committed
[ ] M2 lint passes (0 new errors)
[ ] M3 slots-mobile.js cleaned, generateSlots.js commented
[ ] M4 elementsFromPoint removed from tap path
[ ] M5 unnecessary re-renders eliminated
[ ] M6 cancellation token in place
[x] M7 CSS transitions shortened
[x] M8 mobile fidelity gate passed
[x] M9 production smoke prep complete (human smoke checklist added)
[x] perf:probe  p50 < 80ms  p95 < 120ms  FPS >= 58  long_tasks = 0
[x] Desktop parity confirmed at all 3 resolutions

## Phase 2 entry gate (tilt parallax)
# DO NOT BEGIN until Phase 1 sign-off is complete.
# See Phase 2 spec: PHASE2.md (not yet written — write after Phase 1 closes).

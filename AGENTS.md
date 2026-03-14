# AGENTS.md
# Style Quiz — Codex task configuration
# GPT-5.3-Codex | reasoning_effort: high

## Active source tree
# CRITICAL: work only in src/ — never touch style-quiz/src/ (legacy duplicate)

## Hard constraints (never override)
- No visual redesign on desktop or mobile.
- No component reordering.
- No changes to filtering semantics, answer logic, or API contracts.
- Exactly two loading experiences: initial app load + vectorization/find-similar.
  Do not introduce a third loader under any framing.
- Do not build src/workers/filterWorker.js — perf data rules it out.
- Do not build the adaptive quality governor (P1-D) — no long tasks observed.

## Verification commands
# Run after EVERY milestone — not just at the end.
npm run perf:probe -- http://127.0.0.1:5173   # FPS >= 58, long tasks = 0
npx eslint src/ --ext .js,.jsx --max-warnings 0
npm run build

## Revert triggers (stop and revert immediately if any are true)
- FPS drops below 58 after any change.
- A long task (>= 50ms) appears.
- npm run build fails.
- Any desktop visual drift at 1366x768, 1440x900, or 1920x1080.
- A third loading experience is introduced.
- Filtering correctness changes in any observable way.

## Milestone status file
# Codex must update PLAN.md after completing each milestone.
# Mark milestone as [DONE] and record actual perf probe result.
# Do not proceed to the next milestone until the current one passes verification.
see: PLAN.md

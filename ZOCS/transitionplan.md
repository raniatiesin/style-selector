# Comprehensive Architecture & Execution Plan: `/now` Page UI Transition Engine

## 1. Executive Summary & Context

The `/now` page interface features a split vertical layout inside the main container (`.left`), hosting two primary functional blocks:

1. **Kanban Board** — Task management board positioned in the upper region.
2. **Notes Section** — A dynamic, bloc-based text editor positioned below the Kanban board.

To optimize focus and screen real estate, the interface requires two distinct display states, allowing seamless user switching between task management and long-form note-taking:

* **`HybridMode` (Kanban-Focused):** The user actively manages tasks. The Kanban board takes primary visual real estate. The Notes section is docked at the absolute bottom of the container, revealing **only the last written note block (`LinkBloc`)** along with the active input placeholder (`"— write something..."`).
* **`FullMode` (Notes-Focused):** The user shifts focus to reading/editing notes. The Kanban board fades out and collapses out of the DOM flow (`display: none`), while the Notes section expands to occupy the full page height, rendering all note blocks.

---

## 2. Autopsy of Legacy Implementation Glitches

The initial transition system adapted from legacy modal patterns relied on continuous scroll accumulation (`wheelAccumRef`, `wheelTimeoutRef`), `margin-top: auto` layout hacks, and raw DOM class toggles (`.boardWrapGone`, `.noteBlocHidden`). This approach caused severe visual and functional flaws:

### 2.1 The "Teleportation" Snap (Layout Shift Collisions)
* **Root Cause:** In `HybridMode`, `LinkBloc` was pushed to the bottom using CSS `margin-top: auto`. When transitioning to `FullMode`, a GSAP opacity fade executed, followed by the instant application of `display: none` (`.boardWrapGone`) on the Kanban container.
* **Failure Mechanism:** The instant `display: none` took effect, the Kanban board ceased occupying layout space. Consequently, `margin-top: auto` lost its reference point, causing `LinkBloc` to instantly teleport (snap) to the top of the viewport to meet the notes list before animations completed.

### 2.2 The "Flicker" (React State vs. GSAP Desynchronization)
* **Root Cause:** React state (`scrollPastThreshold`) controlled DOM rendering by toggling CSS classes (`.noteBlocHidden`) that instantly mutated `visibility: hidden`, `height: 0`, and `padding: 0`.
* **Failure Mechanism:** React unmounted/collapsed element dimensions in the exact same frame GSAP attempted to animate opacity, leading to severe visual flickering, miscalculated heights, and layout jitter.

### 2.3 The "Hesitation" (Event Spam & Accumulator Race Conditions)
* **Root Cause:** High-frequency input devices (trackpads, smooth-scroll wheels) fired dozens of `wheel` events per second into `wheelAccumRef += event.deltaY`.
* **Failure Mechanism:** Performing mathematical checks across fragmented sub-events mid-transition created timing desynchronizations, causing animations to stutter, halt mid-frame, or enter illegal state locks.

---

## 3. Core Terminology & Architectural Principles

To guarantee clean domain modeling, the following unified nomenclature is strictly enforced across specification documentation, CSS classes, React state, and animation hooks:

| Term | Technical Definition |
| :--- | :--- |
| **`HybridMode`** | Dual-view state: Kanban visible on top, `LinkBloc` docked at bottom. |
| **`FullMode`** | Note-only state: Kanban collapsed (`display: none`), all note blocs rendered. |
| **`LinkBloc`** | The active/final note block (`blocs[blocs.length - 1]`), serving as the dynamic visual anchor between modes. |
| **`activeBlocId`** | The unique identifier of the note block currently prioritized by focus, typing, or Replay scrubber position. |

```
HYBRID MODE (Default Mount):
┌───────────────────────────────────────────┐
│                                           │
│               KANBAN BOARD                │  ← Primary viewport real estate
│                                           │
│───────────────────────────────────────────│
│ LinkBloc (blocs[N-1])                     │  ← Docked at bottom
│ — write something...                      │  ← Empty input line
└───────────────────────────────────────────┘
                    │
                    │  Scroll Down / Touch Swipe Up (Single Intent Trigger)
                    ▼
FULL MODE:
┌───────────────────────────────────────────┐
│ First bloc note...                        │
│ Second bloc note...                       │
│ ───────────────────────────────────────── │
│ LinkBloc (blocs[N-1])                     │  ← UNIVERSAL DESTINATION: CENTER SCREEN
│ — write something...                      │
└───────────────────────────────────────────┘
```

---

## 4. The Universal Destination Rule

To eliminate arbitrary positioning logic and layout shifts across varying note counts, the transition engine enforces a single deterministic spatial invariant:

$$	ext{Target } Y_{	ext{LinkBloc}} = rac{	ext{Viewport Height}}{2} - rac{	ext{LinkBloc Height}}{2}$$

Regardless of whether the document contains 1 note or 500 notes, **`LinkBloc` must always land in the exact vertical center of the screen in `FullMode`**.

### 4.1 Case Breakdown Matrix

| Scenario | HybridMode State | FullMode Target Behavior |
| :--- | :--- | :--- |
| **Case 1: Single Bloc (`N = 1`)** | `LinkBloc` rests docked at the bottom. | `LinkBloc` glides upward into the exact vertical center. Equal padding fills top and bottom regions. |
| **Case 2: Deep Blocs (`N = 89`)** | `LinkBloc` (Bloc #89) rests docked at the bottom. | The notes container auto-scrolls so Bloc #89 lands centered. `LinkBloc` glides smoothly to center screen while preceding blocs (#80–88) fade in above. |
| **Case 3: Typewriter Focus** | User typing in active line. | Typewriter auto-scroll locks the active line to the identical centered vertical offset ($Y_{	ext{center}}$). |
| **Case 4: Off-Screen Return** | User scrolled to top of notes list (`scrollTop === 0`) in `FullMode`. `LinkBloc` is off-screen below. | FLIP measures `LinkBloc`'s off-screen $Y$ coordinate and glides it **UP** into the bottom dock while Kanban fades in. |

---

## 5. Single-Snapshot FLIP Animation Architecture

The layout transitions utilize the **FLIP (First, Last, Invert, Play)** pattern to bridge React DOM reflows and smooth 60fps animations. 

Rather than calculating manual physics across every scroll tick, **the transition engine performs snapshot calculations exactly ONCE per state trigger**.

```
[User Event Trigger]
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. FIRST: Measure LinkBloc bounding box in current mode (Y_start)     │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. DOM MUTATION: Toggle Mode State (React update, layout reflow)       │
│    - Toggle `boardWrapGone` class                                      │
│    - Render/Hide preceding blocs (`scrollPastThreshold`)               │
│    - Calculate scroll offset to position LinkBloc at screen center      │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. LAST: Measure LinkBloc bounding box in target layout (Y_end)        │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. INVERT: Delta Y = Y_start - Y_end. Apply CSS transform offset       │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. PLAY: Animate transform (Delta Y -> 0) & opacity via GSAP Timeline  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Integration Architecture: Replay Mode Compatibility

The transition architecture natively supports the **Replay Scrubber feature** without requiring layout code overrides or "duct-taped" conditionals.

### 6.1 State Separation Paradigm
Layout state (`mode`) is completely decoupled from content focus state (`activeBlocId`):

```
┌────────────────────────────────────────────────────────┐
│                  Active Bloc Source                    │
│    (Driven by User Editing OR Replay Scrubber)         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
                    Sets `activeBlocId`
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
  HYBRID MODE                       FULL MODE
  - Docked at bottom                - Container auto-scrolls to
  - Swaps content inside            - keep `activeBlocId` centered
    `LinkBloc` slot in-place          in viewport as scrubber advances
```

### 6.2 Execution Rules During Replay
* **In `HybridMode`:** As time advances, `activeBlocId` changes. The container remains static at the bottom of `.left`, updating text inside the single visible `LinkBloc` node in real-time.
* **In `FullMode`:** As time advances, `activeBlocId` updates. The layout engine issues smooth programmatic scroll commands (`scrollTo`) to maintain `activeBlocId` centered on screen, turning the scrubber into a temporal auto-scroll control.

---

## 7. Complete Code Specification & Implementation

### 7.1 CSS Module (`NowPanel.module.css`)

```css
/* Container rules */
.leftPanel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 200px);
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

/* Kanban Wrapper */
.kanbanWrapper {
  width: 100%;
  opacity: 1;
  transform: translateY(0);
  will-change: transform, opacity;
  transition: opacity 0.3s ease;
}

.kanbanWrapper.boardWrapGone {
  display: none !important;
}

/* Notes Section Wrapper */
.notesSection {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

/* Hybrid Mode docking */
.notesSectionKanban {
  margin-top: auto;
  padding-top: 48px;
}

/* Bloc styles */
.noteBloc {
  width: 100%;
  box-sizing: border-box;
  will-change: transform, opacity;
}

.noteBlocHidden {
  display: none !important;
}

/* LinkBloc dynamic anchor */
.linkBloc {
  position: relative;
  z-index: 10;
}
```

### 7.2 React Component (`NowPanel.jsx`)

```jsx
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import styles from './NowPanel.module.css';

gsap.registerPlugin(Flip);

export default function NowPanel({ blocs, activeBlocId, onBlocChange }) {
  const [mode, setMode] = useState('HYBRID'); // 'HYBRID' | 'FULL'
  const [scrollPastThreshold, setScrollPastThreshold] = useState(false);
  
  const containerRef = useRef(null);
  const kanbanRef = useRef(null);
  const notesContainerRef = useRef(null);
  const linkBlocRef = useRef(null);
  const isTransitioningRef = useRef(false);

  // LinkBloc is defined as the active/last note block
  const linkBlocIndex = blocs.length - 1;

  /**
   * Transition: HYBRID -> FULL
   */
  const animateToFull = () => {
    if (isTransitioningRef.current || mode === 'FULL') return;
    isTransitioningRef.current = true;

    // 1. Snapshot Start Position
    const state = Flip.getState(linkBlocRef.current);

    // 2. DOM State Mutate
    setScrollPastThreshold(true);
    setMode('FULL');

    // 3. Execution after React render reflow
    requestAnimationFrame(() => {
      // Auto-scroll container so LinkBloc hits exact vertical center
      if (notesContainerRef.current && linkBlocRef.current) {
        const container = notesContainerRef.current;
        const linkBloc = linkBlocRef.current;
        
        const containerHeight = container.clientHeight;
        const blocHeight = linkBloc.offsetHeight;
        const blocTop = linkBloc.offsetTop;

        const targetScrollTop = blocTop - (containerHeight / 2) + (blocHeight / 2);
        container.scrollTop = Math.max(0, targetScrollTop);
      }

      // 4. GSAP Flip Animation
      const tl = gsap.timeline({
        onComplete: () => {
          if (kanbanRef.current) {
            kanbanRef.current.classList.add(styles.boardWrapGone);
          }
          isTransitioningRef.current = false;
        }
      });

      // Fade out Kanban
      tl.to(kanbanRef.current, {
        opacity: 0,
        y: -30,
        duration: 0.35,
        ease: 'power2.in'
      }, 0);

      // Glide LinkBloc & Preceding Notes
      Flip.from(state, {
        duration: 0.45,
        ease: 'power3.out',
        absolute: false,
        targets: linkBlocRef.current,
      }, 0);

      // Fade in newly exposed upper blocs
      const precedingBlocs = containerRef.current.querySelectorAll(`.${styles.noteBloc}:not(.${styles.linkBloc})`);
      if (precedingBlocs.length > 0) {
        tl.fromTo(precedingBlocs, 
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.35, stagger: 0.03, ease: 'power2.out' },
          0.1
        );
      }
    });
  };

  /**
   * Transition: FULL -> HYBRID
   */
  const animateToHybrid = () => {
    if (isTransitioningRef.current || mode === 'HYBRID') return;
    isTransitioningRef.current = true;

    // 1. Immediately unhide Kanban DOM element
    if (kanbanRef.current) {
      kanbanRef.current.classList.remove(styles.boardWrapGone);
      gsap.set(kanbanRef.current, { opacity: 0, y: -30 });
    }

    // 2. Snapshot Start Position
    const state = Flip.getState(linkBlocRef.current);

    // 3. DOM State Mutate
    setScrollPastThreshold(false);
    setMode('HYBRID');

    requestAnimationFrame(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          isTransitioningRef.current = false;
        }
      });

      // Animate Kanban back in
      tl.to(kanbanRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out'
      }, 0.05);

      // Glide LinkBloc back to docked bottom slot
      Flip.from(state, {
        duration: 0.45,
        ease: 'power3.inOut',
        targets: linkBlocRef.current,
      }, 0);
    });
  };

  /**
   * Clean Gesture Listeners (Intent-driven, NO Accumulator)
   */
  useEffect(() => {
    const handleWheel = (e) => {
      if (isTransitioningRef.current) return;

      if (mode === 'HYBRID' && e.deltaY > 25) {
        animateToFull();
      } else if (mode === 'FULL') {
        const container = notesContainerRef.current;
        // Trigger exit only when user scrolls UP at top boundary
        if (container && container.scrollTop === 0 && e.deltaY < -25) {
          animateToHybrid();
        }
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      if (isTransitioningRef.current) return;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY - touchEndY;

      if (mode === 'HYBRID' && deltaY > 45) {
        animateToFull();
      } else if (mode === 'FULL') {
        const container = notesContainerRef.current;
        if (container && container.scrollTop === 0 && deltaY < -45) {
          animateToHybrid();
        }
      }
    };

    const targetElem = containerRef.current;
    if (targetElem) {
      targetElem.addEventListener('wheel', handleWheel, { passive: true });
      targetElem.addEventListener('touchstart', handleTouchStart, { passive: true });
      targetElem.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (targetElem) {
        targetElem.removeEventListener('wheel', handleWheel);
        targetElem.removeEventListener('touchstart', handleTouchStart);
        targetElem.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [mode]);

  return (
    <div ref={containerRef} className={styles.leftPanel}>
      {/* KANBAN BOARD WRAPPER */}
      <div ref={kanbanRef} className={styles.kanbanWrapper}>
        <div className="kanban-board-placeholder">
          {/* Kanban Board Component */}
        </div>
      </div>

      {/* NOTES SECTION WRAPPER */}
      <div 
        ref={notesContainerRef}
        className={`${styles.notesSection} ${mode === 'HYBRID' ? styles.notesSectionKanban : ''}`}
      >
        {blocs.map((bloc, i) => {
          const isLinkBloc = i === linkBlocIndex;
          const isHiddenInHybrid = i < linkBlocIndex && !scrollPastThreshold;

          return (
            <div
              key={bloc.id || i}
              ref={isLinkBloc ? linkBlocRef : null}
              className={`
                ${styles.noteBloc} 
                ${isLinkBloc ? styles.linkBloc : ''} 
                ${isHiddenInHybrid ? styles.noteBlocHidden : ''}
              `}
            >
              <div className="note-content">
                {bloc.text}
              </div>
            </div>
          );
        })}
        
        {/* Active Input Line */}
        <div className="input-line">
          <span>— write something...</span>
        </div>
      </div>
    </div>
  );
}
```

---

## 8. Verification & QA Matrix

To verify zero regression during testing, run the following verification checks:

| Checkpoint | Target Outcome | Verification Pass Criteria |
| :--- | :--- | :--- |
| **1. Single-Bloc Transition** | `HybridMode` -> `FullMode` with 1 note item. | `LinkBloc` moves directly from bottom dock to screen center without text jump. |
| **2. High-Density Note Transition** | `HybridMode` -> `FullMode` with 100+ note items. | Container auto-scrolls to center `LinkBloc` (Bloc #100) instantly, preceding items stagger fade in. |
| **3. Boundary Return Trigger** | Scroll up in `FullMode`. | Mode DOES NOT exit unless `scrollTop === 0`. Scrolling internal notes works uninterrupted. |
| **4. Off-screen LinkBloc Exit** | User scrolls to top in `FullMode` (`LinkBloc` scrolled out of view below), then swipes down. | `LinkBloc` glides smoothly UP into the bottom dock slot from below screen bounds. |
| **5. Rapid Scroll Spam** | Rapid trackpad fling down/up. | `isTransitioningRef` guards against re-triggering; zero state locks or visual flickering. |

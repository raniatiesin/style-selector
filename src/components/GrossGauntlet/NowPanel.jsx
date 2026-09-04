import React, { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import styles from './NowPanel.module.css';

gsap.registerPlugin(Flip);

/**
 * NowPanel — Layout transition engine for /now page.
 *
 * Uses native GSAP Flip mechanics: snapshot layout state BEFORE the DOM
 * change, then let Flip.from() automatically interpolate the difference
 * after the new layout is committed.
 */
export default function NowPanel({
  blocs,
  kanbanContent,
  renderBloc,
  renderEmptyLine,
  notesContainerRef,
  notifications,
  onDismissNotification
}) {
  const [mode, setMode] = useState('HYBRID');
  const [scrollPastThreshold, setScrollPastThreshold] = useState(false);

  const containerRef = useRef(null);
  const kanbanRef = useRef(null);
  const internalNotesRef = useRef(null);
  const linkBlocRef = useRef(null);
  const isTransitioningRef = useRef(false);

  const linkBlocIndex = blocs.length - 1;

  useEffect(() => {
    if (notesContainerRef && internalNotesRef.current) {
      notesContainerRef.current = internalNotesRef.current;
    }
  });

  // ── Shared helpers ──────────────────────────────────────────
  const $ = gsap;

  /** Kill all GSAP tweens on an element (or list of elements) */
  function killAll(arr) {
    const list = arr instanceof NodeList ? Array.from(arr) : Array.isArray(arr) ? arr : [arr];
    list.forEach(el => { if (el) el._gsap && el._gsap.kill && $.killTweensOf(el); });
  }

  /** Pre-clear: strip any leftover `transform` and `marginTop` inline from previous transitions */
  function clearSafe(el) {
    if (!el) return;
    killAll(el);
    $.set(el, { clearProps: 'transform,marginTop,top,left,opacity' });
  }

  // ─────────────────────────────────────────────────
  // HYBRID → FULL
  // ─────────────────────────────────────────────────
  const animateToFull = useCallback(() => {
    if (isTransitioningRef.current || mode === 'FULL') return;
    isTransitioningRef.current = true;

    const linkBloc = linkBlocRef.current;
    const container = internalNotesRef.current;
    if (!linkBloc || !container) { isTransitioningRef.current = false; return; }

    // 0. Pre-clear ALL animated targets (SYMMETRIC — includes kanbanRef)
    const allBlocs = container.querySelectorAll(`.${styles.noteBloc}`);
    allBlocs.forEach(clearSafe);
    clearSafe(kanbanRef.current);

    // 1. Snapshot layout state before DOM change
    const state = Flip.getState(linkBloc);

    // 2. Commit layout state change synchronously
    flushSync(() => {
      setScrollPastThreshold(true);
      setMode('FULL');
    });

    // 3. Adjust container scroll so LinkBloc target is centered
    container.scrollTop = Math.max(0,
      linkBloc.offsetTop - (container.clientHeight / 2) + (linkBloc.clientHeight / 2)
    );

    // 4. Kanban slides up-and-out using marginTop (safe — no containing block)
    //    then hidden. Use overwrite:true so spam-toggling mid-anim kills stale tweens.
    if (kanbanRef.current) {
      $.to(kanbanRef.current, {
        marginTop: -60,
        opacity: 0,
        duration: 0.25,
        overwrite: 'auto',
        ease: 'power2.out',
        onComplete: () => {
          $.set(kanbanRef.current, { clearProps: 'marginTop' });
          kanbanRef.current.classList.add(styles.boardWrapGone);
        }
      });
    }

    // 5. GSAP Flip interpolates the linkBloc layout change
    Flip.from(state, {
      duration: 0.35,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => {
        // Strip any residual transform Flip may have left on linkBloc
        clearSafe(linkBloc);
        isTransitioningRef.current = false;
      }
    });

    // 6. Preceding blocs stagger fade-in with a subtle marginTop settle
    //    (NO transform — marginTop is safe for dnd-kit coordinate space)
    const precedingBlocs = containerRef.current?.querySelectorAll(
      `.${styles.noteBloc}:not(.${styles.linkBloc})`
    );
    if (precedingBlocs && precedingBlocs.length > 0) {
      killAll(precedingBlocs);
      $.fromTo(precedingBlocs,
        { opacity: 0, marginTop: 12 },
        {
          opacity: 1, marginTop: 0,
          duration: 0.35, stagger: 0.03,
          ease: 'power2.out', delay: 0.1,
          overwrite: 'auto',
          onComplete: () => {
            // Strip the synthetic marginTop after animation so layout isn't shifted
            precedingBlocs.forEach(el => $.set(el, { clearProps: 'marginTop' }));
          }
        }
      );
    }
  }, [mode]);

  // ─────────────────────────────────────────────────
  // FULL → HYBRID
  // ─────────────────────────────────────────────────
  const animateToHybrid = useCallback(() => {
    if (isTransitioningRef.current || mode === 'HYBRID') return;
    isTransitioningRef.current = true;

    const linkBloc = linkBlocRef.current;
    const container = internalNotesRef.current;
    if (!linkBloc || !container) { isTransitioningRef.current = false; return; }

    // 0. Pre-clear ALL animated targets (SYMMETRIC — same as animateToFull)
    const allBlocs = container.querySelectorAll(`.${styles.noteBloc}`);
    allBlocs.forEach(clearSafe);
    clearSafe(kanbanRef.current);

    // 1. Unhide Kanban, set initial marginTop so it slides in from above
    if (kanbanRef.current) {
      kanbanRef.current.classList.remove(styles.boardWrapGone);
      // marginTop is safe — does NOT create a containing block for position:fixed
      $.set(kanbanRef.current, { opacity: 0, marginTop: -60 });
    }

    // 2. Snapshot layout state before DOM change
    const state = Flip.getState(linkBloc);

    // 3. Commit HybridMode state synchronously
    flushSync(() => {
      setScrollPastThreshold(false);
      setMode('HYBRID');
    });

    // 4. Reset scroll (Hybrid docks via margin-top:auto, no scroll)
    container.scrollTop = 0;

    // 5. Kanban slides back into view using marginTop (safe), then clear it
    if (kanbanRef.current) {
      $.to(kanbanRef.current, {
        marginTop: 0,
        opacity: 1,
        duration: 0.25,
        overwrite: 'auto',
        ease: 'power2.out'
      });
    }

    // 6. GSAP Flip handles the linkBloc interpolation
    Flip.from(state, {
      duration: 0.35,
      ease: 'power2.inOut',
      overwrite: true,
      onComplete: () => {
        // Strip any residual transforms Flip may have left on linkBloc,
        // and also strip the synthetic marginTop from kanbanRef
        clearSafe(linkBloc);
        if (kanbanRef.current) $.set(kanbanRef.current, { clearProps: 'marginTop' });
        allBlocs.forEach(el => $.set(el, { clearProps: 'marginTop' }));
        isTransitioningRef.current = false;
      }
    });
  }, [mode]);

  // ─────────────────────────────────────────────────
  // Gesture Listeners
  // ─────────────────────────────────────────────────
  useEffect(() => {
    const handleWheel = (e) => {
      if (isTransitioningRef.current) return;
      if (mode === 'HYBRID' && e.deltaY > 25) {
        animateToFull();
      } else if (mode === 'FULL') {
        const c = internalNotesRef.current;
        if (c && c.scrollTop === 0 && e.deltaY < -25) {
          animateToHybrid();
        }
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
    const handleTouchEnd = (e) => {
      if (isTransitioningRef.current) return;
      const deltaY = touchStartY - e.changedTouches[0].clientY;
      if (mode === 'HYBRID' && deltaY > 45) {
        animateToFull();
      } else if (mode === 'FULL') {
        const c = internalNotesRef.current;
        if (c && c.scrollTop === 0 && deltaY < -45) {
          animateToHybrid();
        }
      }
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: true });
      el.addEventListener('touchstart', handleTouchStart, { passive: true });
      el.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    return () => {
      if (el) {
        el.removeEventListener('wheel', handleWheel);
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [mode, animateToFull, animateToHybrid]);

  // ─────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={styles.leftPanel}>
      <div ref={kanbanRef} className={styles.kanbanWrapper}>
        {kanbanContent}
      </div>
      <div
        ref={(el) => {
          internalNotesRef.current = el;
          if (notesContainerRef) notesContainerRef.current = el;
        }}
        className={`${styles.notesSection} ${
          mode === 'HYBRID' ? styles.notesSectionKanban : styles.notesSectionFull
        }`}
      >
        {blocs.map((bloc, i) => {
          const isLinkBloc = i === linkBlocIndex;
          const isHiddenInHybrid = i < linkBlocIndex && !scrollPastThreshold;
          return (
            <div
              key={bloc.bloc_id || i}
              ref={isLinkBloc ? linkBlocRef : null}
              className={`
                ${styles.noteBloc}
                ${isLinkBloc ? styles.linkBloc : ''}
                ${isHiddenInHybrid ? styles.noteBlocHidden : ''}
              `}
            >
              {renderBloc(bloc, i, isLinkBloc, isHiddenInHybrid)}
            </div>
          );
        })}
        {renderEmptyLine()}
      </div>
      {notifications && notifications.length > 0 && (
        <div className={styles.notifContainer}>
          {notifications.map(n => (
            <div
              key={n.id}
              className={`${styles.notif} ${styles['notif_' + n.type] || ''}`}
              onClick={() => onDismissNotification?.(n.id)}
              role="alert"
            >
              <div className={styles.notifHeader}>
                <span className={styles.notifAction}>{n.action}</span>
                <span className={styles.notifEndpoint}>{n.endpoint}</span>
                {n.statusCode && (
                  <span className={`${styles.notifStatus} ${n.statusCode < 300 ? styles.notifStatusOk : styles.notifStatusErr}`}>
                    {n.statusCode}
                  </span>
                )}
              </div>
              <div className={styles.notifMessage}>{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
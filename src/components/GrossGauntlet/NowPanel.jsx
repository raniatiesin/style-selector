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

  // ─────────────────────────────────────────────────
  // HYBRID → FULL
  // ─────────────────────────────────────────────────
  const animateToFull = useCallback(() => {
    if (isTransitioningRef.current || mode === 'FULL') return;
    isTransitioningRef.current = true;

    const linkBloc = linkBlocRef.current;
    const container = internalNotesRef.current;
    if (!linkBloc || !container) { isTransitioningRef.current = false; return; }

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

    // 4. Let GSAP Flip handle the layout interpolation automatically.
    //    Flip.from() reads the post-scroll DOM position as the LAST state,
    //    pairs it with the FIRST state (captured above), computes the delta,
    //    and animates to zero — no manual Y math needed.
    Flip.from(state, {
      duration: 0.35,
      ease: 'power2.out',
      onStart: () => {
        gsap.to(kanbanRef.current, { opacity: 0, duration: 0.25 });
      },
      onComplete: () => {
        gsap.set(linkBloc, { clearProps: 'transform' });
        if (kanbanRef.current) {
          kanbanRef.current.classList.add(styles.boardWrapGone);
        }
        isTransitioningRef.current = false;
      }
    });

    // Preceding blocs: stagger fade in (they went from display:none → visible)
    const precedingBlocs = containerRef.current?.querySelectorAll(
      `.${styles.noteBloc}:not(.${styles.linkBloc})`
    );
    if (precedingBlocs && precedingBlocs.length > 0) {
      gsap.fromTo(precedingBlocs,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.03, ease: 'power2.out', delay: 0.1 }
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

    // 1. Unhide Kanban (render-tree present, visually hidden via GSAP)
    if (kanbanRef.current) {
      kanbanRef.current.classList.remove(styles.boardWrapGone);
      gsap.set(kanbanRef.current, { opacity: 0, y: -30 });
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

    // 5. Flip handles the interpolation automatically
    Flip.from(state, {
      duration: 0.35,
      ease: 'power2.inOut',
      onStart: () => {
        gsap.to(kanbanRef.current, { opacity: 1, y: 0, duration: 0.25 });
      },
      onComplete: () => {
        gsap.set(linkBloc, { clearProps: 'transform' });
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
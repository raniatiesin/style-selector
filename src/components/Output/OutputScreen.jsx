import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import { getManifest } from '../../utils/dataCache';
import { preloadImagesPriority } from '../../utils/preloader';
import { EASE, DUR, STAGGER } from '../../config/animation';
import { STAGES } from '../../config/questionTree';
import StyleCarousel from './StyleCarousel';
import TagPill from '../shared/TagPill';
import styles from './Output.module.css';

function buildFinalTally(answers) {
  return Array.from({ length: 12 }, (_, i) => answers[i * 3 + 2])
    .filter(Boolean)
    .join(', ');
}

/**
 * Tag-overlap fallback — used when /api/search is unreachable.
 */
function tagOverlapFallback(tally, count = 6) {
  const manifest = getManifest();
  if (!manifest || manifest.length === 0) return [];

  const userTags = tally.split(', ').filter(Boolean);

  const scored = manifest.map(style => {
    const styleTags = style.tally.split(', ');
    const overlap = userTags.filter(t => styleTags.includes(t)).length;
    return { id: style.id, overlap, similarity: overlap / Math.max(userTags.length, 1) };
  });

  scored.sort((a, b) => b.overlap - a.overlap);
  return scored.slice(0, count).map(s => ({ id: s.id, similarity: s.similarity }));
}

/** Look up tally string for a styleId from manifest */
function getStyleTally(styleId) {
  const manifest = getManifest();
  const entry = manifest?.find(m => m.id === styleId);
  return entry?.tally || '';
}

export default function OutputScreen() {
  const carouselGridRef = useRef(null);
  const leftPanelRef = useRef(null);
  const loadingRef = useRef(null);
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const subTextRef = useRef(null);
  const loadingTlRef = useRef(null);
  const [showLoading, setShowLoading] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height || window.innerHeight);

  // Find-similar loading overlay refs
  const simLoadRef = useRef(null);
  const simLineRef = useRef(null);
  const simTextRef = useRef(null);
  const simTlRef = useRef(null);
  const [simLoading, setSimLoading] = useState(false);
  const [pendingSimResults, setPendingSimResults] = useState(null);
  const mobileCardsWrapRef = useRef(null);
  const mobileCardRefs = useRef([]);
  const cardNavVersionRef = useRef(0);
  const cardNavTimeoutRef = useRef(null);
  const cardSwipeRef = useRef({
    dragging: false,
    axis: null,
    startX: 0,
    startY: 0,
    offsetY: 0,
  });
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [isTouchLikeInput, setIsTouchLikeInput] = useState(() => {
    return window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  });
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentSlideCount, setCurrentSlideCount] = useState(6);

  const answers = useQuizStore(s => s.answers);
  const outputResults = useQuizStore(s => s.outputResults);
  const outputHistory = useQuizStore(s => s.outputHistory);
  const sessionId = useQuizStore(s => s.sessionId);
  const selectedCarousel = useQuizStore(s => s.selectedCarousel);

  const setOutputResults = useQuizStore(s => s.setOutputResults);
  const setSessionId = useQuizStore(s => s.setSessionId);
  const setSelectedCarousel = useQuizStore(s => s.setSelectedCarousel);
  const pushToHistory = useQuizStore(s => s.pushToHistory);
  const popHistory = useQuizStore(s => s.popHistory);
  const setIsSearching = useQuizStore(s => s.setIsSearching);
  const prepareConfirmation = useQuizStore(s => s.prepareConfirmation);
  const jumpToQuizStep = useQuizStore(s => s.jumpToQuizStep);

  const isMobileLayout = isMobileViewport;

  const applyMobileDeckTransform = useCallback((cardIndex, offset = 0, animate = false) => {
    if (!mobileCardsWrapRef.current) return;
    const targetY = -(cardIndex * viewportHeight) + offset;
    if (animate) {
      gsap.to(mobileCardsWrapRef.current, {
        y: targetY,
        duration: 0.32,
        ease: 'power2.out',
      });
      return;
    }
    gsap.set(mobileCardsWrapRef.current, { y: targetY });
  }, [viewportHeight]);

  const queueCardIndexUpdate = useCallback((index, animate = true) => {
    const maxIndex = Math.max(0, outputResults.length - 1);
    const clamped = Math.max(0, Math.min(maxIndex, index));
    const version = ++cardNavVersionRef.current;

    if (cardNavTimeoutRef.current !== null) {
      clearTimeout(cardNavTimeoutRef.current);
      cardNavTimeoutRef.current = null;
    }

    cardNavTimeoutRef.current = setTimeout(() => {
      cardNavTimeoutRef.current = null;
      if (cardNavVersionRef.current !== version) return;
      setCurrentCardIndex(clamped);
      applyMobileDeckTransform(clamped, 0, animate);
    }, 0);
  }, [outputResults.length, applyMobileDeckTransform]);

  const readCurrentSlideState = useCallback((cardIndex) => {
    const cardEl = mobileCardRefs.current[cardIndex];
    if (!cardEl) {
      setCurrentSlideIndex(0);
      setCurrentSlideCount(6);
      return;
    }

    const dots = Array.from(cardEl.querySelectorAll(`.${styles.dot}`));
    setCurrentSlideCount(dots.length || 6);

    const activeIdx = dots.findIndex(dot => dot.classList.contains(styles.active));
    setCurrentSlideIndex(activeIdx >= 0 ? activeIdx : 0);
  }, []);

  const handleMobileConfirm = useCallback(() => {
    const active = outputResults[currentCardIndex];
    if (!active) return;
    setSelectedCarousel(active.id);
    prepareConfirmation();
  }, [outputResults, currentCardIndex, setSelectedCarousel, prepareConfirmation]);

  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(window.visualViewport?.height || window.innerHeight);
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    const updateInputAndViewportMode = () => {
      setIsMobileViewport(window.matchMedia('(max-width: 767px)').matches);
      setIsTouchLikeInput(
        window.matchMedia('(pointer: coarse)').matches ||
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0)
      );
    };

    updateInputAndViewportMode();
    window.addEventListener('resize', updateInputAndViewportMode);

    return () => {
      window.removeEventListener('resize', updateInputAndViewportMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cardNavTimeoutRef.current !== null) {
        clearTimeout(cardNavTimeoutRef.current);
        cardNavTimeoutRef.current = null;
      }
    };
  }, []);

  // User's tally tags from quiz answers
  const userTags = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => answers[i * 3 + 2]).filter(Boolean);
  }, [answers]);

  // Selected style's tally tags
  const selectedTags = useMemo(() => {
    if (!selectedCarousel) return [];
    return getStyleTally(selectedCarousel).split(', ').filter(Boolean);
  }, [selectedCarousel]);

  const mobileActiveResult = useMemo(() => {
    if (outputResults.length === 0) return null;
    return outputResults[Math.min(currentCardIndex, outputResults.length - 1)] || null;
  }, [outputResults, currentCardIndex]);

  const mobileOverlayTags = useMemo(() => {
    if (!mobileActiveResult) return userTags;
    return getStyleTally(mobileActiveResult.id).split(', ').filter(Boolean);
  }, [mobileActiveResult, userTags]);

  const mobileTagRows = useMemo(() => {
    const splitAt = Math.ceil(mobileOverlayTags.length / 2);
    return [
      mobileOverlayTags.slice(0, splitAt),
      mobileOverlayTags.slice(splitAt),
    ];
  }, [mobileOverlayTags]);

  // Compute results on mount — POST tally to /api/search
  useEffect(() => {
    if (outputResults.length > 0) return;
    if (useQuizStore.getState().isSearching) return; // Quiz already fired this early

    const tally = buildFinalTally(answers);

    async function computeResults() {
      setIsSearching(true);

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tally }),
        });

        if (!res.ok) throw new Error('Search API failed');
        const data = await res.json();

        setSessionId(data.sessionId);
        setOutputResults(data.results);
      } catch (err) {
        console.error('Search failed:', err);
        const fallback = tagOverlapFallback(tally);
        if (fallback.length > 0) {
          setOutputResults(fallback);
        }
      } finally {
        setIsSearching(false);
      }
    }

    computeResults();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload result rep images immediately when they arrive
  useEffect(() => {
    if (outputResults.length === 0) return;
    preloadImagesPriority(outputResults.map(r => r.id));
  }, [outputResults]);

  // Loading screen entrance animation
  useEffect(() => {
    if (!showLoading || !loadingRef.current) return;

    const tl = gsap.timeline();
    loadingTlRef.current = tl;

    tl.fromTo(textRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.8, ease: EASE.confident }
    );

    tl.fromTo(lineRef.current,
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 0.6, ease: EASE.confident },
      '-=0.4'
    );

    tl.fromTo(subTextRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: EASE.out },
      '-=0.2'
    );

    tl.to(lineRef.current, {
      scaleX: 0.6,
      opacity: 0.3,
      duration: 1.4,
      ease: EASE.organic,
      repeat: -1,
      yoyo: true,
    }, '+=0.3');

    return () => tl.kill();
  }, [showLoading]);

  // Transition: loading out → results in
  useEffect(() => {
    if (outputResults.length === 0 || !showLoading) return;

    if (loadingTlRef.current) loadingTlRef.current.kill();

    const exitTl = gsap.timeline({
      onComplete: () => setShowLoading(false),
    });

    exitTl.to(lineRef.current, {
      scaleX: 0,
      opacity: 0,
      duration: DUR.medium,
      ease: EASE.in,
    });

    exitTl.to([textRef.current, subTextRef.current], {
      opacity: 0,
      y: -8,
      duration: DUR.medium,
      ease: EASE.in,
    }, 0);

    exitTl.to(loadingRef.current, {
      opacity: 0,
      duration: DUR.fast,
      ease: EASE.in,
    }, `-=${DUR.fast}`);
  }, [outputResults, showLoading]);

  // Entrance animation for split layout (after loading is gone)
  useEffect(() => {
    if (showLoading || outputResults.length === 0) return;

    if (isMobileLayout) return;

    // Left panel fade in
    if (leftPanelRef.current) {
      gsap.fromTo(leftPanelRef.current,
        { opacity: 0, x: -16 },
        { opacity: 1, x: 0, duration: 0.5, ease: EASE.confident, delay: 0.1 }
      );
    }

    // Right panel carousels stagger in
    const carousels = carouselGridRef.current?.children;
    if (carousels) {
      gsap.fromTo(
        Array.from(carousels),
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, stagger: STAGGER.carousels, ease: EASE.confident, delay: 0.15 }
      );
    }
  }, [showLoading, outputResults, isMobileLayout]);

  // Find-similar loading entrance animation
  useEffect(() => {
    if (!simLoading || !simLoadRef.current) return;

    const tl = gsap.timeline();
    simTlRef.current = tl;

    tl.fromTo(simTextRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.6, ease: EASE.confident }
    );
    tl.fromTo(simLineRef.current,
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 0.5, ease: EASE.confident },
      '-=0.3'
    );
    tl.to(simLineRef.current, {
      scaleX: 0.5, opacity: 0.3,
      duration: 1.2, ease: EASE.organic,
      repeat: -1, yoyo: true,
    }, '+=0.2');

    return () => tl.kill();
  }, [simLoading]);

  // When results arrive while simLoading, animate out loader → stagger in carousels
  useEffect(() => {
    if (!simLoading || !pendingSimResults) return;

    if (simTlRef.current) simTlRef.current.kill();

    const exitTl = gsap.timeline({
      onComplete: () => {
        setOutputResults(pendingSimResults);
        setPendingSimResults(null);
        setSimLoading(false);
        setIsSearching(false);

        if (isMobileLayout) {
          queueCardIndexUpdate(0, false);
          return;
        }

        const items = carouselGridRef.current?.children;
        if (items) {
          gsap.fromTo(Array.from(items),
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.5, stagger: STAGGER.carousels, ease: EASE.confident }
          );
        }
      },
    });

    exitTl.to(simLineRef.current, {
      scaleX: 0, opacity: 0,
      duration: DUR.medium, ease: EASE.in,
    });
    exitTl.to(simTextRef.current, {
      opacity: 0, y: -6,
      duration: DUR.medium, ease: EASE.in,
    }, 0);
    exitTl.to(simLoadRef.current, {
      opacity: 0,
      duration: DUR.fast, ease: EASE.in,
    }, `-=${DUR.fast}`);
  }, [simLoading, pendingSimResults, setOutputResults, setIsSearching, isMobileLayout, queueCardIndexUpdate]);

  useEffect(() => {
    if (!isMobileLayout || showLoading) return;
    applyMobileDeckTransform(currentCardIndex, 0, false);
  }, [isMobileLayout, showLoading, currentCardIndex, viewportHeight, applyMobileDeckTransform]);

  useEffect(() => {
    if (!isMobileLayout) return;
    if (outputResults.length === 0) {
      setCurrentCardIndex(0);
      setCurrentSlideIndex(0);
      return;
    }

    if (currentCardIndex > outputResults.length - 1) {
      queueCardIndexUpdate(outputResults.length - 1, false);
      return;
    }

    if (!selectedCarousel) {
      setSelectedCarousel(outputResults[0].id);
      return;
    }

    const selectedIndex = outputResults.findIndex(r => r.id === selectedCarousel);
    if (selectedIndex >= 0 && selectedIndex !== currentCardIndex) {
      queueCardIndexUpdate(selectedIndex, false);
    }
  }, [
    isMobileLayout,
    outputResults,
    selectedCarousel,
    currentCardIndex,
    queueCardIndexUpdate,
    setSelectedCarousel,
  ]);

  useEffect(() => {
    if (!isMobileLayout || outputResults.length === 0) return;
    const active = outputResults[currentCardIndex];
    if (active && selectedCarousel !== active.id) {
      setSelectedCarousel(active.id);
    }
  }, [isMobileLayout, outputResults, currentCardIndex, selectedCarousel, setSelectedCarousel]);

  useEffect(() => {
    if (!isMobileLayout || showLoading || outputResults.length === 0) return;

    const cardEl = mobileCardRefs.current[currentCardIndex];
    if (!cardEl) {
      setCurrentSlideIndex(0);
      setCurrentSlideCount(6);
      return;
    }

    const update = () => readCurrentSlideState(currentCardIndex);
    update();

    const observer = new MutationObserver(update);
    const dots = cardEl.querySelectorAll(`.${styles.dot}`);
    dots.forEach(dot => {
      observer.observe(dot, { attributes: true, attributeFilter: ['class'] });
    });

    return () => observer.disconnect();
  }, [isMobileLayout, showLoading, outputResults.length, currentCardIndex, readCurrentSlideState]);

  const handleMobileDeckPointerDown = useCallback((e) => {
    if (!isMobileLayout || !isTouchLikeInput || showLoading || simLoading) return;

    cardSwipeRef.current.dragging = true;
    cardSwipeRef.current.axis = null;
    cardSwipeRef.current.startX = e.pageX;
    cardSwipeRef.current.startY = e.pageY;
    cardSwipeRef.current.offsetY = 0;
  }, [isMobileLayout, isTouchLikeInput, showLoading, simLoading]);

  const handleMobileDeckPointerMove = useCallback((e) => {
    if (!isMobileLayout || !isTouchLikeInput) return;
    if (!cardSwipeRef.current.dragging) return;

    const deltaX = e.pageX - cardSwipeRef.current.startX;
    const deltaY = e.pageY - cardSwipeRef.current.startY;

    if (!cardSwipeRef.current.axis && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
      cardSwipeRef.current.axis = Math.abs(deltaY) > Math.abs(deltaX) ? 'y' : 'x';
    }

    if (cardSwipeRef.current.axis !== 'y') return;

    cardSwipeRef.current.offsetY = deltaY;
    applyMobileDeckTransform(currentCardIndex, deltaY, false);
  }, [isMobileLayout, isTouchLikeInput, currentCardIndex, applyMobileDeckTransform]);

  const handleMobileDeckPointerUp = useCallback((e) => {
    if (!isMobileLayout || !isTouchLikeInput) return;
    if (!cardSwipeRef.current.dragging) return;

    const deltaY = e.pageY - cardSwipeRef.current.startY;
    const axis = cardSwipeRef.current.axis;

    cardSwipeRef.current.dragging = false;
    cardSwipeRef.current.axis = null;
    cardSwipeRef.current.offsetY = 0;

    if (axis !== 'y') {
      applyMobileDeckTransform(currentCardIndex, 0, true);
      return;
    }

    const threshold = Math.min(120, Math.max(50, viewportHeight * 0.1));
    let nextIndex = currentCardIndex;

    if (deltaY < -threshold && currentCardIndex < outputResults.length - 1) {
      nextIndex = currentCardIndex + 1;
    } else if (deltaY > threshold && currentCardIndex > 0) {
      nextIndex = currentCardIndex - 1;
    }

    if (nextIndex !== currentCardIndex) {
      queueCardIndexUpdate(nextIndex, true);
      return;
    }

    applyMobileDeckTransform(currentCardIndex, 0, true);
  }, [
    isMobileLayout,
    isTouchLikeInput,
    currentCardIndex,
    outputResults.length,
    viewportHeight,
    queueCardIndexUpdate,
    applyMobileDeckTransform,
  ]);

  const handleMobileDeckPointerCancel = useCallback(() => {
    if (!isMobileLayout || !isTouchLikeInput) return;
    if (!cardSwipeRef.current.dragging) return;

    cardSwipeRef.current.dragging = false;
    cardSwipeRef.current.axis = null;
    cardSwipeRef.current.offsetY = 0;
    applyMobileDeckTransform(currentCardIndex, 0, true);
  }, [isMobileLayout, isTouchLikeInput, currentCardIndex, applyMobileDeckTransform]);

  // Carousel click → just select it on the left panel
  const handleCarouselClick = useCallback((styleId) => {
    setSelectedCarousel(styleId);
  }, [setSelectedCarousel]);

  const handleFindSimilar = useCallback(async () => {
    const styleIdForSimilar = isMobileLayout
      ? (outputResults[currentCardIndex]?.id || selectedCarousel)
      : selectedCarousel;

    if (!styleIdForSimilar || simLoading) return;

    if (styleIdForSimilar !== selectedCarousel) {
      setSelectedCarousel(styleIdForSimilar);
    }

    pushToHistory();
    setIsSearching(true);

    // Exit current carousels → show loading overlay
    const carousels = carouselGridRef.current?.children;
    if (!isMobileLayout && carousels) {
      gsap.timeline()
        .to(Array.from(carousels), {
          opacity: 0, y: -10,
          duration: 0.18, stagger: 0.04, ease: 'power2.in',
          onComplete: () => {
            setOutputResults([]);
            setSimLoading(true);
          },
        });
    } else {
      setOutputResults([]);
      setSimLoading(true);
    }

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId: styleIdForSimilar, sessionId }),
      });

      if (!res.ok) throw new Error('Find similar failed');
      const data = await res.json();

      // Store results — the simLoading effect will animate out loader + stagger in
      setPendingSimResults(data.results);
    } catch (err) {
      console.error('Find similar failed:', err);
      setSimLoading(false);
      setIsSearching(false);
    }
  }, [
    selectedCarousel,
    sessionId,
    simLoading,
    pushToHistory,
    setOutputResults,
    setIsSearching,
    isMobileLayout,
    outputResults,
    currentCardIndex,
    setSelectedCarousel,
  ]);

  const handleBack = useCallback(() => {
    popHistory();
  }, [popHistory]);

  const handleTagClick = useCallback((categoryIndex) => {
    jumpToQuizStep(categoryIndex * 3);
  }, [jumpToQuizStep]);

  return (
    <>
      {/* Loading screen — visible until results arrive and exit animation completes */}
      {showLoading && (
        <div ref={loadingRef} className={styles.loadingContainer}>
          <div className={styles.loadingInner}>
            <p ref={textRef} className={styles.loadingText} style={{ opacity: 0 }}>
              finding your style
            </p>
            <div
              ref={lineRef}
              className={styles.loadingLine}
              style={{ opacity: 0, transform: 'scaleX(0)' }}
            />
            <p ref={subTextRef} className={styles.loadingSubText} style={{ opacity: 0 }}>
              matching against 686 styles
            </p>
          </div>
        </div>
      )}

      {/* Back button — desktop only, visible after first Find Similar */}
      {!showLoading && !isMobileLayout && outputHistory.length > 0 && (
        <button className={styles.backBtn} onClick={handleBack} type="button">
          ← Back
        </button>
      )}

      {/* Mobile card deck layout */}
      {!showLoading && isMobileLayout && (
        <div className={styles.mobileDeck} style={{ '--output-vh': `${Math.round(viewportHeight)}px` }}>
          <div
            ref={mobileCardsWrapRef}
            className={styles.mobileCardsWrap}
            onPointerDown={handleMobileDeckPointerDown}
            onPointerMove={handleMobileDeckPointerMove}
            onPointerUp={handleMobileDeckPointerUp}
            onPointerCancel={handleMobileDeckPointerCancel}
          >
            {outputResults.map((r, i) => (
              <div
                key={r.id}
                ref={(el) => { mobileCardRefs.current[i] = el; }}
                className={styles.mobileCard}
              >
                <StyleCarousel
                  styleId={r.id}
                  similarity={r.similarity}
                  onClick={handleCarouselClick}
                />
              </div>
            ))}
          </div>

          <div className={styles.mobileTopScrim} />
          <div className={styles.mobileBottomScrim} />

          <div className={styles.mobileTopZone}>
            <div className={styles.mobileNavRow}>
              <button
                className={styles.mobileIconBtn}
                onClick={handleBack}
                type="button"
                disabled={outputHistory.length === 0}
                aria-label="Back"
              >
                ←
              </button>

              <span className={styles.mobileMatchBadge}>
                {mobileActiveResult ? `${Math.round((mobileActiveResult.similarity || 0) * 100)}%` : '--'}
              </span>

              <button
                className={styles.mobileIconBtn}
                type="button"
                aria-label="More options"
              >
                ⋯
              </button>
            </div>

            <div className={styles.mobileTagRibbon}>
              {mobileTagRows.map((row, rowIdx) => (
                <div key={rowIdx} className={styles.mobileTagRow}>
                  {row.map((tag, i) => (
                    <button
                      key={`${rowIdx}-${i}-${tag}`}
                      className={styles.mobileTagPill}
                      onClick={() => handleTagClick(i + (rowIdx * Math.ceil(mobileOverlayTags.length / 2)))}
                      type="button"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.mobileSideProgress}>
            {outputResults.map((r, i) => (
              <div
                key={r.id}
                className={`${styles.mobileProgressDot} ${i === currentCardIndex ? styles.mobileProgressDotActive : ''}`}
              />
            ))}
          </div>

          <div className={styles.mobileBottomZone}>
            <div className={styles.mobileSlideDots}>
              {Array.from({ length: currentSlideCount }, (_, i) => (
                <div
                  key={i}
                  className={`${styles.mobileSlideDot} ${i === currentSlideIndex ? styles.mobileSlideDotActive : ''}`}
                />
              ))}
            </div>

            <div className={styles.mobileButtonsRow}>
              <button
                className={styles.mobileConfirmBtn}
                onClick={handleMobileConfirm}
                type="button"
              >
                Confirm
              </button>
              <button
                className={styles.mobileFindBtn}
                onClick={handleFindSimilar}
                type="button"
              >
                Find Similar
              </button>
            </div>
          </div>

          {simLoading && (
            <div ref={simLoadRef} className={styles.simLoadingOverlay}>
              <p ref={simTextRef} className={styles.simLoadingText} style={{ opacity: 0 }}>
                finding similar
              </p>
              <div
                ref={simLineRef}
                className={styles.loadingLine}
                style={{ opacity: 0, transform: 'scaleX(0)' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Split layout — rendered once loading exits (desktop) */}
      {!showLoading && !isMobileLayout && (
        <div className={styles.splitLayout} style={{ '--output-vh': `${Math.round(viewportHeight)}px` }}>
          {/* Left panel */}
          <div ref={leftPanelRef} className={styles.leftPanel} style={{ opacity: 0 }}>

            {selectedCarousel ? (
              <>
                <div className={styles.tallyGrid}>
                  {selectedTags.map((tag, i) => (
                    <TagPill key={i} label={tag} onClick={() => handleTagClick(i)} />
                  ))}
                </div>
                <div className={styles.selectedCarouselWrap}>
                  <StyleCarousel styleId={selectedCarousel} />
                </div>
                <div className={styles.buttonRow}>
                  <button
                    className={styles.confirmBtn}
                    onClick={prepareConfirmation}
                    type="button"
                  >
                    Confirm
                  </button>
                  <button
                    className={styles.findSimilarBtn}
                    onClick={handleFindSimilar}
                    type="button"
                  >
                    Find Similar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.leftHeading}>your tally</p>
                <div className={styles.tallyGrid}>
                  {userTags.map((tag, i) => (
                    <TagPill key={i} label={tag} onClick={() => handleTagClick(i)} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right panel — similarity carousels */}
          <div className={styles.rightPanel}>
            {simLoading && (
              <div ref={simLoadRef} className={styles.simLoadingOverlay}>
                <p ref={simTextRef} className={styles.simLoadingText} style={{ opacity: 0 }}>
                  finding similar
                </p>
                <div
                  ref={simLineRef}
                  className={styles.loadingLine}
                  style={{ opacity: 0, transform: 'scaleX(0)' }}
                />
              </div>
            )}
            <div ref={carouselGridRef} className={styles.carouselGrid}>
              {outputResults.map(r => (
                <StyleCarousel
                  key={r.id}
                  styleId={r.id}
                  similarity={r.similarity}
                  onClick={handleCarouselClick}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

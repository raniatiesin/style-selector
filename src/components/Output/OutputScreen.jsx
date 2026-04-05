import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import { getVisibleStageIndex } from '../../config/questionTree';
import { getManifest, getStyleTallyMap } from '../../utils/dataCache';
import { preloadImagesPriority } from '../../utils/preloader';
import { buildCanonicalTallyArray, buildCanonicalTallyString, isCanonicalStageEditable } from '../../utils/tally';
import { EASE, DUR, STAGGER } from '../../config/animation';
import StyleCarousel from './StyleCarousel';
import TagPill from '../shared/TagPill';
import styles from './Output.module.css';

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
  const tallyMap = getStyleTallyMap();
  if (!tallyMap) return '';
  return tallyMap.get(styleId) || '';
}

function getStyleLabel(styleId) {
  if (!styleId) return '';
  const numeric = Number.parseInt(String(styleId).replace(/[^0-9]/g, ''), 10);
  if (Number.isFinite(numeric)) {
    return `Style N. ${numeric}`;
  }
  return String(styleId).replace(/_/g, ' ');
}

function splitTagsIntoRows(tags, rowCount = 3) {
  const indexedTags = tags
    .map((tag, index) => ({ tag, index }))
    .filter((item) => Boolean(item.tag));

  const rows = Array.from({ length: rowCount }, () => []);
  if (indexedTags.length === 0) return rows;

  const baseCount = Math.floor(indexedTags.length / rowCount);
  const remainder = indexedTags.length % rowCount;

  let cursor = 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const count = baseCount + (rowIndex < remainder ? 1 : 0);
    rows[rowIndex] = indexedTags.slice(cursor, cursor + count);
    cursor += count;
  }

  return rows;
}

export default function OutputScreen() {
  const carouselGridRef = useRef(null);
  const mobileDeckRef = useRef(null);
  const mobileCardRefs = useRef([]);
  const viewportResizeDebounceRef = useRef(null);
  const leftPanelRef = useRef(null);
  const loadingRef = useRef(null);
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const subTextRef = useRef(null);
  const loadingTlRef = useRef(null);
  const mobileNavVersionRef = useRef(0);
  const mobileNavTimeoutRef = useRef(null);
  const [showLoading, setShowLoading] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height || window.innerHeight);
  const [isMobileCoarse, setIsMobileCoarse] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [navHistory, setNavHistory] = useState([]);
  const [navPosition, setNavPosition] = useState(-1);

  // Find-similar loading overlay refs
  const simLoadRef = useRef(null);
  const simLineRef = useRef(null);
  const simTextRef = useRef(null);
  const simTlRef = useRef(null);
  const findSimilarAbortRef = useRef(null);
  const findSimilarTimeoutRef = useRef(null);
  const [simLoading, setSimLoading] = useState(false);
  const [pendingSimResults, setPendingSimResults] = useState(null);

  const answers = useQuizStore(s => s.answers);
  const outputResults = useQuizStore(s => s.outputResults);
  const sessionId = useQuizStore(s => s.sessionId);
  const selectedCarousel = useQuizStore(s => s.selectedCarousel);
  const ensureSession = useQuizStore(s => s.ensureSession);
  const updateSessionProgress = useQuizStore(s => s.updateSessionProgress);

  const setOutputResults = useQuizStore(s => s.setOutputResults);
  const setSessionId = useQuizStore(s => s.setSessionId);
  const setSelectedCarousel = useQuizStore(s => s.setSelectedCarousel);
  const pushToHistory = useQuizStore(s => s.pushToHistory);
  const setIsSearching = useQuizStore(s => s.setIsSearching);
  const prepareConfirmation = useQuizStore(s => s.prepareConfirmation);
  const jumpToQuizStep = useQuizStore(s => s.jumpToQuizStep);

  const handlePrepareConfirmationClick = useCallback((event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      prepareConfirmation();
      return;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      prepareConfirmation();
      return;
    }

    gsap.killTweensOf(target);
    gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: prepareConfirmation,
    })
      .to(target, {
        scale: 0.985,
        opacity: 0.96,
        duration: DUR.instant,
        ease: EASE.in,
      })
      .to(target, {
        scale: 1,
        opacity: 1,
        duration: DUR.fast,
        ease: EASE.confident,
      });
  }, [prepareConfirmation]);

  useEffect(() => {
    const applyViewportHeight = () => {
      setViewportHeight(window.visualViewport?.height || window.innerHeight);
    };

    const updateViewportHeight = () => {
      if (viewportResizeDebounceRef.current !== null) {
        clearTimeout(viewportResizeDebounceRef.current);
      }
      viewportResizeDebounceRef.current = setTimeout(() => {
        viewportResizeDebounceRef.current = null;
        applyViewportHeight();
      }, 120);
    };

    applyViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      if (viewportResizeDebounceRef.current !== null) {
        clearTimeout(viewportResizeDebounceRef.current);
        viewportResizeDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const updateMobileMode = () => {
      setIsMobileCoarse(window.innerWidth < 768);
    };

    updateMobileMode();
    window.addEventListener('resize', updateMobileMode);

    return () => {
      window.removeEventListener('resize', updateMobileMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mobileNavTimeoutRef.current !== null) {
        clearTimeout(mobileNavTimeoutRef.current);
        mobileNavTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      findSimilarAbortRef.current?.abort();
      if (findSimilarTimeoutRef.current !== null) {
        clearTimeout(findSimilarTimeoutRef.current);
        findSimilarTimeoutRef.current = null;
      }
    };
  }, []);

  // User's tally tags from quiz answers
  const userTags = useMemo(() => {
    return buildCanonicalTallyArray(answers);
  }, [answers]);

  // Selected style's tally tags
  const selectedTags = useMemo(() => {
    if (!selectedCarousel) return [];
    return getStyleTally(selectedCarousel).split(', ').filter(Boolean);
  }, [selectedCarousel]);

  const selectedStyleLabel = useMemo(() => getStyleLabel(selectedCarousel), [selectedCarousel]);

  const mobileCardTags = useMemo(() => {
    return outputResults.map(r => {
      return getStyleTally(r.id).split(', ').filter(Boolean);
    });
  }, [outputResults]);

  const mobileCardIndex = useMemo(() => {
    if (outputResults.length === 0) return 0;
    return Math.min(Math.max(currentCardIndex, 0), outputResults.length - 1);
  }, [currentCardIndex, outputResults]);

  // Compute results on mount — POST tally to /api/search
  useEffect(() => {
    if (outputResults.length > 0) return;
    if (useQuizStore.getState().isSearching) return; // Quiz already fired this early

    const tally = buildCanonicalTallyString(answers);

    async function computeResults() {
      setIsSearching(true);

      try {
        const ensuredSessionId = sessionId || await ensureSession();
        if (!ensuredSessionId) {
          throw new Error('Missing session id for output search');
        }

        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tally, sessionId: ensuredSessionId }),
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
  }, [answers, ensureSession, outputResults.length, sessionId, setIsSearching, setOutputResults, setSessionId]);

  useEffect(() => {
    if (!sessionId || !selectedCarousel) return;

    updateSessionProgress({ selected: selectedCarousel });
  }, [selectedCarousel, sessionId, updateSessionProgress]);

  // Preload result rep images immediately when they arrive
  useEffect(() => {
    if (outputResults.length === 0) return;
    preloadImagesPriority(outputResults.map(r => r.id));
  }, [outputResults]);

  useEffect(() => {
    mobileCardRefs.current = [];
    setCurrentCardIndex(0);
  }, [outputResults]);

  useEffect(() => {
    const newResults = outputResults;
    if (newResults.length === 0) {
      return;
    }

    const firstId = newResults[0]?.id;
    if (!firstId) return;

    setNavHistory((prevHistory) => {
      const truncated = prevHistory;

      if (truncated.length === 0) {
        setNavPosition(0);
        return [firstId];
      }

      if (truncated[truncated.length - 1] === firstId) {
        setNavPosition(truncated.length - 1);
        return truncated;
      }

      const nextHistory = [...truncated, firstId];
      setNavPosition(nextHistory.length - 1);
      return nextHistory;
    });
    setSelectedCarousel(firstId);
  }, [outputResults, setSelectedCarousel]);

  useEffect(() => {
    if (!isMobileCoarse || showLoading || outputResults.length === 0) return;

    const deck = mobileDeckRef.current;
    if (!deck) return;

    // Drop any deferred update from a previous observer instance.
    if (mobileNavTimeoutRef.current !== null) {
      clearTimeout(mobileNavTimeoutRef.current);
      mobileNavTimeoutRef.current = null;
    }
    mobileNavVersionRef.current += 1;
    const observerVersion = mobileNavVersionRef.current;

    let rafId = null;

    const syncIndexToVisibleCard = () => {
      const deckRect = deck.getBoundingClientRect();
      const deckCenter = deckRect.top + (deckRect.height / 2);

      let closestIndex = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      mobileCardRefs.current.forEach((node, index) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const cardCenter = rect.top + (rect.height / 2);
        const distance = Math.abs(cardCenter - deckCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      if (closestIndex === null) return;
      setCurrentCardIndex((prev) => (prev === closestIndex ? prev : closestIndex));
    };

    const onDeckScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (mobileNavVersionRef.current !== observerVersion) return;
        syncIndexToVisibleCard();
      });
    };

    const nodeToIndex = new WeakMap();
    mobileCardRefs.current.forEach((node, index) => {
      if (!node) return;
      nodeToIndex.set(node, index);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        let nextIndex = null;

        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.intersectionRatio < 0.5) return;
          const index = nodeToIndex.get(entry.target);
          if (!Number.isFinite(index)) return;
          nextIndex = index;
        });

        if (nextIndex === null) return;

        if (mobileNavTimeoutRef.current !== null) {
          clearTimeout(mobileNavTimeoutRef.current);
        }

        mobileNavTimeoutRef.current = setTimeout(() => {
          mobileNavTimeoutRef.current = null;
          if (mobileNavVersionRef.current !== observerVersion) return;
          setCurrentCardIndex((prev) => (prev === nextIndex ? prev : nextIndex));
        }, 0);
      },
      {
        root: deck,
        threshold: [0.5],
      }
    );

    mobileCardRefs.current.forEach((node) => {
      if (!node) return;
      observer.observe(node);
    });

    deck.addEventListener('scroll', onDeckScroll, { passive: true });
    syncIndexToVisibleCard();

    return () => {
      observer.disconnect();
      deck.removeEventListener('scroll', onDeckScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (mobileNavTimeoutRef.current !== null) {
        clearTimeout(mobileNavTimeoutRef.current);
        mobileNavTimeoutRef.current = null;
      }
      mobileNavVersionRef.current += 1;
    };
  }, [isMobileCoarse, showLoading, outputResults]);

  useEffect(() => {
    if (!isMobileCoarse || showLoading || outputResults.length === 0) return;

    const activeResult = outputResults[mobileCardIndex];
    if (!activeResult) return;
    if (selectedCarousel === activeResult.id) return;
    setSelectedCarousel(activeResult.id);
  }, [isMobileCoarse, showLoading, outputResults, mobileCardIndex, selectedCarousel, setSelectedCarousel]);

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
    let carouselGridTween = null;

    // Left panel fade in
    if (leftPanelRef.current) {
      gsap.fromTo(leftPanelRef.current,
        { opacity: 0, x: 0 },
        { opacity: 1, x: 0, duration: 0.5, ease: EASE.confident, delay: 0.1 }
      );
    }

    // Right panel carousels stagger in
    const carousels = carouselGridRef.current?.children;
    if (carousels) {
      carouselGridTween = gsap.fromTo(
        Array.from(carousels),
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, stagger: STAGGER.carousels, ease: EASE.confident, delay: 0.15 }
      );
    }

    return () => {
      if (carouselGridTween) carouselGridTween.kill();
    };
  }, [showLoading, outputResults]);

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
        mobileCardRefs.current = [];
        setCurrentCardIndex(0);
        if (mobileDeckRef.current) {
          mobileDeckRef.current.scrollTop = 0;
        }

        setOutputResults(pendingSimResults);
        setPendingSimResults(null);
        setSimLoading(false);
        setIsSearching(false);

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
  }, [simLoading, pendingSimResults, setOutputResults, setIsSearching]);

  const handleCarouselClick = useCallback((clickedStyleId) => {
    const newHistory = navHistory.slice(0, navPosition + 1);
    newHistory.push(clickedStyleId);
    setNavHistory(newHistory);
    setNavPosition(newHistory.length - 1);
    setSelectedCarousel(clickedStyleId);
  }, [navHistory, navPosition, setSelectedCarousel]);

  const handleNavLeft = useCallback(() => {
    const prev = navPosition - 1;
    if (prev < 0) return;
    setNavPosition(prev);
    setSelectedCarousel(navHistory[prev]);
  }, [navHistory, navPosition, setSelectedCarousel]);

  const handleNavRight = useCallback(() => {
    const next = navPosition + 1;
    if (next >= navHistory.length) return;
    setNavPosition(next);
    setSelectedCarousel(navHistory[next]);
  }, [navHistory, navPosition, setSelectedCarousel]);

  const resolveActiveMobileStyleId = useCallback(() => {
    if (!isMobileCoarse || outputResults.length === 0) return null;

    const deck = mobileDeckRef.current;
    if (!deck) return outputResults[mobileCardIndex]?.id || outputResults[0]?.id || null;

    const deckRect = deck.getBoundingClientRect();
    const deckCenter = deckRect.top + (deckRect.height / 2);

    let closestIndex = mobileCardIndex;
    let closestDistance = Number.POSITIVE_INFINITY;

    mobileCardRefs.current.forEach((node, index) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cardCenter = rect.top + (rect.height / 2);
      const distance = Math.abs(cardCenter - deckCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return outputResults[closestIndex]?.id || outputResults[mobileCardIndex]?.id || outputResults[0]?.id || null;
  }, [isMobileCoarse, outputResults, mobileCardIndex]);

  const handleFindSimilar = useCallback(async () => {
    const targetStyleId = isMobileCoarse
      ? resolveActiveMobileStyleId()
      : selectedCarousel;

    if (!targetStyleId || simLoading) return;

    if (findSimilarAbortRef.current) {
      findSimilarAbortRef.current.abort();
    }
    if (findSimilarTimeoutRef.current !== null) {
      clearTimeout(findSimilarTimeoutRef.current);
      findSimilarTimeoutRef.current = null;
    }

    const controller = new AbortController();
    findSimilarAbortRef.current = controller;
    let didTimeout = false;
    findSimilarTimeoutRef.current = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 15000);

    pushToHistory();
    setIsSearching(true);

    // Exit current carousels → show loading overlay
    const carousels = carouselGridRef.current?.children;
    if (carousels) {
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
      const ensuredSessionId = sessionId || await ensureSession();
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ styleId: targetStyleId, sessionId: ensuredSessionId }),
      });

      if (!res.ok) throw new Error('Find similar failed');
      const data = await res.json();

      // Store results — the simLoading effect will animate out loader + stagger in
      setPendingSimResults(data.results);
    } catch (err) {
      if (err?.name === 'AbortError') {
        if (didTimeout) {
          setSimLoading(false);
          setIsSearching(false);
        }
        return;
      }
      console.error('Find similar failed:', err);
      setSimLoading(false);
      setIsSearching(false);
    } finally {
      if (findSimilarTimeoutRef.current !== null) {
        clearTimeout(findSimilarTimeoutRef.current);
        findSimilarTimeoutRef.current = null;
      }
      if (findSimilarAbortRef.current === controller) {
        findSimilarAbortRef.current = null;
      }
    }
  }, [
    ensureSession,
    isMobileCoarse,
    selectedCarousel,
    sessionId,
    simLoading,
    pushToHistory,
    setOutputResults,
    setIsSearching,
    resolveActiveMobileStyleId,
  ]);

  const handleTagClick = useCallback((canonicalStageIndex) => {
    if (!isCanonicalStageEditable(canonicalStageIndex)) return;
    const visibleStageIndex = getVisibleStageIndex(canonicalStageIndex);
    if (visibleStageIndex == null) return;
    jumpToQuizStep(visibleStageIndex * 3);
  }, [jumpToQuizStep]);

  const handleTagRowWheel = useCallback((event) => {
    // Mobile-only row handler.
    if (!isMobileCoarse) return;

    const row = event.currentTarget;
    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    if (maxScrollLeft <= 0) return;

    const hasHorizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const delta = hasHorizontalIntent ? event.deltaX : event.deltaY;

    if (delta === 0) return;

    let nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, row.scrollLeft + delta));
    if (nextScrollLeft === row.scrollLeft) {
      // Some wheel devices report opposite signs; try inverse direction as a fallback.
      nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, row.scrollLeft - delta));
      if (nextScrollLeft === row.scrollLeft) return;
    }

    event.preventDefault();
    row.scrollLeft = nextScrollLeft;
  }, [isMobileCoarse]);

  const handleDesktopTagRowWheel = useCallback((event) => {
    const row = event.currentTarget;
    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    if (maxScrollLeft <= 0) return;

    const hasHorizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const rawDelta = hasHorizontalIntent ? event.deltaX : event.deltaY;
    if (rawDelta === 0) return;

    let delta = rawDelta;
    if (event.deltaMode === 1) {
      delta *= 16;
    } else if (event.deltaMode === 2) {
      delta *= row.clientWidth * 0.9;
    }

    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, row.scrollLeft + (delta * 1.15)));
    if (nextScrollLeft === row.scrollLeft) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    row.scrollLeft = nextScrollLeft;
  }, []);

  const renderDesktopTallyRows = useCallback((tags) => {
    const rows = splitTagsIntoRows(tags, 3);

    return (
      <div className={styles.desktopTallyRows}>
        {rows.map((row, rowIndex) => (
          <div key={`desktop-row-${rowIndex}`} className={styles.desktopTallyRowShell}>
            <div className={styles.desktopTallyRow} onWheel={handleDesktopTagRowWheel}>
              {row.map((item) => (
                <TagPill
                  key={`desktop-tag-${rowIndex}-${item.index}-${item.tag}`}
                  label={item.tag}
                  onClick={() => handleTagClick(item.index)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }, [handleDesktopTagRowWheel, handleTagClick]);

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

      {/* Split layout — rendered once loading exits */}
      {!showLoading && (
        <div className={styles.splitLayout} style={{ '--output-vh': `${Math.round(viewportHeight)}px` }}>
          {/* Left panel */}
          <div ref={leftPanelRef} className={styles.leftPanel} style={{ opacity: 0 }}>

            {selectedCarousel ? (
              <>
                <p className={styles.leftHeading}>{selectedStyleLabel}</p>
                {renderDesktopTallyRows(selectedTags)}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', width: '100%' }}>
                  <button
                    style={{
                      opacity: navPosition > 0 ? 1 : 0.28,
                      pointerEvents: navPosition > 0 ? 'auto' : 'none',
                    }}
                    disabled={navPosition <= 0}
                    className={`${styles.carouselArrow} ${styles.historyNavArrow}`}
                    onClick={handleNavLeft}
                    type="button"
                    aria-label="Previous selected style"
                  >
                    ←
                  </button>
                  <div className={styles.selectedCarouselWrap}>
                    <StyleCarousel styleId={selectedCarousel} />
                  </div>
                  <button
                    style={{
                      opacity: navPosition < navHistory.length - 1 ? 1 : 0.28,
                      pointerEvents: navPosition < navHistory.length - 1 ? 'auto' : 'none',
                    }}
                    disabled={navPosition >= navHistory.length - 1}
                    className={`${styles.carouselArrow} ${styles.historyNavArrow}`}
                    onClick={handleNavRight}
                    type="button"
                    aria-label="Next selected style"
                  >
                    →
                  </button>
                </div>
                <div className={styles.buttonRow}>
                  <button
                    className={styles.confirmBtn}
                    onClick={handlePrepareConfirmationClick}
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
                <p className={styles.scrollHint}>Hit confirm. We get to work.</p>
              </>
            ) : (
              <>
                <p className={styles.leftHeading}>your tally</p>
                {renderDesktopTallyRows(userTags)}
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

            {isMobileCoarse ? (
              <>
                <div
                  ref={mobileDeckRef}
                  className={styles.mobileCardDeck}
                >
                  {outputResults.map((result, index) => (
                    (() => {
                      const tags = mobileCardTags[index] || [];

                      return (
                        <div
                          key={result.id}
                          ref={(node) => {
                            mobileCardRefs.current[index] = node;
                          }}
                          className={styles.mobileCardSlot}
                        >
                          <div className={styles.mobileSlotTagRibbon}>
                            <div className={styles.mobileTagRow} onWheelCapture={handleTagRowWheel}>
                              {tags.slice(0, 4).map((tag, indexInRow) => (
                                <TagPill
                                  key={`t1-${result.id}-${indexInRow}`}
                                  label={tag}
                                />
                              ))}
                            </div>
                            <div className={styles.mobileTagRow} onWheelCapture={handleTagRowWheel}>
                              {tags.slice(4, 8).map((tag, indexInRow) => (
                                <TagPill
                                  key={`t2-${result.id}-${indexInRow}`}
                                  label={tag}
                                />
                              ))}
                            </div>
                            <div className={styles.mobileTagRow} onWheelCapture={handleTagRowWheel}>
                              {tags.slice(8, 12).map((tag, indexInRow) => (
                                <TagPill
                                  key={`t3-${result.id}-${indexInRow}`}
                                  label={tag}
                                />
                              ))}
                            </div>
                          </div>

                          <div className={styles.mobileCardFrame}>
                            <StyleCarousel
                              styleId={result.id}
                              similarity={result.similarity}
                              shouldLoadSegments={true}
                              onClick={handleCarouselClick}
                            />
                          </div>
                        </div>
                      );
                    })()
                  ))}
                </div>

                <div className={styles.mobileCardTracker}>
                  {outputResults.map((result, index) => (
                    <div
                      key={`tracker-${result.id}`}
                      className={`${styles.mobileTrackerDot} ${index === mobileCardIndex ? styles.mobileTrackerDotActive : ''}`}
                    />
                  ))}
                </div>

                <div className={styles.mobileBottomZone}>
                  <div className={styles.buttonRow}>
                    <button
                      className={styles.confirmBtn}
                      onClick={handlePrepareConfirmationClick}
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
                </div>
              </>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </>
  );
}

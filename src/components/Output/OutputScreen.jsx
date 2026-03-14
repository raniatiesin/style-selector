import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import { getManifest } from '../../utils/dataCache';
import { preloadImagesPriority } from '../../utils/preloader';
import { EASE, DUR, STAGGER } from '../../config/animation';
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
  const mobileDeckRef = useRef(null);
  const mobileCardRefs = useRef([]);
  const viewportResizeDebounceRef = useRef(null);
  const leftPanelRef = useRef(null);
  const loadingRef = useRef(null);
  const lineRef = useRef(null);
  const textRef = useRef(null);
  const subTextRef = useRef(null);
  const loadingTlRef = useRef(null);
  const mobileScrollRafRef = useRef(null);
  const [showLoading, setShowLoading] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height || window.innerHeight);
  const [isMobileCoarse, setIsMobileCoarse] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Find-similar loading overlay refs
  const simLoadRef = useRef(null);
  const simLineRef = useRef(null);
  const simTextRef = useRef(null);
  const simTlRef = useRef(null);
  const [simLoading, setSimLoading] = useState(false);
  const [pendingSimResults, setPendingSimResults] = useState(null);

  const answers = useQuizStore(s => s.answers);
  const outputResults = useQuizStore(s => s.outputResults);
  const sessionId = useQuizStore(s => s.sessionId);
  const selectedCarousel = useQuizStore(s => s.selectedCarousel);

  const setOutputResults = useQuizStore(s => s.setOutputResults);
  const setSessionId = useQuizStore(s => s.setSessionId);
  const setSelectedCarousel = useQuizStore(s => s.setSelectedCarousel);
  const pushToHistory = useQuizStore(s => s.pushToHistory);
  const setIsSearching = useQuizStore(s => s.setIsSearching);
  const prepareConfirmation = useQuizStore(s => s.prepareConfirmation);
  const jumpToQuizStep = useQuizStore(s => s.jumpToQuizStep);

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
    const query = window.matchMedia('(max-width: 767px) and (pointer: coarse)');

    const updateMobileMode = () => {
      setIsMobileCoarse(query.matches);
    };

    updateMobileMode();
    query.addEventListener('change', updateMobileMode);
    window.addEventListener('resize', updateMobileMode);

    return () => {
      query.removeEventListener('change', updateMobileMode);
      window.removeEventListener('resize', updateMobileMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mobileScrollRafRef.current !== null) {
        cancelAnimationFrame(mobileScrollRafRef.current);
        mobileScrollRafRef.current = null;
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

  const mobileCardIndex = currentCardIndex;

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

  useEffect(() => {
    mobileCardRefs.current = [];
    setCurrentCardIndex(0);
  }, [outputResults]);

  useEffect(() => {
    if (!isMobileCoarse || showLoading || outputResults.length === 0) return;

    const deck = mobileDeckRef.current;
    if (!deck) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex = null;
        let bestRatio = 0;

        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.getAttribute('data-card-index'));
          if (!Number.isFinite(index)) return;
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = index;
          }
        });

        if (bestIndex === null) return;
        setCurrentCardIndex((prev) => (prev === bestIndex ? prev : bestIndex));
      },
      {
        root: deck,
        threshold: [0.55, 0.7, 0.85],
      }
    );

    mobileCardRefs.current.forEach((node, index) => {
      if (!node) return;
      node.setAttribute('data-card-index', String(index));
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, [isMobileCoarse, showLoading, outputResults]);

  useEffect(() => {
    if (!isMobileCoarse || showLoading || outputResults.length === 0) return;

    const safeIndex = Math.min(currentCardIndex, outputResults.length - 1);
    const activeResult = outputResults[safeIndex];
    if (!activeResult) return;
    if (selectedCarousel === activeResult.id) return;
    setSelectedCarousel(activeResult.id);
  }, [isMobileCoarse, showLoading, outputResults, currentCardIndex, selectedCarousel, setSelectedCarousel]);

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

  // Carousel click → just select it on the left panel
  const handleCarouselClick = useCallback((styleId) => {
    setSelectedCarousel(styleId);
  }, [setSelectedCarousel]);

  const handleFindSimilar = useCallback(async () => {
    if (!selectedCarousel || simLoading) return;

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
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId: selectedCarousel, sessionId }),
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
  }, [selectedCarousel, sessionId, simLoading, pushToHistory, setOutputResults, setIsSearching]);

  const handleTagClick = useCallback((categoryIndex) => {
    jumpToQuizStep(categoryIndex * 3);
  }, [jumpToQuizStep]);

  const handleMobileDeckScroll = useCallback(() => {
    if (!isMobileCoarse) return;

    if (mobileScrollRafRef.current !== null) return;

    const deck = mobileDeckRef.current;
    if (!deck) return;

    mobileScrollRafRef.current = requestAnimationFrame(() => {
      mobileScrollRafRef.current = null;

      const viewportMiddle = deck.scrollTop + (deck.clientHeight / 2);
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      mobileCardRefs.current.forEach((node, index) => {
        if (!node) return;
        const center = node.offsetTop + (node.offsetHeight / 2);
        const distance = Math.abs(center - viewportMiddle);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      setCurrentCardIndex((prev) => (prev === nearestIndex ? prev : nearestIndex));
    });
  }, [isMobileCoarse]);

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

            {isMobileCoarse ? (
              <>
                <div className={styles.mobileCardTracker}>
                  {outputResults.map((result, index) => (
                    <div
                      key={`tracker-${result.id}`}
                      className={`${styles.mobileTrackerDot} ${index === currentCardIndex ? styles.mobileTrackerDotActive : ''}`}
                    />
                  ))}
                </div>

                <div
                  ref={mobileDeckRef}
                  className={styles.mobileCardDeck}
                  onScroll={handleMobileDeckScroll}
                >
                  {outputResults.map((result, index) => (
                    (() => {
                      const cardTags = getStyleTally(result.id).split(', ').filter(Boolean);
                      const row1 = cardTags.slice(0, 6);
                      const row2 = cardTags.slice(6, 12);

                      return (
                        <div
                          key={result.id}
                          ref={(node) => {
                            mobileCardRefs.current[index] = node;
                          }}
                          className={styles.mobileCardSlot}
                        >
                          <div className={styles.mobileSlotTagRibbon}>
                            <div className={styles.mobileTagRow}>
                              {row1.map((tag, indexInRow) => (
                                <TagPill
                                  key={`r1-${result.id}-${indexInRow}`}
                                  label={tag}
                                  onClick={() => handleTagClick(indexInRow)}
                                />
                              ))}
                            </div>
                            <div className={styles.mobileTagRow}>
                              {row2.map((tag, indexInRow) => (
                                <TagPill
                                  key={`r2-${result.id}-${indexInRow}`}
                                  label={tag}
                                  onClick={() => handleTagClick(indexInRow + 6)}
                                />
                              ))}
                            </div>
                          </div>

                          <div className={styles.mobileCardFrame}>
                            <StyleCarousel
                              styleId={result.id}
                              similarity={result.similarity}
                              isActive={index === mobileCardIndex}
                              shouldLoadSegments={Math.abs(index - mobileCardIndex) <= 1}
                              onClick={undefined}
                            />
                          </div>
                        </div>
                      );
                    })()
                  ))}
                </div>

                <div className={styles.mobileBottomZone}>
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

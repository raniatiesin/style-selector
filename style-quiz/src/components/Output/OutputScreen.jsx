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

  // Find-similar loading overlay refs
  const simLoadRef = useRef(null);
  const simLineRef = useRef(null);
  const simTextRef = useRef(null);
  const simTlRef = useRef(null);
  const [simLoading, setSimLoading] = useState(false);
  const [pendingSimResults, setPendingSimResults] = useState(null);

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

  // User's tally tags from quiz answers
  const userTags = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => answers[i * 3 + 2]).filter(Boolean);
  }, [answers]);

  // Selected style's tally tags
  const selectedTags = useMemo(() => {
    if (!selectedCarousel) return [];
    return getStyleTally(selectedCarousel).split(', ').filter(Boolean);
  }, [selectedCarousel]);

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

        // Stagger new carousels in after next render
        requestAnimationFrame(() => {
          const items = carouselGridRef.current?.children;
          if (items) {
            gsap.fromTo(Array.from(items),
              { opacity: 0, y: 24 },
              { opacity: 1, y: 0, duration: 0.5, stagger: STAGGER.carousels, ease: EASE.confident }
            );
          }
        });
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

      {/* Back button — visible after first Find Similar */}
      {!showLoading && outputHistory.length > 0 && (
        <button className={styles.backBtn} onClick={handleBack} type="button">
          ← Back
        </button>
      )}

      {/* Split layout — rendered once loading exits */}
      {!showLoading && (
        <div className={styles.splitLayout}>
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

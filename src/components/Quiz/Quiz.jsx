import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import { resolveStep, MAINS } from '../../config/questionTree';
import { filterImages, selectForSlots } from '../../utils/filter';
import { getManifest } from '../../utils/dataCache';
import { preloadImages, preloadImagesPriority } from '../../utils/preloader';
import { DESKTOP_SLOTS, MOBILE_SLOTS } from '../../config/generateSlots';
import { triggerAnswerPulse } from '../Background/answerPulse';
import ProgressBar from './ProgressBar';
import styles from './Quiz.module.css';

const SLOT_COUNT = typeof window !== 'undefined' && window.innerWidth >= 768
  ? DESKTOP_SLOTS.length
  : MOBILE_SLOTS.length;

/** Derive the current category's {main, sub, subsub} from the answers map */
function getCategoryState(answers, categoryIndex) {
  return {
    main:   answers[categoryIndex * 3]     ?? null,
    sub:    answers[categoryIndex * 3 + 1] ?? null,
    subsub: answers[categoryIndex * 3 + 2] ?? null,
  };
}

export default function Quiz() {
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const canvasElementRef = useRef(null);
  const canvasResizeDebounceRef = useRef(null);
  const tapVersionRef = useRef(0);
  const deferredWorkTimeoutRef = useRef(null);
  const warmedSeedsRef = useRef(new Set());
  const preloadTimeoutRef = useRef(null);
  const preloadIdleRef = useRef(null);
  const backgroundRafRef = useRef(null);

  const currentStep = useQuizStore(s => s.currentStep);
  const answers = useQuizStore(s => s.answers);
  const selectAnswer = useQuizStore(s => s.selectAnswer);
  const advanceStep = useQuizStore(s => s.advanceStep);
  const setActiveImageIds = useQuizStore(s => s.setActiveImageIds);
  const goBack = useQuizStore(s => s.goBack);
  const updateMode = useQuizStore(s => s.updateMode);
  const updateCategoryIndex = useQuizStore(s => s.updateCategoryIndex);
  const returnToOutput = useQuizStore(s => s.returnToOutput);
  const updateAndReturn = useQuizStore(s => s.updateAndReturn);

  // Resolve current question
  const step = resolveStep(currentStep, answers);
  const selectedOption = answers[currentStep] || step?.options[0];

  // Update-mode helpers
  const level = currentStep % 3;
  const isInUpdateCategory = updateMode && Math.floor(currentStep / 3) === updateCategoryIndex;
  const backLabel = isInUpdateCategory && level === 0 ? '← Return' : '← Back';
  const nextLabel = isInUpdateCategory && level === 2 ? 'Update →' : 'Next →';

  // Recompute background images for the given category state
  const updateBackground = useCallback((categoryIndex, catState) => {
    const manifest = getManifest();
    if (!manifest) return;

    const filtered = filterImages(manifest, categoryIndex, catState);
    const seed = `${categoryIndex}:${catState.main}:${catState.sub}:${catState.subsub}`;
    const selected = selectForSlots(filtered, SLOT_COUNT, seed);
    const ids = selected.map(s => s.id);
    setActiveImageIds(ids);

    preloadImagesPriority(ids.slice(0, 20));
  }, [setActiveImageIds]);

  const queueBackgroundUpdate = useCallback((categoryIndex, catState) => {
    if (backgroundRafRef.current !== null) {
      cancelAnimationFrame(backgroundRafRef.current);
    }
    backgroundRafRef.current = requestAnimationFrame(() => {
      backgroundRafRef.current = null;
      updateBackground(categoryIndex, catState);
    });
  }, [updateBackground]);

  const preloadCategoryState = useCallback((manifest, categoryIndex, catState, maxImages = 14) => {
    if (!catState.main) return;
    const seed = `${categoryIndex}:${catState.main}:${catState.sub}:${catState.subsub}`;
    if (warmedSeedsRef.current.has(seed)) return;

    const filtered = filterImages(manifest, categoryIndex, catState);
    const ids = selectForSlots(filtered, SLOT_COUNT, seed).map(s => s.id);
    if (ids.length === 0) return;

    warmedSeedsRef.current.add(seed);
    preloadImages(ids.slice(0, maxImages));
  }, []);

  const preloadUpcomingStages = useCallback((stepIndex, sourceAnswers) => {
    const manifest = getManifest();
    if (!manifest) return;

    const categoryIndex = Math.floor(stepIndex / 3);
    const level = stepIndex % 3;
    const catState = getCategoryState(sourceAnswers, categoryIndex);

    // Warm defaults for the next two categories while user is in the current one.
    for (let offset = 1; offset <= 2; offset++) {
      const nextCat = categoryIndex + offset;
      if (nextCat > 11) break;
      const defaultMain = MAINS[nextCat].options[0];
      preloadCategoryState(manifest, nextCat, { main: defaultMain, sub: null, subsub: null }, 12);
    }

    // Warm likely immediate branches in the current category.
    if (level === 0 && catState.main) {
      const subStep = resolveStep(categoryIndex * 3 + 1, {
        ...sourceAnswers,
        [categoryIndex * 3]: catState.main,
      });
      subStep?.options?.slice(0, 2).forEach(sub => {
        preloadCategoryState(manifest, categoryIndex, { main: catState.main, sub, subsub: null }, 10);
      });
    }

    if (level <= 1 && catState.main && catState.sub) {
      const subsubStep = resolveStep(categoryIndex * 3 + 2, {
        ...sourceAnswers,
        [categoryIndex * 3]: catState.main,
        [categoryIndex * 3 + 1]: catState.sub,
      });
      subsubStep?.options?.slice(0, 2).forEach(subsub => {
        preloadCategoryState(manifest, categoryIndex, { main: catState.main, sub: catState.sub, subsub }, 8);
      });
    }
  }, [preloadCategoryState]);

  const clearScheduledUpcomingPreload = useCallback(() => {
    if (preloadTimeoutRef.current !== null) {
      clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = null;
    }

    if (
      preloadIdleRef.current !== null &&
      typeof window !== 'undefined' &&
      typeof window.cancelIdleCallback === 'function'
    ) {
      window.cancelIdleCallback(preloadIdleRef.current);
    }

    preloadIdleRef.current = null;
  }, []);

  const scheduleUpcomingPreload = useCallback((stepIndex, sourceAnswers) => {
    clearScheduledUpcomingPreload();

    preloadTimeoutRef.current = setTimeout(() => {
      preloadTimeoutRef.current = null;

      if (
        typeof window !== 'undefined' &&
        typeof window.requestIdleCallback === 'function'
      ) {
        preloadIdleRef.current = window.requestIdleCallback(() => {
          preloadIdleRef.current = null;
          preloadUpcomingStages(stepIndex, sourceAnswers);
        }, { timeout: 300 });
        return;
      }

      preloadUpcomingStages(stepIndex, sourceAnswers);
    }, 80);
  }, [clearScheduledUpcomingPreload, preloadUpcomingStages]);

  const queueVersionedDeferredWork = useCallback((version, task) => {
    if (deferredWorkTimeoutRef.current !== null) {
      clearTimeout(deferredWorkTimeoutRef.current);
      deferredWorkTimeoutRef.current = null;
    }

    deferredWorkTimeoutRef.current = setTimeout(() => {
      deferredWorkTimeoutRef.current = null;
      if (tapVersionRef.current !== version) return;
      task();
    }, 0);
  }, []);

  useEffect(() => {
    const cacheCanvasElement = () => {
      canvasElementRef.current = document.querySelector('[class*="canvas"]');
    };

    const onResize = () => {
      if (canvasResizeDebounceRef.current !== null) {
        clearTimeout(canvasResizeDebounceRef.current);
      }
      canvasResizeDebounceRef.current = setTimeout(() => {
        canvasResizeDebounceRef.current = null;
        cacheCanvasElement();
      }, 150);
    };

    cacheCanvasElement();
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('resize', onResize);
      if (canvasResizeDebounceRef.current !== null) {
        clearTimeout(canvasResizeDebounceRef.current);
        canvasResizeDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      clearScheduledUpcomingPreload();
      if (backgroundRafRef.current !== null) {
        cancelAnimationFrame(backgroundRafRef.current);
      }
      if (deferredWorkTimeoutRef.current !== null) {
        clearTimeout(deferredWorkTimeoutRef.current);
        deferredWorkTimeoutRef.current = null;
      }
    };
  }, [clearScheduledUpcomingPreload]);

  // Initial background on mount — filter category 0 with its default MAIN
  useEffect(() => {
    const defaultMain = MAINS[0].options[0];
    selectAnswer(0, defaultMain);
    queueBackgroundUpdate(0, { main: defaultMain, sub: null, subsub: null });
    scheduleUpcomingPreload(0, { 0: defaultMain });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((value) => {
    const level = currentStep % 3; // 0=main, 1=sub, 2=subsub
    const categoryIndex = Math.floor(currentStep / 3);

    // Build updated answers, clearing orphaned child selections when parent changes
    const updatedAnswers = { ...answers, [currentStep]: value };
    if (level === 0) {
      delete updatedAnswers[categoryIndex * 3 + 1]; // clear SUB
      delete updatedAnswers[categoryIndex * 3 + 2]; // clear SUBSUB
    } else if (level === 1) {
      delete updatedAnswers[categoryIndex * 3 + 2]; // clear SUBSUB
    }

    // Persist all changed keys to store
    selectAnswer(currentStep, value);
    if (level === 0) {
      selectAnswer(categoryIndex * 3 + 1, undefined);
      selectAnswer(categoryIndex * 3 + 2, undefined);
    } else if (level === 1) {
      selectAnswer(categoryIndex * 3 + 2, undefined);
    }

    // Trigger answer pulse
    triggerAnswerPulse(canvasElementRef.current);

    // Refilter with the updated category state
    const catState = getCategoryState(updatedAnswers, categoryIndex);
    const tapVersion = ++tapVersionRef.current;
    queueVersionedDeferredWork(tapVersion, () => {
      queueBackgroundUpdate(categoryIndex, catState);
      scheduleUpcomingPreload(currentStep, updatedAnswers);
    });
  }, [currentStep, answers, selectAnswer, queueBackgroundUpdate, scheduleUpcomingPreload, queueVersionedDeferredWork]);

  const handleNext = useCallback(() => {
    const tapVersion = ++tapVersionRef.current;

    // Auto-commit the visually-displayed default if the user never explicitly clicked an option.
    const { currentStep: cs, answers: ans, selectAnswer: save } = useQuizStore.getState();
    if (!ans[cs]) {
      const stepData = resolveStep(cs, ans);
      if (stepData?.options[0]) save(cs, stepData.options[0]);
    }

    // Fire /api/search immediately on the final step — saves transition + mount overhead.
    // OutputScreen will skip its own fetch because isSearching is already true.
    if (cs === 35) {
      const freshAnswers = useQuizStore.getState().answers;
      const finalTally = Array.from({ length: 12 }, (_, i) => freshAnswers[i * 3 + 2])
        .filter(Boolean).join(', ');
      const { setIsSearching, setSessionId, setOutputResults } = useQuizStore.getState();
      setIsSearching(true);
      fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tally: finalTally }),
      })
        .then(r => r.ok ? r.json() : Promise.reject('Search API failed'))
        .then(data => {
          setSessionId(data.sessionId);
          setOutputResults(data.results);
          setIsSearching(false);
        })
        .catch(err => {
          console.error('Early search failed:', err);
          useQuizStore.getState().setIsSearching(false);
        });
    }

    const contentEl = contentRef.current;
    if (!contentEl) {
      advanceStep();
      // Update background for the new step
      const newStep = cs + 1;
      if (newStep <= 35) {
        const newCat = Math.floor(newStep / 3);
        const isNewCategory = newStep % 3 === 0;
        if (isNewCategory) {
          const defaultMain = MAINS[newCat].options[0];
          save(newCat * 3, defaultMain);
          queueVersionedDeferredWork(tapVersion, () => {
            queueBackgroundUpdate(newCat, { main: defaultMain, sub: null, subsub: null });
            scheduleUpcomingPreload(newStep, { ...useQuizStore.getState().answers, [newCat * 3]: defaultMain });
          });
        } else {
          // Auto-save default for the arriving step so the filter narrows
          const curAns = useQuizStore.getState().answers;
          if (!curAns[newStep]) {
            const stepData = resolveStep(newStep, curAns);
            if (stepData?.options[0]) save(newStep, stepData.options[0]);
          }
          const freshAns = useQuizStore.getState().answers;
          queueVersionedDeferredWork(tapVersion, () => {
            queueBackgroundUpdate(newCat, getCategoryState(freshAns, newCat));
            scheduleUpcomingPreload(newStep, freshAns);
          });
        }
      }
      return;
    }

    // Panel transition
    gsap.timeline()
      .to(contentEl, {
        opacity: 0,
        y: -8,
        duration: 0.015,
        ease: 'power2.out',
        onComplete: () => {
          advanceStep();

          // After advancing, update background for the new step
          const { currentStep: newCs, answers: freshAns, selectAnswer: freshSave } = useQuizStore.getState();
          if (newCs <= 35) {
            const newCat = Math.floor(newCs / 3);
            const isNewCategory = newCs % 3 === 0;
            if (isNewCategory) {
              const defaultMain = MAINS[newCat].options[0];
              freshSave(newCat * 3, defaultMain);
              queueVersionedDeferredWork(tapVersion, () => {
                queueBackgroundUpdate(newCat, { main: defaultMain, sub: null, subsub: null });
                scheduleUpcomingPreload(newCs, { ...useQuizStore.getState().answers, [newCat * 3]: defaultMain });
              });
            } else {
              // Auto-save default for the arriving step so the filter narrows
              if (!freshAns[newCs]) {
                const stepData = resolveStep(newCs, freshAns);
                if (stepData?.options[0]) freshSave(newCs, stepData.options[0]);
              }
              const latestAns = useQuizStore.getState().answers;
              queueVersionedDeferredWork(tapVersion, () => {
                queueBackgroundUpdate(newCat, getCategoryState(latestAns, newCat));
                scheduleUpcomingPreload(newCs, latestAns);
              });
            }
          }
        },
      })
      .set(contentEl, { y: 8 })
      .to(contentEl, {
        opacity: 1,
        y: 0,
        duration: 0.08,
        ease: 'power2.out',
      });
  }, [advanceStep, queueBackgroundUpdate, scheduleUpcomingPreload, queueVersionedDeferredWork]);

  if (!step) return null;

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.card}>
        <ProgressBar currentStep={currentStep} />
        <div ref={contentRef} className={styles.panelContent}>
          <p className={styles.question}>{step.question}</p>
          <div className={styles.optionsRow}>
            {step.options.map(opt => (
              <button
                key={opt}
                className={`${styles.option} ${selectedOption === opt ? styles.selected : ''}`}
                onClick={(e) => {
                  gsap.timeline()
                    .to(e.currentTarget, { scale: 0.98, duration: 0.03, ease: 'power2.out' })
                    .to(e.currentTarget, { scale: 1.0, duration: 0.09, ease: 'power2.out' });
                  handleSelect(opt);
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.navRow}>
          <button className={styles.backBtn} onClick={() => {
            if (isInUpdateCategory && level === 0) returnToOutput();
            else goBack();
          }}>
            {backLabel}
          </button>
          <button className={styles.nextBtn} onClick={() => {
            if (isInUpdateCategory && level === 2) {
              // Auto-commit default if user never explicitly chose
              const { currentStep: cs, answers: ans, selectAnswer: save } = useQuizStore.getState();
              if (!ans[cs]) {
                const stepData = resolveStep(cs, ans);
                if (stepData?.options[0]) save(cs, stepData.options[0]);
              }
              updateAndReturn();
            } else {
              handleNext();
            }
          }}>
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

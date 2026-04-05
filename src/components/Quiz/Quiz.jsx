import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import {
  resolveStep,
  MAINS,
  MAX_VISIBLE_STEP_INDEX,
  STEPS_PER_STAGE,
  getCanonicalStageIndex,
  getMainAnswerIndex,
  getLeafAnswerIndex,
} from '../../config/questionTree';
import { filterImages, selectForSlots } from '../../utils/filter';
import { buildCanonicalTallyArray, buildCanonicalTallyString } from '../../utils/tally';
import { getManifest } from '../../utils/dataCache';
import { preloadImages, preloadImagesPriority } from '../../utils/preloader';
import { DESKTOP_SLOTS, MOBILE_SLOTS } from '../../config/generateSlots';
import { triggerAnswerPulse } from '../Background/answerPulse';
import ProgressBar from './ProgressBar';
import styles from './Quiz.module.css';

const SLOT_COUNT = typeof window !== 'undefined' && window.innerWidth >= 768
  ? DESKTOP_SLOTS.length
  : MOBILE_SLOTS.length;

function getAnswerIndexForStep(stepIndex) {
  const categoryIndex = Math.floor(stepIndex / STEPS_PER_STAGE);
  const level = stepIndex % STEPS_PER_STAGE;
  return level === 0 ? getMainAnswerIndex(categoryIndex) : getLeafAnswerIndex(categoryIndex);
}

/** Derive the current category's {main, sub, subsub} from the answers map */
function getCategoryState(answers, categoryIndex) {
  return {
    main: answers[getMainAnswerIndex(categoryIndex)] ?? null,
    sub: null,
    subsub: answers[getLeafAnswerIndex(categoryIndex)] ?? null,
  };
}

function normalizeCategoryState(catState) {
  return {
    main: catState.main ?? null,
    sub: catState.sub ?? null,
    subsub: catState.subsub ?? null,
  };
}

function buildSeed(canonicalStageIndex, catState) {
  const normalized = normalizeCategoryState(catState);
  return `${canonicalStageIndex}:${normalized.main}:${normalized.sub}:${normalized.subsub}`;
}

function deriveDeterministicCategoryState(answers, stepIndex) {
  const categoryIndex = Math.floor(stepIndex / STEPS_PER_STAGE);
  const level = stepIndex % STEPS_PER_STAGE;
  const defaultMain = MAINS[categoryIndex]?.options?.[0] ?? null;
  const main = answers[getMainAnswerIndex(categoryIndex)] ?? defaultMain;

  let subsub = null;
  if (level >= 1) {
    const leafStep = resolveStep(categoryIndex * STEPS_PER_STAGE + 1, {
      ...answers,
      [getMainAnswerIndex(categoryIndex)]: main,
    });
    subsub = answers[getLeafAnswerIndex(categoryIndex)] ?? leafStep?.options?.[0] ?? null;
  }

  return {
    categoryIndex,
    catState: normalizeCategoryState({ main, sub: null, subsub }),
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
  const sessionId = useQuizStore(s => s.sessionId);
  const selectAnswer = useQuizStore(s => s.selectAnswer);
  const advanceStep = useQuizStore(s => s.advanceStep);
  const setActiveImageIds = useQuizStore(s => s.setActiveImageIds);
  const goBack = useQuizStore(s => s.goBack);
  const ensureSession = useQuizStore(s => s.ensureSession);
  const updateSessionProgress = useQuizStore(s => s.updateSessionProgress);
  const updateMode = useQuizStore(s => s.updateMode);
  const updateCategoryIndex = useQuizStore(s => s.updateCategoryIndex);
  const returnToOutput = useQuizStore(s => s.returnToOutput);
  const updateAndReturn = useQuizStore(s => s.updateAndReturn);

  // Resolve current question
  const step = resolveStep(currentStep, answers);
  const selectedOption = answers[getAnswerIndexForStep(currentStep)] || step?.options[0];

  // Update-mode helpers
  const level = currentStep % STEPS_PER_STAGE;
  const isCombinedQ2Step = level === STEPS_PER_STAGE - 1;
  const columnLabels = isCombinedQ2Step ? step?.columnLabels : null;
  const isInUpdateCategory = updateMode && Math.floor(currentStep / STEPS_PER_STAGE) === updateCategoryIndex;
  const backLabel = isInUpdateCategory && level === 0 ? '← Return' : '← Back';
  const nextLabel = isInUpdateCategory && level === STEPS_PER_STAGE - 1 ? 'Update →' : 'Next →';

  // Recompute background images for the given category state
  const updateBackground = useCallback((categoryIndex, catState) => {
    const manifest = getManifest();
    if (!manifest) return;
    const canonicalStageIndex = getCanonicalStageIndex(categoryIndex);
    if (canonicalStageIndex == null) return;

    const normalized = normalizeCategoryState(catState);

    const filtered = filterImages(manifest, canonicalStageIndex, normalized);
    const seed = buildSeed(canonicalStageIndex, normalized);
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
    const canonicalStageIndex = getCanonicalStageIndex(categoryIndex);
    if (canonicalStageIndex == null) return;
    const normalized = normalizeCategoryState(catState);
    if (!normalized.main) return;
    const seed = buildSeed(canonicalStageIndex, normalized);
    if (warmedSeedsRef.current.has(seed)) return;

    const filtered = filterImages(manifest, canonicalStageIndex, normalized);
    const ids = selectForSlots(filtered, SLOT_COUNT, seed).map(s => s.id);
    if (ids.length === 0) return;

    warmedSeedsRef.current.add(seed);
    preloadImages(ids.slice(0, maxImages));
  }, []);

  const preloadUpcomingStages = useCallback((stepIndex, sourceAnswers) => {
    const manifest = getManifest();
    if (!manifest) return;

    const categoryIndex = Math.floor(stepIndex / STEPS_PER_STAGE);
    const level = stepIndex % STEPS_PER_STAGE;
    const catState = getCategoryState(sourceAnswers, categoryIndex);

    // Warm defaults for the next two categories while user is in the current one.
    for (let offset = 1; offset <= 2; offset++) {
      const nextCat = categoryIndex + offset;
      if (nextCat >= MAINS.length) break;
      const defaultMain = MAINS[nextCat].options[0];
      preloadCategoryState(manifest, nextCat, { main: defaultMain, sub: null, subsub: null }, 12);
    }

    // Warm likely immediate branches in the current category.
    if (level === 0 && catState.main) {
      const leafStep = resolveStep(categoryIndex * STEPS_PER_STAGE + 1, {
        ...sourceAnswers,
        [getMainAnswerIndex(categoryIndex)]: catState.main,
      });
      leafStep?.options?.slice(0, 2).forEach(leaf => {
        preloadCategoryState(manifest, categoryIndex, { main: catState.main, sub: null, subsub: leaf }, 10);
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

  const invalidatePendingBackgroundWork = useCallback(() => {
    tapVersionRef.current += 1;

    if (deferredWorkTimeoutRef.current !== null) {
      clearTimeout(deferredWorkTimeoutRef.current);
      deferredWorkTimeoutRef.current = null;
    }

    if (backgroundRafRef.current !== null) {
      cancelAnimationFrame(backgroundRafRef.current);
      backgroundRafRef.current = null;
    }
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

  // Commit the currently displayed default choice so store state and UI stay in sync.
  useEffect(() => {
    const defaultOption = step?.options?.[0];
    if (!defaultOption) return;
    const answerIndex = getAnswerIndexForStep(currentStep);
    if (answers[answerIndex] != null) return;
    selectAnswer(answerIndex, defaultOption);
  }, [currentStep, answers, step, selectAnswer]);

  // Keep background deterministic for any step transition, including back navigation.
  useEffect(() => {
    const { categoryIndex, catState } = deriveDeterministicCategoryState(answers, currentStep);
    queueBackgroundUpdate(categoryIndex, catState);
  }, [currentStep, answers, queueBackgroundUpdate]);

  const handleSelect = useCallback((value) => {
    const level = currentStep % STEPS_PER_STAGE; // 0=main, 1=leaf
    const categoryIndex = Math.floor(currentStep / STEPS_PER_STAGE);
    const answerIndex = getAnswerIndexForStep(currentStep);

    // Build updated answers, clearing orphaned child selections when parent changes
    const updatedAnswers = { ...answers, [answerIndex]: value };
    if (level === 0) {
      delete updatedAnswers[getLeafAnswerIndex(categoryIndex)];
    }

    // Persist all changed keys to store
    selectAnswer(answerIndex, value);
    if (level === 0) {
      selectAnswer(getLeafAnswerIndex(categoryIndex), undefined);
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
    const csAnswerIndex = getAnswerIndexForStep(cs);
    if (ans[csAnswerIndex] == null) {
      const stepData = resolveStep(cs, ans);
      if (stepData?.options[0]) save(csAnswerIndex, stepData.options[0]);
    }

    const freshAnswers = useQuizStore.getState().answers;
    const progressContent = buildCanonicalTallyArray(freshAnswers)
      .filter(Boolean)
      .join(', ');

    (async () => {
      const ensuredSessionId = sessionId || await ensureSession();
      if (!ensuredSessionId) return;

      await updateSessionProgress({
        content: progressContent || null,
        metadata: {
          completedStep: cs,
          answeredCount: Object.keys(freshAnswers).length,
          updatedAt: new Date().toISOString(),
        },
      });
    })();

    // Fire /api/search immediately on the final step — saves transition + mount overhead.
    // OutputScreen will skip its own fetch because isSearching is already true.
    if (cs === MAX_VISIBLE_STEP_INDEX) {
      const finalTally = buildCanonicalTallyString(freshAnswers);
      const { setIsSearching, setSessionId, setOutputResults } = useQuizStore.getState();
      setIsSearching(true);

      (async () => {
        const ensuredSessionId = sessionId || await ensureSession();
        if (!ensuredSessionId) {
          throw new Error('Missing session id for search');
        }

        return fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tally: finalTally, sessionId: ensuredSessionId }),
        });
      })()
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
      if (newStep <= MAX_VISIBLE_STEP_INDEX) {
        const newCat = Math.floor(newStep / STEPS_PER_STAGE);
        const isNewCategory = newStep % STEPS_PER_STAGE === 0;
        if (isNewCategory) {
          const defaultMain = MAINS[newCat].options[0];
          save(getMainAnswerIndex(newCat), defaultMain);
          queueVersionedDeferredWork(tapVersion, () => {
            queueBackgroundUpdate(newCat, { main: defaultMain, sub: null, subsub: null });
            scheduleUpcomingPreload(newStep, { ...useQuizStore.getState().answers, [getMainAnswerIndex(newCat)]: defaultMain });
          });
        } else {
          // Auto-save default for the arriving step so the filter narrows
          const curAns = useQuizStore.getState().answers;
          const nextAnswerIndex = getAnswerIndexForStep(newStep);
          if (curAns[nextAnswerIndex] == null) {
            const stepData = resolveStep(newStep, curAns);
            if (stepData?.options[0]) save(nextAnswerIndex, stepData.options[0]);
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
          if (newCs <= MAX_VISIBLE_STEP_INDEX) {
            const newCat = Math.floor(newCs / STEPS_PER_STAGE);
            const isNewCategory = newCs % STEPS_PER_STAGE === 0;
            if (isNewCategory) {
              const defaultMain = MAINS[newCat].options[0];
              freshSave(getMainAnswerIndex(newCat), defaultMain);
              queueVersionedDeferredWork(tapVersion, () => {
                queueBackgroundUpdate(newCat, { main: defaultMain, sub: null, subsub: null });
                scheduleUpcomingPreload(newCs, { ...useQuizStore.getState().answers, [getMainAnswerIndex(newCat)]: defaultMain });
              });
            } else {
              // Auto-save default for the arriving step so the filter narrows
              const nextAnswerIndex = getAnswerIndexForStep(newCs);
              if (freshAns[nextAnswerIndex] == null) {
                const stepData = resolveStep(newCs, freshAns);
                if (stepData?.options[0]) freshSave(nextAnswerIndex, stepData.options[0]);
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
  }, [
    advanceStep,
    ensureSession,
    queueBackgroundUpdate,
    scheduleUpcomingPreload,
    queueVersionedDeferredWork,
    sessionId,
    updateSessionProgress,
  ]);

  if (!step) return null;

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.card}>
        <ProgressBar currentStep={currentStep} />
        <div ref={contentRef} className={styles.panelContent}>
          <p className={styles.question}>{step.question}</p>
          {isCombinedQ2Step && Array.isArray(columnLabels) && columnLabels.length === 2 ? (
            <div className={styles.columnLabels}>
              <span className={styles.columnLabel}>{columnLabels[0]}</span>
              <span className={styles.columnLabel}>{columnLabels[1]}</span>
            </div>
          ) : null}
          <div className={`${styles.optionsRow} ${isCombinedQ2Step ? styles.optionsGrid : ''}`}>
            {isCombinedQ2Step ? <div className={styles.gridDivider} /> : null}
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
            invalidatePendingBackgroundWork();
            if (isInUpdateCategory && level === 0) returnToOutput();
            else goBack();
          }}>
            {backLabel}
          </button>
          <button className={styles.nextBtn} onClick={() => {
            if (isInUpdateCategory && level === STEPS_PER_STAGE - 1) {
              // Auto-commit default if user never explicitly chose
              const { currentStep: cs, answers: ans, selectAnswer: save } = useQuizStore.getState();
              const answerIndex = getAnswerIndexForStep(cs);
              if (ans[answerIndex] == null) {
                const stepData = resolveStep(cs, ans);
                if (stepData?.options[0]) save(answerIndex, stepData.options[0]);
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

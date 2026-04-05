import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import { resolveStep, MAINS, MAX_VISIBLE_STEP_INDEX, getCanonicalStageIndex } from '../../config/questionTree';
import { filterImages, selectForSlots } from '../../utils/filter';
import { buildCanonicalTallyString } from '../../utils/tally';
import { getManifest } from '../../utils/dataCache';
import { preloadImages } from '../../utils/preloader';
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
    const canonicalStageIndex = getCanonicalStageIndex(categoryIndex);
    if (canonicalStageIndex == null) return;

    const filtered = filterImages(manifest, canonicalStageIndex, catState);
    const seed = `${canonicalStageIndex}:${catState.main}:${catState.sub}:${catState.subsub}`;
    const selected = selectForSlots(filtered, SLOT_COUNT, seed);
    const ids = selected.map(s => s.id);
    setActiveImageIds(ids);

    preloadImages(ids.slice(0, 20));
  }, [setActiveImageIds]);

  // Initial background on mount — filter category 0 with its default MAIN
  useEffect(() => {
    const defaultMain = MAINS[0].options[0];
    selectAnswer(0, defaultMain);
    updateBackground(0, { main: defaultMain, sub: null, subsub: null });
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
    const canvas = document.querySelector('[class*="canvas"]');
    triggerAnswerPulse(canvas);

    // Refilter with the updated category state
    const catState = getCategoryState(updatedAnswers, categoryIndex);
    updateBackground(categoryIndex, catState);
  }, [currentStep, answers, selectAnswer, updateBackground]);

  const handleNext = useCallback(() => {
    // Auto-commit the visually-displayed default if the user never explicitly clicked an option.
    const { currentStep: cs, answers: ans, selectAnswer: save } = useQuizStore.getState();
    if (!ans[cs]) {
      const stepData = resolveStep(cs, ans);
      if (stepData?.options[0]) save(cs, stepData.options[0]);
    }

    // Fire /api/search immediately on the final step — saves transition + mount overhead.
    // OutputScreen will skip its own fetch because isSearching is already true.
    if (cs === MAX_VISIBLE_STEP_INDEX) {
      const freshAnswers = useQuizStore.getState().answers;
      const finalTally = buildCanonicalTallyString(freshAnswers);
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
      if (newStep <= MAX_VISIBLE_STEP_INDEX) {
        const newCat = Math.floor(newStep / 3);
        const isNewCategory = newStep % 3 === 0;
        if (isNewCategory) {
          const defaultMain = MAINS[newCat].options[0];
          save(newCat * 3, defaultMain);
          updateBackground(newCat, { main: defaultMain, sub: null, subsub: null });
          if (newCat < MAINS.length - 1) {
            const mf = getManifest();
            if (mf) {
              const nextMain = MAINS[newCat + 1].options[0];
              const nextCanonical = getCanonicalStageIndex(newCat + 1);
              if (nextCanonical != null) {
                const nf = filterImages(mf, nextCanonical, { main: nextMain, sub: null, subsub: null });
                preloadImages(selectForSlots(nf, SLOT_COUNT, `${nextCanonical}:${nextMain}:null:null`).map(s => s.id));
              }
            }
          }
        } else {
          // Auto-save default for the arriving step so the filter narrows
          const curAns = useQuizStore.getState().answers;
          if (!curAns[newStep]) {
            const stepData = resolveStep(newStep, curAns);
            if (stepData?.options[0]) save(newStep, stepData.options[0]);
          }
          const freshAns = useQuizStore.getState().answers;
          updateBackground(newCat, getCategoryState(freshAns, newCat));
        }
      }
      return;
    }

    // Panel transition
    gsap.timeline()
      .to(contentEl, {
        opacity: 0,
        y: -4,
        duration: 0.08,
        ease: 'power2.in',
        onComplete: () => {
          advanceStep();

          // After advancing, update background for the new step
          const { currentStep: newCs, answers: freshAns, selectAnswer: freshSave } = useQuizStore.getState();
          if (newCs <= MAX_VISIBLE_STEP_INDEX) {
            const newCat = Math.floor(newCs / 3);
            const isNewCategory = newCs % 3 === 0;
            if (isNewCategory) {
              const defaultMain = MAINS[newCat].options[0];
              freshSave(newCat * 3, defaultMain);
              updateBackground(newCat, { main: defaultMain, sub: null, subsub: null });
              if (newCat < MAINS.length - 1) {
                const mf = getManifest();
                if (mf) {
                  const nextMain = MAINS[newCat + 1].options[0];
                  const nextCanonical = getCanonicalStageIndex(newCat + 1);
                  if (nextCanonical != null) {
                    const nf = filterImages(mf, nextCanonical, { main: nextMain, sub: null, subsub: null });
                    preloadImages(selectForSlots(nf, SLOT_COUNT, `${nextCanonical}:${nextMain}:null:null`).map(s => s.id));
                  }
                }
              }
            } else {
              // Auto-save default for the arriving step so the filter narrows
              if (!freshAns[newCs]) {
                const stepData = resolveStep(newCs, freshAns);
                if (stepData?.options[0]) freshSave(newCs, stepData.options[0]);
              }
              const latestAns = useQuizStore.getState().answers;
              updateBackground(newCat, getCategoryState(latestAns, newCat));
            }
          }
        },
      })
      .set(contentEl, { y: 4 })
      .to(contentEl, {
        opacity: 1,
        y: 0,
        duration: 0.12,
        ease: 'power2.out',
      });
  }, [advanceStep, updateBackground]);

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
                    .to(e.currentTarget, { scale: 0.96, duration: 0.04, ease: 'power2.in' })
                    .to(e.currentTarget, { scale: 1.0, duration: 0.18, ease: 'elastic.out(1.2, 0.75)' });
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

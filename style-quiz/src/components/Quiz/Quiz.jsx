import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import {
  resolveStep,
  MAINS,
  MAX_VISIBLE_STEP_INDEX,
  getCanonicalStageIndex,
  STEPS_PER_STAGE,
  getMainAnswerIndex,
  getLeafAnswerIndex,
} from '../../config/questionTree';
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

function getAnswerIndexForStep(stepIndex) {
  const categoryIndex = Math.floor(stepIndex / STEPS_PER_STAGE);
  const level = stepIndex % STEPS_PER_STAGE;
  return level === 0 ? getMainAnswerIndex(categoryIndex) : getLeafAnswerIndex(categoryIndex);
}

function getCategoryState(answers, categoryIndex) {
  return {
    main: answers[getMainAnswerIndex(categoryIndex)] ?? null,
    sub: null,
    subsub: answers[getLeafAnswerIndex(categoryIndex)] ?? null,
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

  const step = resolveStep(currentStep, answers);
  const selectedOption = answers[getAnswerIndexForStep(currentStep)] || step?.options[0];

  const level = currentStep % STEPS_PER_STAGE;
  const isInUpdateCategory = updateMode && Math.floor(currentStep / STEPS_PER_STAGE) === updateCategoryIndex;
  const backLabel = isInUpdateCategory && level === 0 ? '← Return' : '← Back';
  const nextLabel = isInUpdateCategory && level === STEPS_PER_STAGE - 1 ? 'Update →' : 'Next →';

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

  useEffect(() => {
    const defaultMain = MAINS[0].options[0];
    selectAnswer(getMainAnswerIndex(0), defaultMain);
    updateBackground(0, { main: defaultMain, sub: null, subsub: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((value) => {
    const levelAtStep = currentStep % STEPS_PER_STAGE;
    const categoryIndex = Math.floor(currentStep / STEPS_PER_STAGE);
    const answerIndex = getAnswerIndexForStep(currentStep);

    const updatedAnswers = { ...answers, [answerIndex]: value };
    if (levelAtStep === 0) {
      delete updatedAnswers[getLeafAnswerIndex(categoryIndex)];
    }

    selectAnswer(answerIndex, value);
    if (levelAtStep === 0) {
      selectAnswer(getLeafAnswerIndex(categoryIndex), undefined);
    }

    const canvas = document.querySelector('[class*="canvas"]');
    triggerAnswerPulse(canvas);

    const catState = getCategoryState(updatedAnswers, categoryIndex);
    updateBackground(categoryIndex, catState);
  }, [currentStep, answers, selectAnswer, updateBackground]);

  const handleNext = useCallback(() => {
    const { currentStep: cs, answers: ans, selectAnswer: save } = useQuizStore.getState();
    const csAnswerIndex = getAnswerIndexForStep(cs);

    if (!ans[csAnswerIndex]) {
      const stepData = resolveStep(cs, ans);
      if (stepData?.options[0]) save(csAnswerIndex, stepData.options[0]);
    }

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
      const newStep = cs + 1;
      if (newStep <= MAX_VISIBLE_STEP_INDEX) {
        const newCat = Math.floor(newStep / STEPS_PER_STAGE);
        const isNewCategory = newStep % STEPS_PER_STAGE === 0;
        if (isNewCategory) {
          const defaultMain = MAINS[newCat].options[0];
          save(getMainAnswerIndex(newCat), defaultMain);
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
          const curAns = useQuizStore.getState().answers;
          const newAnswerIndex = getAnswerIndexForStep(newStep);
          if (!curAns[newAnswerIndex]) {
            const stepData = resolveStep(newStep, curAns);
            if (stepData?.options[0]) save(newAnswerIndex, stepData.options[0]);
          }
          const freshAns = useQuizStore.getState().answers;
          updateBackground(newCat, getCategoryState(freshAns, newCat));
        }
      }
      return;
    }

    gsap.timeline()
      .to(contentEl, {
        opacity: 0, y: -4, duration: 0.08, ease: 'power2.in',
        onComplete: () => {
          advanceStep();
          const { currentStep: newCs, answers: freshAns, selectAnswer: freshSave } = useQuizStore.getState();
          if (newCs <= MAX_VISIBLE_STEP_INDEX) {
            const newCat = Math.floor(newCs / STEPS_PER_STAGE);
            const isNewCategory = newCs % STEPS_PER_STAGE === 0;
            if (isNewCategory) {
              const defaultMain = MAINS[newCat].options[0];
              freshSave(getMainAnswerIndex(newCat), defaultMain);
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
              const newAnswerIndex = getAnswerIndexForStep(newCs);
              if (!freshAns[newAnswerIndex]) {
                const stepData = resolveStep(newCs, freshAns);
                if (stepData?.options[0]) freshSave(newAnswerIndex, stepData.options[0]);
              }
              const latestAns = useQuizStore.getState().answers;
              updateBackground(newCat, getCategoryState(latestAns, newCat));
            }
          }
        },
      })
      .set(contentEl, { y: 4 })
      .to(contentEl, { opacity: 1, y: 0, duration: 0.12, ease: 'power2.out' });
  }, [advanceStep, updateBackground]);

  if (!step) return null;

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.card}>
        <ProgressBar currentStep={currentStep} />
        <div ref={contentRef} className={styles.panelContent}>
          <p className={styles.question}>{step.question}</p>
          <div className={`${styles.optionsRow} ${level === STEPS_PER_STAGE - 1 ? styles.optionsGrid : ''}`}>
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
            if (isInUpdateCategory && level === STEPS_PER_STAGE - 1) {
              const { currentStep: cs, answers: ans, selectAnswer: save } = useQuizStore.getState();
              const answerIndex = getAnswerIndexForStep(cs);
              if (!ans[answerIndex]) {
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

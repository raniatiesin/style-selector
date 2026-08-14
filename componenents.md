# Components Overview

## Non-GrossGauntlet Component Files in `src/components/`

### Background/
- `Background.jsx`
- `answerPulse.js`
- `Background.module.css`
- `Slot.jsx`

### Confirmation/
- `Confirmation.jsx`
- `Confirmation.module.css`

### Output/
- `Output.module.css`
- `OutputScreen.jsx`
- `StyleCarousel.jsx`

### Quiz/
- `Quiz.jsx`
- `Quiz.module.css`
- `ProgressBar.jsx`
- `QuizPanel.jsx`

### shared/
- `TagPill.jsx`
- `TagPill.module.css`

### Welcome/
- `Welcome.jsx`
- `Welcome.module.css`

---

## Core Files

### `src/App.jsx`
```jsx
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useQuizStore } from './store/quizStore';
import Background from './components/Background/Background';
import Welcome from './components/Welcome/Welcome';
import Quiz from './components/Quiz/Quiz';
import OutputScreen from './components/Output/OutputScreen';
import Confirmation from './components/Confirmation/Confirmation';
import GrossGauntletRouter from './components/GrossGauntlet/GrossGauntletRouter';
import GrossGauntletApp from './components/GrossGauntlet/GrossGauntletApp';
import GrossGauntletControl from './components/GrossGauntlet/GrossGauntletControl';
import TasksOverlay from './components/GrossGauntlet/TasksOverlay';
import { WELCOME_IMAGE_IDS } from './config/welcome-images';

const GROSSGAUNTLET_ROUTES = ['/grossgauntlet', '/overlay'];
const OVERLAY_ROUTES = ['/GrossGauntlet/overlays/', '/GrossGauntlet/controls'];

function isGrossGauntletRoute(pathname) {
  return GROSSGAUNTLET_ROUTES.some((route) => pathname.startsWith(route));
}

function isOverlayRoute(pathname) {
  return OVERLAY_ROUTES.some(r => pathname.includes(r));
}

export default function App() {
  const location = useLocation();
  const canvasRef = useRef(null);
  const didBootstrapRef = useRef(false);
  const screen = useQuizStore(s => s.screen);
  const welcomePanel = useQuizStore(s => s.welcomePanel);
  const currentStep = useQuizStore(s => s.currentStep);
  const activeImageIds = useQuizStore(s => s.activeImageIds);
  const isSearching = useQuizStore(s => s.isSearching);
  const outputResults = useQuizStore(s => s.outputResults);
  const bootstrapSession = useQuizStore(s => s.bootstrapSession);
  const blurred = screen === 'output' || screen === 'confirmation';
  const isOutputVisible = screen === 'output';
  const isResultFlow = screen === 'output' || screen === 'confirmation';
  const isInitialMatchLoading = screen === 'output' && isSearching && outputResults.length === 0;
  const backgroundImageIds = isResultFlow ? WELCOME_IMAGE_IDS : activeImageIds;
  const showCard1 = screen === 'quiz' && currentStep === 0;
  const showCard2 = screen === 'quiz' && currentStep === 1;
  const showCard3 = screen === 'quiz' && currentStep === 2;

  const isGGRoute = isGrossGauntletRoute(location.pathname);
  const isOvlRoute = isOverlayRoute(location.pathname);

  useEffect(() => {
    const el = document.getElementById('app-loading');
    if (!el) return;
    gsap.to(el, { opacity: 0, duration: 0.4, ease: 'power2.in', delay: 0.1, onComplete: () => el.remove() });
  }, []);

  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;

    const pathname = window.location.pathname || '/';
    const extractedHandle = pathname.startsWith('/@')
      ? decodeURIComponent(pathname.slice(2)) || null
      : null;

    bootstrapSession(extractedHandle);
  }, [bootstrapSession]);

  if (isOvlRoute) {
    const path = location.pathname;
    if (path.includes('overlays/explain')) return <GrossGauntletApp displayMode="explain" />;
    if (path.includes('overlays/break'))   return <GrossGauntletApp displayMode="break" />;
    if (path.includes('overlays/work'))    return <GrossGauntletApp displayMode="work" />;
    if (path.includes('overlays/standby')) return <GrossGauntletApp displayMode="standby" />;
    if (path.includes('overlays/tasks'))   return <TasksOverlay />;
    if (path.includes('/controls'))        return <GrossGauntletControl />;
  }

  if (isGGRoute) {
    return <GrossGauntletRouter />;
  }

  return (
    <>
      <Background
        ref={canvasRef}
        imageIds={backgroundImageIds}
        blurred={blurred}
        isOutputVisible={isOutputVisible}
        rapidSwapActive={isInitialMatchLoading}
        showCard1={showCard1}
        showCard2={showCard2}
        showCard3={showCard3}
      />
      {screen === 'welcome' && <Welcome canvasRef={canvasRef} />}
      {screen === 'quiz' && <Quiz />}
      {screen === 'output' && <OutputScreen />}
      {screen === 'confirmation' && <Confirmation />}
    </>
  );
}
```

### `src/main.jsx`
```jsx
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { loadAllData } from './utils/dataCache';
import { preloadImagesAsync } from './utils/preloader';
import { WELCOME_IMAGE_IDS } from './config/welcome-images';
import { DESKTOP_SLOTS, MOBILE_SLOTS } from './config/generateSlots';
import App from './App';
import './styles/global.css';

function preloadWelcomeImages() {
  const slotCount = window.innerWidth >= 768 ? DESKTOP_SLOTS.length : MOBILE_SLOTS.length;
  const toPreload = WELCOME_IMAGE_IDS.slice(0, slotCount);
  return preloadImagesAsync(toPreload, { threshold: 1.0, maxMs: 2500 });
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

Promise.all([
  loadAllData(),
  preloadWelcomeImages(),
]).catch(console.error);
```

---

## Global CSS

### `src/styles/global.css`
```css
:root {
  --bg: #0a0a0a;
  --white-100: rgba(255, 255, 255, 1.00);
  --white-92:  rgba(255, 255, 255, 0.92);
  --white-82:  rgba(255, 255, 255, 0.82);
  --white-70:  rgba(255, 255, 255, 0.70);
  --white-55:  rgba(255, 255, 255, 0.55);
  --white-45:  rgba(255, 255, 255, 0.45);
  --white-40:  rgba(255, 255, 255, 0.40);
  --white-35:  rgba(255, 255, 255, 0.35);
  --white-25:  rgba(255, 255, 255, 0.25);
  --white-12:  rgba(255, 255, 255, 0.12);
  --white-10:  rgba(255, 255, 255, 0.10);
  --white-07:  rgba(255, 255, 255, 0.07);
  --white-06:  rgba(255, 255, 255, 0.06);
  --panel-bg: rgba(10, 10, 10, 0.62);
  --font: 'Space Grotesk', system-ui, -apple-system, sans-serif;
  --weight-thin: 200;
  --weight-light: 300;
  --weight-regular: 400;
  --space-4:  4px;
  --space-8:  8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-20: 20px;
  --space-24: 24px;
  --space-28: 28px;
  --space-36: 36px;
  --space-40: 40px;
  --space-48: 48px;
  --space-60: 60px;
  --space-72: 72px;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html, body, #root {
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--bg);
  font-family: var(--font);
  color: var(--white-92);
}

@media (min-width: 768px) {
  html, body, #root {
    overflow: visible;
  }
}

button {
  font-family: var(--font);
  cursor: pointer;
  background: none;
  border: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

img {
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

::selection {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

*:focus {
  outline: none;
}

button:focus-visible {
  outline: 1px solid rgba(255, 255, 255, 0.5);
  outline-offset: 3px;
}
```

---

## Component Files

### `src/components/shared/TagPill.jsx`
```jsx
import styles from './TagPill.module.css';

export default function TagPill({ label, onClick }) {
  return (
    <button className={styles.pill} onClick={onClick} type="button">
      {label}
    </button>
  );
}
```

### `src/components/shared/TagPill.module.css`
```css
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 9px 22px;
  cursor: pointer;
  border-radius: 0;
  transition: color 0.18s ease, border-color 0.18s ease;
  white-space: nowrap;
}

.pill:hover {
  color: rgba(255, 255, 255, 0.82);
  border-color: rgba(255, 255, 255, 0.38);
}

@media (max-width: 767px) {
  .pill {
    padding: 10px 18px;
    font-size: 0.72rem;
  }
}
```

### `src/components/Welcome/Welcome.jsx`
```jsx
import { memo, useRef, useEffect, useCallback, useMemo, useState } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import { WELCOME_IMAGE_IDS } from '../../config/welcome-images';
import { filterImages, selectForSlots } from '../../utils/filter';
import { MAINS } from '../../config/questionTree';
import { DESKTOP_SLOTS, MOBILE_SLOTS } from '../../config/generateSlots';
import { getManifest } from '../../utils/dataCache';
import { preloadImagesPriority } from '../../utils/preloader';
import { EASE, DUR } from '../../config/animation';
import styles from './Welcome.module.css';

const FAQ_GROUPS = [
  {
    label: 'WHAT IT IS',
    items: [
      { question: 'What exactly do you do?', answer: 'We close the distribution gap between your newsletter and the readers who would pay for it. Your posts become short-form videos. Those videos run on TikTok and Instagram. The viewers who resonate subscribe to your newsletter.' },
      { question: 'What does "faceless" mean?', answer: 'No one appears on camera. No face, no voice, no personality. The content is the star.' },
      { question: 'What does "branded to me" mean?', answer: 'The visual style, tone, and feel of every video is built from your quiz responses. It looks like an extension of your newsletter, not a generic template.' },
      { question: 'Is this my brand or a separate channel?', answer: 'A separate channel. A passive funnel into your newsletter. Your identity, reputation, and authority stay entirely on Substack.' },
      { question: 'Will the video sound like me?', answer: 'Yes. The script comes from your own words. We do not rewrite your ideas, we make them visual.' },
      { question: 'What kind of content works for this?', answer: 'Structured, idea-driven posts. Frameworks, real numbers, step-by-step processes, specific stories with a clear lesson. If you can read it and learn something actionable, it works.' },
      { question: 'Where do the videos get posted?', answer: 'TikTok, Instagram Reels, and YouTube Shorts.' },
      { question: 'How many videos a month?', answer: 'Ten.' },
    ],
  },
  {
    label: 'THE FREE VIDEO',
    items: [
      { question: 'Is the first video really free?', answer: 'Yes. No cost. No commitment. In your inbox in 2 days.' },
      { question: 'What is the free video made from?', answer: 'Your latest newsletter post.' },
      { question: 'Can I choose which post you use?', answer: 'Yes. If you have a specific post in mind, tell us. Otherwise we use the latest one.' },
      { question: 'When do I receive it?', answer: 'Within 2 days of completing the quiz.' },
      { question: 'What if I don\'t like it?', answer: 'Tell us why. We will fix it.' },
      { question: 'Is there a catch?', answer: 'No. The free video is free. We make it because it is the best way to show you what is possible.' },
    ],
  },
  {
    label: 'YOUR INVOLVEMENT',
    items: [
      { question: 'Do I appear on camera?', answer: 'Never.' },
      { question: 'Do I write anything new?', answer: 'No. Every video is built from your existing posts.' },
      { question: 'How much of my time does this take?', answer: 'One email to approve the video. That is it.' },
      { question: 'Do I manage the social accounts?', answer: 'No.' },
      { question: 'What happens after I confirm?', answer: 'We get to work. Free video in your inbox in 2 days. After that, one decision: continue or do not.' },
    ],
  },
  {
    label: 'THE OFFER',
    items: [
      { question: 'How much does it cost?', answer: 'Two options. The Partnership: $200/mo + 20% commission on new paid subscriber revenue. Ten videos a month. The Engine: $1,000/mo flat, no commission.' },
      { question: 'How does commission work?', answer: 'You activate Substack\'s built-in referral program. We get a unique referral link. That link goes in every video description. Every subscriber who clicks through is tracked automatically. We take 20% of their subscription revenue.' },
      { question: 'How is commission tracked?', answer: 'Through Substack\'s native referral dashboard. The number is the same for both of us in real time. No self-reporting. No disputes.' },
      { question: 'When is commission paid?', answer: 'End of month, based on verified attributed subscribers.' },
      { question: 'What if I don\'t break even?', answer: 'We keep working until you do. For free.' },
      { question: 'What if the videos don\'t grow my subscribers at all?', answer: 'Commission is zero. You paid $200 for ten videos and walked away.' },
      { question: 'What\'s the break-even number?', answer: '15 new paid subscribers.' },
      { question: 'How long until I see results?', answer: 'Videos compound over time. Some pick up immediately. Some build over months. Ten videos a month means consistent presence, the algorithm rewards that.' },
    ],
  },
  {
    label: 'TRUST',
    items: [
      { question: 'Why is the first video free?', answer: 'Because telling you it works means nothing. Showing you does.' },
      { question: 'Why commission based?', answer: 'Because our income grows when yours does. If the videos do not perform, we do not get paid. That is the only model that makes sense.' },
      { question: 'What happens to my content?', answer: 'Nothing. Your writing stays yours. We use it to make videos and nothing else.' },
      { question: 'Can I cancel anytime?', answer: 'Yes.' },
      { question: 'What if I want to stop after the free video?', answer: 'You stop. No questions. Although feedback will be greatly appreciated.' },
      { question: 'Do you work with anyone?', answer: 'We work with business writers and operators who share real mechanics: numbers, processes, decisions. Not theory. Not inspiration.' },
    ],
  },
];

const WHEEL_THRESHOLD = 90;
const SWIPE_THRESHOLD = 54;

const FaqItem = memo(function FaqItem({ itemKey, item, isOpen, onToggle }) {
  const answerId = `faq-answer-${itemKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  return (
    <section className={styles.faqItem}>
      <button className={`${styles.faqTrigger} ${isOpen ? styles.faqTriggerOpen : ''}`} type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => onToggle(itemKey)}>
        <h3 className={styles.faqQuestion}>{item.question}</h3>
        <span className={styles.faqChevron} aria-hidden="true">+</span>
      </button>
      <div id={answerId} className={`${styles.faqAnswer} ${isOpen ? styles.faqAnswerOpen : ''}`}>
        <p>{item.answer}</p>
      </div>
    </section>
  );
});

export default function Welcome({ canvasRef }) {
  const headlineRef = useRef(null);
  const subRef = useRef(null);
  const btnRef = useRef(null);
  const heroCardRef = useRef(null);
  const faqCardRef = useRef(null);
  const faqScrollRef = useRef(null);
  const transitionTlRef = useRef(null);
  const wheelAccumRef = useRef(0);
  const touchStartYRef = useRef(null);

  const setScreen = useQuizStore(s => s.setScreen);
  const setActiveImageIds = useQuizStore(s => s.setActiveImageIds);
  const welcomePanel = useQuizStore(s => s.welcomePanel);
  const welcomePanelAnimating = useQuizStore(s => s.welcomePanelAnimating);
  const setWelcomePanelAnimating = useQuizStore(s => s.setWelcomePanelAnimating);
  const openWelcomeFaq = useQuizStore(s => s.openWelcomeFaq);
  const closeWelcomeFaq = useQuizStore(s => s.closeWelcomeFaq);
  const resetWelcomePanel = useQuizStore(s => s.resetWelcomePanel);
  const [expandedFaqKey, setExpandedFaqKey] = useState('WHAT IT IS::What exactly do you do?');
  const faqColumns = useMemo(() => {
    const leftColumn = [];
    const rightColumn = [];
    FAQ_GROUPS.forEach((group, index) => {
      if (index % 2 === 0) leftColumn.push(group);
      else rightColumn.push(group);
    });
    return [leftColumn, rightColumn];
  }, []);

  const animateToFaq = useCallback(() => { /* full implementation in source file */ }, []);
  const animateToHero = useCallback(() => { /* full implementation in source file */ }, []);

  useEffect(() => {
    resetWelcomePanel();
    setActiveImageIds(WELCOME_IMAGE_IDS);
    const manifest = getManifest();
    if (manifest) {
      const slotCount = window.innerWidth >= 768 ? DESKTOP_SLOTS.length : MOBILE_SLOTS.length;
      const defaultMain = MAINS[0].options[0];
      const filtered = filterImages(manifest, 0, { main: defaultMain, subsub: null });
      const selected = selectForSlots(filtered, slotCount, `0:${defaultMain}:null:null`);
      preloadImagesPriority(selected.map(s => s.id));
    }
    fetch('/api/warmup', { method: 'POST' }).catch(() => {});
    gsap.set(heroCardRef.current, { y: 0, opacity: 0, pointerEvents: 'auto' });
    gsap.set(faqCardRef.current, { y: 84, opacity: 0, pointerEvents: 'none' });
    gsap.timeline()
      .fromTo(heroCardRef.current, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: DUR.slow, ease: EASE.out })
      .fromTo(headlineRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: EASE.out }, '-=0.35')
      .fromTo(subRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: EASE.out }, '-=0.3')
      .fromTo(btnRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: DUR.deliberate, ease: EASE.out }, '-=0.2');
    return () => { if (transitionTlRef.current) { transitionTlRef.current.kill(); transitionTlRef.current = null; } setWelcomePanelAnimating(false); };
  }, []);

  useEffect(() => {
    const onWheel = (event) => { /* wheel handler */ };
    const onTouchStart = (event) => { touchStartYRef.current = event.touches?.[0]?.clientY ?? null; };
    const onTouchEnd = (event) => { /* touch end handler */ };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => { window.removeEventListener('wheel', onWheel); window.removeEventListener('touchstart', onTouchStart); window.removeEventListener('touchend', onTouchEnd); };
  }, [animateToFaq, animateToHero, welcomePanel, welcomePanelAnimating]);

  const toggleFaqItem = useCallback((key) => { setExpandedFaqKey((prev) => (prev === key ? '' : key)); }, []);

  const handleMake = () => {
    const activeCard = welcomePanel === 'faq' ? faqCardRef.current : heroCardRef.current;
    gsap.timeline().to(activeCard, { opacity: 0, scale: 0.97, duration: DUR.medium, ease: EASE.in, onComplete: () => setScreen('quiz') });
  };

  return (
    <div className={styles.container}>
      <div ref={heroCardRef} className={`${styles.card} ${styles.heroCard}`} style={{ opacity: 0 }}>
        <h1 ref={headlineRef} className={styles.headline} style={{ opacity: 0 }}>your free video starts here.</h1>
        <p ref={subRef} className={styles.sub} style={{ opacity: 0 }}>Two minutes so it looks like yours.</p>
        <button ref={btnRef} className={styles.makeBtn} onClick={handleMake} style={{ opacity: 0 }}>Start</button>
      </div>
      <div ref={faqCardRef} className={`${styles.card} ${styles.faqCard}`} style={{ opacity: 0 }}>
        <h2 className={styles.faqTitle}>FAQ</h2>
        <div ref={faqScrollRef} className={styles.faqScrollArea}>
          <div className={styles.faqColumns}>
            {faqColumns.map((columnGroups, columnIndex) => (
              <div className={styles.faqColumn} key={`faq-col-${columnIndex}`}>
                {columnGroups.map((group) => (
                  <section key={group.label} className={styles.faqGroup}>
                    <p className={styles.faqGroupLabel}>{group.label}</p>
                    <div className={styles.faqGroupItems}>
                      {group.items.map((item) => {
                        const itemKey = `${group.label}::${item.question}`;
                        return <FaqItem key={itemKey} itemKey={itemKey} item={item} isOpen={expandedFaqKey === itemKey} onToggle={toggleFaqItem} />;
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ))}
          </div>
        </div>
        <button className={`${styles.makeBtn} ${styles.faqStartBtn}`} onClick={handleMake} type="button">Start</button>
      </div>
      {welcomePanel === 'hero' && <p className={styles.scrollHint}>Scroll down for FAQ</p>}
    </div>
  );
}
```

### `src/components/Welcome/Welcome.module.css`
```css
.container { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 100; pointer-events: none; }
.card { position: absolute; pointer-events: auto; background: rgba(10, 10, 10, 0.62); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.10); border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45); padding: 52px 60px; display: flex; flex-direction: column; align-items: center; }
/* ... see source file for full CSS including .faqCard, .faqTitle, .faqScrollArea, .faqColumns, .faqColumn, .faqGroup, .faqGroupLabel, .faqGroupItems, .faqItem, .faqQuestion, .faqAnswer, .faqAnswerOpen, .faqTrigger, .faqChevron, .faqTriggerOpen, .scrollHint, .headline, .sub, .makeBtn, .heroCard, .faqStartBtn, and mobile breakpoints */
```

### `src/components/Output/OutputScreen.jsx`
*(Full file available in source — 1022 lines including loading screen, split layout, similarity carousels, mobile card deck, tag rows, find-similar overlay, navigation history, and animation orchestration)*

### `src/components/Output/Output.module.css`
*(Full file available in source — 673 lines covering split layout, left/right panels, carousel grid, mobile breakpoints, carousel containers, pagination dots, shimmer placeholders, similarity badges, arrows, button rows, loading screen, and find-similar overlay)*

### `src/components/Output/StyleCarousel.jsx`
*(Full file available in source — 301 lines handling segment loading from Supabase Storage, swipe/pointer events, slide navigation, pagination dots, and similarity badge)*

### `src/components/Background/Background.jsx`
*(Full file available in source — 494 lines managing 60 permanent slots with drift, parallax, adaptive slot assignment, coordinate stretch, text cards, and rapid image swap during search)*

### `src/components/Background/Background.module.css`
*(Full file available in source — 72 lines styling .canvas, .layer, .slot, .textCardContent, .textCardText, .emptyHint)*

### `src/components/Background/answerPulse.js`
*(Full file available in source — 17 lines for GSAP answer pulse animation)*

### `src/components/Background/Slot.jsx`
*(Full file available in source — 145 lines handling drift animation, ambient vertical creep, image crossfade, and text card rendering)*

### `src/components/Confirmation/Confirmation.jsx`
*(Full file available in source — 128 lines handling email/name form, validation, submission, and done state)*

### `src/components/Confirmation/Confirmation.module.css`
*(Full file available in source — 157 lines for confirmation glass card, form inputs, actions row, and done state)*

### `src/components/Quiz/Quiz.jsx`
*(Full file available in source — 492 lines handling quiz flow, background filtering, answer selection, step advancement, preloading, and session progress)*

### `src/components/Quiz/Quiz.module.css`
*(Full file available in source — 292 lines for quiz panel, glass card, progress bar, options grid, column labels, and navigation)*

### `src/components/Quiz/ProgressBar.jsx`
```jsx
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { TOTAL_VISIBLE_STEPS } from '../../config/questionTree';
import styles from './Quiz.module.css';

export default function ProgressBar({ currentStep }) {
  const barRef = useRef(null);

  useEffect(() => {
    gsap.to(barRef.current, {
      scaleX: (currentStep + 1) / TOTAL_VISIBLE_STEPS,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, [currentStep]);

  return (
    <div className={styles.track}>
      <div ref={barRef} className={styles.fill} />
    </div>
  );
}
```

### `src/components/Quiz/QuizPanel.jsx`
```jsx
import { useRef } from 'react';
import gsap from 'gsap';
import styles from './Quiz.module.css';

export default function QuizPanel({ question, options, selectedOption, onSelect, onNext }) {
  const contentRef = useRef(null);

  const handleOptionClick = (e, value) => {
    gsap.timeline()
      .to(e.currentTarget, { scale: 0.96, duration: 0.04, ease: 'power2.in' })
      .to(e.currentTarget, { scale: 1.0, duration: 0.18, ease: 'elastic.out(1.2, 0.75)' });
    onSelect(value);
  };

  return (
    <div ref={contentRef} className={styles.panelContent}>
      <p className={styles.question}>{question}</p>
      <div className={styles.optionsRow}>
        {options.map(opt => (
          <button key={opt} className={`${styles.option} ${selectedOption === opt ? styles.selected : ''}`} onClick={(e) => handleOptionClick(e, opt)}>
            {opt}
          </button>
        ))}
      </div>
      <button className={styles.nextBtn} onClick={onNext}>Next →</button>
    </div>
  );
}
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
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
      {
        question: 'What exactly do you do?',
        answer: 'We close the distribution gap between your newsletter and the readers who would pay for it. Your posts become short-form videos. Those videos run on TikTok and Instagram. The viewers who resonate subscribe to your newsletter.',
      },
      {
        question: 'What does "faceless" mean?',
        answer: 'No one appears on camera. No face, no voice, no personality. The content is the star.',
      },
      {
        question: 'What does "branded to me" mean?',
        answer: 'The visual style, tone, and feel of every video is built from your quiz responses. It looks like an extension of your newsletter, not a generic template.',
      },
      {
        question: 'Is this my brand or a separate channel?',
        answer: 'A separate channel. A passive funnel into your newsletter. Your identity, reputation, and authority stay entirely on Substack.',
      },
      {
        question: 'Will the video sound like me?',
        answer: 'Yes. The script comes from your own words. We do not rewrite your ideas, we make them visual.',
      },
      {
        question: 'What kind of content works for this?',
        answer: 'Structured, idea-driven posts. Frameworks, real numbers, step-by-step processes, specific stories with a clear lesson. If you can read it and learn something actionable, it works.',
      },
      {
        question: 'Where do the videos get posted?',
        answer: 'TikTok, Instagram Reels, and YouTube Shorts.',
      },
      {
        question: 'How many videos a month?',
        answer: 'Ten.',
      },
    ],
  },
  {
    label: 'THE FREE VIDEO',
    items: [
      {
        question: 'Is the first video really free?',
        answer: 'Yes. No cost. No commitment. In your inbox in 2 days.',
      },
      {
        question: 'What is the free video made from?',
        answer: 'Your latest newsletter post.',
      },
      {
        question: 'Can I choose which post you use?',
        answer: 'Yes. If you have a specific post in mind, tell us. Otherwise we use the latest one.',
      },
      {
        question: 'When do I receive it?',
        answer: 'Within 2 days of completing the quiz.',
      },
      {
        question: 'What if I don\'t like it?',
        answer: 'Tell us why. We will fix it.',
      },
      {
        question: 'Is there a catch?',
        answer: 'No. The free video is free. We make it because it is the best way to show you what is possible.',
      },
    ],
  },
  {
    label: 'YOUR INVOLVEMENT',
    items: [
      {
        question: 'Do I appear on camera?',
        answer: 'Never.',
      },
      {
        question: 'Do I write anything new?',
        answer: 'No. Every video is built from your existing posts.',
      },
      {
        question: 'How much of my time does this take?',
        answer: 'One email to approve the video. That is it.',
      },
      {
        question: 'Do I manage the social accounts?',
        answer: 'No.',
      },
      {
        question: 'What happens after I confirm?',
        answer: 'We get to work. Free video in your inbox in 2 days. After that, one decision: continue or do not.',
      },
    ],
  },
  {
    label: 'THE OFFER',
    items: [
      {
        question: 'How much does it cost?',
        answer: 'Two options. The Partnership: $200/mo + 20% commission on new paid subscriber revenue. Ten videos a month. The Engine: $1,000/mo flat, no commission.',
      },
      {
        question: 'How does commission work?',
        answer: 'You activate Substack\'s built-in referral program. We get a unique referral link. That link goes in every video description. Every subscriber who clicks through is tracked automatically. We take 20% of their subscription revenue.',
      },
      {
        question: 'How is commission tracked?',
        answer: 'Through Substack\'s native referral dashboard. The number is the same for both of us in real time. No self-reporting. No disputes.',
      },
      {
        question: 'When is commission paid?',
        answer: 'End of month, based on verified attributed subscribers.',
      },
      {
        question: 'What if I don\'t break even?',
        answer: 'We keep working until you do. For free.',
      },
      {
        question: 'What if the videos don\'t grow my subscribers at all?',
        answer: 'Commission is zero. You paid $200 for ten videos and walked away.',
      },
      {
        question: 'What\'s the break-even number?',
        answer: '15 new paid subscribers.',
      },
      {
        question: 'How long until I see results?',
        answer: 'Videos compound over time. Some pick up immediately. Some build over months. Ten videos a month means consistent presence, the algorithm rewards that.',
      },
    ],
  },
  {
    label: 'TRUST',
    items: [
      {
        question: 'Why is the first video free?',
        answer: 'Because telling you it works means nothing. Showing you does.',
      },
      {
        question: 'Why commission based?',
        answer: 'Because our income grows when yours does. If the videos do not perform, we do not get paid. That is the only model that makes sense.',
      },
      {
        question: 'What happens to my content?',
        answer: 'Nothing. Your writing stays yours. We use it to make videos and nothing else.',
      },
      {
        question: 'Can I cancel anytime?',
        answer: 'Yes.',
      },
      {
        question: 'What if I want to stop after the free video?',
        answer: 'You stop. No questions. Although feedback will be greatly appreciated.',
      },
      {
        question: 'Do you work with anyone?',
        answer: 'We work with business writers and operators who share real mechanics: numbers, processes, decisions. Not theory. Not inspiration.',
      },
    ],
  },
];

const WHEEL_THRESHOLD = 90;
const SWIPE_THRESHOLD = 54;

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

  const animateToFaq = useCallback(() => {
    if (welcomePanelAnimating || welcomePanel === 'faq') return;
    if (!heroCardRef.current || !faqCardRef.current) return;

    setWelcomePanelAnimating(true);

    if (transitionTlRef.current) transitionTlRef.current.kill();

    const tl = gsap.timeline({
      onComplete: () => {
        openWelcomeFaq();
        setWelcomePanelAnimating(false);
      },
    });

    transitionTlRef.current = tl;

    tl.set(faqCardRef.current, { pointerEvents: 'auto' });
    tl.set(heroCardRef.current, { pointerEvents: 'none' });
    tl.to(heroCardRef.current, {
      opacity: 0,
      y: -16,
      duration: DUR.deliberate,
      ease: EASE.out,
    }, 0);
    tl.fromTo(faqCardRef.current,
      { opacity: 0, y: 84 },
      { opacity: 1, y: 0, duration: DUR.deliberate, ease: EASE.out },
      0
    );
  }, [openWelcomeFaq, setWelcomePanelAnimating, welcomePanel, welcomePanelAnimating]);

  const animateToHero = useCallback(() => {
    if (welcomePanelAnimating || welcomePanel !== 'faq') return;
    if (!heroCardRef.current || !faqCardRef.current) return;

    setWelcomePanelAnimating(true);

    if (transitionTlRef.current) transitionTlRef.current.kill();

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(canvasRef.current, { clearProps: 'filter,opacity' });
        closeWelcomeFaq();
        if (faqScrollRef.current) faqScrollRef.current.scrollTop = 0;
        gsap.set(faqCardRef.current, { pointerEvents: 'none' });
        setWelcomePanelAnimating(false);
      },
    });

    transitionTlRef.current = tl;

    tl.set(heroCardRef.current, { pointerEvents: 'auto' });
    tl.to(faqCardRef.current, {
      opacity: 0,
      y: 84,
      duration: DUR.deliberate,
      ease: EASE.in,
    }, 0);
    tl.to(canvasRef.current, {
      filter: 'blur(0px)',
      opacity: 1,
      duration: DUR.deliberate,
      ease: EASE.out,
    }, 0);
    tl.to(heroCardRef.current, {
      opacity: 1,
      y: 0,
      duration: DUR.deliberate,
      ease: EASE.out,
    }, 0);
  }, [canvasRef, closeWelcomeFaq, setWelcomePanelAnimating, welcomePanel, welcomePanelAnimating]);

  // Set welcome images on mount + entrance animation
  useEffect(() => {
    resetWelcomePanel();
    setActiveImageIds(WELCOME_IMAGE_IDS);

    // Preload quiz step 0 images — always category 0, first MAIN, 100% deterministic
    const manifest = getManifest();
    if (manifest) {
      const slotCount = window.innerWidth >= 768 ? DESKTOP_SLOTS.length : MOBILE_SLOTS.length;
      const defaultMain = MAINS[0].options[0];
      const filtered = filterImages(manifest, 0, { main: defaultMain, sub: null, subsub: null });
      const selected = selectForSlots(filtered, slotCount, `0:${defaultMain}:null:null`);
      preloadImagesPriority(selected.map(s => s.id));
    }

    // Warm the RunPod worker immediately — by the time the quiz ends it'll be hot
    fetch('/api/warmup', { method: 'POST' }).catch(() => {});

    gsap.set(heroCardRef.current, { y: 0, opacity: 0, pointerEvents: 'auto' });
    gsap.set(faqCardRef.current, { y: 84, opacity: 0, pointerEvents: 'none' });

    gsap.timeline()
      .fromTo(heroCardRef.current,
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1, duration: DUR.slow, ease: EASE.out }
      )
      .fromTo(headlineRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.8, ease: EASE.out },
        '-=0.35'
      )
      .fromTo(subRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: EASE.out },
        '-=0.3'
      )
      .fromTo(btnRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: DUR.deliberate, ease: EASE.out },
        '-=0.2'
      );

    return () => {
      if (transitionTlRef.current) {
        transitionTlRef.current.kill();
        transitionTlRef.current = null;
      }
      setWelcomePanelAnimating(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {

    const onWheel = (event) => {
      if (welcomePanelAnimating) return;

      if (welcomePanel === 'hero') {
        if (event.deltaY <= 0) {
          wheelAccumRef.current = 0;
          return;
        }

        wheelAccumRef.current += event.deltaY;
        if (wheelAccumRef.current >= WHEEL_THRESHOLD) {
          wheelAccumRef.current = 0;
          event.preventDefault();
          animateToFaq();
        }
        return;
      }

      if (welcomePanel !== 'faq' || !faqScrollRef.current) return;
      if (event.deltaY >= 0) {
        wheelAccumRef.current = 0;
        return;
      }

      const atTop = faqScrollRef.current.scrollTop <= 1;
      if (!atTop) {
        wheelAccumRef.current = 0;
        return;
      }

      wheelAccumRef.current += Math.abs(event.deltaY);
      if (wheelAccumRef.current >= WHEEL_THRESHOLD) {
        wheelAccumRef.current = 0;
        event.preventDefault();
        animateToHero();
      }
    };

    const onTouchStart = (event) => {
      touchStartYRef.current = event.touches?.[0]?.clientY ?? null;
    };

    const onTouchEnd = (event) => {
      if (welcomePanelAnimating) return;
      const startY = touchStartYRef.current;
      const endY = event.changedTouches?.[0]?.clientY ?? null;
      touchStartYRef.current = null;
      if (startY === null || endY === null) return;

      const deltaY = startY - endY;

      if (welcomePanel === 'hero' && deltaY >= SWIPE_THRESHOLD) {
        animateToFaq();
        return;
      }

      if (welcomePanel !== 'faq' || deltaY > -SWIPE_THRESHOLD || !faqScrollRef.current) return;

      const atTop = faqScrollRef.current.scrollTop <= 1;
      if (atTop) {
        animateToHero();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      wheelAccumRef.current = 0;
      touchStartYRef.current = null;
    };
  }, [animateToFaq, animateToHero, welcomePanel, welcomePanelAnimating]);

  const toggleFaqItem = useCallback((key) => {
    setExpandedFaqKey((prev) => (prev === key ? '' : key));
  }, []);

  const handleMake = () => {
    const activeCard = welcomePanel === 'faq' ? faqCardRef.current : heroCardRef.current;

    // Faster exit animation then transition
    gsap.timeline()
      .to(activeCard, {
        opacity: 0,
        scale: 0.97,
        duration: DUR.medium,
        ease: EASE.in,
        onComplete: () => setScreen('quiz'),
      });
  };

  return (
    <div className={styles.container}>
      <div ref={heroCardRef} className={`${styles.card} ${styles.heroCard}`} style={{ opacity: 0 }}>
        <h1 ref={headlineRef} className={styles.headline} style={{ opacity: 0 }}>
          your free video starts here.
        </h1>
        <p ref={subRef} className={styles.sub} style={{ opacity: 0 }}>
          Two minutes so it looks like yours.
        </p>
        <button
          ref={btnRef}
          className={styles.makeBtn}
          onClick={handleMake}
          style={{ opacity: 0 }}
        >
          Start
        </button>
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
                        const isOpen = expandedFaqKey === itemKey;
                        const answerId = `faq-answer-${itemKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

                        return (
                          <section key={item.question} className={styles.faqItem}>
                            <button
                              className={`${styles.faqTrigger} ${isOpen ? styles.faqTriggerOpen : ''}`}
                              type="button"
                              aria-expanded={isOpen}
                              aria-controls={answerId}
                              onClick={() => toggleFaqItem(itemKey)}
                            >
                              <h3 className={styles.faqQuestion}>{item.question}</h3>
                              <span className={styles.faqChevron} aria-hidden="true">+</span>
                            </button>
                            <div
                              id={answerId}
                              className={`${styles.faqAnswer} ${isOpen ? styles.faqAnswerOpen : ''}`}
                            >
                              <p>{item.answer}</p>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ))}
          </div>
        </div>
        <button
          className={`${styles.makeBtn} ${styles.faqStartBtn}`}
          onClick={handleMake}
          type="button"
        >
          Start
        </button>
      </div>
      {welcomePanel === 'hero' && <p className={styles.scrollHint}>Scroll down for FAQ</p>}
    </div>
  );
}

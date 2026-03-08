import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import { WELCOME_IMAGE_IDS } from '../../config/welcome-images';
import { filterImages, selectForSlots } from '../../utils/filter';
import { MAINS } from '../../config/questionTree';
import { DESKTOP_SLOTS, MOBILE_SLOTS } from '../../config/generateSlots';
import { getManifest } from '../../utils/dataCache';
import { preloadImagesPriority } from '../../utils/preloader';
import styles from './Welcome.module.css';

export default function Welcome() {
  const headlineRef = useRef(null);
  const subRef = useRef(null);
  const btnRef = useRef(null);
  const containerRef = useRef(null);
  const cardRef = useRef(null);

  const setScreen = useQuizStore(s => s.setScreen);
  const setActiveImageIds = useQuizStore(s => s.setActiveImageIds);

  // Set welcome images on mount + entrance animation
  useEffect(() => {
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

    gsap.timeline()
      .fromTo(cardRef.current,
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }
      )
      .fromTo(headlineRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
        '-=0.35'
      )
      .fromTo(subRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out' },
        '-=0.3'
      )
      .fromTo(btnRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
        '-=0.2'
      );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMake = () => {
    // Faster exit animation then transition
    gsap.timeline()
      .to(cardRef.current, {
        opacity: 0,
        scale: 0.97,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => setScreen('quiz'),
      });
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <div ref={cardRef} className={styles.card} style={{ opacity: 0 }}>
        <h1 ref={headlineRef} className={styles.headline} style={{ opacity: 0 }}>
          your ideas. your style.
        </h1>
        <p ref={subRef} className={styles.sub} style={{ opacity: 0 }}>
          The bigger room is waiting.
        </p>
        <button
          ref={btnRef}
          className={styles.makeBtn}
          onClick={handleMake}
          style={{ opacity: 0 }}
        >
          Enter
        </button>
      </div>
    </div>
  );
}

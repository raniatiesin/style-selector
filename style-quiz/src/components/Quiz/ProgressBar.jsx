import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import styles from './Quiz.module.css';

export default function ProgressBar({ currentStep }) {
  const barRef = useRef(null);

  useEffect(() => {
    gsap.to(barRef.current, {
      scaleX: (currentStep + 1) / 36,
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

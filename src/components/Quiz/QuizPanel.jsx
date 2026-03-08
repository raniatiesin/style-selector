import { useRef } from 'react';
import gsap from 'gsap';
import styles from './Quiz.module.css';

export default function QuizPanel({
  question,
  options,
  selectedOption,
  onSelect,
  onNext,
}) {
  const contentRef = useRef(null);

  const handleOptionClick = (e, value) => {
    // Faster tactile spring
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
          <button
            key={opt}
            className={`${styles.option} ${selectedOption === opt ? styles.selected : ''}`}
            onClick={(e) => handleOptionClick(e, opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      <button className={styles.nextBtn} onClick={onNext}>
        Next →
      </button>
    </div>
  );
}

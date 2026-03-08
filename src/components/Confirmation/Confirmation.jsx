import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useQuizStore } from '../../store/quizStore';
import styles from './Confirmation.module.css';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function Done() {
  const doneRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(doneRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.6, ease: 'power2.out' }
    );
  }, []);

  return (
    <div className={styles.doneContainer}>
      <span ref={doneRef} className={styles.doneText} style={{ opacity: 0 }}>
        Done.
      </span>
    </div>
  );
}

export default function Confirmation() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});

  const headlineRef = useRef(null);
  const bodyRef = useRef(null);
  const formRef = useRef(null);

  const submitting = useQuizStore(s => s.submitting);
  const submitted = useQuizStore(s => s.submitted);
  const submitConfirmation = useQuizStore(s => s.submitConfirmation);

  // Entrance animation
  useEffect(() => {
    gsap.timeline()
      .fromTo(headlineRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.1 }
      )
      .fromTo(bodyRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' },
        '-=0.25'
      )
      .fromTo(formRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
        '-=0.2'
      );
  }, []);

  const handleSubmit = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = true;
    if (!isValidEmail(email)) newErrors.email = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    submitConfirmation(name.trim(), email.trim());
  };

  if (submitted) return <Done />;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 ref={headlineRef} className={styles.headline} style={{ opacity: 0 }}>
          Your video is on its way.
        </h1>
        <p ref={bodyRef} className={styles.body} style={{ opacity: 0 }}>
          Free of charge. In your inbox within 2 days.
        </p>

        <div ref={formRef} className={styles.form} style={{ opacity: 0 }}>
          <input
            className={`${styles.input} ${errors.name ? styles.error : ''}`}
            placeholder="Name"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: false })); }}
            autoComplete="name"
          />
          <input
            className={`${styles.input} ${errors.email ? styles.error : ''}`}
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: false })); }}
            autoComplete="email"
          />
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}

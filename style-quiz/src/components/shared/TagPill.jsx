import styles from './TagPill.module.css';

export default function TagPill({ label, onClick }) {
  return (
    <button className={styles.pill} onClick={onClick} type="button">
      {label}
    </button>
  );
}

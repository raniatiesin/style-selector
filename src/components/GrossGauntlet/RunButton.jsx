import { useState } from 'react';
import { API } from '../../config/api';
import { getLocalStorageItem, setLocalStorageItem } from './utils';
import { STORAGE_KEYS } from './constants';

/**
 * Auth gate for /tasks — unlocks board editing via the same
 * STREAM_ADMIN_KEY used by the control panel.
 */
export default function RunButton({ onUnlock, isUnlocked }) {
  const [showForm, setShowForm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const key = password.trim();
    if (!key) return;

    setChecking(true);
    setError(null);

    try {
      const res = await fetch(API.postMetrics(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ ping: true }),
      });

      if (res.status === 401) {
        setError('Invalid admin key.');
        return;
      }

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      setLocalStorageItem(STORAGE_KEYS.STREAM_ADMIN_KEY, key);
      setLocalStorageItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED, 'true');
      setPassword('');
      setShowForm(false);
      onUnlock?.();
    } catch (err) {
      setError(err.message || 'Failed to verify key');
    } finally {
      setChecking(false);
    }
  }

  function handleLock() {
    localStorage.removeItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED);
    setShowForm(false);
    setPassword('');
    setError(null);
    onUnlock?.();
  }

  if (isUnlocked) {
    return (
      <button type="button" className="gg-run-btn gg-run-btn--locked" onClick={handleLock}>
        Lock Board
      </button>
    );
  }

  if (!showForm) {
    return (
      <button type="button" className="gg-run-btn" onClick={() => setShowForm(true)}>
        Run
      </button>
    );
  }

  return (
    <form className="gg-run-form" onSubmit={handleSubmit}>
      <input
        type="password"
        className="gg-run-input"
        placeholder="Admin key"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        disabled={checking}
      />
      <button type="submit" className="gg-run-btn" disabled={checking || !password.trim()}>
        {checking ? '…' : 'Unlock'}
      </button>
      <button
        type="button"
        className="gg-run-btn gg-run-btn--cancel"
        onClick={() => {
          setShowForm(false);
          setError(null);
        }}
      >
        Cancel
      </button>
      {error && <span className="gg-run-error">{error}</span>}
    </form>
  );
}

export function getIsUnlocked() {
  return getLocalStorageItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED) === 'true';
}

export function getAdminKey() {
  return getLocalStorageItem(STORAGE_KEYS.STREAM_ADMIN_KEY);
}

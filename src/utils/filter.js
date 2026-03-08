import { SUBSUB_DESCENDANTS, SUBSUBS, SUBSUBS_OVERRIDES } from '../config/questionTree';

/** Mulberry32 — seeded PRNG (same as generateSlots.js). */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert a string seed to a 32-bit integer for mulberry32. */
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Filter manifest by set-membership against the current category's SUBSUB descendants.
 *
 * @param {Array}  manifest       — full manifest array
 * @param {number} categoryIndex  — 0–11
 * @param {{ main: string|null, sub: string|null, subsub: string|null }} state
 * @returns {Array} filtered manifest entries
 */
export function filterImages(manifest, categoryIndex, { main, sub, subsub }) {
  let validSet;

  if (subsub) {
    validSet = new Set([subsub]);
  } else if (sub) {
    // Use SUBSUBS directly (not SUBSUB_DESCENDANTS) to avoid key collisions.
    // "Frozen Action" is both a MAIN and SUB with different descendants;
    // "Essential Elements" appears in two categories with different children.
    const entry = SUBSUBS_OVERRIDES[categoryIndex]?.[sub] || SUBSUBS[sub];
    if (entry) {
      validSet = new Set(entry.options);
    } else {
      return manifest;
    }
  } else if (main && SUBSUB_DESCENDANTS[main]) {
    validSet = new Set(SUBSUB_DESCENDANTS[main]);
  } else {
    return manifest;
  }

  return manifest.filter(style => {
    const tag = style.tally.split(', ')[categoryIndex];
    return validSet.has(tag);
  });
}

/**
 * Shuffle filtered pool and return up to slotCount entries.
 * Uses a seeded PRNG so identical selections produce identical results.
 */
export function selectForSlots(filtered, slotCount, seed) {
  if (filtered.length === 0) return [];

  const rand = mulberry32(hashSeed(seed));

  // Fisher-Yates shuffle (copy first)
  const shuffled = [...filtered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, slotCount);
}

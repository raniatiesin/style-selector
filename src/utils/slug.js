/**
 * Slug normalization utility for GrossGauntlet stream sessions.
 * Generates URL slug from the subtitle portion of the stream title
 * following the last delimiter (:, —, or -).
 */

export function generateSlug(streamTitle) {
  if (!streamTitle) return 'session';
  const parts = streamTitle.split(/[:—–-]/);
  const rawSub = parts[parts.length - 1] || streamTitle;

  return rawSub
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Strip spaces, symbols, punctuation
    .slice(0, 40);             // Hard cap at 40 chars
}

// Example: "Gross Gauntlet — Log 7: Chapter 1 shipped" -> "chapter1shipped"
export function matchesSlug(streamTitle, slug) {
  if (!slug) return false;
  return generateSlug(streamTitle) === slug;
}
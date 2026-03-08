// ════════════════════════════════════════════════════════════════
// PROCEDURAL SLOT GENERATOR
// Creates N slots with center-avoidance dispersion:
//   • Close/large images → edges & corners only
//   • Mid images → outer-middle ring
//   • Far/small images → everywhere including center
// Works with any count: 1, 4, 40, 84, etc.
// ════════════════════════════════════════════════════════════════

/**
 * Seeded pseudo-random for deterministic layouts.
 * Mulberry32 — fast, good distribution.
 */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Geometric distance from center in percentage space (used for spatial coverage).
 * Returns 0–√2 for points within the grid.
 */
function centerDistance(x, y) {
  const dx = (x - 50) / 50;
  const dy = (y - 50) / 50;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Pixel-space distance from center, normalized so 1.0 = half the screen height.
 * Accounts for aspect ratio so top/bottom edges don't count as "far from center"
 * the same way left/right edges do on a 16:9 screen.
 * On 16:9 desktop: top-center=1.0, left-center=1.78, corners≈2.04
 */
function pixelDist(x, y, aspect) {
  const dx = (x - 50) / 50 * aspect;
  const dy = (y - 50) / 50;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Layer definitions ──────────────────────────────────────────
// Layer 1 (far):  small, transparent — allowed everywhere
// Layer 2 (mid):  medium — outer ring only
// Layer 3 (close): large, opaque — edges & corners only

const LAYER_CONFIG = {
  1: {
    widthRange: [5, 9],
    opacityRange: [0.45, 0.62],
    driftXRange: [8, 14],
    driftYRange: [6, 11],
    driftDurRange: [18, 26],
  },
  2: {
    widthRange: [9, 14],
    opacityRange: [0.65, 0.82],
    driftXRange: [12, 22],
    driftYRange: [10, 18],
    driftDurRange: [12, 18],
  },
  3: {
    widthRange: [14, 19],
    opacityRange: [0.88, 1.0],
    driftXRange: [20, 32],
    driftYRange: [16, 26],
    driftDurRange: [8, 13],
  },
};

const MOBILE_LAYER_CONFIG = {
  1: {
    widthRange: [12, 18],
    opacityRange: [0.45, 0.62],
    driftXRange: [6, 10],
    driftYRange: [4, 8],
    driftDurRange: [18, 26],
  },
  2: {
    widthRange: [18, 26],
    opacityRange: [0.65, 0.82],
    driftXRange: [8, 15],
    driftYRange: [7, 13],
    driftDurRange: [12, 18],
  },
  3: {
    widthRange: [26, 36],
    opacityRange: [0.88, 1.0],
    driftXRange: [12, 20],
    driftYRange: [10, 16],
    driftDurRange: [8, 13],
  },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Generate slot positions for a given count.
 *
 * @param {number} count       — how many slots to generate (1–200+)
 * @param {object} options
 * @param {'desktop'|'mobile'} options.platform
 * @param {number} options.seed — deterministic seed (default: 42)
 * @returns {Array} slot definitions compatible with Background.jsx
 */
export function generateSlots(count, { platform = 'desktop', seed = 42 } = {}) {
  const rand = mulberry32(seed);
  const config = platform === 'mobile' ? MOBILE_LAYER_CONFIG : LAYER_CONFIG;
  const aspect = platform === 'mobile' ? 9 / 16 : 16 / 9;

  // ── Step 1: Aspect-ratio-aware grid ───────────────────────
  // Match grid shape to screen shape so cells are visually uniform.
  const cols = Math.max(2, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(2, Math.ceil(count / cols));
  const totalCells = cols * rows;

  // Span with slight edge bleed
  const spanX = 112;
  const spanY = 112;
  const cellW = spanX / cols;
  const cellH = spanY / rows;
  const originX = 50 - spanX / 2;
  const originY = 50 - spanY / 2;

  // Generate all grid positions with brick-pattern stagger + jitter.
  // Odd rows are offset by half a cell width so no two adjacent rows
  // share the same x column — breaks the vertical stripe effect.
  const allCandidates = [];
  for (let r = 0; r < rows; r++) {
    const staggerX = (r % 2 === 1) ? cellW * 0.5 : 0;
    for (let c = 0; c < cols; c++) {
      const baseX = originX + (c + 0.5) * cellW + staggerX;
      const baseY = originY + (r + 0.5) * cellH;
      const jitterX = (rand() - 0.5) * cellW * 0.85;
      const jitterY = (rand() - 0.5) * cellH * 0.85;
      allCandidates.push({ x: baseX + jitterX, y: baseY + jitterY });
    }
  }

  // If more cells than needed, drop the most spatially redundant ones
  // (those closest to another candidate) to maintain even coverage.
  let positions;
  if (totalCells > count) {
    const keep = new Array(totalCells).fill(true);
    let remaining = totalCells;
    while (remaining > count) {
      let minDist = Infinity;
      let dropIdx = -1;
      for (let i = 0; i < totalCells; i++) {
        if (!keep[i]) continue;
        for (let j = i + 1; j < totalCells; j++) {
          if (!keep[j]) continue;
          const dx = allCandidates[i].x - allCandidates[j].x;
          const dy = allCandidates[i].y - allCandidates[j].y;
          const d = dx * dx + dy * dy;
          if (d < minDist) {
            minDist = d;
            // Drop whichever is closer to center (preserve edge coverage)
            dropIdx = centerDistance(allCandidates[i].x, allCandidates[i].y)
                    < centerDistance(allCandidates[j].x, allCandidates[j].y)
                    ? i : j;
          }
        }
      }
      keep[dropIdx] = false;
      remaining--;
    }
    positions = allCandidates.filter((_, i) => keep[i]);
  } else {
    positions = allCandidates.slice(0, count);
  }

  // ── Step 2: Zone-based layer assignment ──────────────────────
  //
  // L3 (large, opaque) → CORNER zones ONLY:
  //   Must be near BOTH a horizontal AND vertical edge.
  //   hEdge: x < 15 or x > 85  (near left/right viewport edge)
  //   vEdge: y < 20 or y > 80  (near top/bottom viewport edge)
  //   An image in the left column at y=50% is NOT a corner — it's a side —
  //   and does NOT get L3. Only x<15 AND y<20 etc. qualifies.
  //
  // L1 (small, transparent) → inner 50% by pixel-distance: center field
  // L2 (medium) → outer ring that is not a corner zone

  const hEdge = x => x < 15 || x > 85;
  const vEdge = y => y < 20 || y > 80;
  const isCorner = (x, y) => hEdge(x) && vEdge(y);

  // Sort by pixelDist ascending for L1/L2 ordering
  positions.sort((a, b) => pixelDist(a.x, a.y, aspect) - pixelDist(b.x, b.y, aspect));

  // Collect corner-zone candidates, outermost first
  const cornerCandidates = [...positions.filter(p => isCorner(p.x, p.y))]
    .sort((a, b) => pixelDist(b.x, b.y, aspect) - pixelDist(a.x, a.y, aspect));

  // Place L3 slots with minimum spacing — prevents adjacent corner cells stacking
  const MIN_L3_SQ = 28 * 28; // 28% min distance between large images
  const l3Set = new Set();
  const l3Placed = [];
  for (const pos of cornerCandidates) {
    const tooClose = l3Placed.some(p => {
      const dx = pos.x - p.x, dy = pos.y - p.y;
      return dx * dx + dy * dy < MIN_L3_SQ;
    });
    if (!tooClose) { l3Set.add(pos); l3Placed.push(pos); }
  }

  // All non-L3 positions stay sorted by pixelDist — inner half → L1, outer half → L2
  const rest = positions.filter(p => !l3Set.has(p));
  const targetL1 = Math.max(1, Math.round(rest.length * 0.50));

  const layerAssignments = positions.map(pos => {
    if (l3Set.has(pos)) return { pos, layer: 3 };
    const idx = rest.indexOf(pos);
    return { pos, layer: idx < targetL1 ? 1 : 2 };
  });

  // ── Step 3: Build slot objects ─────────────────────────────
  const slots = [];
  for (let i = 0; i < count; i++) {
    const { pos, layer } = layerAssignments[i];
    const cfg = config[layer];

    slots.push({
      id: `slot-${String(i + 1).padStart(3, '0')}`,
      x: Math.round(pos.x * 10) / 10,
      y: Math.round(pos.y * 10) / 10,
      width: Math.round(lerp(cfg.widthRange[0], cfg.widthRange[1], rand()) * 10) / 10,
      aspectRatio: '2/3',
      layer,
      driftX: Math.round(lerp(cfg.driftXRange[0], cfg.driftXRange[1], rand())),
      driftY: Math.round(lerp(cfg.driftYRange[0], cfg.driftYRange[1], rand())),
      driftDuration: Math.round(lerp(cfg.driftDurRange[0], cfg.driftDurRange[1], rand())),
      driftPhase: i / count,
      rotation: 0,
      opacity: Math.round(lerp(cfg.opacityRange[0], cfg.opacityRange[1], rand()) * 100) / 100,
      borderRadius: 4,
    });
  }

  return slots;
}

// Pre-generated for the two platforms at standard counts
export const DESKTOP_SLOTS = generateSlots(84, { platform: 'desktop', seed: 42 });
export const MOBILE_SLOTS  = generateSlots(40, { platform: 'mobile',  seed: 42 });

export const MOBILE_SLOT_COMPOSITION = {
  description: 'Mobile composition-only metadata for slot distribution tuning.',
  zones: {
    corners: {
      x: [0, 15, 85, 100],
      y: [0, 20, 80, 100],
      weight: 0.22,
    },
    outerRing: {
      minCenterDistance: 0.45,
      weight: 0.55,
    },
    centerField: {
      maxCenterDistance: 0.45,
      weight: 0.23,
    },
  },
  layerWeights: {
    far: 0.23,
    mid: 0.55,
    close: 0.22,
  },
  driftBias: {
    far: { x: [6, 10], y: [4, 8] },
    mid: { x: [8, 15], y: [7, 13] },
    close: { x: [12, 20], y: [10, 16] },
  },
};

import {
  ANSWER_STRIDE,
  CANONICAL_STAGE_COUNT,
  LEAF_SLOT_OFFSET,
  REMOVED_STAGE_DEFAULTS,
  VISIBLE_TO_CANONICAL_STAGE,
  getVisibleStageIndex,
} from '../config/questionTree.js';

export function buildCanonicalTallyArray(answers) {
  const slots = Array(CANONICAL_STAGE_COUNT).fill(null);

  for (let visibleStageIndex = 0; visibleStageIndex < VISIBLE_TO_CANONICAL_STAGE.length; visibleStageIndex++) {
    const canonicalStageIndex = VISIBLE_TO_CANONICAL_STAGE[visibleStageIndex];
    const answer = answers[visibleStageIndex * ANSWER_STRIDE + LEAF_SLOT_OFFSET];
    if (answer) slots[canonicalStageIndex] = answer;
  }

  for (const [slotIndex, defaultValue] of Object.entries(REMOVED_STAGE_DEFAULTS)) {
    slots[Number(slotIndex)] = defaultValue;
  }

  return slots;
}

export function buildCanonicalTallyString(answers) {
  return buildCanonicalTallyArray(answers).join(', ');
}

export function isCanonicalStageEditable(canonicalStageIndex) {
  return getVisibleStageIndex(canonicalStageIndex) != null;
}

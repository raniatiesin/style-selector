/**
 * questionTree.js — Manifest-aligned version
 * 8 visible stages × 2 steps/stage.
 * Canonical 12-slot tally mapping remains unchanged.
 */

export const CANONICAL_STAGE_COUNT = 12;

export const VISIBLE_TO_CANONICAL_STAGE = [0, 1, 2, 3, 4, 7, 8, 10];

export const REMOVED_STAGE_DEFAULTS = {
  5: "Smooth Undulating",
  6: "Visual Equilibrium",
  9: "Impossible Landscapes",
  11: "Standing Pose",
};

export const STEPS_PER_STAGE = 2;
export const ANSWER_STRIDE = 3;
export const MAIN_SLOT_OFFSET = 0;
export const LEAF_SLOT_OFFSET = 2;

export const STAGES = [
  { stage: 0, name: "Primary Vibe", question: "What's the primary VIBE you want to communicate?", options: ["Dreamlike & Surreal", "Bold & Striking", "Calm & Serene", "Playful & Whimsical", "Mysterious & Moody", "Energetic & Dynamic", "Elegant & Refined", "Raw & Authentic"] },
  { stage: 1, name: "Realism Level", question: "How REALISTIC should the image feel?", options: ["Photorealistic", "Illustrated/Painted", "3D Rendered", "Flat Graphic", "Mixed Media", "Abstract Forms", "Sketch/Line Art", "Pixel Art"] },
  { stage: 2, name: "Texture Quality", question: "What TEXTURE quality do you prefer?", options: ["Ultra Smooth/Clean", "Grainy/Noisy", "Painterly/Brushed", "Pointillistic/Dotted", "Geometric/Patterned", "Organic/Natural", "Glitch/Digital Artifacts", "Layered/Dimensional"] },
  { stage: 3, name: "Color Philosophy", question: "What's your COLOR philosophy?", options: ["Vibrant & Saturated", "Pastel & Soft", "Muted & Desaturated", "Monochromatic", "High Contrast", "Neon & Fluorescent", "Natural & Organic", "Metallic & Iridescent"] },
  { stage: 4, name: "Lighting Setup", question: "What LIGHTING sets the scene?", options: ["Natural Daylight", "Golden Hour Warm", "Dramatic Side/Rim", "Soft Diffused", "Neon/Artificial", "Moonlight/Night", "Backlit/Silhouette", "Studio Controlled"] },
  { stage: 7, name: "Emotional Mood", question: "What EMOTIONAL MOOD should viewers feel?", options: ["Joyful/Uplifting", "Melancholic/Nostalgic", "Contemplative/Introspective", "Energetic/Exciting", "Mysterious/Enigmatic", "Serene/Peaceful", "Dramatic/Intense", "Whimsical/Fantastical"] },
  { stage: 8, name: "Motion & Energy", question: "How does MOVEMENT feel?", options: ["Speed Lines/Blur", "Frozen Action", "Flowing Curves", "Static Stillness", "Spiral/Vortex", "Explosive/Radiating", "Collapsing/Heavy", "Rhythmic/Oscillating"] },
  { stage: 10, name: "Detail Level", question: "What LEVEL OF DETAIL is appropriate?", options: ["Hyperdetailed", "High Detail", "Moderate Detail", "Low Detail", "Minimal Detail", "Abstract/Suggestive", "Textural Detail", "Atmospheric Detail"] },
];

export const VISIBLE_STAGE_COUNT = STAGES.length;
export const TOTAL_VISIBLE_STEPS = VISIBLE_STAGE_COUNT * STEPS_PER_STAGE;
export const MAX_VISIBLE_STEP_INDEX = TOTAL_VISIBLE_STEPS - 1;

const CANONICAL_TO_VISIBLE_STAGE = (() => {
  const map = {};
  for (let visibleIdx = 0; visibleIdx < VISIBLE_TO_CANONICAL_STAGE.length; visibleIdx++) {
    map[VISIBLE_TO_CANONICAL_STAGE[visibleIdx]] = visibleIdx;
  }
  return map;
})();

export function getCanonicalStageIndex(visibleStageIndex) {
  return VISIBLE_TO_CANONICAL_STAGE[visibleStageIndex] ?? null;
}

export function getVisibleStageIndex(canonicalStageIndex) {
  return CANONICAL_TO_VISIBLE_STAGE[canonicalStageIndex] ?? null;
}

export function getMainAnswerIndex(visibleStageIndex) {
  return visibleStageIndex * ANSWER_STRIDE + MAIN_SLOT_OFFSET;
}

export function getLeafAnswerIndex(visibleStageIndex) {
  return visibleStageIndex * ANSWER_STRIDE + LEAF_SLOT_OFFSET;
}

// Backward-compat alias used by Quiz.jsx
export const MAINS = STAGES;

export const SUBS = {
  "Dreamlike & Surreal": { question: "Which dreamlike direction calls to you?", options: ["Subtle Dreamlike", "Obvious Fantasy", "Chaotic Abstract", "Structured Abstract"] },
  "Bold & Striking": { question: "What makes it strike?", options: ["Neon Vibrant", "High-Contrast", "Macro Details", "Vast Expansive"] },
  "Calm & Serene": { question: "How does the calm feel?", options: ["Empty Space", "Soft Filled", "Organic Flowing", "Geometric Zen"] },
  "Playful & Whimsical": { question: "What kind of playful?", options: ["Flat 2D", "3D Rendered Cute", "Weird Charming", "Absurdist Humor"] },
  "Mysterious & Moody": { question: "What flavour of mystery?", options: ["Gothic Shadows", "Noir Minimal", "Folklore Symbols", "Cosmic Ethereal"] },
  "Energetic & Dynamic": { question: "How does the energy move?", options: ["Splatter Energy", "Geometric Kinetic", "Pop Art Bright", "Tropical Saturated"] },
  "Elegant & Refined": { question: "What kind of elegance?", options: ["Gold Accents", "Minimalist Expensive", "Renaissance Inspired", "Modern Classic"] },
  "Raw & Authentic": { question: "How does authenticity show up?", options: ["Urban Rough", "Organic Earthy", "Portrait Intimate", "Documentary Real"] },

  "Photorealistic": { question: "What kind of photorealism?", options: ["Studio Photography", "Natural Environment", "Enhanced Beauty", "Artistic Interpretation"] },
  "Illustrated/Painted": { question: "What illustration style?", options: ["Smooth Blended", "Visible Brushstrokes", "Watercolor Soft", "Oil Painting Rich"] },
  "3D Rendered": { question: "What 3D rendering style?", options: ["Product Render Perfect", "Architectural Precise", "Cartoon Render", "Clay/Toy Aesthetic"] },
  "Flat Graphic": { question: "What flat graphic feel?", options: ["Corporate Minimal", "Playful Shapes", "Vintage Propaganda", "Modern Graphic"] },
  "Mixed Media": { question: "What mixed media approach?", options: ["Cut Paper Analog", "Digital Composite", "Seamless Blend", "Obvious Surreal"] },
  "Abstract Forms": { question: "What abstract quality?", options: ["Hard Edge Precise", "Flowing Shapes", "Natural Forms", "Chaotic Expressive"] },
  "Sketch/Line Art": { question: "What line art style?", options: ["Technical Pen", "Cross-hatched", "Quick Sketch", "Expressive Scribble"] },
  "Pixel Art": { question: "What pixel art era?", options: ["NES/GameBoy Style", "C64 Limited Palette", "Detailed Sprites", "Pixel Painting"] },

  "Ultra Smooth/Clean": { question: "What smooth finish?", options: ["Mirror Shine", "Wet Reflective", "Powder Soft", "Porcelain Finish"] },
  "Grainy/Noisy": { question: "What kind of grain?", options: ["35mm Texture", "Analog Warmth", "High ISO Grit", "Distressed Vintage"] },
  "Painterly/Brushed": { question: "What painterly quality?", options: ["Impasto Thick", "Expressive Marks", "Airbrushed Smooth", "Sfumato Subtle"] },
  "Pointillistic/Dotted": { question: "What dot texture?", options: ["Delicate Stipple", "Halftone Screen", "Bold Pointillism", "Spray Paint Dots"] },
  "Geometric/Patterned": { question: "What pattern type?", options: ["Wallpaper Regular", "Decorative Motifs", "Islamic Geometric", "Mosaic Tiles"] },
  "Organic/Natural": { question: "What natural texture?", options: ["Canvas Texture", "Linen Threads", "Rough Handmade", "Subtle Grain"] },
  "Glitch/Digital Artifacts": { question: "How corrupted is it?", options: ["Slight Distortion", "Digital Artifacts", "Datamosh Chaos", "Pixel Sorting"] },
  "Layered/Dimensional": { question: "How dimensional?", options: ["Slight Emboss", "Soft Shadows", "Clear Separation", "3D Paper Craft"] },

  "Vibrant & Saturated": { question: "How are the colors arranged?", options: ["Red/Yellow/Blue Focus", "Secondary Colors Too", "Even Distribution", "Gradient Flow"] },
  "Pastel & Soft": { question: "Which pastel direction?", options: ["Lavender/Mint/Sky", "Full Cool Range", "Coral/Cream/Blush", "Sunset Warmth"] },
  "Muted & Desaturated": { question: "What muted palette?", options: ["Brown/Beige/Olive", "Terracotta/Rust", "Faded 70s", "Sepia Nostalgic"] },
  "Monochromatic": { question: "What mono tone?", options: ["Blue Variations", "Warm Tone Variations", "Pure Grayscale", "Tinted Monochrome"] },
  "High Contrast": { question: "What contrast approach?", options: ["Orange/Blue", "Red/Green Tension", "Stark Contrast", "Chiaroscuro Drama"] },
  "Neon & Fluorescent": { question: "Which neon palette?", options: ["Electric Pink/Blue", "Acid Green/Purple", "Hot Magenta", "Day-glo Pop"] },
  "Natural & Organic": { question: "Which natural hue?", options: ["Deep Emerald", "Moss Tones", "Aqua Turquoise", "Deep Navy"] },
  "Metallic & Iridescent": { question: "What metallic quality?", options: ["Warm Gold", "Cool Silver", "Shifting Colors", "Opalescent Sheen"] },

  "Natural Daylight": { question: "What natural light quality?", options: ["Sunrise Glow", "Sunset Amber", "Cloud Filtered", "Shade Soft"] },
  "Golden Hour Warm": { question: "How dramatic are the shadows?", options: ["Deep Blacks", "Mystery Silhouette", "Triangle Light", "Chiaroscuro Depth"] },
  "Dramatic Side/Rim": { question: "What quality of brightness?", options: ["Natural Daylight", "Warm Radiance", "Professional Setup", "Controlled Uniform"] },
  "Soft Diffused": { question: "What dim mood?", options: ["Flickering Warmth", "Soft Glow", "Dusk Ambiance", "Fading Light"] },
  "Neon/Artificial": { question: "What artificial light era?", options: ["Electric Pink/Blue", "Urban Nightscape", "Vintage Signs", "50s Nostalgia"] },
  "Moonlight/Night": { question: "How does light cut through dark?", options: ["Bright Intensity", "Strong Shadows", "Through Leaves", "Diffused Soft"] },
  "Backlit/Silhouette": { question: "How much detail survives the light?", options: ["Edge Glow", "Outline Luminous", "Complete Shadow", "Dark Shape"] },
  "Studio Controlled": { question: "What ethereal quality?", options: ["Floating Sparkles", "Luminous Dust", "Light Beams", "Divine Shafts"] },

  "Joyful/Uplifting": { question: "What kind of joy?", options: ["Party Festive", "Triumphant Victory", "Quiet Smile", "Peaceful Contentment"] },
  "Melancholic/Nostalgic": { question: "What shade of melancholy?", options: ["Sweet Sadness", "Aching Nostalgia", "Distant Past", "Faded Remembrance"] },
  "Contemplative/Introspective": { question: "What kind of tension?", options: ["Anticipation Building", "Climactic Moment", "Dark Omen", "Creeping Unease"] },
  "Energetic/Exciting": { question: "What kind of calm energy?", options: ["Meditative Stillness", "Profound Calm", "Gentle Satisfaction", "Relaxed Ease"] },
  "Mysterious/Enigmatic": { question: "What intensity of power?", options: ["Unbridled Energy", "Explosive Strength", "Focused Aggression", "Disciplined Power"] },
  "Serene/Peaceful": { question: "What kind of wonder?", options: ["Innocent Discovery", "Wide-eyed Joy", "Overwhelming Majesty", "Transcendent Beauty"] },
  "Dramatic/Intense": { question: "What kind of connection?", options: ["Intense Desire", "Burning Love", "Gentle Affection", "Intimate Closeness"] },
  "Whimsical/Fantastical": { question: "What mysterious quality?", options: ["Captivating Puzzle", "Fascinating Secret", "Eerie Uncertainty", "Disturbing Ambiguity"] },

  "Speed Lines/Blur": { question: "How is speed captured?", options: ["Motion Trails", "Directional Blur", "Peak Moment", "Mid-Action Freeze"] },
  "Frozen Action": { question: "What flows through the stillness?", options: ["Streaming Current", "Ripple Surface", "Ethereal Tendrils", "Diffusing Vapor"] },
  "Flowing Curves": { question: "How still is the stillness?", options: ["Immovable Weight", "Grounded Permanence", "Poised Calm", "Centered Equilibrium"] },
  "Static Stillness": { question: "How much life is implied?", options: ["Barely Perceptible", "About to Shift", "Breathing Presence", "Quiet Animation"] },
  "Spiral/Vortex": { question: "What spiral energy?", options: ["Swirling Chaos", "Whirlpool Pull", "Slow Spin", "Orbiting Elements"] },
  "Explosive/Radiating": { question: "How does it radiate?", options: ["Explosive Force", "Star Burst", "Emanating Light", "Expanding Rings"] },
  "Collapsing/Heavy": { question: "What direction does weight pull?", options: ["Collapsing Inward", "Vacuum Pull", "Heavy Weight", "Sinking Down"] },
  "Rhythmic/Oscillating": { question: "What rhythm pattern?", options: ["Undulating Motion", "Ripple Effect", "Back and Forth", "Rhythmic Pulse"] },

  "Hyperdetailed": { question: "What kind of hyper detail?", options: ["Macro Photography Close", "Surface Detail Zoom", "Lace-like Complexity", "Ornamental Precision"] },
  "High Detail": { question: "What high detail emphasis?", options: ["Layered Depth", "Varied Elements", "Sharp Clarity", "Technical Accuracy"] },
  "Moderate Detail": { question: "How is detail balanced?", options: ["Even Attention", "Distributed Detail", "Hero Focus", "Depth of Field Blur"] },
  "Low Detail": { question: "How simplified?", options: ["Basic Shapes", "Clean Reduction", "Core Components", "Key Features Only"] },
  "Minimal Detail": { question: "How minimal?", options: ["Absolute Minimum", "Stripped Down", "Symbol Simple", "Logo-like"] },
  "Abstract/Suggestive": { question: "How much is left to imagination?", options: ["Suggested Shapes", "Partial Rendering", "Open Ended", "Imagination Required"] },
  "Textural Detail": { question: "What textural emphasis?", options: ["Material Quality", "Tactile Focus", "Physical Properties", "Substance Highlight"] },
  "Atmospheric Detail": { question: "What atmospheric quality?", options: ["Atmosphere Heavy", "Ambient Quality", "Distance Layers", "Perspective Emphasis"] },
};

export const SUBSUBS = {};

export const SUBSUBS_OVERRIDES = {};

export const SUBSUB_DESCENDANTS = (() => {
  const map = {};
  for (const [mainKey, config] of Object.entries(SUBS)) {
    map[mainKey] = [...config.options];
  }
  return map;
})();

export function resolveStep(stepIndex, answers) {
  const level = stepIndex % STEPS_PER_STAGE;
  const visibleStageIndex = Math.floor(stepIndex / STEPS_PER_STAGE);
  const stage = STAGES[visibleStageIndex];
  if (!stage) return null;

  if (level === 0) return { question: stage.question, options: stage.options };

  const mainAnswer = answers[getMainAnswerIndex(visibleStageIndex)] ?? stage.options[0];
  return SUBS[mainAnswer] ?? SUBS[stage.options[0]] ?? null;
}

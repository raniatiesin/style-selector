// scripts/generate-manifest-dev.cjs
// Generates placeholder manifest.json with valid tally strings matching the actual SUBS structure.
// Each tally slot must be a leaf-level option from the question tree so filterImages() can match.

const fs = require('fs');
const path = require('path');

const COUNT = 695;

// Canonical stage order: [0,1,2,3,4,5,6,7,8,9,10,11]
// Visible stages: 0-4,7,8,10  (removed: 5,6,9,11)

const REMOVED_STAGE_DEFAULTS = [
  'Smooth Undulating',
  'Visual Equilibrium',
  'Impossible Landscapes',
  'Standing Pose',
];

// For each visible stage: { main: MAIN_OPTION, leaf: LEAF_OPTION }
// Constructed from SUBS so leaf values exactly match filterImages()'s validSet.
// Category 0 — Vibe → SUBS[Vibe option].options
const CAT0_LEAVES = {
  "Dreamlike & Surreal": ["Subtle Dreamlike", "Obvious Fantasy", "Chaotic Abstract", "Structured Abstract"],
  "Bold & Striking":       ["Neon Vibrant", "High-Contrast", "Macro Details", "Vast Expansive"],
  "Calm & Serene":         ["Empty Space", "Soft Filled", "Organic Flowing", "Geometric Zen"],
  "Playful & Whimsical":   ["Flat 2D", "3D Rendered Cute", "Weird Charming", "Absurdist Humor"],
  "Mysterious & Moody":    ["Gothic Shadows", "Noir Minimal", "Folklore Symbols", "Cosmic Ethereal"],
  "Energetic & Dynamic":   ["Splatter Energy", "Geometric Kinetic", "Pop Art Bright", "Tropical Saturated"],
  "Elegant & Refined":     ["Gold Accents", "Minimalist Expensive", "Renaissance Inspired", "Modern Classic"],
  "Raw & Authentic":       ["Urban Rough", "Organic Earthy", "Portrait Intimate", "Documentary Real"],
};

const CAT1_LEAVES = {
  "Photorealistic":      ["Studio Photography", "Natural Environment", "Enhanced Beauty", "Artistic Interpretation"],
  "Illustrated/Painted": ["Smooth Blended", "Visible Brushstrokes", "Watercolor Soft", "Oil Painting Rich"],
  "3D Rendered":         ["Product Render Perfect", "Architectural Precise", "Cartoon Render", "Clay/Toy Aesthetic"],
  "Flat Graphic":        ["Corporate Minimal", "Playful Shapes", "Vintage Propaganda", "Modern Graphic"],
  "Mixed Media":         ["Cut Paper Analog", "Digital Composite", "Seamless Blend", "Obvious Surreal"],
  "Abstract Forms":      ["Hard Edge Precise", "Flowing Shapes", "Natural Forms", "Chaotic Expressive"],
  "Sketch/Line Art":     ["Technical Pen", "Cross-hatched", "Quick Sketch", "Expressive Scribble"],
  "Pixel Art":           ["NES/GameBoy Style", "C64 Limited Palette", "Detailed Sprites", "Pixel Painting"],
};

const CAT2_LEAVES = {
  "Ultra Smooth/Clean":      ["Mirror Shine", "Wet Reflective", "Powder Soft", "Porcelain Finish"],
  "Grainy/Noisy":            ["35mm Texture", "Analog Warmth", "High ISO Grit", "Distressed Vintage"],
  "Painterly/Brushed":       ["Impasto Thick", "Expressive Marks", "Airbrushed Smooth", "Sfumato Subtle"],
  "Pointillistic/Dotted":    ["Delicate Stipple", "Halftone Screen", "Bold Pointillism", "Spray Paint Dots"],
  "Geometric/Patterned":     ["Wallpaper Regular", "Decorative Motifs", "Islamic Geometric", "Mosaic Tiles"],
  "Organic/Natural":         ["Canvas Texture", "Linen Threads", "Rough Handmade", "Subtle Grain"],
  "Glitch/Digital Artifacts":["Slight Distortion", "Digital Artifacts", "Datamosh Chaos", "Pixel Sorting"],
  "Layered/Dimensional":     ["Slight Emboss", "Soft Shadows", "Clear Separation", "3D Paper Craft"],
};

const CAT3_LEAVES = {
  "Vibrant & Saturated":   ["Red/Yellow/Blue Focus", "Secondary Colors Too", "Even Distribution", "Gradient Flow"],
  "Pastel & Soft":         ["Lavender/Mint/Sky", "Full Cool Range", "Coral/Cream/Blush", "Sunset Warmth"],
  "Muted & Desaturated":   ["Brown/Beige/Olive", "Terracotta/Rust", "Faded 70s", "Sepia Nostalgic"],
  "Monochromatic":         ["Blue Variations", "Warm Tone Variations", "Pure Grayscale", "Tinted Monochrome"],
  "High Contrast":         ["Orange/Blue", "Red/Green Tension", "Stark Contrast", "Chiaroscuro Drama"],
  "Neon & Fluorescent":    ["Electric Pink/Blue", "Acid Green/Purple", "Hot Magenta", "Day-glo Pop"],
  "Natural & Organic":     ["Deep Emerald", "Moss Tones", "Aqua Turquoise", "Deep Navy"],
  "Metallic & Iridescent": ["Warm Gold", "Cool Silver", "Shifting Colors", "Opalescent Sheen"],
};

const CAT4_LEAVES = {
  "Natural Daylight":    ["Sunrise Glow", "Sunset Amber", "Cloud Filtered", "Shade Soft"],
  "Golden Hour Warm":    ["Deep Blacks", "Mystery Silhouette", "Triangle Light", "Chiaroscuro Depth"],
  "Dramatic Side/Rim":   ["Natural Daylight", "Warm Radiance", "Professional Setup", "Controlled Uniform"],
  "Soft Diffused":       ["Flickering Warmth", "Soft Glow", "Dusk Ambiance", "Fading Light"],
  "Neon/Artificial":     ["Electric Pink/Blue", "Urban Nightscape", "Vintage Signs", "50s Nostalgia"],
  "Moonlight/Night":     ["Bright Intensity", "Strong Shadows", "Through Leaves", "Diffused Soft"],
  "Backlit/Silhouette":  ["Edge Glow", "Outline Luminous", "Complete Shadow", "Dark Shape"],
  "Studio Controlled":   ["Floating Sparkles", "Luminous Dust", "Light Beams", "Divine Shafts"],
};

const CAT7_LEAVES = {
  "Joyful/Uplifting":         ["Party Festive", "Triumphant Victory", "Quiet Smile", "Peaceful Contentment"],
  "Melancholic/Nostalgic":    ["Sweet Sadness", "Aching Nostalgia", "Distant Past", "Faded Remembrance"],
  "Contemplative/Introspective":["Anticipation Building", "Climactic Moment", "Dark Omen", "Creeping Unease"],
  "Energetic/Exciting":       ["Meditative Stillness", "Profound Calm", "Gentle Satisfaction", "Relaxed Ease"],
  "Mysterious/Enigmatic":     ["Unbridled Energy", "Explosive Strength", "Focused Aggression", "Disciplined Power"],
  "Serene/Peaceful":          ["Innocent Discovery", "Wide-eyed Joy", "Overwhelming Majesty", "Transcendent Beauty"],
  "Dramatic/Intense":         ["Intense Desire", "Burning Love", "Gentle Affection", "Intimate Closeness"],
  "Whimsical/Fantastical":    ["Captivating Puzzle", "Fascinating Secret", "Eerie Uncertainty", "Disturbing Ambiguity"],
};

const CAT8_LEAVES = {
  "Speed Lines/Blur":        ["Motion Trails", "Directional Blur", "Peak Moment", "Mid-Action Freeze"],
  "Frozen Action":           ["Streaming Current", "Ripple Surface", "Ethereal Tendrils", "Diffusing Vapor"],
  "Flowing Curves":          ["Immovable Weight", "Grounded Permanence", "Poised Calm", "Centered Equilibrium"],
  "Static Stillness":        ["Barely Perceptible", "About to Shift", "Breathing Presence", "Quiet Animation"],
  "Spiral/Vortex":           ["Swirling Chaos", "Whirlpool Pull", "Slow Spin", "Orbiting Elements"],
  "Explosive/Radiating":     ["Explosive Force", "Star Burst", "Emanating Light", "Expanding Rings"],
  "Collapsing/Heavy":        ["Collapsing Inward", "Vacuum Pull", "Heavy Weight", "Sinking Down"],
  "Rhythmic/Oscillating":    ["Undulating Motion", "Ripple Effect", "Back and Forth", "Rhythmic Pulse"],
};

const CAT10_LEAVES = {
  "Hyperdetailed":       ["Macro Photography Close", "Surface Detail Zoom", "Lace-like Complexity", "Ornamental Precision"],
  "High Detail":         ["Layered Depth", "Varied Elements", "Sharp Clarity", "Technical Accuracy"],
  "Moderate Detail":     ["Even Attention", "Distributed Detail", "Hero Focus", "Depth of Field Blur"],
  "Low Detail":          ["Basic Shapes", "Clean Reduction", "Core Components", "Key Features Only"],
  "Minimal Detail":      ["Absolute Minimum", "Stripped Down", "Symbol Simple", "Logo-like"],
  "Abstract/Suggestive": ["Suggested Shapes", "Partial Rendering", "Open Ended", "Imagination Required"],
  "Textural Detail":     ["Material Quality", "Tactile Focus", "Physical Properties", "Substance Highlight"],
  "Atmospheric Detail":  ["Atmosphere Heavy", "Ambient Quality", "Distance Layers", "Perspective Emphasis"],
};

// Visible stages and their MAIN options + leaf lookup tables
const VISIBLE_STAGES = [
  { mains: Object.keys(CAT0_LEAVES),  leaves: CAT0_LEAVES },
  { mains: Object.keys(CAT1_LEAVES),  leaves: CAT1_LEAVES },
  { mains: Object.keys(CAT2_LEAVES),  leaves: CAT2_LEAVES },
  { mains: Object.keys(CAT3_LEAVES),  leaves: CAT3_LEAVES },
  { mains: Object.keys(CAT4_LEAVES),  leaves: CAT4_LEAVES },
  // slots 5,6 = removed (defaults used)
  { mains: Object.keys(CAT7_LEAVES),  leaves: CAT7_LEAVES },
  { mains: Object.keys(CAT8_LEAVES),  leaves: CAT8_LEAVES },
  // slot 9 = removed
  { mains: Object.keys(CAT10_LEAVES), leaves: CAT10_LEAVES },
  // slot 11 = removed
];

// Map: visible stage index → canonical slot index
const VISIBLE_TO_CANONICAL = [0, 1, 2, 3, 4, 7, 8, 10];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTally() {
  const slots = Array(12).fill(null);

  // Fill visible stages with valid leaf values
  VISIBLE_STAGES.forEach((stage, vsIdx) => {
    const canonicalIdx = VISIBLE_TO_CANONICAL[vsIdx];
    const main = pick(stage.mains);
    slots[canonicalIdx] = pick(stage.leaves[main]);
  });

  // Fill removed stages with defaults
  slots[5] = REMOVED_STAGE_DEFAULTS[0];  // Smooth Undulating
  slots[6] = REMOVED_STAGE_DEFAULTS[1];  // Visual Equilibrium
  slots[9] = REMOVED_STAGE_DEFAULTS[2];  // Impossible Landscapes
  slots[11] = REMOVED_STAGE_DEFAULTS[3]; // Standing Pose

  return slots;
}

const manifest = [];

for (let i = 1; i <= COUNT; i++) {
  const id = `style_${String(i).padStart(4, '0')}`;
  const tally = generateTally().join(', ');

  manifest.push({
    id,
    repPath: `/images/rep/${id}.webp`,
    tally,
  });
}

const outPath = path.resolve(__dirname, '../public/manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Written ${manifest.length} entries to ${outPath}`);

// Verify
const verify = JSON.parse(fs.readFileSync(outPath, 'utf8'));
console.log(`Verified: ${verify.length} entries`);
console.log(`First: ${verify[0].id}, Last: ${verify[verify.length - 1].id}`);
console.log(`Sample tally tags (first entry): ${verify[0].tally}`);
console.log(`Tag count per entry: ${verify[0].tally.split(', ').length} tags (expected 12)`);

// Cross-validate: every tag in every tally must be a known leaf or default
const ALL_LEAVES = new Set(
  Object.values(CAT0_LEAVES).flat().concat(
    Object.values(CAT1_LEAVES).flat(),
    Object.values(CAT2_LEAVES).flat(),
    Object.values(CAT3_LEAVES).flat(),
    Object.values(CAT4_LEAVES).flat(),
    Object.values(CAT7_LEAVES).flat(),
    Object.values(CAT8_LEAVES).flat(),
    Object.values(CAT10_LEAVES).flat(),
    REMOVED_STAGE_DEFAULTS
  )
);

let unknownCount = 0;
verify.forEach(entry => {
  entry.tally.split(', ').forEach(tag => {
    if (!ALL_LEAVES.has(tag)) {
      unknownCount++;
      if (unknownCount <= 3) console.error(`UNKNOWN TAG: "${tag}"`);
    }
  });
});

if (unknownCount === 0) {
  console.log('✅ All tally tags validated against SUBS leaf options + removed defaults.');
} else {
  console.error(`❌ Found ${unknownCount} unknown tags — fix the generator.`);
  process.exit(1);
}
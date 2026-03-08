// scripts/generate-manifest-dev.js
// Generates placeholder manifest.json with random tally strings for development
const fs = require('fs');
const path = require('path');

// All SUBSUBS options from the question tree — one per category picked randomly
const SUBSUBS_OPTIONS = [
  // Cat 0 — Vibe
  ["Subtle Dreamlike", "Obvious Fantasy", "Chaotic Abstract", "Structured Abstract", "Neon Vibrant", "High Contrast", "Macro Details", "Vast Expansive", "Empty Space", "Soft Filled", "Organic Flowing", "Geometric Zen", "Flat 2D", "3D Rendered Cute", "Weird Charming", "Absurdist Humor"],
  // Cat 1 — Render
  ["Perfect Realism", "Stylized Realism", "Digital Painting", "Traditional Media Feel", "Hyperreal 3D", "Stylized 3D", "Vector Clean", "Poster Art", "Collage Layered", "Photo Manipulation", "Geometric Abstract", "Organic Abstract", "Detailed Line Work", "Loose Gestural", "Retro 8-bit", "Modern High-res Pixel"],
  // Cat 2 — Texture
  ["Glossy Perfect", "Matte Smooth", "Film Grain Subtle", "Heavy Noise Texture", "Visible Strokes", "Blended Soft", "Fine Dots", "Chunky Stippled", "Repeating Patterns", "Tessellated Shapes", "Fabric Weave", "Paper Texture", "Subtle Glitch", "Heavy Corruption", "Subtle Depth", "Obvious Layers"],
  // Cat 3 — Color
  ["Primary Bold", "Full Rainbow Spectrum", "Cool Pastels", "Warm Peachy Tones", "Earth Tones", "Washed Vintage", "Single Color Variations", "Black & White Only", "Complementary Clash", "Light vs Dark Drama", "Cyberpunk Neon", "80s Bright", "Forest Greens", "Ocean Blues", "Gold/Silver Luxe", "Holographic Rainbow"],
  // Cat 4 — Light
  ["Even All Over", "Directional Soft", "Single Source Harsh", "Multiple Shadows", "Inner Luminescence", "External Halo", "No Shadows", "Minimal Depth", "Golden Hour Warm", "Overcast Neutral", "Sign Glow", "Screen Light", "Silhouette", "Edge Highlight", "God Rays", "Fog Penetration"],
  // Cat 5 — Form
  ["Natural Curves", "Liquid Movement", "Sharp Edges", "Tessellated Patterns", "Essential Shapes Only", "Reduced Detail", "Ornate Decorative", "Technical Precise", "Human-like", "Creature Hybrid", "Building Forms", "Constructed Elements", "Floral Botanical", "Landscape Elements", "Pure Shape Play", "Conceptual Forms"],
  // Cat 6 — Composition
  ["Perfect Mirror", "Radial Symmetry", "Rule of Thirds", "Dynamic Diagonal", "Breathing Room", "Isolated Subject", "Horror Vacui", "Organised Chaos", "Foreground/Mid/Background", "Flat Overlapping", "Strict Grid", "Loose Pattern", "Intentional Chaos", "Scattered Elements", "Window/Portal", "Vignette Focus"],
  // Cat 7 — Mood
  ["Pure Happiness", "Gentle Contentment", "Bittersweet", "Deep Sadness", "Peaceful Reflection", "Existential Questioning", "Adrenaline Rush", "Playful Enthusiasm", "Curious Intrigue", "Unsettling Unknown", "Zen Calm", "Sleepy Tranquil", "Epic Grandeur", "Emotional Tension", "Magical Wonder", "Playful Imagination"],
  // Cat 8 — Movement
  ["Frozen Action", "Blur Movement", "Wind Blown", "Water Current", "Frozen Time", "Static Composition", "Almost Moving", "Living Still", "Vortex Energy", "Gentle Rotation", "Outward Burst", "Radiating Energy", "Imploding Center", "Gravitational Pull", "Wave Patterns", "Pendulum Swing"],
  // Cat 9 — Artistic Movement
  ["Classic Vaporwave", "Outrun Aesthetic", "Dali Dreamscape", "Magritte Conceptual", "Warhol Repetition", "Lichtenstein Comic", "Mucha Organic", "Klimt Decorative", "Geometric Rational", "Primary Colors Bold", "Monet Light", "Van Gogh Expressive", "60s Trippy", "Modern Neon Psychedelic", "Brutalist Stark", "Refined Simplicity"],
  // Cat 10 — Detail
  ["Every Texture Visible", "Intricate Patterns", "Rich Complexity", "Focused Precision", "Balanced Focus", "Selective Detail", "Simplified Forms", "Essential Elements", "Bare Essentials", "Iconic Reduction", "Implied Forms", "Viewer Interpretation", "Surface Emphasis", "Material Focus", "Environmental Mood", "Spatial Depth"],
  // Cat 11 — Subject
  ["Close-up Face", "Full Body Character", "Single Object", "Arranged Collection", "Vast Expansive", "Intimate Scene", "Pure Visual", "Symbolic Narrative", "Text as Art", "Text with Imagery", "Realistic", "Fantastical Hybrid", "Exterior Structures", "Interior Spaces", "Repeating Motifs", "Material Surfaces"],
];

const COUNT = 695;
const manifest = [];

for (let i = 1; i <= COUNT; i++) {
  const id = `style_${String(i).padStart(4, '0')}`;
  const tally = SUBSUBS_OPTIONS.map(catOptions => {
    return catOptions[Math.floor(Math.random() * catOptions.length)];
  }).join(', ');

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
console.log(`Sample tally tags: ${verify[0].tally.split(', ').length} tags`);

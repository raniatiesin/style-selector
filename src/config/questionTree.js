/**
 * questionTree.js — Manifest-aligned version
 * 12 stages × 8 MAINs × 2 SUBs × 2 SUBSUBs = 384 leaf options
 * SUBSUB leaf values match manifest tally tags exactly.
 */

export const STAGES = [
  { stage: 0, name: "Primary Vibe", question: "What's the primary VIBE you want to communicate?", options: ["Dreamlike & Surreal", "Bold & Striking", "Calm & Serene", "Playful & Whimsical", "Mysterious & Moody", "Energetic & Dynamic", "Elegant & Refined", "Raw & Authentic"] },
  { stage: 1, name: "Realism Level", question: "How REALISTIC should the image feel?", options: ["Photorealistic", "Illustrated/Painted", "3D Rendered", "Flat Graphic", "Mixed Media", "Abstract Forms", "Sketch/Line Art", "Pixel Art"] },
  { stage: 2, name: "Texture Quality", question: "What TEXTURE quality do you prefer?", options: ["Ultra Smooth/Clean", "Grainy/Noisy", "Painterly/Brushed", "Pointillistic/Dotted", "Geometric/Patterned", "Organic/Natural", "Glitch/Digital Artifacts", "Layered/Dimensional"] },
  { stage: 3, name: "Color Philosophy", question: "What's your COLOR philosophy?", options: ["Vibrant & Saturated", "Pastel & Soft", "Muted & Desaturated", "Monochromatic", "High Contrast", "Neon & Fluorescent", "Natural & Organic", "Metallic & Iridescent"] },
  { stage: 4, name: "Lighting Setup", question: "What LIGHTING sets the scene?", options: ["Natural Daylight", "Golden Hour Warm", "Dramatic Side/Rim", "Soft Diffused", "Neon/Artificial", "Moonlight/Night", "Backlit/Silhouette", "Studio Controlled"] },
  { stage: 5, name: "Form Dominance", question: "What FORMS should dominate the composition?", options: ["Organic/Flowing", "Geometric/Angular", "Simplified/Minimalist", "Detailed/Intricate", "Anthropomorphic/Character", "Architectural/Structural", "Nature-Inspired", "Abstract/Non-Objective"] },
  { stage: 6, name: "Composition Structure", question: "What's your COMPOSITION preference?", options: ["Centered/Symmetrical", "Rule of Thirds", "Dynamic Diagonal", "Frame within Frame", "Negative Space", "Depth Layers", "Chaotic/Scattered", "Minimal/Empty"] },
  { stage: 7, name: "Emotional Mood", question: "What EMOTIONAL MOOD should viewers feel?", options: ["Joyful/Uplifting", "Melancholic/Nostalgic", "Contemplative/Introspective", "Energetic/Exciting", "Mysterious/Enigmatic", "Serene/Peaceful", "Dramatic/Intense", "Whimsical/Fantastical"] },
  { stage: 8, name: "Motion & Energy", question: "How does MOVEMENT feel?", options: ["Speed Lines/Blur", "Frozen Action", "Flowing Curves", "Static Stillness", "Spiral/Vortex", "Explosive/Radiating", "Collapsing/Heavy", "Rhythmic/Oscillating"] },
  { stage: 9, name: "Art Movement", question: "Any ARTISTIC MOVEMENT or style inspiration?", options: ["Vaporwave/Synthwave", "Surrealism", "Pop Art", "Art Nouveau", "Bauhaus/Modernist", "Impressionist", "Psychedelic", "Minimalism"] },
  { stage: 10, name: "Detail Level", question: "What LEVEL OF DETAIL is appropriate?", options: ["Hyperdetailed", "High Detail", "Moderate Detail", "Low Detail", "Minimal Detail", "Abstract/Suggestive", "Textural Detail", "Atmospheric Detail"] },
  { stage: 11, name: "Subject Focus", question: "What's the PRIMARY SUBJECT FOCUS?", options: ["Portraits/Figures", "Objects/Still Life", "Landscapes/Environments", "Abstract Concepts", "Typography/Text", "Creatures/Animals", "Architecture/Spaces", "Patterns/Textures"] },
];

// Backward-compat alias used by Quiz.jsx
export const MAINS = STAGES;

export const SUBS = {
  // [0] Primary Vibe
  "Dreamlike & Surreal": { question: "How dreamlike does this image feel?", options: ["Slightly Surreal", "Fully Abstract"] },
  "Bold & Striking": { question: "How does it create bold impact?", options: ["Color Impact", "Scale Impact"] },
  "Calm & Serene": { question: "What kind of calm does it convey?", options: ["Meditative Quiet", "Nature Inspired"] },
  "Playful & Whimsical": { question: "How is playfulness expressed?", options: ["Cartoon Fun", "Quirky Oddball"] },
  "Mysterious & Moody": { question: "What mysterious mood is present?", options: ["Dark Atmospheric", "Mystical Magical"] },
  "Energetic & Dynamic": { question: "How is energy expressed?", options: ["Explosive Chaos", "Vibrant Lively"] },
  "Elegant & Refined": { question: "What level of elegance is present?", options: ["Luxurious Premium", "Classic Timeless"] },
  "Raw & Authentic": { question: "How is authenticity expressed?", options: ["Gritty Textured", "Candid Human"] },

  // [1] Realism Level
  "Photorealistic": { question: "How photorealistic is the rendering?", options: ["Perfect Realism", "Stylized Realism"] },
  "Illustrated/Painted": { question: "What illustrated style is present?", options: ["Digital Painting", "Traditional Media"] },
  "3D Rendered": { question: "What 3D rendering style is used?", options: ["Hyperreal 3D", "Stylized 3D"] },
  "Flat Graphic": { question: "What flat graphic approach is used?", options: ["Vector Clean", "Poster Art"] },
  "Mixed Media": { question: "What mixed media technique is used?", options: ["Collage Layered", "Photo Manipulation"] },
  "Abstract Forms": { question: "What abstract form is present?", options: ["Geometric Abstract", "Organic Abstract"] },
  "Sketch/Line Art": { question: "What line art technique is used?", options: ["Detailed Line Work", "Loose Gestural"] },
  "Pixel Art": { question: "What pixel art style is used?", options: ["Retro 8-bit", "Modern High-res Pixel"] },

  // [2] Texture Quality
  "Ultra Smooth/Clean": { question: "What kind of smooth finish does it have?", options: ["Glossy Perfect", "Matte Smooth"] },
  "Grainy/Noisy": { question: "What kind of grain texture is visible?", options: ["Film Grain Subtle", "Heavy Noise Texture"] },
  "Painterly/Brushed": { question: "What painterly technique is visible?", options: ["Visible Strokes", "Blended Soft"] },
  "Pointillistic/Dotted": { question: "What dot technique is present?", options: ["Fine Dots", "Chunky Stippled"] },
  "Geometric/Patterned": { question: "What geometric pattern is present?", options: ["Repeating Patterns", "Tessellated Shapes"] },
  "Organic/Natural": { question: "What organic texture is visible?", options: ["Fabric Weave", "Paper Texture"] },
  "Glitch/Digital Artifacts": { question: "What glitch effect is present?", options: ["Subtle Glitch", "Heavy Corruption"] },
  "Layered/Dimensional": { question: "How dimensional are the layers?", options: ["Subtle Depth", "Obvious Layers"] },

  // [3] Color Philosophy
  "Vibrant & Saturated": { question: "How vibrant are the colors?", options: ["Primary Bold", "Rainbow Spectrum"] },
  "Pastel & Soft": { question: "What pastel tone dominates?", options: ["Cool Pastels", "Warm Peachy"] },
  "Muted & Desaturated": { question: "What muted palette is present?", options: ["Earth Tones", "Washed Vintage"] },
  "Monochromatic": { question: "What monochromatic scheme is used?", options: ["Single Color", "Black & White"] },
  "High Contrast": { question: "How is high contrast achieved?", options: ["Complementary Clash", "Light vs Dark"] },
  "Neon & Fluorescent": { question: "What neon palette is used?", options: ["Cyberpunk Neon", "80s Bright"] },
  "Natural & Organic": { question: "What natural color palette is used?", options: ["Forest Greens", "Ocean Blues"] },
  "Metallic & Iridescent": { question: "What metallic finish is present?", options: ["Gold/Silver Luxe", "Holographic Rainbow"] },

  // [4] Lighting Setup
  "Natural Daylight": { question: "What kind of soft lighting is present?", options: ["Golden Hour Warmth", "Overcast Even Light"] },
  "Golden Hour Warm": { question: "How dramatic are the shadows?", options: ["Film Noir Contrast", "Rembrandt Classic"] },
  "Dramatic Side/Rim": { question: "How bright and airy is the lighting?", options: ["Sunshine Cheerful", "Studio Clean"] },
  "Soft Diffused": { question: "How moody and dim is the lighting?", options: ["Candlelit Intimate", "Twilight Mystery"] },
  "Neon/Artificial": { question: "What neon lighting style is used?", options: ["Cyberpunk Glow", "Retro Diner"] },
  "Moonlight/Night": { question: "How does natural sunlight appear?", options: ["Direct Harsh", "Filtered Gentle"] },
  "Backlit/Silhouette": { question: "How is the backlighting achieved?", options: ["Rim Light Halo", "Full Silhouette"] },
  "Studio Controlled": { question: "What ethereal lighting is present?", options: ["Glowing Particles", "Mystical Rays"] },

  // [5] Form Dominance
  "Organic/Flowing": { question: "How does the organic composition flow?", options: ["Natural Curves", "Meandering Paths"] },
  "Geometric/Angular": { question: "How geometric is the structure?", options: ["Grid Precision", "Angular Shapes"] },
  "Simplified/Minimalist": { question: "What level of chaos is present?", options: ["Controlled Chaos", "Total Randomness"] },
  "Detailed/Intricate": { question: "How are the depth layers created?", options: ["Clear Foreground/Background", "Atmospheric Depth"] },
  "Anthropomorphic/Character": { question: "How sparse is the minimalist approach?", options: ["Zen Negative Space", "Essential Elements"] },
  "Architectural/Structural": { question: "How dense is the maximalist approach?", options: ["Every Inch Filled", "Baroque Ornate"] },
  "Nature-Inspired": { question: "How dynamic is the diagonal composition?", options: ["Slanting Energy", "Zig-zag Movement"] },
  "Abstract/Non-Objective": { question: "What circular pattern is used?", options: ["Mandala Symmetry", "Spiral Outward"] },

  // [6] Composition Structure
  "Centered/Symmetrical": { question: "What type of symmetry is present?", options: ["Perfect Mirror", "Balanced Weight"] },
  "Rule of Thirds": { question: "How is the rule of thirds applied?", options: ["Classic Offset", "Dynamic Tension"] },
  "Dynamic Diagonal": { question: "How extreme is the close-up?", options: ["Macro Detail", "Cropped Tight"] },
  "Frame within Frame": { question: "How expansive is the wide angle?", options: ["Sweeping Vista", "Distorted Perspective"] },
  "Negative Space": { question: "What bird's eye view is shown?", options: ["Flat Map View", "Angled Overhead"] },
  "Depth Layers": { question: "How dramatic is the low angle?", options: ["Upward Dramatic", "Ground Level"] },
  "Chaotic/Scattered": { question: "How tilted is the Dutch angle?", options: ["Slight Tilt", "Extreme Diagonal"] },
  "Minimal/Empty": { question: "What first person view is shown?", options: ["Through Eyes", "Hand-held Camera"] },

  // [7] Emotional Mood
  "Joyful/Uplifting": { question: "What kind of joyful energy does it convey?", options: ["Celebration Exuberant", "Gentle Happiness"] },
  "Melancholic/Nostalgic": { question: "What kind of melancholy is present?", options: ["Bittersweet Longing", "Wistful Memory"] },
  "Contemplative/Introspective": { question: "What kind of tension is felt?", options: ["Edge of Seat", "Foreboding Dread"] },
  "Energetic/Exciting": { question: "What kind of peace is conveyed?", options: ["Deep Serenity", "Quiet Contentment"] },
  "Mysterious/Enigmatic": { question: "How aggressive is the intensity?", options: ["Raw Power", "Controlled Force"] },
  "Serene/Peaceful": { question: "What sense of wonder is present?", options: ["Childlike Amazement", "Sublime Grandeur"] },
  "Dramatic/Intense": { question: "What romantic quality is conveyed?", options: ["Passionate Fire", "Tender Connection"] },
  "Whimsical/Fantastical": { question: "What mysterious feeling is conveyed?", options: ["Curious Intrigue", "Unsettling Unknown"] },

  // [8] Motion & Energy
  "Speed Lines/Blur": { question: "How is the dynamic motion captured?", options: ["Blur Speed", "Frozen Action"] },
  "Frozen Action": { question: "How does the liquid flow appear?", options: ["Water Smooth", "Smoke Wispy"] },
  "Flowing Curves": { question: "How still and stable is it?", options: ["Rock Solid", "Balanced Stillness"] },
  "Static Stillness": { question: "How is motion implied?", options: ["Almost Moving", "Living Still"] },
  "Spiral/Vortex": { question: "How does the spiral motion appear?", options: ["Vortex Energy", "Gentle Rotation"] },
  "Explosive/Radiating": { question: "How does the radiating energy appear?", options: ["Outward Burst", "Radiating Energy"] },
  "Collapsing/Heavy": { question: "How does the converging motion appear?", options: ["Imploding Center", "Gravitational Pull"] },
  "Rhythmic/Oscillating": { question: "What rhythmic pattern is present?", options: ["Wave Patterns", "Pendulum Swing"] },

  // [9] Art Movement
  "Vaporwave/Synthwave": { question: "Which vaporwave aesthetic does it embody?", options: ["Classic Vaporwave", "Outrun Aesthetic"] },
  "Surrealism": { question: "Which surrealist approach is used?", options: ["Dali Dreamscape", "Magritte Conceptual"] },
  "Pop Art": { question: "Which pop art style is used?", options: ["Warhol Repetition", "Lichtenstein Comic"] },
  "Art Nouveau": { question: "Which art nouveau style is used?", options: ["Mucha Organic", "Klimt Decorative"] },
  "Bauhaus/Modernist": { question: "Which Bauhaus approach is used?", options: ["Geometric Rational", "Primary Colors Bold"] },
  "Impressionist": { question: "Which impressionist style is used?", options: ["Monet Light", "Van Gogh Expressive"] },
  "Psychedelic": { question: "Which psychedelic style is used?", options: ["60s Trippy", "Modern Neon Psychedelic"] },
  "Minimalism": { question: "Which minimalist approach is used?", options: ["Brutalist Stark", "Refined Simplicity"] },

  // [10] Detail Level
  "Hyperdetailed": { question: "What aspect is hyperdetailed?", options: ["Every Texture Visible", "Intricate Patterns"] },
  "High Detail": { question: "What type of high detail is emphasized?", options: ["Rich Complexity", "Focused Precision"] },
  "Moderate Detail": { question: "How is the moderate detail balanced?", options: ["Balanced Focus", "Selective Detail"] },
  "Low Detail": { question: "How are details simplified?", options: ["Simplified Forms", "Essential Elements"] },
  "Minimal Detail": { question: "How minimal is the detail?", options: ["Bare Essentials", "Iconic Reduction"] },
  "Abstract/Suggestive": { question: "How abstract is the detail level?", options: ["Implied Forms", "Viewer Interpretation"] },
  "Textural Detail": { question: "How is textural detail emphasized?", options: ["Surface Emphasis", "Material Focus"] },
  "Atmospheric Detail": { question: "How is atmospheric detail emphasized?", options: ["Environmental Mood", "Spatial Depth"] },

  // [11] Subject Focus
  "Portraits/Figures": { question: "What is the portrait framing?", options: ["Close-up Face", "Full Body Character"] },
  "Objects/Still Life": { question: "How are the objects presented?", options: ["Single Object", "Arranged Collection"] },
  "Landscapes/Environments": { question: "What landscape scope is shown?", options: ["Vast Expansive", "Intimate Scene"] },
  "Abstract Concepts": { question: "How is the abstract concept expressed?", options: ["Pure Visual", "Symbolic Narrative"] },
  "Typography/Text": { question: "How is typography integrated?", options: ["Text as Art", "Text with Imagery"] },
  "Creatures/Animals": { question: "How are creatures depicted?", options: ["Realistic", "Fantastical Hybrid"] },
  "Architecture/Spaces": { question: "What architectural view is shown?", options: ["Exterior Structures", "Interior Spaces"] },
  "Patterns/Textures": { question: "How are patterns and textures featured?", options: ["Repeating Motifs", "Material Surfaces"] },
};

export const SUBSUBS = {
  // [0] Primary Vibe
  "Slightly Surreal": { question: "Subtle dreamlike or obvious fantasy?", options: ["Subtle Dreamlike", "Obvious Fantasy"] },
  "Fully Abstract": { question: "Chaotic abstract or structured abstract?", options: ["Chaotic Abstract", "Structured Abstract"] },
  "Color Impact": { question: "Neon vibrant or high-contrast?", options: ["Neon Vibrant", "High-Contrast"] },
  "Scale Impact": { question: "Macro details or vast expansive?", options: ["Macro Details", "Vast Expansive"] },
  "Meditative Quiet": { question: "Empty space or soft filled?", options: ["Empty Space", "Soft Filled"] },
  "Nature Inspired": { question: "Organic flowing or geometric zen?", options: ["Organic Flowing", "Geometric Zen"] },
  "Cartoon Fun": { question: "Flat 2D or 3D rendered cute?", options: ["Flat 2D", "3D Rendered Cute"] },
  "Quirky Oddball": { question: "Weird charming or absurdist humor?", options: ["Weird Charming", "Absurdist Humor"] },
  "Dark Atmospheric": { question: "Gothic shadows or noir minimal?", options: ["Gothic Shadows", "Noir Minimal"] },
  "Mystical Magical": { question: "Folklore symbols or cosmic ethereal?", options: ["Folklore Symbols", "Cosmic Ethereal"] },
  "Explosive Chaos": { question: "Splatter energy or geometric kinetic?", options: ["Splatter Energy", "Geometric Kinetic"] },
  "Vibrant Lively": { question: "Pop art bright or tropical saturated?", options: ["Pop Art Bright", "Tropical Saturated"] },
  "Luxurious Premium": { question: "Gold accents or minimalist expensive?", options: ["Gold Accents", "Minimalist Expensive"] },
  "Classic Timeless": { question: "Renaissance inspired or modern classic?", options: ["Renaissance Inspired", "Modern Classic"] },
  "Gritty Textured": { question: "Urban rough or organic earthy?", options: ["Urban Rough", "Organic Earthy"] },
  "Candid Human": { question: "Portrait intimate or documentary real?", options: ["Portrait Intimate", "Documentary Real"] },

  // [1] Realism Level
  "Perfect Realism": { question: "Studio photography or natural environment?", options: ["Studio Photography", "Natural Environment"] },
  "Stylized Realism": { question: "Enhanced beauty or artistic interpretation?", options: ["Enhanced Beauty", "Artistic Interpretation"] },
  "Digital Painting": { question: "Smooth blended or visible brushstrokes?", options: ["Smooth Blended", "Visible Brushstrokes"] },
  "Traditional Media": { question: "Watercolor soft or oil painting rich?", options: ["Watercolor Soft", "Oil Painting Rich"] },
  "Hyperreal 3D": { question: "Product render perfect or architectural precise?", options: ["Product Render Perfect", "Architectural Precise"] },
  "Stylized 3D": { question: "Cartoon render or clay/toy aesthetic?", options: ["Cartoon Render", "Clay/Toy Aesthetic"] },
  "Vector Clean": { question: "Corporate minimal or playful shapes?", options: ["Corporate Minimal", "Playful Shapes"] },
  "Poster Art": { question: "Vintage propaganda or modern graphic?", options: ["Vintage Propaganda", "Modern Graphic"] },
  "Collage Layered": { question: "Cut paper analog or digital composite?", options: ["Cut Paper Analog", "Digital Composite"] },
  "Photo Manipulation": { question: "Seamless blend or obvious surreal?", options: ["Seamless Blend", "Obvious Surreal"] },
  "Geometric Abstract": { question: "Hard edge precise or flowing shapes?", options: ["Hard Edge Precise", "Flowing Shapes"] },
  "Organic Abstract": { question: "Natural forms or chaotic expressive?", options: ["Natural Forms", "Chaotic Expressive"] },
  "Detailed Line Work": { question: "Technical pen or cross-hatched?", options: ["Technical Pen", "Cross-hatched"] },
  "Loose Gestural": { question: "Quick sketch or expressive scribble?", options: ["Quick Sketch", "Expressive Scribble"] },
  "Retro 8-bit": { question: "NES/GameBoy style or C64 limited palette?", options: ["NES/GameBoy Style", "C64 Limited Palette"] },
  "Modern High-res Pixel": { question: "Detailed sprites or pixel painting?", options: ["Detailed Sprites", "Pixel Painting"] },

  // [2] Texture Quality
  "Glossy Perfect": { question: "Mirror shine or wet reflective?", options: ["Mirror Shine", "Wet Reflective"] },
  "Matte Smooth": { question: "Powder soft or porcelain finish?", options: ["Powder Soft", "Porcelain Finish"] },
  "Film Grain Subtle": { question: "35mm texture or analog warmth?", options: ["35mm Texture", "Analog Warmth"] },
  "Heavy Noise Texture": { question: "High ISO grit or distressed vintage?", options: ["High ISO Grit", "Distressed Vintage"] },
  "Visible Strokes": { question: "Impasto thick or expressive marks?", options: ["Impasto Thick", "Expressive Marks"] },
  "Blended Soft": { question: "Airbrushed smooth or sfumato subtle?", options: ["Airbrushed Smooth", "Sfumato Subtle"] },
  "Fine Dots": { question: "Delicate stipple or halftone screen?", options: ["Delicate Stipple", "Halftone Screen"] },
  "Chunky Stippled": { question: "Bold pointillism or spray paint dots?", options: ["Bold Pointillism", "Spray Paint Dots"] },
  "Repeating Patterns": { question: "Wallpaper regular or decorative motifs?", options: ["Wallpaper Regular", "Decorative Motifs"] },
  "Tessellated Shapes": { question: "Islamic geometric or mosaic tiles?", options: ["Islamic Geometric", "Mosaic Tiles"] },
  "Fabric Weave": { question: "Canvas texture or linen threads?", options: ["Canvas Texture", "Linen Threads"] },
  "Paper Texture": { question: "Rough handmade or subtle grain?", options: ["Rough Handmade", "Subtle Grain"] },
  "Subtle Glitch": { question: "Slight distortion or digital artifacts?", options: ["Slight Distortion", "Digital Artifacts"] },
  "Heavy Corruption": { question: "Datamosh chaos or pixel sorting?", options: ["Datamosh Chaos", "Pixel Sorting"] },
  "Subtle Depth": { question: "Slight emboss or soft shadows?", options: ["Slight Emboss", "Soft Shadows"] },
  "Obvious Layers": { question: "Clear separation or 3D paper craft?", options: ["Clear Separation", "3D Paper Craft"] },

  // [3] Color Philosophy
  "Primary Bold": { question: "Red/yellow/blue focus or secondary colors too?", options: ["Red/Yellow/Blue Focus", "Secondary Colors Too"] },
  "Rainbow Spectrum": { question: "Even distribution or gradient flow?", options: ["Even Distribution", "Gradient Flow"] },
  "Cool Pastels": { question: "Lavender/mint/sky or full cool range?", options: ["Lavender/Mint/Sky", "Full Cool Range"] },
  "Warm Peachy": { question: "Coral/cream/blush or sunset warmth?", options: ["Coral/Cream/Blush", "Sunset Warmth"] },
  "Earth Tones": { question: "Brown/beige/olive or terracotta/rust?", options: ["Brown/Beige/Olive", "Terracotta/Rust"] },
  "Washed Vintage": { question: "Faded 70s or sepia nostalgic?", options: ["Faded 70s", "Sepia Nostalgic"] },
  "Single Color": { question: "Blue variations or warm tone variations?", options: ["Blue Variations", "Warm Tone Variations"] },
  "Black & White": { question: "Pure grayscale or tinted monochrome?", options: ["Pure Grayscale", "Tinted Monochrome"] },
  "Complementary Clash": { question: "Orange/blue or red/green tension?", options: ["Orange/Blue", "Red/Green Tension"] },
  "Light vs Dark": { question: "Stark contrast or chiaroscuro drama?", options: ["Stark Contrast", "Chiaroscuro Drama"] },
  "Cyberpunk Neon": { question: "Electric pink/blue or acid green/purple?", options: ["Electric Pink/Blue", "Acid Green/Purple"] },
  "80s Bright": { question: "Hot magenta or day-glo pop?", options: ["Hot Magenta", "Day-glo Pop"] },
  "Forest Greens": { question: "Deep emerald or moss tones?", options: ["Deep Emerald", "Moss Tones"] },
  "Ocean Blues": { question: "Aqua turquoise or deep navy?", options: ["Aqua Turquoise", "Deep Navy"] },
  "Gold/Silver Luxe": { question: "Warm gold or cool silver?", options: ["Warm Gold", "Cool Silver"] },
  "Holographic Rainbow": { question: "Shifting colors or opalescent sheen?", options: ["Shifting Colors", "Opalescent Sheen"] },

  // [4] Lighting Setup
  "Golden Hour Warmth": { question: "Sunrise glow or sunset amber?", options: ["Sunrise Glow", "Sunset Amber"] },
  "Overcast Even Light": { question: "Cloud filtered or shade soft?", options: ["Cloud Filtered", "Shade Soft"] },
  "Film Noir Contrast": { question: "Deep blacks or mystery silhouette?", options: ["Deep Blacks", "Mystery Silhouette"] },
  "Rembrandt Classic": { question: "Triangle light or chiaroscuro depth?", options: ["Triangle Light", "Chiaroscuro Depth"] },
  "Sunshine Cheerful": { question: "Natural daylight or warm radiance?", options: ["Natural Daylight", "Warm Radiance"] },
  "Studio Clean": { question: "Professional setup or controlled uniform?", options: ["Professional Setup", "Controlled Uniform"] },
  "Candlelit Intimate": { question: "Flickering warmth or soft glow?", options: ["Flickering Warmth", "Soft Glow"] },
  "Twilight Mystery": { question: "Dusk ambiance or fading light?", options: ["Dusk Ambiance", "Fading Light"] },
  "Cyberpunk Glow": { question: "Electric pink/blue or urban nightscape?", options: ["Electric Pink/Blue", "Urban Nightscape"] },
  "Retro Diner": { question: "Vintage signs or 50s nostalgia?", options: ["Vintage Signs", "50s Nostalgia"] },
  "Direct Harsh": { question: "Bright intensity or strong shadows?", options: ["Bright Intensity", "Strong Shadows"] },
  "Filtered Gentle": { question: "Through leaves or diffused soft?", options: ["Through Leaves", "Diffused Soft"] },
  "Rim Light Halo": { question: "Edge glow or outline luminous?", options: ["Edge Glow", "Outline Luminous"] },
  "Full Silhouette": { question: "Complete shadow or dark shape?", options: ["Complete Shadow", "Dark Shape"] },
  "Glowing Particles": { question: "Floating sparkles or luminous dust?", options: ["Floating Sparkles", "Luminous Dust"] },
  "Mystical Rays": { question: "Light beams or divine shafts?", options: ["Light Beams", "Divine Shafts"] },

  // [5] Form Dominance
  "Natural Curves": { question: "Smooth undulating or gentle waves?", options: ["Smooth Undulating", "Gentle Waves"] },
  "Meandering Paths": { question: "Winding journey or organic trails?", options: ["Winding Journey", "Organic Trails"] },
  "Grid Precision": { question: "Perfect squares or aligned pattern?", options: ["Perfect Squares", "Aligned Pattern"] },
  "Angular Shapes": { question: "Sharp triangles or diagonal lines?", options: ["Sharp Triangles", "Diagonal Lines"] },
  "Controlled Chaos": { question: "Organized disorder or intentional scatter?", options: ["Organized Disorder", "Intentional Scatter"] },
  "Total Randomness": { question: "Complete unpredictability or wild abandon?", options: ["Complete Unpredictability", "Wild Abandon"] },
  "Clear Foreground/Background": { question: "Distinct planes or separated layers?", options: ["Distinct Planes", "Separated Layers"] },
  "Atmospheric Depth": { question: "Hazy distance or aerial perspective?", options: ["Hazy Distance", "Aerial Perspective"] },
  "Zen Negative Space": { question: "Vast emptiness or breathing room?", options: ["Vast Emptiness", "Breathing Room"] },
  // Note: "Essential Elements" for Cat 5 is in SUBSUBS_OVERRIDES (avoids duplicate key with Cat 10)
  "Every Inch Filled": { question: "No empty space or abundant details?", options: ["No Empty Space", "Abundant Details"] },
  "Baroque Ornate": { question: "Elaborate flourishes or excessive decoration?", options: ["Elaborate Flourishes", "Excessive Decoration"] },
  "Slanting Energy": { question: "Angled thrust or leaning force?", options: ["Angled Thrust", "Leaning Force"] },
  "Zig-zag Movement": { question: "Sharp turns or angular path?", options: ["Sharp Turns", "Angular Path"] },
  "Mandala Symmetry": { question: "Perfect circular or sacred geometry?", options: ["Perfect Circular", "Sacred Geometry"] },
  "Spiral Outward": { question: "Expanding coil or rotating outward?", options: ["Expanding Coil", "Rotating Outward"] },

  // [6] Composition Structure
  "Perfect Mirror": { question: "Exact reflection or kaleidoscope pattern?", options: ["Exact Reflection", "Kaleidoscope Pattern"] },
  "Balanced Weight": { question: "Visual equilibrium or harmonious distribution?", options: ["Visual Equilibrium", "Harmonious Distribution"] },
  "Classic Offset": { question: "Intersection points or power placement?", options: ["Intersection Points", "Power Placement"] },
  "Dynamic Tension": { question: "Diagonal energy or edge tension?", options: ["Diagonal Energy", "Edge Tension"] },
  "Macro Detail": { question: "Microscopic view or surface texture?", options: ["Microscopic View", "Surface Texture"] },
  "Cropped Tight": { question: "Edge cutting or intimate framing?", options: ["Edge Cutting", "Intimate Framing"] },
  "Sweeping Vista": { question: "Panoramic breadth or endless horizon?", options: ["Panoramic Breadth", "Endless Horizon"] },
  "Distorted Perspective": { question: "Fisheye curve or warped edges?", options: ["Fisheye Curve", "Warped Edges"] },
  "Flat Map View": { question: "Directly above or blueprint layout?", options: ["Directly Above", "Blueprint Layout"] },
  "Angled Overhead": { question: "Elevated perspective or tilted downward?", options: ["Elevated Perspective", "Tilted Downward"] },
  "Upward Dramatic": { question: "Towering perspective or heroic stance?", options: ["Towering Perspective", "Heroic Stance"] },
  "Ground Level": { question: "Eye level low or surface view?", options: ["Eye Level Low", "Surface View"] },
  "Slight Tilt": { question: "Subtle off-balance or gentle cant?", options: ["Subtle Off-balance", "Gentle Cant"] },
  "Extreme Diagonal": { question: "Severe angle or dramatic slant?", options: ["Severe Angle", "Dramatic Slant"] },
  "Through Eyes": { question: "Direct vision or subjective view?", options: ["Direct Vision", "Subjective View"] },
  "Hand-held Camera": { question: "Shaky movement or raw footage?", options: ["Shaky Movement", "Raw Footage"] },

  // [7] Emotional Mood
  "Celebration Exuberant": { question: "Party festive or triumphant victory?", options: ["Party Festive", "Triumphant Victory"] },
  "Gentle Happiness": { question: "Quiet smile or peaceful contentment?", options: ["Quiet Smile", "Peaceful Contentment"] },
  "Bittersweet Longing": { question: "Sweet sadness or aching nostalgia?", options: ["Sweet Sadness", "Aching Nostalgia"] },
  "Wistful Memory": { question: "Distant past or faded remembrance?", options: ["Distant Past", "Faded Remembrance"] },
  "Edge of Seat": { question: "Anticipation building or climactic moment?", options: ["Anticipation Building", "Climactic Moment"] },
  "Foreboding Dread": { question: "Dark omen or creeping unease?", options: ["Dark Omen", "Creeping Unease"] },
  "Deep Serenity": { question: "Meditative stillness or profound calm?", options: ["Meditative Stillness", "Profound Calm"] },
  "Quiet Contentment": { question: "Gentle satisfaction or relaxed ease?", options: ["Gentle Satisfaction", "Relaxed Ease"] },
  "Raw Power": { question: "Unbridled energy or explosive strength?", options: ["Unbridled Energy", "Explosive Strength"] },
  "Controlled Force": { question: "Focused aggression or disciplined power?", options: ["Focused Aggression", "Disciplined Power"] },
  "Childlike Amazement": { question: "Innocent discovery or wide-eyed joy?", options: ["Innocent Discovery", "Wide-eyed Joy"] },
  "Sublime Grandeur": { question: "Overwhelming majesty or transcendent beauty?", options: ["Overwhelming Majesty", "Transcendent Beauty"] },
  "Passionate Fire": { question: "Intense desire or burning love?", options: ["Intense Desire", "Burning Love"] },
  "Tender Connection": { question: "Gentle affection or intimate closeness?", options: ["Gentle Affection", "Intimate Closeness"] },
  "Curious Intrigue": { question: "Captivating puzzle or fascinating secret?", options: ["Captivating Puzzle", "Fascinating Secret"] },
  "Unsettling Unknown": { question: "Eerie uncertainty or disturbing ambiguity?", options: ["Eerie Uncertainty", "Disturbing Ambiguity"] },

  // [8] Motion & Energy
  "Blur Speed": { question: "Motion trails or directional blur?", options: ["Motion Trails", "Directional Blur"] },
  "Frozen Action": { question: "Peak moment or mid-action freeze?", options: ["Peak Moment", "Mid-Action Freeze"] },
  "Water Smooth": { question: "Streaming current or ripple surface?", options: ["Streaming Current", "Ripple Surface"] },
  "Smoke Wispy": { question: "Ethereal tendrils or diffusing vapor?", options: ["Ethereal Tendrils", "Diffusing Vapor"] },
  "Rock Solid": { question: "Immovable weight or grounded permanence?", options: ["Immovable Weight", "Grounded Permanence"] },
  "Balanced Stillness": { question: "Poised calm or centered equilibrium?", options: ["Poised Calm", "Centered Equilibrium"] },
  "Almost Moving": { question: "Barely perceptible or about to shift?", options: ["Barely Perceptible", "About to Shift"] },
  "Living Still": { question: "Breathing presence or quiet animation?", options: ["Breathing Presence", "Quiet Animation"] },
  "Vortex Energy": { question: "Swirling chaos or whirlpool pull?", options: ["Swirling Chaos", "Whirlpool Pull"] },
  "Gentle Rotation": { question: "Slow spin or orbiting elements?", options: ["Slow Spin", "Orbiting Elements"] },
  "Outward Burst": { question: "Explosive force or star burst?", options: ["Explosive Force", "Star Burst"] },
  "Radiating Energy": { question: "Emanating light or expanding rings?", options: ["Emanating Light", "Expanding Rings"] },
  "Imploding Center": { question: "Collapsing inward or vacuum pull?", options: ["Collapsing Inward", "Vacuum Pull"] },
  "Gravitational Pull": { question: "Heavy weight or sinking down?", options: ["Heavy Weight", "Sinking Down"] },
  "Wave Patterns": { question: "Undulating motion or ripple effect?", options: ["Undulating Motion", "Ripple Effect"] },
  "Pendulum Swing": { question: "Back and forth or rhythmic pulse?", options: ["Back and Forth", "Rhythmic Pulse"] },

  // [9] Art Movement
  "Classic Vaporwave": { question: "Roman bust nostalgia or Japanese text aesthetic?", options: ["Roman Bust Nostalgia", "Japanese Text Aesthetic"] },
  "Outrun Aesthetic": { question: "Sunset grid horizon or sports car speed?", options: ["Sunset Grid Horizon", "Sports Car Speed"] },
  "Dali Dreamscape": { question: "Melting clocks or impossible landscapes?", options: ["Melting Clocks", "Impossible Landscapes"] },
  "Magritte Conceptual": { question: "Floating objects or visual paradox?", options: ["Floating Objects", "Visual Paradox"] },
  "Warhol Repetition": { question: "Screen print grid or color variations?", options: ["Screen Print Grid", "Color Variations"] },
  "Lichtenstein Comic": { question: "Ben-day dots or speech bubbles?", options: ["Ben-day Dots", "Speech Bubbles"] },
  "Mucha Organic": { question: "Flowing hair or natural curves?", options: ["Flowing Hair", "Natural Curves"] },
  "Klimt Decorative": { question: "Gold patterns or ornate details?", options: ["Gold Patterns", "Ornate Details"] },
  "Geometric Rational": { question: "Clean lines or functional forms?", options: ["Clean Lines", "Functional Forms"] },
  "Primary Colors Bold": { question: "Red/yellow/blue or strong contrast?", options: ["Red/Yellow/Blue", "Strong Contrast"] },
  "Monet Light": { question: "Soft impressions or water reflections?", options: ["Soft Impressions", "Water Reflections"] },
  "Van Gogh Expressive": { question: "Swirling strokes or emotional color?", options: ["Swirling Strokes", "Emotional Color"] },
  "60s Trippy": { question: "Paisley patterns or kaleidoscope effects?", options: ["Paisley Patterns", "Kaleidoscope Effects"] },
  "Modern Neon Psychedelic": { question: "Digital fractals or glowing colors?", options: ["Digital Fractals", "Glowing Colors"] },
  "Brutalist Stark": { question: "Concrete harsh or geometric severe?", options: ["Concrete Harsh", "Geometric Severe"] },
  "Refined Simplicity": { question: "Japanese zen or elegant reduction?", options: ["Japanese Zen", "Elegant Reduction"] },

  // [10] Detail Level
  "Every Texture Visible": { question: "Macro photography close or surface detail zoom?", options: ["Macro Photography Close", "Surface Detail Zoom"] },
  "Intricate Patterns": { question: "Lace-like complexity or ornamental precision?", options: ["Lace-like Complexity", "Ornamental Precision"] },
  "Rich Complexity": { question: "Layered depth or varied elements?", options: ["Layered Depth", "Varied Elements"] },
  "Focused Precision": { question: "Sharp clarity or technical accuracy?", options: ["Sharp Clarity", "Technical Accuracy"] },
  "Balanced Focus": { question: "Even attention or distributed detail?", options: ["Even Attention", "Distributed Detail"] },
  "Selective Detail": { question: "Hero focus or depth of field blur?", options: ["Hero Focus", "Depth of Field Blur"] },
  "Simplified Forms": { question: "Basic shapes or clean reduction?", options: ["Basic Shapes", "Clean Reduction"] },
  "Essential Elements": { question: "Core components or key features only?", options: ["Core Components", "Key Features Only"] },
  "Bare Essentials": { question: "Absolute minimum or stripped down?", options: ["Absolute Minimum", "Stripped Down"] },
  "Iconic Reduction": { question: "Symbol simple or logo-like?", options: ["Symbol Simple", "Logo-like"] },
  "Implied Forms": { question: "Suggested shapes or partial rendering?", options: ["Suggested Shapes", "Partial Rendering"] },
  "Viewer Interpretation": { question: "Open ended or imagination required?", options: ["Open Ended", "Imagination Required"] },
  "Surface Emphasis": { question: "Material quality or tactile focus?", options: ["Material Quality", "Tactile Focus"] },
  "Material Focus": { question: "Physical properties or substance highlight?", options: ["Physical Properties", "Substance Highlight"] },
  "Environmental Mood": { question: "Atmosphere heavy or ambient quality?", options: ["Atmosphere Heavy", "Ambient Quality"] },
  "Spatial Depth": { question: "Distance layers or perspective emphasis?", options: ["Distance Layers", "Perspective Emphasis"] },

  // [11] Subject Focus
  "Close-up Face": { question: "Eyes centered or profile angle?", options: ["Eyes Centered", "Profile Angle"] },
  "Full Body Character": { question: "Standing pose or action position?", options: ["Standing Pose", "Action Position"] },
  "Single Object": { question: "Product spotlight or artifact focus?", options: ["Product Spotlight", "Artifact Focus"] },
  "Arranged Collection": { question: "Organized display or scattered grouping?", options: ["Organized Display", "Scattered Grouping"] },
  "Vast Expansive": { question: "Horizon wide or infinite space?", options: ["Horizon Wide", "Infinite Space"] },
  "Intimate Scene": { question: "Cozy corner or personal moment?", options: ["Cozy Corner", "Personal Moment"] },
  "Pure Visual": { question: "Color/form exploration or aesthetic experience?", options: ["Color/Form Exploration", "Aesthetic Experience"] },
  "Symbolic Narrative": { question: "Metaphorical meaning or story suggestion?", options: ["Metaphorical Meaning", "Story Suggestion"] },
  "Text as Art": { question: "Typography design or lettering craft?", options: ["Typography Design", "Lettering Craft"] },
  "Text with Imagery": { question: "Words integrated or message + visual?", options: ["Words Integrated", "Message + Visual"] },
  "Realistic": { question: "Natural accurate or wildlife authentic?", options: ["Natural Accurate", "Wildlife Authentic"] },
  "Fantastical Hybrid": { question: "Mythical creature or imaginary being?", options: ["Mythical Creature", "Imaginary Being"] },
  "Exterior Structures": { question: "Building facades or outdoor architecture?", options: ["Building Facades", "Outdoor Architecture"] },
  "Interior Spaces": { question: "Room design or inside environment?", options: ["Room Design", "Inside Environment"] },
  "Repeating Motifs": { question: "Pattern tiling or decorative repeat?", options: ["Pattern Tiling", "Decorative Repeat"] },
  "Material Surfaces": { question: "Texture showcase or substance detail?", options: ["Texture Showcase", "Substance Detail"] },
};

// Category-specific overrides for duplicate SUB names that appear in multiple categories
// with different SUBSUB children. JS objects silently drop earlier duplicate keys, so the
// overridden entries live here and are checked first by resolveStep / filter.
export const SUBSUBS_OVERRIDES = {
  // "Essential Elements" under Cat 5 (Form) has different children than Cat 10 (Detail)
  5: { "Essential Elements": { question: "Absolute minimum or stripped down?", options: ["Absolute Minimum", "Stripped Down"] } },
};

// MAIN → all reachable SUBSUB leaf values (for MAIN-level filtering)
export const SUBSUB_DESCENDANTS = (() => {
  // Map each MAIN option to its category so we can apply overrides
  const mainToCategory = {};
  for (let i = 0; i < STAGES.length; i++) {
    for (const opt of STAGES[i].options) mainToCategory[opt] = i;
  }

  const map = {};
  for (const [mainKey, subConfig] of Object.entries(SUBS)) {
    const catIdx = mainToCategory[mainKey];
    const descendants = [];
    for (const subOpt of subConfig.options) {
      const entry = SUBSUBS_OVERRIDES[catIdx]?.[subOpt] || SUBSUBS[subOpt];
      if (entry) descendants.push(...entry.options);
    }
    map[mainKey] = descendants;
  }
  return map;
})();

// resolveStep — returns { question, options } for a given step index
// step = categoryIndex * 3 + level  (0=main, 1=sub, 2=subsub)
export function resolveStep(stepIndex, answers) {
  const level         = stepIndex % 3;
  const categoryIndex = Math.floor(stepIndex / 3);
  const stage         = STAGES[categoryIndex];
  if (!stage) return null;

  if (level === 0) return { question: stage.question, options: stage.options };

  const mainAnswer = answers[categoryIndex * 3];

  if (level === 1) return SUBS[mainAnswer] ?? SUBS[stage.options[0]];

  if (level === 2) {
    const subAnswer = answers[categoryIndex * 3 + 1];
    // Check category-specific overrides first (handles duplicate SUB names)
    const override = SUBSUBS_OVERRIDES[categoryIndex]?.[subAnswer];
    if (override) return override;
    if (SUBSUBS[subAnswer]) return SUBSUBS[subAnswer];
    const mainConfig = SUBS[mainAnswer] ?? SUBS[stage.options[0]];
    return mainConfig ? (SUBSUBS_OVERRIDES[categoryIndex]?.[mainConfig.options[0]] || SUBSUBS[mainConfig.options[0]]) ?? null : null;
  }

  return null;
}

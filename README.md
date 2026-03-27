# Style Quiz

AI-powered visual style quiz that matches users to aesthetic styles through a 36-question funnel and embedding similarity search.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 7 |
| Animation | GSAP 3 |
| State | Zustand 5 |
| Database | Supabase (Postgres + pgvector) |
| Storage | Supabase Storage (segment images) |
| Embeddings | Qwen3-Embedding-4B via RunPod Serverless |
| Hosting | Vercel (static + serverless functions) |

## Architecture

```
Welcome → Quiz (36 steps) → Output (6 carousels) → Confirmation
   ↓          ↓                    ↓                     ↓
Background mosaic with 60 parallax slots, always mounted
```

- **Welcome** — curated 60-image mosaic, headline + MAKE button
- **Quiz** — 12 categories × 3 levels (main → sub → subsub), background refilters on every answer
- **Output** — POST tally → embed via RunPod → pgvector similarity → 6 style carousels (swipeable, rep + 5 segments)
- **Confirmation** — name + email form → updates session row in Supabase

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase and RunPod credentials

# Generate dev manifest (random tallies for 695 styles)
npm run generate-manifest

# Convert source images to webp reps
npm run convert-reps

# Start dev server
npm run dev
```

## Environment Variables

See [.env.example](.env.example) for the full list. Required:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key (server-side only)
- `RUNPOD_API_KEY` — RunPod API key
- `RUNPOD_ENDPOINT_ID` — RunPod serverless endpoint ID for Qwen3-Embedding-4B

## Project Structure

```
api/                  Vercel serverless functions
  search.js           POST /api/search — embed + similarity match
  submit.js           POST /api/submit — save contact info
public/
  images/rep/         695 representative .webp images
  manifest.json       Style metadata (id, repPath, tally)
scripts/
  convert-reps.cjs    Source JPGs → optimized WebP reps
  generate-manifest-dev.cjs   Dev placeholder manifest
src/
  components/
    Background/       60-slot parallax mosaic (always mounted)
    Quiz/             36-step question panels + progress bar
    Output/           Style carousels + rabbit hole search
    Welcome/          Landing screen
    Confirmation/     Contact form + submission
  config/
    animation.js      GSAP timing constants
    questionTree.js   12×3 question tree + resolver
    slots-desktop.js  60 art-directed slot positions
    slots-mobile.js   35 mobile slot positions
    welcome-images.js Curated welcome image IDs
  store/
    quizStore.js      Zustand store (screen, answers, session)
  styles/
    global.css        CSS custom properties + resets
  utils/
    dataCache.js      Manifest loader + cache
    filter.js         Tag-based image filtering
    preloader.js      Idle-time image prefetching
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run convert-reps` | Convert source images to WebP |
| `npm run generate-manifest` | Generate dev manifest with random tallies |

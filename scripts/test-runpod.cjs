// scripts/test-runpod.cjs
// Phase 1: warms the worker by submitting a tiny ping job, polls /health until
//          workers.idle >= 1, then fires immediately and times just the inference.
// Run: node scripts/test-runpod.cjs  (from inside style-quiz/)

require('dotenv').config({ path: '.env' });

const RUNPOD_API_KEY     = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const EMBED_DIM          = 2560;
const WARMUP_POLL_MS     = 1000;   // check health every 1 second during warmup
const JOB_POLL_MS        = 500;    // check job status every 500ms once worker is hot
const MAX_WARMUP_MS      = 300000; // 5 min warmup ceiling
const MAX_JOB_MS         = 30000;  // 30 sec for the actual inference once warm

if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
  console.error('FAIL  RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is missing in .env');
  process.exit(1);
}

const SAMPLE_TALLY = 'Subtle Dreamlike, Matte Smooth, Natural Organic, Quiet Intimate, Timeless Refined, Cool Neutral';
const BASE         = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;
const RUN_URL      = `${BASE}/run`;
const HEALTH_URL   = `${BASE}/health`;
const STATUS_URL   = (id) => `${BASE}/status/${id}`;

const HEADERS = {
  'Authorization': `Bearer ${RUNPOD_API_KEY}`,
  'Content-Type': 'application/json',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function submitJob(prompt) {
  const res = await fetch(RUN_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ input: { prompt } }),
  });
  if (!res.ok) throw new Error(`submit HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

async function pollJob(jobId, maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await sleep(JOB_POLL_MS);
    const res = await fetch(STATUS_URL(jobId), { headers: HEADERS });
    if (!res.ok) throw new Error(`poll HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'COMPLETED') return data;
    if (data.status === 'FAILED') throw new Error(`job failed: ${data.error}`);
  }
  throw new Error('job timed out');
}

async function main() {
  console.log('\nRunPod embedding test — warm-then-fire');
  console.log('Endpoint:', BASE);
  console.log('─'.repeat(60));

  // ── Phase 1: check if a worker is already idle ──
  const healthRes = await fetch(HEALTH_URL, { headers: HEADERS });
  if (!healthRes.ok) throw new Error(`health HTTP ${healthRes.status}`);
  const health = await healthRes.json();
  const idle = health?.workers?.idle ?? 0;
  const ready = health?.workers?.ready ?? 0;

  console.log(`Workers — idle: ${idle}, ready: ${ready}, initializing: ${health?.workers?.initializing ?? 0}`);

  if (idle === 0 && ready === 0) {
    // ── Phase 2: send a ping job to wake a worker ──
    console.log('No idle worker — submitting warmup ping to wake endpoint...');
    const warmupStart = Date.now();
    const pingId = await submitJob('ping');
    console.log(`Ping job submitted (${pingId})`);

    // Poll health until a worker is idle (= loaded and waiting for work)
    const warmupDeadline = Date.now() + MAX_WARMUP_MS;
    let secs = 0;
    while (Date.now() < warmupDeadline) {
      await sleep(WARMUP_POLL_MS);
      secs++;
      process.stdout.write(`\rWaiting for worker to become idle ... ${secs}s`);

      const h = await (await fetch(HEALTH_URL, { headers: HEADERS })).json();
      if ((h?.workers?.idle ?? 0) >= 1 || (h?.workers?.ready ?? 0) >= 1) {
        const warmupMs = Date.now() - warmupStart;
        console.log(`\nWorker idle after ${(warmupMs / 1000).toFixed(1)}s`);
        break;
      }
      if (Date.now() >= warmupDeadline) {
        console.log('\nFAIL  worker never became idle within 5 minutes');
        process.exit(1);
      }
    }
  } else {
    console.log('Worker already idle — skipping warmup.');
  }

  // ── Phase 3: fire real request immediately, time inference only ──
  console.log(`\nFiring embedding request ...`);
  console.log(`Input: ${SAMPLE_TALLY}`);
  const inferStart = Date.now();
  const jobId = await submitJob(SAMPLE_TALLY);
  const result = await pollJob(jobId, MAX_JOB_MS);
  const inferMs = Date.now() - inferStart;

  // ── Validate ──
  const embeddingArr = result?.output?.embeddings?.[0];
  if (!embeddingArr) {
    console.error('FAIL  output.embeddings[0] missing');
    console.error(JSON.stringify(result.output, null, 2));
    process.exit(1);
  }
  if (embeddingArr.length !== EMBED_DIM) {
    console.error(`FAIL  expected ${EMBED_DIM} dims, got ${embeddingArr.length}`);
    process.exit(1);
  }

  console.log('─'.repeat(60));
  console.log(`Inference time: ${inferMs}ms`);
  console.log(`Dims:    ${embeddingArr.length}  (expected ${EMBED_DIM}) ✓`);
  console.log(`First 5: [${embeddingArr.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`);
  console.log('─'.repeat(60));
  console.log('RunPod test passed.\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

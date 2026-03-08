// api/warmup.js
// Fires a tiny job to RunPod to wake the serverless worker.
// Returns immediately — does not wait for the job to complete.
// Called on app load so the worker is hot by the time the quiz ends.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID } = process.env;
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  try {
    // Fire and forget — submit a minimal job, don't await completion
    const warmupStart = Date.now();
    console.log('[RunPod] → Sending warmup request (fire-and-forget)');
    console.log('[RunPod]   Input: "warmup" (ping to wake the worker)');
    fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: { prompt: 'warmup' } }),
    })
      .then(r => r.json())
      .then(data => {
        const ms = Date.now() - warmupStart;
        console.log(`[RunPod] ✓ Warmup job accepted in ${ms}ms — jobId: ${data?.id ?? '(unknown)'}`);
      })
      .catch(err => {
        console.warn('[RunPod] ✗ Warmup request failed silently:', err?.message);
      });
  } catch (_) {
    // Never fail the client over a warmup
  }

  res.status(200).json({ ok: true });
}

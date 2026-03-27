import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const EMBED_DIM = 2560;

/**
 * POST /api/search
 *
 * Mode 1 — Initial search (after quiz):
 *   Body: { tally: "tag1, tag2, ..." }
 *   → OpenRouter embed tally → INSERT session (tally + embedding) → pgvector top 6
 *   Returns: { sessionId, styleIds }
 *
 * Mode 2 — Rabbit hole (click on a carousel):
 *   Body: { styleId: "style_0001", sessionId: "uuid" }
 *   → fetch embedding from styles table (path = "style_0001/2.webp") → pgvector top N
 *   Returns: { sessionId, styleIds }
 *
 * Mode 3 — Show more (expand to 12):
 *   Body: { styleId: "style_0001", sessionId: "uuid", matchCount: 12 }
 *   Same as mode 2 but returns 12 results
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tally, styleId, sessionId, matchCount } = req.body;
  const N = matchCount || 6;

  try {
    // ── Mode 1: tally-based (initial quiz result) ──
    if (tally && typeof tally === 'string') {
      // 1. Embed the tally via RunPod (Qwen3-Embedding-4B, preloaded)
      console.log('[RunPod] → Sending embedding request');
      console.log('[RunPod]   Input:', tally);
      const embedStart = Date.now();

      const embedRes = await fetch(
        `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/runsync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: { prompt: tally } }),
        }
      );

      const embedData = await embedRes.json();
      const embedMs = Date.now() - embedStart;
      const embeddingArr = embedData?.output?.embeddings?.[0];

      if (!embeddingArr || embeddingArr.length !== EMBED_DIM) {
        console.error(`[RunPod] ✗ Embedding failed after ${embedMs}ms — got dims: ${embeddingArr?.length ?? 0}`);
        return res.status(500).json({ error: 'Embedding failed' });
      }

      console.log(`[RunPod] ✓ Embedding received in ${embedMs}ms`);
      console.log(`[RunPod]   Dims: ${embeddingArr.length}  First 5: [${embeddingArr.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`);

      const embedding = '[' + embeddingArr.join(',') + ']';

      // 2. Insert session row (content + embedding) into sessions table
      const { data: session, error: insertErr } = await supabase
        .from('sessions')
        .insert({ content: tally, embedding })
        .select('id')
        .single();

      if (insertErr) {
        console.error('Session insert error:', insertErr);
        return res.status(500).json({ error: 'Session creation failed' });
      }

      // 3. pgvector similarity search
      const { data: matches, error: matchErr } = await supabase.rpc(
        'match_styles',
        {
          query_embedding: embedding,
          match_count: N,
        }
      );

      if (matchErr) {
        console.error('Match error:', matchErr);
        return res.status(500).json({ error: 'Similarity search failed' });
      }

      // match_styles returns { path, similarity } — path is "style_XXXX" directly
      const results = matches.map((m) => ({
        id: m.path,
        similarity: m.similarity,
      }));

      // 4. Update session metadata with result ids
      await supabase
        .from('sessions')
        .update({ metadata: { result_ids: results.map(r => r.id) } })
        .eq('id', session.id);

      return res.status(200).json({ sessionId: session.id, results });
    }

    // ── Mode 2 / 3: styleId-based (rabbit hole or show more) ──
    if (styleId && typeof styleId === 'string') {
      // 1. Fetch the clicked style's embedding from styles table
      const { data: row, error: fetchErr } = await supabase
        .from('styles')
        .select('embedding')
        .eq('path', styleId)
        .single();

      if (fetchErr || !row) {
        console.error('Style fetch error:', fetchErr);
        return res.status(404).json({ error: 'Style not found' });
      }

      // 2. pgvector similarity search using the style's embedding
      const { data: matches, error: matchErr } = await supabase.rpc(
        'match_styles',
        {
          query_embedding:
            typeof row.embedding === 'string'
              ? row.embedding
              : JSON.stringify(row.embedding),
          match_count: N,
        }
      );

      if (matchErr) {
        console.error('Match error:', matchErr);
        return res.status(500).json({ error: 'Similarity search failed' });
      }

      // match_styles returns { path, similarity } — path is "style_XXXX" directly
      const results = matches.map((m) => ({
        id: m.path,
        similarity: m.similarity,
      }));

      return res.status(200).json({
        sessionId: sessionId || null,
        results,
      });
    }

    return res.status(400).json({ error: 'Provide either tally or styleId' });
  } catch (err) {
    console.error('Search handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

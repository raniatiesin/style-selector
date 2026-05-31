/* global process */

const TIME_ZONE = 'Europe/Paris';

function getTodayString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

async function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing from environment variables.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseKey);
}

function requireWebhookSecret(req) {
  const expectedSecret = process.env.MINECRAFT_WEBHOOK_SECRET || process.env.OVERLAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
  const authHeader = req.headers.authorization;

  if (!expectedSecret) {
    return { ok: false, status: 500, message: 'Missing minecraft webhook secret.' };
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    return { ok: false, status: 401, message: 'Unauthorized access blocked.' };
  }

  return { ok: true };
}

function buildResponseRow(row) {
  return {
    worldId: row.world_id,
    worldName: row.world_name,
    worldPath: row.world_path,
    runType: row.run_type,
    startGamemode: row.start_gamemode,
    isCompleted: row.is_completed,
    finalIgt: row.final_igt,
    enterNetherIgt: row.enter_nether_igt,
    enterEndIgt: row.enter_end_igt,
    observedDurationMs: row.observed_duration_ms,
    date: row.date,
    updatedAt: row.updated_at,
    rawData: row.raw_data
  };
}

function aggregateRows(rows) {
  const completedRows = rows.filter((row) => row.is_completed);
  const completedFinalIgt = completedRows.filter((row) => Number.isFinite(Number(row.final_igt)) && Number(row.final_igt) > 0).map((row) => Number(row.final_igt));
  const netherIgtValues = rows.filter((row) => Number.isFinite(Number(row.enter_nether_igt)) && Number(row.enter_nether_igt) > 0).map((row) => Number(row.enter_nether_igt));
  const endIgtValues = rows.filter((row) => Number.isFinite(Number(row.enter_end_igt)) && Number(row.enter_end_igt) > 0).map((row) => Number(row.enter_end_igt));

  const average = (values) => {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };

  return {
    totals: {
      totalRuns: rows.length,
      completedRuns: completedRows.length
    },
    averages: {
      avgFinalIgtCompleted: average(completedFinalIgt),
      avgEnterNetherIgt: average(netherIgtValues),
      avgEnterEndIgt: average(endIgtValues)
    },
    bests: {
      bestFinalIgt: completedFinalIgt.length ? Math.min(...completedFinalIgt) : Infinity,
      bestEnterNetherIgt: netherIgtValues.length ? Math.min(...netherIgtValues) : Infinity,
      bestEnterEndIgt: endIgtValues.length ? Math.min(...endIgtValues) : Infinity
    }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const supabase = await getSupabaseClient();

    if (req.method === 'POST') {
      const authResult = requireWebhookSecret(req);
      if (!authResult.ok) {
        return res.status(authResult.status).json({ error: authResult.message });
      }

      const payload = req.body || {};
      if (!payload.worldId || !payload.worldPath) {
        return res.status(400).json({ error: 'worldId and worldPath are required.' });
      }

      const date = payload.date || getTodayString();
      const row = {
        world_id: String(payload.worldId),
        world_name: String(payload.worldName || ''),
        world_path: String(payload.worldPath),
        run_type: String(payload.runType || 'unknown'),
        start_gamemode: String(payload.startGamemode || 'unknown'),
        is_completed: Boolean(payload.isCompleted),
        final_igt: Number(payload.finalIgt) || 0,
        enter_nether_igt: Number(payload.enterNetherIgt) || 0,
        enter_end_igt: Number(payload.enterEndIgt) || 0,
        observed_duration_ms: Number(payload.observedDurationMs) || 0,
        date,
        raw_data: payload.rawData ?? null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('minecraft_runs')
        .upsert(row, { onConflict: 'world_id' });

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, message: 'Minecraft run synced.', date });
    }

    if (req.method === 'GET') {
      const date = typeof req.query?.date === 'string' && req.query.date.trim() ? req.query.date.trim() : getTodayString();

      const { data: rows, error } = await supabase
        .from('minecraft_runs')
        .select('*')
        .eq('date', date)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      const normalizedRows = Array.isArray(rows) ? rows.map(buildResponseRow) : [];
      const stats = aggregateRows(normalizedRows);

      return res.status(200).json({
        success: true,
        date,
        stats,
        runs: normalizedRows
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed.' });
  } catch (error) {
    console.error('[API Error] /api/stream/minecraft:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
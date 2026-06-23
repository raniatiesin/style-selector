/* global process */

const TIME_ZONE = 'Europe/Paris';

function getTodayString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

function getTodayStartISO() {
  const today = getTodayString(); // "2026-06-23"
  return `${today}T00:00:00.000Z`;
}

function getTodayEndISO() {
  const today = getTodayString();
  return `${today}T23:59:59.999Z`;
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
  const webhookSecrets = [
    process.env.MINECRAFT_WEBHOOK_SECRET,
    process.env.OVERLAY_WEBHOOK_SECRET,
    process.env.WEBHOOK_SECRET,
    process.env.STREAM_ADMIN_KEY
  ].filter(Boolean);

  if (webhookSecrets.length === 0) {
    return { ok: false, status: 500, message: 'Missing minecraft webhook or admin secret.' };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { ok: false, status: 401, message: 'Unauthorized access blocked.' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const matched = webhookSecrets.some(secret => token === secret);
  if (!matched) {
    return { ok: false, status: 401, message: 'Unauthorized access blocked.' };
  }

  return { ok: true };
}

function computeStats(rows) {
  const times = rows
    .filter(r => Number.isFinite(Number(r.time_played_ms)) && Number(r.time_played_ms) > 0)
    .map(r => Number(r.time_played_ms));

  return {
    totalGames: rows.length,
    bestTimeMs: times.length ? Math.min(...times) : null,
    totalPlaytimeMs: times.reduce((sum, t) => sum + t, 0)
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
      const timePlayedMs = Number(payload.timePlayedMs) || 0;

      const row = {
        time_played_ms: timePlayedMs
      };

      const { error } = await supabase
        .from('paceman')
        .insert(row);

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, message: 'Game session recorded.' });
    }

    if (req.method === 'GET') {
      // Fetch today's rows
      const { data: todayRows, error: todayError } = await supabase
        .from('paceman')
        .select('time_played_ms')
        .gte('created_at', getTodayStartISO())
        .lte('created_at', getTodayEndISO())
        .order('created_at', { ascending: false });

      if (todayError) {
        throw todayError;
      }

      // Fetch ALL rows for totality stats
      const { data: allRows, error: allError } = await supabase
        .from('paceman')
        .select('time_played_ms')
        .order('created_at', { ascending: false });

      if (allError) {
        throw allError;
      }

      return res.status(200).json({
        success: true,
        date: getTodayString(),
        today: computeStats(todayRows || []),
        totality: computeStats(allRows || [])
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed.' });
  } catch (error) {
    console.error('[API Error] /api/stream/minecraft:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase credentials missing.' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve dayNumber to date
    function dayNumberToDate(dn) {
      const startDate = new Date('2026-08-15');
      const targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + (Number(dn) - 1));
      return targetDate.toISOString().split('T')[0];
    }

    // ── GET: Return NoteLogs for a session ──
    if (req.method === 'GET') {
      const { dayNumber, sessionNumber } = req.query;

      if (!dayNumber || !sessionNumber) {
        return res.status(400).json({ error: 'dayNumber and sessionNumber are required' });
      }

      const dateStr = dayNumberToDate(dayNumber);

      const { data: notes, error } = await supabase
        .from('NoteLogs')
        .select('*')
        .eq('session_date', dateStr)
        .eq('session_number', sessionNumber)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ success: true, notes: notes ?? [] });
    }

    // ── POST: Create or update a NoteLog ──
    if (req.method === 'POST') {
      const WEBHOOK_SECRET = process.env.OVERLAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || process.env.STREAM_ADMIN_KEY;

      if (!WEBHOOK_SECRET) {
        return res.status(500).json({ error: 'Missing secret' });
      }

      const authHeader = req.headers.authorization || req.headers['x-api-key'] || '';
      let isValidAuth = false;
      if (authHeader.includes(WEBHOOK_SECRET)) isValidAuth = true;

      if (!isValidAuth) {
        return res.status(401).json({ error: 'Unauthorized access blocked. Secret mismatch or missing.' });
      }

      const { dayNumber, sessionNumber, bloc_id, type, content } = req.body;

      // Resolve session: active stream > latest session > explicit params
      let resolvedDate = null;
      let resolvedSessionNumber = null;
      let isStreaming = false;

      const { data: activeSession } = await supabase
        .from('Sessions')
        .select('date, session_number, is_streaming')
        .eq('is_streaming', true)
        .maybeSingle();

      if (activeSession) {
        resolvedDate = activeSession.date;
        resolvedSessionNumber = activeSession.session_number;
        isStreaming = true;
      } else {
        const { data: latestSession } = await supabase
          .from('Sessions')
          .select('date, session_number, is_streaming')
          .order('date', { ascending: false })
          .order('session_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSession) {
          resolvedDate = latestSession.date;
          resolvedSessionNumber = latestSession.session_number;
          isStreaming = latestSession.is_streaming === true;
        } else if (dayNumber && sessionNumber) {
          resolvedDate = dayNumberToDate(dayNumber);
          resolvedSessionNumber = sessionNumber;
          // explicit params — no session row to check, keep as-is
        }
      }

      if (!bloc_id) {
        return res.status(400).json({ error: 'bloc_id is required' });
      }

      // If offline (not actively streaming), check if existing bloc has session fields to preserve
      let existingSessionDate = null;
      let existingSessionNumber = null;
      if (!isStreaming && resolvedDate && resolvedSessionNumber) {
        const { data: existing } = await supabase
          .from('NoteLogs')
          .select('session_date, session_number')
          .eq('bloc_id', bloc_id)
          .maybeSingle();
        if (existing) {
          existingSessionDate = existing.session_date;
          existingSessionNumber = existing.session_number;
        }
      }

      const useDate = existingSessionDate ? existingSessionDate : (isStreaming ? resolvedDate : null);
      const useNum = existingSessionNumber != null ? existingSessionNumber : (isStreaming ? resolvedSessionNumber : null);

      if (!useDate || useNum == null) {
        if (!resolvedDate || resolvedSessionNumber == null) {
          return res.status(400).json({ error: 'Could not resolve session. Ensure a session exists.' });
        }
      }

      const { data: bloc, error } = await supabase
        .from('NoteLogs')
        .upsert(
          {
            bloc_id,
            session_date: useDate,
            session_number: useNum,
            type: type ?? null,
            content: content ?? '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'bloc_id' }
        )
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, bloc });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
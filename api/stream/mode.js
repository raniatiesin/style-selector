export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const WEBHOOK_SECRET = process.env.OVERLAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return res.status(500).json({ error: "Missing Secret" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized access blocked." });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed.' });
  }

  try {
    const { mode } = req.body;

    if (!mode) {
      return res.status(400).json({ error: 'mode is required' });
    }

    const validModes = ['work', 'break', 'standby', 'explain'];
    if (!validModes.includes(mode) && !mode.startsWith('explain')) {
      return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Session resolution: active stream first, then absolute latest session
    const { data: activeSession } = await supabase
      .from('Sessions')
      .select('date, session_number, mode')
      .eq('is_streaming', true)
      .maybeSingle();

    let session = activeSession;
    if (!session) {
      const { data: recentSession } = await supabase
        .from('Sessions')
        .select('date, session_number, mode')
        .order('date', { ascending: false })
        .order('session_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      session = recentSession;
    }

    if (!session) {
      return res.status(404).json({ error: 'No session found' });
    }

    // Update the Sessions row mode field
    const { error: updateError } = await supabase
      .from('Sessions')
      .update({ mode, updated_at: new Date().toISOString() })
      .eq('date', session.date)
      .eq('session_number', session.session_number);

    if (updateError) throw updateError;

    // Only insert SessionLogs if mode changed from current stored mode
    if (mode !== session.mode) {
      const isStreaming = !!activeSession;
      const { error: slErr } = await supabase
        .from('SessionLogs')
        .insert({
          session_date: isStreaming ? session.date : null,
          session_number: isStreaming ? session.session_number : null,
          mode,
          occurred_at: new Date().toISOString()
        });
      if (slErr) console.error('[SessionLogs] Failed to insert mode change:', slErr);
    }

    return res.status(200).json({ success: true, mode });
  } catch (error) {
    console.error('[API Error] /api/stream/mode:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
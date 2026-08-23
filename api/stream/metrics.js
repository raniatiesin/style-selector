export default async function handler(req, res) {
  // CORS Security
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
    const payload = req.body;

    if (payload?.ping === true) {
      return res.status(200).json({ success: true, message: 'Authenticated' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    
    const { data: activeStreamData } = await supabase
      .from('Sessions')
      .select('*')
      .eq('is_streaming', true)
      .single();
    
    const activeDate = activeStreamData ? activeStreamData.date : today;
    
    const validationErrors = [];
    if (payload.isStreaming !== undefined && typeof payload.isStreaming !== 'boolean') validationErrors.push('isStreaming must be a boolean');
    if (payload.isPaused !== undefined && typeof payload.isPaused !== 'boolean') validationErrors.push('isPaused must be a boolean');
    if (payload.accumulatedTodaySeconds !== undefined && payload.accumulatedTodaySeconds < 0 && payload.accumulatedTodaySeconds !== -1) validationErrors.push('accumulatedTodaySeconds cannot be negative');
    
    const validModes = ['work', 'break', 'standby', 'explain'];
    if (payload.mode !== undefined && !validModes.includes(payload.mode) && !payload.mode.startsWith('explain|')) {
      validationErrors.push(`Invalid mode: ${payload.mode}`);
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }
    
    const updateData = { updated_at: new Date().toISOString() };
    if (Object.hasOwn(payload, 'mode')) updateData.mode = payload.mode;
    if (Object.hasOwn(payload, 'contentCount')) updateData.content_count = payload.contentCount;
    if (Object.hasOwn(payload, 'salesCount')) updateData.sales_count = payload.salesCount;
    if (Object.hasOwn(payload, 'accumulatedTodaySeconds')) updateData.today_seconds = payload.accumulatedTodaySeconds;
    if (Object.hasOwn(payload, 'todayWorkSeconds')) updateData.today_seconds = payload.todayWorkSeconds;
    if (Object.hasOwn(payload, 'modeTimestamp')) updateData.mode_timestamp = payload.modeTimestamp;
    if (Object.hasOwn(payload, 'sessionStartTimestamp')) updateData.session_start_timestamp = payload.sessionStartTimestamp;
    if (Object.hasOwn(payload, 'isStreaming')) updateData.is_streaming = payload.isStreaming;
    if (Object.hasOwn(payload, 'standbySelection')) updateData.standby_selection = payload.standbySelection;
    if (Object.hasOwn(payload, 'timestamps')) updateData.timestamps = payload.timestamps;
    if (Object.hasOwn(payload, 'isPaused')) updateData.is_paused = payload.isPaused;
    if (Object.hasOwn(payload, 'pausedTimestamp')) updateData.paused_timestamp = payload.pausedTimestamp;
    if (Object.hasOwn(payload, 'title')) updateData.title = payload.title;
    if (Object.hasOwn(payload, 'streamUrl')) updateData.stream_url = payload.streamUrl;
    if (Object.hasOwn(payload, 'notes')) updateData.notes = payload.notes;

    let result;
    
    if (activeStreamData) {
      // Authoritative guard: never let a non-reset push lower today_seconds.
      // A stale/partial push (metric +/-, title blur, etc.) must not shrink the
      // running day total. Explicit resets (-1 sentinel) are allowed through.
      const incoming = updateData.today_seconds;
      const current = activeStreamData.today_seconds;
      if (
        incoming !== undefined &&
        incoming !== null &&
        incoming !== -1 &&
        current !== undefined &&
        current !== null &&
        current !== -1 &&
        Number.isFinite(Number(incoming)) &&
        Number.isFinite(Number(current)) &&
        Number(incoming) < Number(current)
      ) {
        delete updateData.today_seconds;
      }
      
      result = await supabase
        .from('Sessions')
        .update(updateData)
        .eq('date', activeStreamData.date)
        .eq('session_number', activeStreamData.session_number)
        .select();
    } else {
      if (payload.isStreaming === true) {
        const { data: sessionsToday } = await supabase
          .from('Sessions')
          .select('session_number, today_seconds')
          .eq('date', today)
          .order('session_number', { ascending: false })
          .limit(1);
        
        const latestToday = (sessionsToday && sessionsToday.length > 0) ? sessionsToday[0] : null;
        const nextSessionNum = latestToday ? latestToday.session_number + 1 : 1;
        // Carry forward today's accumulated work seconds across multiple stream sessions
        // within the same day. A brand-new day (no Sessions rows for `today`) starts at 0,
        // which is exactly the "reset on day change" behaviour we want.
        // Clamp to >= 0 so a -1 reset sentinel is never propagated into a new session.
        const carriedTodaySeconds = latestToday ? Math.max(0, latestToday.today_seconds ?? 0) : 0;
        
        updateData.date = today;
        updateData.session_number = nextSessionNum;
        updateData.today_seconds = carriedTodaySeconds;
        updateData.mode_timestamp = Date.now();
        
        result = await supabase
          .from('Sessions')
          .insert(updateData)
          .select();
      } else {
        return res.status(200).json({
          success: true,
          message: "No record created (not a stream start)."
        });
      }
    }

    if (result && result.error) throw result.error;

    return res.status(200).json({
      success: true,
      message: "Metrics synced."
    });

  } catch (error) {
    console.error('[API Error] /api/stream/metrics:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
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
      .maybeSingle();
    
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
    if (Object.hasOwn(payload, 'alphaGross')) updateData.alpha_gross = payload.alphaGross;
    if (Object.hasOwn(payload, 'totalGross')) updateData.total_gross = payload.totalGross;

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

      // Record SessionLogs on mode change
      if (Object.hasOwn(payload, 'mode') && payload.mode !== activeStreamData.mode) {
        const { error: slErr } = await supabase
          .from('SessionLogs')
          .insert({
            session_date: activeStreamData.date,
            session_number: activeStreamData.session_number,
            mode: payload.mode,
            occurred_at: new Date().toISOString()
          });
        if (slErr) console.error('[SessionLogs] Failed to insert mode change:', slErr);
      }
    } else {
      // No active stream: persist updates to the latest session for today
      // (handles resets, metric changes, title changes when offline)
      delete updateData.timestamps;
      const { data: sessionsToday } = await supabase
        .from('Sessions')
        .select('session_number, today_seconds, mode')
        .eq('date', today)
        .order('session_number', { ascending: false })
        .limit(1);

      const latestToday = (sessionsToday && sessionsToday.length > 0) ? sessionsToday[0] : null;

      if (payload.isStreaming === true) {
        // ── Ensure NO other session has is_streaming=true ──
        const { error: clearErr } = await supabase
          .from('Sessions')
          .update({ is_streaming: false, updated_at: new Date().toISOString() })
          .eq('is_streaming', true);
        if (clearErr) console.error('[Metrics] Failed to clear prior streaming flag:', clearErr);

        const nextSessionNum = latestToday ? latestToday.session_number + 1 : 1;
        // Carry forward today's accumulated work seconds across multiple stream sessions
        const carriedTodaySeconds = latestToday ? Math.max(0, latestToday.today_seconds ?? 0) : 0;

        updateData.date = today;
        updateData.session_number = nextSessionNum;
        updateData.today_seconds = carriedTodaySeconds;
        updateData.mode_timestamp = Date.now();

        result = await supabase
          .from('Sessions')
          .insert(updateData)
          .select();

        // Record initial SessionLogs for new session
        const initialMode = Object.hasOwn(payload, 'mode') ? payload.mode : 'standby';
        const { error: slErr } = await supabase
          .from('SessionLogs')
          .insert({
            session_date: today,
            session_number: nextSessionNum,
            mode: initialMode,
            occurred_at: new Date().toISOString()
          });
        if (slErr) console.error('[SessionLogs] Failed to insert initial mode:', slErr);

        // Claim floating logs: attach orphaned rows to this new session
        if (result && result.length > 0) {
          const newDate = result[0].date;
          const newSessionNum = result[0].session_number;

          const claimTables = ['TaskLogs', 'NoteLogs', 'SessionLogs'];
          for (const table of claimTables) {
            try {
              const { error: claimErr } = await supabase
                .from(table)
                .update({ session_date: newDate, session_number: newSessionNum })
                .is('session_date', null)
                .is('session_number', null);
              if (claimErr) console.error(`[Claim ${table}] Failed:`, claimErr);
            } catch (claimErr) {
              console.error(`[Claim ${table}] Exception:`, claimErr);
            }
          }
        }
      } else if (latestToday) {
        // Offline update: persist to the latest today's session
        result = await supabase
          .from('Sessions')
          .update(updateData)
          .eq('date', today)
          .eq('session_number', latestToday.session_number)
          .select();

        // Record SessionLogs on mode change
        if (Object.hasOwn(payload, 'mode') && payload.mode !== latestToday.mode) {
          const { error: slErr } = await supabase
            .from('SessionLogs')
            .insert({
              session_date: null,
              session_number: null,
              mode: payload.mode,
              occurred_at: new Date().toISOString()
            });
          if (slErr) console.error('[SessionLogs] Failed to insert mode change:', slErr);
        }
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
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

  // 1. Same Secret Auth Lock as your Webhook
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

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use local timezone (e.g. 'Europe/Paris') for day bounds
    // to strictly prevent roll-overs mismatching your location
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    
    // Check if there's an active stream from any day
    const { data: activeStreamData, error: activeStreamError } = await supabase
      .from('stream_metrics')
      .select('*')
      .eq('is_streaming', true)
      .single();
    
    // Determine which date to use - active stream's date if exists, otherwise today
    const activeDate = activeStreamData ? activeStreamData.date : today;
    
    // Server-side validation
    const validationErrors = [];
    
    // Validate streaming state
    if (payload.isStreaming !== undefined && typeof payload.isStreaming !== 'boolean') {
      validationErrors.push('isStreaming must be a boolean');
    }
    
    // Validate pause state
    if (payload.isPaused !== undefined && typeof payload.isPaused !== 'boolean') {
      validationErrors.push('isPaused must be a boolean');
    }
    
    // Validate accumulated time doesn't go negative
    if (payload.accumulatedTodaySeconds !== undefined && payload.accumulatedTodaySeconds < 0 && payload.accumulatedTodaySeconds !== -1) {
      validationErrors.push('accumulatedTodaySeconds cannot be negative (except -1 for reset)');
    }
    
    // Validate mode
    const validModes = ['work', 'play', 'break', 'standby', 'explain'];
    if (payload.mode !== undefined && !validModes.includes(payload.mode) && !payload.mode.startsWith('explain|')) {
      validationErrors.push(`Invalid mode: ${payload.mode}`);
    }
    
    if (validationErrors.length > 0) {
      console.error('[API Validation Error]', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }
    
    // We only update the fields that the client sends to us.
    // Use activeDate if there's an active stream, otherwise use today
    const updateData = { date: activeDate, updated_at: new Date().toISOString() };
    if (Object.hasOwn(payload, 'mode')) updateData.mode = payload.mode;
    if (Object.hasOwn(payload, 'contactedCount')) updateData.projects_count = payload.contactedCount;
    if (Object.hasOwn(payload, 'convertedCount')) updateData.contacts_count = payload.convertedCount;
    if (Object.hasOwn(payload, 'playSeconds')) updateData.play_seconds = payload.playSeconds;
    
    // NEW: Timestamp logic to fix timer drift and stale UI overwrites
    if (Object.hasOwn(payload, 'accumulatedTodaySeconds')) {
      updateData.today_seconds = payload.accumulatedTodaySeconds;
    } else if (Object.hasOwn(payload, 'todayWorkSeconds')) {
      updateData.today_seconds = payload.todayWorkSeconds; // Fallback for older UI
    }

    if (Object.hasOwn(payload, 'modeTimestamp')) updateData.mode_timestamp = payload.modeTimestamp;
    
    if (Object.hasOwn(payload, 'accumulatedTotalSeconds')) updateData.accumulated_seconds = payload.accumulatedTotalSeconds;
    if (Object.hasOwn(payload, 'isStreaming')) {
      // Use the exact value provided (true or false)
      updateData.is_streaming = payload.isStreaming;
    }
    if (Object.hasOwn(payload, 'gameName')) updateData.game_name = payload.gameName;
    if (Object.hasOwn(payload, 'standbySelection')) updateData.standby_selection = payload.standbySelection;
    if (Object.hasOwn(payload, 'timestamps')) updateData.timestamps = payload.timestamps;
    if (Object.hasOwn(payload, 'streamNumber')) updateData.stream_number = payload.streamNumber;
    if (Object.hasOwn(payload, 'inProgressTasks')) updateData.in_progress_tasks = payload.inProgressTasks;
    if (Object.hasOwn(payload, 'inReviewTasks')) updateData.in_review_tasks = payload.inReviewTasks;
    if (Object.hasOwn(payload, 'upNextTasks')) updateData.up_next_tasks = payload.upNextTasks;
    if (Object.hasOwn(payload, 'doneTasks')) updateData.done_tasks = payload.doneTasks;
    if (Object.hasOwn(payload, 'isPaused')) updateData.is_paused = payload.isPaused;
    if (Object.hasOwn(payload, 'pausedTimestamp')) updateData.paused_timestamp = payload.pausedTimestamp;

    let result;
    
    if (activeStreamData) {
      // Active stream found - update that record regardless of date
      // Don't change the date field to preserve continuity across midnight
      const updateDataWithoutDate = { ...updateData };
      delete updateDataWithoutDate.date;
      result = await supabase
        .from('stream_metrics')
        .update(updateDataWithoutDate)
        .eq('date', activeStreamData.date)
        .select();
    } else {
      // No active stream - check if a record exists for the active date
      const { data: existingRecord, error: checkError } = await supabase
        .from('stream_metrics')
        .select('*')
        .eq('date', activeDate)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // Real error (not "no rows returned")
        throw checkError;
      }

      if (!existingRecord) {
        // No record exists for active date - only create if this is a stream start, stop, OR pause state change
        if (payload.isStreaming === true || payload.isStreaming === false || payload.isPaused !== undefined) {
          // Stream start/stop with no record - create new record
          result = await supabase
            .from('stream_metrics')
            .insert(updateData)
            .select();
        } else {
          // Not a stream start/stop and no pause state change - don't create a record
          return res.status(200).json({
            success: true,
            message: "No record created (not a stream start/stop)."
          });
        }
      } else {
        // Record exists - update it
        result = await supabase
          .from('stream_metrics')
          .update(updateData)
          .eq('date', activeDate)
          .select();
      }
    }

    if (result.error) {
      console.error('[Supabase Write Error]', result.error);
      throw result.error;
    }

    return res.status(200).json({
      success: true,
      message: "Global metrics synced."
    });

  } catch (error) {
    console.error('[API Error] /api/stream/metrics:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message, stack: error.stack });
  }
}
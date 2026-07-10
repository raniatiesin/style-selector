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
    
    // We only update the fields that the client sends to us.
    const updateData = { date: today, updated_at: new Date().toISOString() };
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
    if (Object.hasOwn(payload, 'isStreaming')) updateData.is_streaming = payload.isStreaming;
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

    // Check if there's an active stream from a previous day
    const { data: activeStreamData, error: activeStreamError } = await supabase
      .from('stream_metrics')
      .select('*')
      .eq('is_streaming', true)
      .single();

    let result;
    
    if (activeStreamData) {
      // Active stream found - update that record regardless of date
      // Don't change the date field to preserve continuity
      const updateDataWithoutDate = { ...updateData };
      delete updateDataWithoutDate.date;
      result = await supabase
        .from('stream_metrics')
        .update(updateDataWithoutDate)
        .eq('id', activeStreamData.id)
        .select();
    } else {
      // No active stream - check if a record exists for today
      const { data: existingRecord, error: checkError } = await supabase
        .from('stream_metrics')
        .select('*')
        .eq('date', today)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // Real error (not "no rows returned")
        throw checkError;
      }

      if (!existingRecord) {
        // No record exists for today - only create if this is a stream start OR pause state change
        if (payload.isStreaming === true || payload.isPaused !== undefined) {
          // Stream start with no record - create new record
          result = await supabase
            .from('stream_metrics')
            .insert(updateData)
            .select();
        } else {
          // Not a stream start and no pause state change - don't create a record
          return res.status(200).json({
            success: true,
            message: "No record created (not a stream start)."
          });
        }
      } else {
        // Record exists - update it
        result = await supabase
          .from('stream_metrics')
          .update(updateData)
          .eq('date', today)
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
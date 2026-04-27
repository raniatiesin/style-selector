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

    // Use local timezone (e.g. 'America/New_York' or browser-passed UTC offset) for day bounds
    // to strictly prevent 8PM UTC roll-overs
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).toISOString().split('T')[0];
    
    // We only update the fields that the client sends to us.
    const updateData = { date: today, updated_at: new Date().toISOString() };
    if (Object.hasOwn(payload, 'mode')) updateData.mode = payload.mode;
    if (Object.hasOwn(payload, 'contactedCount')) updateData.contacted_count = payload.contactedCount;
    if (Object.hasOwn(payload, 'convertedCount')) updateData.converted_count = payload.convertedCount;
    
    // NEW: Timestamp logic to fix timer drift and stale UI overwrites
    if (Object.hasOwn(payload, 'todayWorkSeconds')) updateData.today_seconds = payload.todayWorkSeconds;
    if (Object.hasOwn(payload, 'accumulatedTodaySeconds')) updateData.accumulated_today_seconds = payload.accumulatedTodaySeconds;
    if (Object.hasOwn(payload, 'modeTimestamp')) updateData.mode_timestamp = payload.modeTimestamp;
    
    if (Object.hasOwn(payload, 'accumulatedTotalSeconds')) updateData.accumulated_seconds = payload.accumulatedTotalSeconds;
    if (Object.hasOwn(payload, 'inProgressTasks')) updateData.in_progress_tasks = payload.inProgressTasks;
    if (Object.hasOwn(payload, 'inReviewTasks')) updateData.in_review_tasks = payload.inReviewTasks;
    if (Object.hasOwn(payload, 'upNextTasks')) updateData.up_next_tasks = payload.upNextTasks;
    if (Object.hasOwn(payload, 'doneTasks')) updateData.done_tasks = payload.doneTasks;

    const { data, error } = await supabase
      .from('stream_metrics')
      .upsert(updateData, { onConflict: 'date' });

    if (error) {
      console.error('[Supabase Write Error]', error);
      throw error;
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
export default async function handler(req, res) {
  // CORS configuration to allow OBS to securely read this endpoint
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or strict 'ms-browser-source://' if you want extreme OBS lock-down
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // High-Quality Cache Control: Tells Vercel edge networks not to cache this read
  // We want the absolute freshest data from the database every time OBS polls.
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');

  try {
    // IMPORTANT: Since Vercel Serverless has no "memory" (it destroys itself after every request),
    // we use your existing Supabase connection to act as the "notepad" passing the task to OBS.

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase credentials missing from Vercel Env variables.' });
    }

    // Dynamic import for Vercel Serverless environment
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use local timezone string to fetch correctly
    const todayStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const today = new Date(todayStr).toISOString().split('T')[0];
    
    // Fetch today's metrics
    const { data, error } = await supabase
      .from('stream_metrics')
      .select('*')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    const { count, error: countErr } = await supabase
      .from('stream_metrics')
      .select('*', { count: 'exact', head: true });

    // Calculate true accumulated time from PREVIOUS days (so today doesn't double count active ticking)
    const { data: pastRows } = await supabase
      .from('stream_metrics')
      .select('today_seconds, accumulated_seconds')
      .neq('date', today);
      
    let pastDaysAcc = 0;
    if (pastRows) {
      const hasManualBase = pastRows.find(r => r.accumulated_seconds > 0);
      if (hasManualBase) {
         pastDaysAcc = Math.max(...pastRows.map(r => r.accumulated_seconds || 0));
      } else {
         pastDaysAcc = pastRows.reduce((acc, row) => acc + (row.today_seconds || 0), 0);
      }
    }

    // Allow today's row to completely override previous days if explicitly manually set today
    if (data && data.accumulated_seconds > 0) {
        // Because the frontend calculates total as (previousDaysSeconds + todayWorkSeconds),
        // we set pastDaysAcc = accumulated - today, so it adds up perfectly to the user's manual value.
        pastDaysAcc = Math.max(0, data.accumulated_seconds - (data.today_seconds || 0));
    }

    let globalMetrics = null;
    let tasks = [];
    let webhookLogs = [];

    if (data) {
       // If currently in an active ticking mode, explicitly calculate the un-pushed elapsed time.
       // This guarantees data isn't lost if the stream crashes before a break causes an accumulated log.
       let activeOffset = 0;
       if (data.mode === 'work' || data.mode === 'explain') {
           const timestamp = data.mode_timestamp || Date.now();
           activeOffset = Math.floor((Date.now() - timestamp) / 1000);
           // Fallback to avoid negative values
           if (activeOffset < 0) activeOffset = 0;
       }

       globalMetrics = {
          mode: data.mode,
          contactedCount: data.contacted_count,
          convertedCount: data.converted_count,
          previousDaysSeconds: pastDaysAcc,
          todayWorkSeconds: (data.accumulated_today_seconds ?? data.today_seconds ?? 0) + activeOffset,
          
          // Pure timestamp states back to frontend
          accumulatedTodaySeconds: data.accumulated_today_seconds ?? data.today_seconds ?? 0,
          modeTimestamp: data.mode_timestamp,

          totalDays: count || 1
       };
       webhookLogs = data.webhook_logs || [];
       // Combine the arrays for the frontend logic if needed
       tasks = [
         ...(data.in_progress_tasks || []),
         ...(data.in_review_tasks || []),
         ...(data.up_next_tasks || []),
         ...(data.done_tasks || [])
       ];
    } else {
        // If no rows for today, still return the global accumulations
        globalMetrics = {
            mode: 'work',
            contactedCount: 0,
            convertedCount: 0,
            previousDaysSeconds: pastDaysAcc,
            todayWorkSeconds: 0,
            accumulatedTodaySeconds: 0,
            modeTimestamp: Date.now(),
            totalDays: count ? count + 1 : 1
        };
    }

    return res.status(200).json({
      success: true,
      timestamp: Date.now(),
      tasks: tasks,
      webhookLogs: webhookLogs,
      metrics: globalMetrics
    });

  } catch (error) {
    console.error('[API Error] /api/stream/state:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

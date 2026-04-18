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

const today = new Date().toISOString().split('T')[0];
    
    // Fetch today's metrics
    const { data, error } = await supabase
      .from('stream_metrics')
      .select('*')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    let globalMetrics = null;
    let tasks = [];
    let webhookLogs = [];

    if (data) {
       globalMetrics = {
          mode: data.mode,
          contactedCount: data.contacted_count,
          convertedCount: data.converted_count,
          accumulatedTotalSeconds: data.accumulated_seconds,
          todayWorkSeconds: data.today_seconds,
       };
       webhookLogs = data.webhook_logs || [];
       // Combine the arrays for the frontend logic if needed
       tasks = [
         ...(data.in_progress_tasks || []),
         ...(data.in_review_tasks || []),
         ...(data.up_next_tasks || []),
         ...(data.done_tasks || [])
       ];
    }

    return res.status(200).json({
      success: true,
      timestamp: Date.now(),
      tasks: tasks,
      webhookLogs: webhookLogs,
      metrics: globalMetrics || { mode: 'work', contactedCount: 0, convertedCount: 0 }
    });

  } catch (error) {
    console.error('[API Error] /api/stream/state:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

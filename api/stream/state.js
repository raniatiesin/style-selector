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

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase credentials missing from Vercel Env variables.' });
    }

    // Dynamic import for Vercel Serverless environment
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the single most recent active task state from a dedicated table
    const { data, error } = await supabase
      .from('overlay')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50); // Grabs the 50 most recent updates so metrics won't fall off the list

    if (error) throw error;

    let tasks = [];
    let globalMetrics = null;

    if (data && data.length > 0) {
       for (let row of data) {
         if (row.id === "global_metrics") {
            try {
              // Parse the JSON.stringify payload from the metrics endpoint
              globalMetrics = JSON.parse(row.name);
            } catch (e) {
              globalMetrics = null;
            }
         } else {
            tasks.push(row);
         }
       }
    }

    return res.status(200).json({
      success: true,
      timestamp: Date.now(),
      tasks: tasks,
      metrics: globalMetrics
    });

  } catch (error) {
    console.error('[API Error] /api/stream/state:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

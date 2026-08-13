/**
 * GET /api/grossgauntlet/tasks/:streamNumber
 * Returns task board columns for a session by stream_number.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase credentials missing from Vercel Env variables.' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const streamNumber = parseInt(req.query.streamNumber, 10);
    if (isNaN(streamNumber) || streamNumber < 1) {
      return res.status(400).json({ error: 'Invalid stream number' });
    }

    const { data, error } = await supabase
      .from('GrossGauntlet')
      .select('*')
      .eq('stream_number', streamNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: `Session ${streamNumber} not found` });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: data.id,
        title: data.title || `Session ${streamNumber}`,
        stream_number: data.stream_number,
        date: data.date,
        up_next_tasks: data.up_next_tasks || [],
        in_progress_tasks: data.in_progress_tasks || [],
        in_review_tasks: data.in_review_tasks || [],
        done_tasks: data.done_tasks || [],
      },
    });

  } catch (error) {
    console.error('[API Error] /api/grossgauntlet/tasks/:streamNumber:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

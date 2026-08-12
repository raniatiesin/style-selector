/**
 * GET /api/grossgauntlet/logs/:logNumber
 * Returns a specific log record by its 1-based index (ordered by date descending).
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

    const logNumber = parseInt(req.query.logNumber, 10);
    if (isNaN(logNumber) || logNumber < 1) {
      return res.status(400).json({ error: 'Invalid log number' });
    }

    // Fetch all records ordered by date descending, then pick the one at index (logNumber - 1)
    const { data, error } = await supabase
      .from('GrossGauntlet')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No logs found' });
    }

    const index = logNumber - 1;
    if (index >= data.length) {
      return res.status(404).json({ error: `Log ${logNumber} not found` });
    }

    const record = data[index];

    // Extract sessions from the record's task arrays
    const sessions = [];
    const allTasks = [
      ...(record.in_progress_tasks || []),
      ...(record.in_review_tasks || []),
      ...(record.up_next_tasks || []),
      ...(record.done_tasks || [])
    ];

    // Create a session entry for this record
    sessions.push({
      stream_number: record.stream_number || 1,
      title: record.title || `Stream ${record.stream_number || 1}`,
      subtitle: record.timestamps || '',
      tasks: allTasks,
      metrics: {
        todaySeconds: record.today_seconds || 0,
        contentCount: record.content_count ?? 0,
        salesCount: record.sales_count ?? 0,
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        id: record.id,
        date: record.date,
        title: record.title || `Log ${logNumber}`,
        subtitle: record.timestamps || '',
        timestamps: record.timestamps || '',
        created_at: record.created_at || record.updated_at,
        sessions
      }
    });

  } catch (error) {
    console.error('[API Error] /api/grossgauntlet/logs/:logNumber:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
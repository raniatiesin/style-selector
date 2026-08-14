export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { date, sessionNumber } = req.query;

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: logs, error } = await supabase
      .from('Logs')
      .select('*')
      .eq('session_date', date)
      .eq('session_number', sessionNumber)
      .order('occurred_at', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ success: true, events: logs ?? [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

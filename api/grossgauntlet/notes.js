export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase credentials missing.' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dayNumber, sessionNumber, notes } = req.body;

    if (!dayNumber || !sessionNumber) {
      return res.status(400).json({ error: 'dayNumber and sessionNumber are required' });
    }

    // Resolve dayNumber to date
    const startDate = new Date('2026-08-15');
    const targetDate = new Date(startDate);
    targetDate.setDate(targetDate.getDate() + (Number(dayNumber) - 1));
    const dateStr = targetDate.toISOString().split('T')[0];

    const { error } = await supabase
      .from('Sessions')
      .update({ notes: notes ?? '' })
      .eq('date', dateStr)
      .eq('session_number', sessionNumber);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
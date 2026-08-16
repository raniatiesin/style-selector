export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { dayNumber } = req.query;

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve dayNumber to date
    const startDate = new Date('2026-08-15');
    const targetDate = new Date(startDate);
    targetDate.setDate(targetDate.getDate() + (Number(dayNumber) - 1));
    const dateStr = targetDate.toISOString().split('T')[0];

    const { data: sessions, error } = await supabase
      .from('Sessions')
      .select('*')
      .eq('date', dateStr)
      .order('session_number', { ascending: true });

    if (error) throw error;
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({ error: 'No sessions found for day' });
    }

    return res.status(200).json({
      date: dateStr,
      dayNumber: Number(dayNumber),
      sessions: sessions.map(s => ({
        ...s,
        session_number: s.session_number,
        title: s.title || `Day ${dayNumber} — Session ${s.session_number}`,
      }))
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
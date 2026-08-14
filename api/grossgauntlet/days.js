export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
       return res.status(500).json({ error: 'Supabase credentials missing.' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: sessions, error } = await supabase
      .from('Sessions')
      .select('date, session_number, title, today_seconds, is_streaming, stream_url')
      .order('date', { ascending: false })
      .order('session_number', { ascending: false });

    if (error) throw error;

    const { data: logs, error: logsError } = await supabase
      .from('Logs')
      .select('session_date, session_number, event_type, to_column, from_column, task_id');
      
    if (logsError) throw logsError;

    const sessionLogsMap = {};
    for (const log of (logs || [])) {
        const key = `${log.session_date}_${log.session_number}`;
        if (!sessionLogsMap[key]) sessionLogsMap[key] = [];
        sessionLogsMap[key].push(log);
    }
    
    function countDone(sessionLogs) {
        let doneTasks = new Set();
        let otherTasks = new Set();
        for (const ev of sessionLogs) {
            if (ev.event_type === 'create') {
                if (ev.to_column === 'done') doneTasks.add(ev.task_id);
                else otherTasks.add(ev.task_id);
            } else if (ev.event_type === 'move') {
                if (ev.to_column === 'done') {
                    otherTasks.delete(ev.task_id);
                    doneTasks.add(ev.task_id);
                } else if (ev.from_column === 'done') {
                    doneTasks.delete(ev.task_id);
                    otherTasks.add(ev.task_id);
                }
            } else if (ev.event_type === 'delete') {
                doneTasks.delete(ev.task_id);
                otherTasks.delete(ev.task_id);
            }
        }
        return doneTasks.size;
    }

    const grouped = {};
    for (const session of (sessions || [])) {
      if (!grouped[session.date]) {
        const dayNum = Math.floor((new Date(session.date) - new Date('2026-08-15')) / 86400000) + 1;
        grouped[session.date] = {
          date: session.date,
          dayNumber: dayNum,
          sessions: []
        };
      }
      
      const key = `${session.date}_${session.session_number}`;
      const doneCount = countDone(sessionLogsMap[key] || []);
      
      grouped[session.date].sessions.push({
        ...session,
        done_count: doneCount
      });
    }

    const result = Object.values(grouped);

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

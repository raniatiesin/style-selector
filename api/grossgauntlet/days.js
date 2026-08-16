export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { dayNumber, sessionNumber, events } = req.query;

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
       return res.status(500).json({ error: 'Supabase credentials missing.' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve dayNumber to date
    function dayNumberToDate(dn) {
      const startDate = new Date('2026-08-15');
      const targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + (Number(dn) - 1));
      return targetDate.toISOString().split('T')[0];
    }

    // ── Pattern: events=true (must have dayNumber + sessionNumber) ──
    if (events === 'true' && dayNumber && sessionNumber) {
      const dateStr = dayNumberToDate(dayNumber);
      const { data: logs, error } = await supabase
        .from('Logs')
        .select('*')
        .eq('session_date', dateStr)
        .eq('session_number', sessionNumber)
        .order('occurred_at', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ success: true, events: logs ?? [] });
    }

    // ── Pattern: dayNumber + sessionNumber (single session + folded board) ──
    if (dayNumber && sessionNumber) {
      const dateStr = dayNumberToDate(dayNumber);

      const { data: session, error } = await supabase
        .from('Sessions')
        .select('*')
        .eq('date', dateStr)
        .eq('session_number', sessionNumber)
        .single();

      if (error) throw error;
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const { data: logs, error: logsError } = await supabase
        .from('Logs')
        .select('*')
        .eq('session_date', dateStr)
        .eq('session_number', sessionNumber)
        .order('occurred_at', { ascending: true });

      if (logsError) throw logsError;

      const board = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };

      function removeFromBoard(b, taskId) {
        for (const col of ['todo', 'up_next', 'in_progress', 'in_review', 'done']) {
          const idx = b[col].findIndex(t => String(t.id) === String(taskId));
          if (idx !== -1) return b[col].splice(idx, 1)[0];
        }
        return null;
      }

      function updateInBoard(b, taskId, updates) {
        for (const col of ['todo', 'up_next', 'in_progress', 'in_review', 'done']) {
          const idx = b[col].findIndex(t => String(t.id) === String(taskId));
          if (idx !== -1) { Object.assign(b[col][idx], updates); return true; }
        }
        return false;
      }

      if (logs) {
        for (const event of logs) {
          const toCol = event.to_column || 'todo';
          if (!board[toCol]) board[toCol] = [];
          if (event.event_type === 'create') {
            board[toCol].push({ id: event.task_id, name: event.payload?.name || 'Untitled', createdAt: event.occurred_at });
          } else if (event.event_type === 'move') {
            const task = removeFromBoard(board, event.task_id);
            if (task) {
              if (!board[toCol]) board[toCol] = [];
              board[toCol].push(task);
            }
          } else if (event.event_type === 'rename') {
            updateInBoard(board, event.task_id, { name: event.payload?.new });
          } else if (event.event_type === 'delete') {
            removeFromBoard(board, event.task_id);
          }
        }
      }

      return res.status(200).json({ session, board });
    }

    // ── Pattern: dayNumber only (all sessions for a day) ──
    if (dayNumber) {
      const dateStr = dayNumberToDate(dayNumber);

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
    }

    // ── Pattern: no params (all days grouped, existing behavior) ──
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
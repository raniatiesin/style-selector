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

    const { data: session, error } = await supabase
      .from('Sessions')
      .select('*')
      .eq('date', date)
      .eq('session_number', sessionNumber)
      .single();

    if (error) throw error;
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { data: logs, error: logsError } = await supabase
      .from('Logs')
      .select('*')
      .eq('session_date', date)
      .eq('session_number', sessionNumber)
      .order('occurred_at', { ascending: true });

    if (logsError) throw logsError;

    const board = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };
    
    function removeFromBoard(board, taskId) {
      for (const col of ['todo', 'up_next', 'in_progress', 'in_review', 'done']) {
        const idx = board[col].findIndex(t => String(t.id) === String(taskId));
        if (idx !== -1) return board[col].splice(idx, 1)[0];
      }
      return null;
    }

    function updateInBoard(board, taskId, updates) {
      for (const col of ['todo', 'up_next', 'in_progress', 'in_review', 'done']) {
        const idx = board[col].findIndex(t => String(t.id) === String(taskId));
        if (idx !== -1) {
          Object.assign(board[col][idx], updates);
          return true;
        }
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

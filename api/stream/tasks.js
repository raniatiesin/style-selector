export default async function handler(req, res) {
  // CORS Security
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); 

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Same Secret Auth Lock
  const WEBHOOK_SECRET = process.env.OVERLAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || process.env.STREAM_ADMIN_KEY;

  if (!WEBHOOK_SECRET) {
    return res.status(500).json({ error: "Missing Secret" });
  }

  const authHeader = req.headers.authorization || req.headers['x-api-key'] || '';
  
  let isValidAuth = false;
  if (authHeader.includes(WEBHOOK_SECRET)) isValidAuth = true;
  if (req.method !== 'GET' && req.body && req.body.secret === WEBHOOK_SECRET) isValidAuth = true;
  if (req.query && req.query.secret === WEBHOOK_SECRET) isValidAuth = true;

  if (!isValidAuth) {
    return res.status(401).json({ error: "Unauthorized access blocked. Secret mismatch or missing." });     
  }

  try {
    let body = req.body;
    if (typeof body === 'object' && Object.keys(body).length === 0) {
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => raw += chunk);
        req.on('end', () => resolve(raw));
      });
    }
    
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    
    const payload = req.method === 'DELETE' ? (Object.keys(body || {}).length ? body : req.query) : body;
    let { action, taskId, toColumn, fromColumn, name, oldName, newName, inProgressTasks, inReviewTasks, upNextTasks, doneTasks } = payload || {};

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find active session
    const { data: activeSession } = await supabase
      .from('Sessions')
      .select('*')
      .eq('is_streaming', true)
      .single();

    let session = activeSession;
    if (!session) {
      const { data: recentSession } = await supabase
        .from('Sessions')
        .select('*')
        .order('date', { ascending: false })
        .order('session_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      session = recentSession;
    }

    if (!session) {
      return res.status(404).json({ error: "No session found to perform task actions." });
    }

    const sDate = session.date;
    const sNum = session.session_number;

    if (action === 'sync') {
      // Delete all existing logs for this session
      await supabase.from('Logs').delete().eq('session_date', sDate).eq('session_number', sNum);
      
      const insertLogs = [];
      const now = new Date().toISOString();
      const createEvent = (task, col) => ({
        session_date: sDate,
        session_number: sNum,
        task_id: String(task.id),
        event_type: 'create',
        to_column: col,
        payload: { name: task.name || task.task || 'Untitled' },
        occurred_at: task.createdAt ? new Date(task.createdAt).toISOString() : now
      });

      (inProgressTasks || []).forEach(t => insertLogs.push(createEvent(t, 'in_progress')));
      (inReviewTasks || []).forEach(t => insertLogs.push(createEvent(t, 'in_review')));
      (upNextTasks || []).forEach(t => insertLogs.push(createEvent(t, 'up_next')));
      (doneTasks || []).forEach(t => insertLogs.push(createEvent(t, 'done')));

      if (insertLogs.length > 0) {
        await supabase.from('Logs').insert(insertLogs);
      }
    } else {
      if (!taskId) taskId = String(Date.now());
      
      const logEntry = {
        session_date: sDate,
        session_number: sNum,
        task_id: String(taskId),
        event_type: action,
        occurred_at: new Date().toISOString()
      };

      if (action === 'create') {
        logEntry.to_column = toColumn || 'todo';
        logEntry.payload = { name: name };
      } else if (action === 'move') {
        logEntry.from_column = fromColumn;
        logEntry.to_column = toColumn;
      } else if (action === 'rename') {
        logEntry.payload = { old: oldName, new: newName };
      } else if (action === 'delete') {
        // No payload needed
      }

      const { error: insertErr } = await supabase.from('Logs').insert(logEntry);
      if (insertErr) throw insertErr;
    }

    // Refold logs
    const { data: logs } = await supabase
      .from('Logs')
      .select('*')
      .eq('session_date', sDate)
      .eq('session_number', sNum)
      .order('occurred_at', { ascending: true });

    const board = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };
    
    function removeFromBoard(board, tId) {
      for (const col of ['todo', 'up_next', 'in_progress', 'in_review', 'done']) {
        const idx = board[col].findIndex(t => String(t.id) === String(tId));
        if (idx !== -1) return board[col].splice(idx, 1)[0];
      }
      return null;
    }
    function updateInBoard(board, tId, updates) {
      for (const col of ['todo', 'up_next', 'in_progress', 'in_review', 'done']) {
        const idx = board[col].findIndex(t => String(t.id) === String(tId));
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

    return res.status(200).json({
      success: true,
      message: `Task action '${action}' processed.`,
      board
    });

  } catch (error) {
    console.error('[API Error] /api/stream/tasks:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
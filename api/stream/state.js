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

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

    const { data: activeStreamData } = await supabase
      .from('Sessions')
      .select('*')
      .eq('is_streaming', true)
      .maybeSingle();

    let session = null;

    if (activeStreamData) {
      session = activeStreamData;
    } else {
      // No active stream. Fall back to the absolute latest session across all dates.
      const { data: recentSession } = await supabase
        .from('Sessions')
        .select('*')
        .order('date', { ascending: false })
        .order('session_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentSession) {
        session = recentSession;
      }
    }

    const { data: dateRows } = await supabase
      .from('Sessions')
      .select('date');
    const uniqueDates = new Set(dateRows?.map(r => r.date) || []);
    const count = uniqueDates.size || 1;

    const { data: pastRows } = await supabase
      .from('Sessions')
      .select('date, today_seconds')
      .neq('date', today);
      
    let pastDaysAcc = 0;
    if (pastRows && pastRows.length > 0) {
      const dailyMax = {};
      for (const row of pastRows) {
         if (!dailyMax[row.date] || row.today_seconds > dailyMax[row.date]) {
             dailyMax[row.date] = row.today_seconds || 0;
         }
      }
      pastDaysAcc = Object.values(dailyMax).reduce((a, b) => a + b, 0);
    }

    let globalMetrics = null;
    let board = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };

    if (session) {
       const { data: logs } = await supabase
          .from('TaskLogs')
          .select('*')
          .eq('session_date', session.date)
          .eq('session_number', session.session_number)
          .order('occurred_at', { ascending: true });

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

       let activeOffset = 0;
       const isStreaming = session.is_streaming === true;
       const normalizedMode = session.mode === 'play' || session.mode === 'minecraft' ? 'work' : session.mode;
         if (normalizedMode === 'work' && isStreaming) {
           const timestamp = session.mode_timestamp || session.session_start_timestamp || Date.now();
           activeOffset = Math.floor((Date.now() - timestamp) / 1000);
           if (activeOffset < 0) activeOffset = 0;
       }

       globalMetrics = {
           mode: normalizedMode,
           isStreaming: session.is_streaming === true,
           isPaused: session.is_paused === true,
           accumulatedTodaySeconds: session.today_seconds ?? 0,
           previousDaysSeconds: pastDaysAcc,
            modeTimestamp: session.mode_timestamp ?? session.session_start_timestamp ?? Date.now(),
           sessionStartTimestamp: session.session_start_timestamp,
           contentCount: session.content_count ?? 0,
           salesCount: session.sales_count ?? 0,
           sessionNumber: session.session_number ?? 1,
           date: session.date,
           title: session.title,
           standbySelection: session.standby_selection ?? 'Coming Soon',
           timestamps: session.timestamps ?? '',
           totalDays: count,
           pausedTimestamp: session.paused_timestamp ?? null,
           streamNumber: session.session_number ?? 1,
           totalGross: session.total_gross ?? 0,
           alphaGross: session.alpha_gross ?? 0
       };
    } else {
        globalMetrics = {
            mode: 'work',
            isStreaming: false,
            isPaused: false,
            accumulatedTodaySeconds: 0,
            totalGross: 0,
            alphaGross: 0,
            previousDaysSeconds: pastDaysAcc,
            modeTimestamp: null,
            sessionStartTimestamp: null,
            contentCount: 0,
            salesCount: 0,
            sessionNumber: 1,
            date: today,
            title: null,
            standbySelection: 'Coming Soon',
            timestamps: '',
            totalDays: count,
            pausedTimestamp: null,
            streamNumber: 1
        };
    }

    // ── Always fold in NULL-session TaskLogs (offline prep work) ──
    {
       const { data: nullLogs } = await supabase
          .from('TaskLogs')
          .select('*')
          .is('session_date', null)
          .is('session_number', null)
          .order('occurred_at', { ascending: true });

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

       if (nullLogs) {
         for (const event of nullLogs) {
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
    }

    const flattenedTasks = [
      ...(board.in_progress || []).map(t => ({ ...t, status: 'in_progress' })),
      ...(board.up_next || []).map(t => ({ ...t, status: 'up_next' })),
      ...(board.in_review || []).map(t => ({ ...t, status: 'in_review' })),
      ...(board.todo || []).map(t => ({ ...t, status: 'todo' })),
      ...(board.done || []).map(t => ({ ...t, status: 'done' })),
    ];

    return res.status(200).json({
      success: true,
      timestamp: Date.now(),
      board: board,
      metrics: globalMetrics,
      tasks: flattenedTasks,
      webhookLogs: []
    });

  } catch (error) {
    console.error('[API Error] /api/stream/state:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
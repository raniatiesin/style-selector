/* ============================================================
   /api/stream/state — /now page poll endpoint.
   Returns ALL undone cards (todo|up_next|in_progress|in_review)
   from ALL sessions/days in the ENTIRE TaskLogs table.
   Done cards are EXCLUDED from the board response.
   ============================================================ */

function foldAll(logs) {
  const b = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };
  if (!Array.isArray(logs)) return b;
  for (const ev of logs) {
    const tc = ev.to_column || 'todo';
    if (!b[tc]) b[tc] = [];
    if (ev.event_type === 'create') b[tc].push({ id: ev.task_id, name: ev.payload?.name || 'Untitled', createdAt: ev.occurred_at });
    else if (ev.event_type === 'move') {
      let task = null;
      for (const c of Object.keys(b)) { const i = b[c].findIndex(t => String(t.id) === String(ev.task_id)); if (i !== -1) { task = b[c].splice(i, 1)[0]; break; } }
      if (task) (b[tc] || []).push(task);
    }
    else if (ev.event_type === 'rename') { for (const c of Object.keys(b)) { const t = b[c].find(t => String(t.id) === String(ev.task_id)); if (t) { t.name = ev.payload?.new; break; } } }
    else if (ev.event_type === 'delete') { for (const c of Object.keys(b)) { const i = b[c].findIndex(t => String(t.id) === String(ev.task_id)); if (i !== -1) { b[c].splice(i, 1); break; } } }
  }
  return b;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase credentials missing' });
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

    const { data: activeSesh } = await supabase.from('Sessions').select('*').eq('is_streaming', true).maybeSingle();
    let session = activeSesh;
    if (!session) {
      const { data: recent } = await supabase.from('Sessions').select('*').order('date', { ascending: false }).order('session_number', { ascending: false }).limit(1).maybeSingle();
      session = recent;
    }

    const { data: dateRows } = await supabase.from('Sessions').select('date');
    const uniqueDates = new Set(dateRows?.map(r => r.date) || []);
    const count = uniqueDates.size || 1;
    const { data: pastRows } = await supabase.from('Sessions').select('date, today_seconds').neq('date', today);
    let pastDaysAcc = 0;
    if (pastRows && pastRows.length > 0) {
      const dailyMax = {};
      for (const row of pastRows) { if (!dailyMax[row.date] || row.today_seconds > dailyMax[row.date]) dailyMax[row.date] = row.today_seconds || 0; }
      pastDaysAcc = Object.values(dailyMax).reduce((a, b) => a + b, 0);
    }

    /* ── Fold ALL TaskLogs across EVERY session/date ── */
    const { data: allLogs } = await supabase.from('TaskLogs').select('*').order('occurred_at', { ascending: true });
    const fullB = foldAll(allLogs || []);

    /* Strip done column — the /now page shows only undone cards */
    const board = { todo: fullB.todo || [], up_next: fullB.up_next || [], in_progress: fullB.in_progress || [], in_review: fullB.in_review || [], done: [] };

    const metrics = session ? {
      mode: (session.mode === 'play' || session.mode === 'minecraft') ? 'work' : (session.mode || 'work'),
      isStreaming: session.is_streaming === true,
      isPaused: session.is_paused === true,
      accumulatedTodaySeconds: session.today_seconds ?? 0,
      previousDaysSeconds: pastDaysAcc,
      modeTimestamp: session.mode_timestamp ?? session.session_start_timestamp ?? Date.now(),
      sessionStartTimestamp: session.session_start_timestamp,
      contentCount: session.content_count ?? 0,
      salesCount: session.sales_count ?? 0,
      sessionNumber: session.session_number ?? 1,
      date: session.date, title: session.title,
      standbySelection: session.standby_selection ?? 'Coming Soon',
      timestamps: session.timestamps ?? '',
      totalDays: count,
      pausedTimestamp: session.paused_timestamp ?? null,
      streamNumber: session.session_number ?? 1,
      totalGross: session.total_gross ?? 0,
      alphaGross: session.alpha_gross ?? 0
    } : {
      mode: 'work', isStreaming: false, isPaused: false,
      accumulatedTodaySeconds: 0, totalGross: 0, alphaGross: 0,
      previousDaysSeconds: pastDaysAcc, modeTimestamp: null,
      sessionStartTimestamp: null, contentCount: 0, salesCount: 0,
      sessionNumber: 1, date: today, title: null,
      standbySelection: 'Coming Soon', timestamps: '',
      totalDays: count, pausedTimestamp: null, streamNumber: 1
    };

    return res.status(200).json({
      success: true, timestamp: Date.now(),
      board, metrics,
      tasks: [...board.in_progress.map(t=>({...t,status:'in_progress'})), ...board.up_next.map(t=>({...t,status:'up_next'})), ...board.in_review.map(t=>({...t,status:'in_review'})), ...board.todo.map(t=>({...t,status:'todo'}))],
      webhookLogs: []
    });

  } catch (error) {
    console.error('[API Error] /api/stream/state:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
/* ============================================================
   /api/stream/tasks — Bulletproof task action endpoint
   • Handles null / empty / string body safely
   • Exact-match auth (no substring)
   • Folds BOTH session-specific AND null-session TaskLogs
     so offline-created cards are always returned.
   ============================================================ */

function extractBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
  });
}

function foldBoard(logs) {
  const b = { todo: [], up_next: [], in_progress: [], in_review: [], done: [] };
  if (!Array.isArray(logs)) return b;
  function rm(b2, tid) {
    for (const c of Object.keys(b2)) {
      const i = b2[c].findIndex(t => String(t.id) === String(tid));
      if (i !== -1) return b2[c].splice(i, 1)[0];
    }
    return null;
  }
  function up(b2, tid, u) {
    for (const c of Object.keys(b2)) {
      const i = b2[c].findIndex(t => String(t.id) === String(tid));
      if (i !== -1) { Object.assign(b2[c][i], u); return true; }
    }
    return false;
  }
  for (const ev of logs) {
    const tc = ev.to_column || 'todo';
    if (!b[tc]) b[tc] = [];
    switch (ev.event_type) {
      case 'create':
        b[tc].push({ id: ev.task_id, name: ev.payload?.name || 'Untitled', createdAt: ev.occurred_at });
        break;
      case 'move': { const t = rm(b, ev.task_id); if (t) b[tc].push(t); break; }
      case 'rename': up(b, ev.task_id, { name: ev.payload?.new }); break;
      case 'delete': rm(b, ev.task_id); break;
    }
  }
  return b;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Api-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = process.env.OVERLAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || process.env.STREAM_ADMIN_KEY;
  if (!secret) return res.status(500).json({ error: 'Missing server secret' });

  const body = await extractBody(req);
  const authH = req.headers.authorization || req.headers['x-api-key'] || '';
  const ok = authH === `Bearer ${secret}` || authH === secret || body?.secret === secret || req.query?.secret === secret;
  if (!ok) return res.status(401).json({ error: 'Unauthorized — invalid secret' });

  try {
    const { action, taskId, toColumn, fromColumn, name, oldName, newName } = body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    /* Resolve session */
    const { data: activeSesh } = await supabase
      .from('Sessions').select('*').eq('is_streaming', true).maybeSingle();

    let sesh = activeSesh;
    if (!sesh) {
      const { data: recent } = await supabase
        .from('Sessions').select('*')
        .order('date', { ascending: false }).order('session_number', { ascending: false })
        .limit(1).maybeSingle();
      sesh = recent;
    }

    const logDate = activeSesh && sesh ? sesh.date : null;
    const logNum  = activeSesh && sesh ? sesh.session_number : null;

    /* Insert log */
    const entry = {
      session_date: logDate, session_number: logNum,
      task_id: String(taskId || Date.now()),
      event_type: action || 'create',
      occurred_at: new Date().toISOString()
    };
    if (action === 'create') { entry.to_column = toColumn || 'todo'; entry.payload = { name: name || 'Untitled' }; }
    else if (action === 'move') { entry.from_column = fromColumn; entry.to_column = toColumn; }
    else if (action === 'rename') { entry.payload = { old: oldName, new: newName }; }

    const { error: ie } = await supabase.from('TaskLogs').insert(entry);
    if (ie) throw ie;

    /* Refold session logs + null-session logs */
    let seshLogs = [];
    if (sesh) {
      const { data: a } = await supabase.from('TaskLogs').select('*')
        .eq('session_date', sesh.date).eq('session_number', sesh.session_number)
        .order('occurred_at', { ascending: true });
      seshLogs = a || [];
    }
    const { data: b } = await supabase.from('TaskLogs').select('*')
      .is('session_date', null).is('session_number', null)
      .order('occurred_at', { ascending: true });

    const board = foldBoard([...seshLogs, ...(b || [])]);

    return res.status(200).json({
      success: true,
      message: `Task action '${action || 'create'}' processed.`,
      board,
      sessionBoard: foldBoard(seshLogs),
      logCount: { session: seshLogs.length, nullSession: (b || []).length }
    });

  } catch (error) {
    console.error('[API Error] /api/stream/tasks:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
/* ============================================================
   /api/stream/tasks — Write endpoint for the /now page.
   All tasks are written as null-session logs.
   After each action, returns ALL undone cards from
   ENTIRE TaskLogs table. Done cards excluded.
   forceDelete/forceMove for purging ghost entries.
   ============================================================ */

function extractBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) return req.body;
  return new Promise((resolve) => { let r = ''; req.on('data', c => r += c); req.on('end', () => { try { resolve(JSON.parse(r)); } catch { resolve({}); } }); });
}

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

    /* ── forceDelete: PURGE ALL rows for this task_id ── */
    if (action === 'forceDelete') {
      const { data: purged } = await supabase.from('TaskLogs').delete().eq('task_id', String(taskId)).select();
      return res.status(200).json({ success: true, message: `Force-purged ${purged?.length || 0} entries.`, board: { todo: [], up_next: [], in_progress: [], in_review: [], done: [] }, purgedCount: purged?.length || 0 });
    }

    /* ── forceMove: update ALL events to target column ── */
    if (action === 'forceMove') {
      if (!toColumn) return res.status(400).json({ error: 'toColumn required' });
      await supabase.from('TaskLogs').update({ to_column: toColumn, from_column: fromColumn || null }).eq('task_id', String(taskId)).eq('event_type', 'move');
      await supabase.from('TaskLogs').update({ to_column: toColumn }).eq('task_id', String(taskId)).eq('event_type', 'create');
      const { data: allL } = await supabase.from('TaskLogs').select('*').order('occurred_at', { ascending: true });
      const fb = foldAll(allL || []);
      return res.status(200).json({ success: true, message: `Force-moved ${taskId} to ${toColumn}.`, board: { todo: fb.todo, up_next: fb.up_next, in_progress: fb.in_progress, in_review: fb.in_review, done: [] } });
    }

    /* ── Normal actions ── */
    const entry = { session_date: null, session_number: null, task_id: String(taskId || Date.now()), event_type: action || 'create', occurred_at: new Date().toISOString() };
    if (action === 'create') { entry.to_column = toColumn || 'todo'; entry.payload = { name: name || 'Untitled' }; }
    else if (action === 'move') { entry.from_column = fromColumn; entry.to_column = toColumn; }
    else if (action === 'rename') { entry.payload = { old: oldName, new: newName }; }

    const { error: ie } = await supabase.from('TaskLogs').insert(entry);
    if (ie) throw ie;

    /* ── Refold ALL logs across every session + null-session ── */
    const { data: allL2 } = await supabase.from('TaskLogs').select('*').order('occurred_at', { ascending: true });
    const fullB = foldAll(allL2 || []);
    const board = { todo: fullB.todo || [], up_next: fullB.up_next || [], in_progress: fullB.in_progress || [], in_review: fullB.in_review || [], done: [] };

    return res.status(200).json({ success: true, message: `Task '${action || 'create'}' processed.`, board, logCount: allL2?.length || 0 });

  } catch (error) {
    console.error('[API Error] /api/stream/tasks:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
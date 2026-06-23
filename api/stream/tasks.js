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
  const WEBHOOK_SECRET = process.env.OVERLAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;

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

  if (req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: `Method Not Allowed. Passed method: ${req.method}` });
  }

  try {
    let body = req.body;
    
    // Vercel failed to parse body, get raw string
    if (typeof body === 'object' && Object.keys(body).length === 0) {
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => raw += chunk);
        req.on('end', () => resolve(raw));
      });
    }
    
    if (typeof body === 'string') {
      body = body.replace(/:\s*([\d]{4}-[\d]{2}-[\d]{2}T[^\s,}\]]+)/g, ': "$1"');
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    
    console.error('[DEBUG]', JSON.stringify(req.body));
    
    const payload = req.method === 'DELETE' ? (Object.keys(body || {}).length ? body : req.query) : body;
    let { id, task, status, time, action, inProgressTasks, doneTasks, due_date, dueDate, due } = payload || {};
    
    // Clean up null/undefined string values
    if (id === "null" || id === "undefined") id = null;
    if (task === "null" || task === "undefined") task = null;
    if (status === "null" || status === "undefined") status = null;
    if (time === "null" || time === "undefined") time = null;
    if (due_date === "null" || due_date === "undefined") due_date = null;
    if (dueDate === "null" || dueDate === "undefined") dueDate = null;
    if (due === "null" || due === "undefined") due = null;
    
    // Task name fallback
    task = task || payload?.name || payload?.title || payload?.subject;
    
    // Status field fallback
    status = status || payload?.type || payload?.state;

    // Fallback to headers if n8n forces you to send them there for DELETE requests
    id = id || req.headers['id'] || req.headers['x-task-id'];
    action = action || req.headers['action'] || req.headers['x-action'];

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // FIX: Align the database 'date' string format calculation with the state poll 
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

    // Fetch the current task arrays so we can dynamically modify them
    const { data, error: fetchError } = await supabase
      .from('stream_metrics')
      .select('in_progress_tasks, in_review_tasks, up_next_tasks, done_tasks, webhook_logs')
      .eq('date', today)
      .single();

    // Ignore PGRST116 (No rows) because we are about to upsert
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let inProgress = data?.in_progress_tasks || [];
    let inReview = data?.in_review_tasks || [];
    let upNext = data?.up_next_tasks || [];
    let done = data?.done_tasks || [];
    let webhookLogs = data?.webhook_logs || [];

    const shortTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logMsg = `[${shortTime}] Webhook: '${task || 'Unknown Task'}' -> ${status || action || 'ignored'}`;
    webhookLogs.push(logMsg);
    // Keep only the last 30 logs so the DB doesn't explode
    if (webhookLogs.length > 30) webhookLogs = webhookLogs.slice(-30);

    // --- TASK ACTION ROUTING ---
    const rawStatus = String(status || '').toLowerCase().trim();
    const taskId = String(id || Date.now());

    // Clean up task from everywhere first to prevent duplicates (using weak inequality in case DB has ints vs strings)
    inProgress = inProgress.filter(t => String(t.id) !== taskId);
    inReview = inReview.filter(t => String(t.id) !== taskId);
    upNext = upNext.filter(t => String(t.id) !== taskId);
    done = done.filter(t => String(t.id) !== taskId);

    if (action === 'sync') {
       inProgress = inProgressTasks || inProgress;
       done = doneTasks || done;
    } else if (action === 'delete' || req.method === 'DELETE' || rawStatus === 'delete' || rawStatus === 'deleted') {
       // Just deleting, do nothing to add it back
    } else {
       // Check if task is due today
       const passedDate = due_date || dueDate || due;
       let isDueToday = true;
       if (passedDate) {
         try {
           const parsedDue = new Date(passedDate).toISOString().split('T')[0];
           if (parsedDue !== today) isDueToday = false;
         } catch(e) {}
       }

       // Map Twenty CRM statuses to overlay internal statuses
       const twentyToOverlayStatus = {
           // Waiting states
           'new': 'waiting',
           'waiting': 'waiting',
           'todo': 'waiting',
          // In progress states
          'ongoing': 'in_progress',
          'in_progress': 'in_progress',
          'contacted': 'in_progress',
          'qualified': 'in_progress',
          // In review states
          'in_review': 'in_review',
          'review': 'in_review',
          // Up next states
          'up_next': 'up_next',
          'upnext': 'up_next',
          'next': 'up_next',
          'up next': 'up_next',
          // Done states
          'won': 'done',
          'lost': 'done',
          'converted': 'done',
          'unqualified': 'done',
          'done': 'done',
          'completed': 'done'
       };
       const overlayStatus = twentyToOverlayStatus[rawStatus] || rawStatus;

       const recognizedStatuses = ['in progress', 'in_progress', 'up next', 'up_next', 'upnext', 'in review', 'in_review', 'waiting', 'done', 'completed', 'active'];
       if (recognizedStatuses.includes(overlayStatus) || recognizedStatuses.includes(rawStatus)) {
          // Normalize to overlay format
          let normalizedStatus = 'waiting';
          if (overlayStatus.includes('progress') || rawStatus.includes('progress')) normalizedStatus = 'in_progress';
          else if (overlayStatus.includes('next') || rawStatus.includes('next')) normalizedStatus = 'up_next';
          else if (overlayStatus.includes('review') || rawStatus.includes('review')) normalizedStatus = 'in_review';
          else if (overlayStatus === 'done' || overlayStatus === 'completed' || rawStatus === 'done' || rawStatus === 'completed') normalizedStatus = 'done';
          else if (overlayStatus === 'active') normalizedStatus = 'in_progress';

          if (normalizedStatus === 'done') {
             if (isDueToday) {
               done.unshift({
                 id: taskId,
                 name: String(task || "Completed Task"),
                 status: "done",
                 createdAt: Date.now(),
                 completedAt: time ? new Date(time).getTime() : Date.now()
               });
             }
          } else {
             const newTask = {
               id: taskId,
               name: String(task || "Untitled Task"),
               status: normalizedStatus,
               createdAt: time ? new Date(time).getTime() : Date.now(),
               completedAt: null
             };
             if (normalizedStatus === 'in_progress') inProgress.push(newTask);
             else if (normalizedStatus === 'in_review') inReview.push(newTask);
             else upNext.push(newTask);
          }
       }
    }

    // Save the modified arrays back to Supabase
    const { error: updateErr } = await supabase
      .from('stream_metrics')
      .upsert({
         date: today,
         in_progress_tasks: inProgress,
         in_review_tasks: inReview,
         up_next_tasks: upNext,
         done_tasks: done,
         webhook_logs: webhookLogs,
         updated_at: new Date().toISOString()
      }, { onConflict: 'date' });

    if (updateErr) throw updateErr;

    return res.status(200).json({
      success: true,
      message: `Task status '${status}' processed.`,
      activeTasksCount: inProgress.length
    });

  } catch (error) {
    console.error('[API Error] /api/stream/tasks:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
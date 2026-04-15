export default async function handler(req, res) {
  // CORS Security
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized access blocked." });     
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed.' });
  }

  try {
    const { id, task, status, time, action, inProgressTasks, doneTasks } = req.body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];

    // Fetch the current task arrays so we can dynamically modify them
    const { data, error: fetchError } = await supabase
      .from('stream_metrics')
      .select('in_progress_tasks, done_tasks')
      .eq('date', today)
      .single();

    // Ignore PGRST116 (No rows) because we are about to upsert
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let inProgress = data?.in_progress_tasks || [];
    let done = data?.done_tasks || [];

    // --- TASK ACTION ROUTING ---
    const rawStatus = String(status || '').toLowerCase().trim();
    const taskId = String(id || Date.now());

    // Clean up task from everywhere first to prevent duplicates
    inProgress = inProgress.filter(t => t.id !== taskId);
    done = done.filter(t => t.id !== taskId);

    if (action === 'sync') {
       inProgress = inProgressTasks || inProgress;
       done = doneTasks || done;
    } else if (['in progress', 'in_progress', 'up next', 'up_next', 'upnext', 'in review', 'in_review', 'waiting'].includes(rawStatus)) {
       let normalizedStatus = 'waiting';
       if (rawStatus.includes('progress')) normalizedStatus = 'in_progress';
       else if (rawStatus.includes('next')) normalizedStatus = 'up_next';
       else if (rawStatus.includes('review')) normalizedStatus = 'in_review';
       
       inProgress.push({
         id: taskId,
         name: String(task || "Untitled Task"),
         status: normalizedStatus,
         createdAt: time ? new Date(time).getTime() : Date.now(),
         completedAt: null
       });
    } else if (rawStatus === 'done' || rawStatus === 'completed') {
       done.unshift({
         id: taskId,
         name: String(task || "Completed Task"),
         status: "done",
         createdAt: Date.now(), // Fallback if it didn't exist before
         completedAt: time ? new Date(time).getTime() : Date.now()
       });
    } else {
       // Ignore unrecognized statuses instead of crashing
    }

    // Save the modified arrays back to Supabase
    const { error: updateErr } = await supabase
      .from('stream_metrics')
      .upsert({
         date: today,
         in_progress_tasks: inProgress,
         done_tasks: done,
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
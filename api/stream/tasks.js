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
    const { action, task, inProgressTasks, doneTasks } = req.body;

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
    if (action === 'sync') {
       // Manual overwrite (useful if mirroring full arrays)
       inProgress = inProgressTasks || inProgress;
       done = doneTasks || done;
    } 
    else if (action === 'add') {
       // Add a new active task to the timeline
       const newTask = {
         id: String(task.id || Date.now()),
         name: String(task.name || "Untitled Task"),
         status: "in_progress",
         createdAt: Date.now(),
         completedAt: null
       };
       // Remove it if it already exists to avoid duplicates
       inProgress = inProgress.filter(t => t.id !== newTask.id);
       inProgress.push(newTask);
    } 
    else if (action === 'complete') {
       // Move a task from in-progress to done
       const targetId = String(task.id);
       const existingIndex = inProgress.findIndex(t => t.id === targetId);
       
       if (existingIndex > -1) {
         const [completedTask] = inProgress.splice(existingIndex, 1);
         completedTask.status = "done";
         completedTask.completedAt = Date.now();
         done.unshift(completedTask); // Add to the top of the done list
       } else {
         // Fallback just in case the task wasn't in the active list
         done.unshift({
           id: targetId,
           name: String(task.name || "Completed Task"),
           status: "done",
           createdAt: Date.now(),
           completedAt: Date.now()
         });
       }
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
      message: `Task action '${action}' processed.`,
      activeTasksCount: inProgress.length
    });

  } catch (error) {
    console.error('[API Error] /api/stream/tasks:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
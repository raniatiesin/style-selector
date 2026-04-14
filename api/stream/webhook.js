export default async function handler(req, res) {
  // CORS Security: The Kanban board endpoint must accept POST
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 1. Extreme Security Check 
  // This webhook MUST be accompanied by "Authorization: Bearer <WEBHOOK_SECRET>"
  // Add this WEBHOOK_SECRET securely to your Vercel Dashboard Environment Variables
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CRITICAL: Vercel is missing the WEBHOOK_SECRET environment variable!');
    return res.status(500).json({ error: "Server Configuration Error: Missing Secret" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    console.warn(`[SECURITY] Unauthorized webhook attempt heavily rejected. Initial header: ${authHeader}`);
    return res.status(401).json({ error: "Unauthorized access attempt blocked." });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Must POST to this endpoint.' });
  }

  try {
    const payload = req.body;
    
    // Quick validation of required payload structures from Kanban
    if (!payload || !payload.id || !payload.status) {
      return res.status(400).json({ error: "Bad Request. Payload missing critical Kanban properties (id, status)." });
    }

    // 2. High-Quality State Write 
    // We instantly write the webhook into your existing Supabase
    // This allows Vercel to securely remember it for OBS
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // We "Upsert" the task. 
    // If Kanban says "Task 1: In Progress", it creates row.
    // If Kanban says "Task 1: Done", it instantly updates the same row instead of duplicating.
    const { data, error } = await supabase
      .from('overlay')
      .upsert({
         id: String(payload.id),
         name: String(payload.name || "Untitled Kanban Task"),
         status: String(payload.status).toLowerCase(),
         updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.error('[Supabase Write Error]', error);
      throw error;
    }

    console.log(`[SECURE WEBHOOK] Successfully accepted and saved task state: ${payload.id}`);
    
    return res.status(200).json({
      success: true,
      message: "Kanban update securely processed.",
      processedPayload: payload.id
    });

  } catch (error) {
    console.error('[API Error] /api/stream/webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * POST /api/submit
 * Body: { sessionId, name, email, selected, favorites? }
 *
 * Updates the existing sessions row with contact info + chosen style.
 * Optionally sends a Resend notification email.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { sessionId, name, email, selected, favorites } = req.body;

  if (!sessionId || !name || !email) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    // Update sessions row — write to proper columns, not metadata
    const { error: updateErr } = await supabase
      .from('sessions')
      .update({
        name: name.trim(),
        email: email.trim(),
        selected: selected || null,
        ...(favorites ? { favorites } : {}),
      })
      .eq('id', sessionId);

    if (updateErr) {
      console.error('Session update error:', updateErr);
      return res.status(500).json({ error: 'Submission failed' });
    }

    // Optional: send notification via Resend
    if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'quiz@yourdomain.com',
          to: process.env.NOTIFICATION_EMAIL,
          subject: `New Style Quiz — ${name}`,
          text: `Name: ${name}\nEmail: ${email}\nStyle: ${selected}\nSession: ${sessionId}`,
        }),
      });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Submit handler error:', err);
    res.status(500).json({ error: 'Submission failed' });
  }
}

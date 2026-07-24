require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  console.log("Inserting row for date:", today);
  
  const { data, error } = await supabase
    .from('stream_metrics')
    .upsert({ 
      date: today, 
      updated_at: new Date().toISOString(),
      mode: 'standby',
      contacted_count: 0,
      converted_count: 0,
      today_seconds: 0,
      mode_timestamp: Date.now()
    }, { onConflict: 'date' });

  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("Success! Data inserted.");
  }
}

run();

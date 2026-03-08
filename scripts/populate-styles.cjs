// scripts/populate-styles.cjs
// READ-ONLY — only SELECTs from styles table, writes public/manifest.json locally.
// Run: node scripts/populate-styles.cjs  (from inside style-quiz/)

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('Fetching styles table (read-only)...');

  const { data, error } = await supabase
    .from('styles')
    .select('path, content')
    .not('content', 'is', null)
    .order('path');

  if (error) {
    console.error('Supabase error:', error);
    process.exit(1);
  }

  console.log(`Fetched ${data.length} rows`);

  const manifest = data.map(row => {
    const id = row.path.split('/')[0]; // "style_0042/2.webp" → "style_0042"
    return {
      id,
      repPath: `/images/rep/${id}.webp`,
      tally: row.content,
    };
  });

  const outPath = path.resolve(__dirname, '../public/manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  console.log(`Written ${manifest.length} entries to public/manifest.json`);
}

main();

// scripts/test-supabase.cjs
// Tests the Supabase connection: styles table row count, sessions table access,
// and a live call to the match_styles RPC using a dummy embedding.
// Run: node scripts/test-supabase.cjs  (from inside style-quiz/)

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('FAIL  SUPABASE_URL or SUPABASE_SERVICE_KEY is missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testStylesTable() {
  process.stdout.write('[1/3] styles table — count rows ... ');
  const { count, error } = await supabase
    .from('styles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log('FAIL');
    console.error('     ', error.message);
    return false;
  }
  console.log(`OK  (${count} rows)`);
  if (count !== 686) {
    console.warn(`     Warning: expected 686 rows, got ${count}`);
  }
  return true;
}

async function testSessionsTable() {
  process.stdout.write('[2/3] sessions table — accessible ... ');
  const { count, error } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log('FAIL');
    console.error('     ', error.message);
    return false;
  }
  console.log(`OK  (${count} rows)`);
  return true;
}

async function testMatchStylesRPC() {
  process.stdout.write('[3/3] match_styles RPC — dummy embedding ... ');
  // Zero vector of 2560 dims — not meaningful, just checks the RPC is callable
  const dummyEmbedding = '[' + new Array(2560).fill(0).join(',') + ']';

  const { data, error } = await supabase.rpc('match_styles', {
    query_embedding: dummyEmbedding,
    match_count: 3,
  });

  if (error) {
    console.log('FAIL');
    console.error('     ', error.message);
    return false;
  }
  console.log(`OK  (returned ${data.length} matches)`);
  if (data.length > 0) {
    console.log('     First match:', data[0]);
  }
  return true;
}

async function main() {
  console.log('\nSupabase connection test');
  console.log('URL:', SUPABASE_URL);
  console.log('─'.repeat(50));

  const r1 = await testStylesTable();
  const r2 = await testSessionsTable();
  const r3 = await testMatchStylesRPC();

  console.log('─'.repeat(50));
  if (r1 && r2 && r3) {
    console.log('All tests passed.\n');
  } else {
    console.log('Some tests FAILED — check errors above.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

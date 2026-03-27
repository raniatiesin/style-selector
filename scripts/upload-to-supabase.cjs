/**
 * upload-to-supabase.cjs
 *
 * Uploads all WebP files from style-quiz/segments/ to Supabase Storage
 * bucket "segments". Folder structure is preserved:
 *   segments/style_0001/1.webp  →  bucket: segments/style_0001/1.webp
 *
 * Usage:
 *   node scripts/upload-to-supabase.cjs              (full upload)
 *   node scripts/upload-to-supabase.cjs --dry-run    (count only, no upload)
 *
 * Prerequisites:
 *   .env with SUPABASE_URL and SUPABASE_SERVICE_KEY
 */

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// --- Config ---
const BUCKET = 'segments';
const SEGMENTS_DIR = path.join(__dirname, '..', '..', 'image-pipeline', 'segments');
const CONCURRENCY = 10;
const CONTENT_TYPE = 'image/webp';

// --- CLI args ---
const DRY_RUN = process.argv.includes('--dry-run');

// --- Env ---
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!DRY_RUN) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
  }
}

const supabase = !DRY_RUN
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// --- Recursively collect all .webp files ---
function collectFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const bucketPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, bucketPath));
    } else if (entry.name.endsWith('.webp')) {
      files.push({ fullPath, bucketPath });
    }
  }
  return files;
}

// --- Upload a single file (upsert) ---
async function uploadFile({ fullPath, bucketPath }) {
  const fileBuffer = fs.readFileSync(fullPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(bucketPath, fileBuffer, {
      contentType: CONTENT_TYPE,
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed for ${bucketPath}: ${error.message}`);
  }
  return bucketPath;
}

// --- Run with limited concurrency ---
async function runWithConcurrency(tasks, concurrency) {
  let index = 0;
  let completed = 0;
  let failed = 0;
  const errors = [];
  const total = tasks.length;

  async function worker() {
    while (index < total) {
      const task = tasks[index++];
      try {
        const p = await uploadFile(task);
        completed++;
        if (completed % 100 === 0 || completed === total) {
          console.log(`  Uploaded ${completed}/${total} — ${p}`);
        }
      } catch (err) {
        failed++;
        errors.push(err.message);
        console.error(`  ✗ ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { completed, failed, errors };
}

// --- Main ---
async function main() {
  if (!fs.existsSync(SEGMENTS_DIR)) {
    console.error(`segments/ folder not found at: ${SEGMENTS_DIR}`);
    console.error('Expected: image-pipeline/segments/style_XXXX/1.webp … 6.webp');
    process.exit(1);
  }

  console.log(`Collecting files from: ${SEGMENTS_DIR}`);
  const files = collectFiles(SEGMENTS_DIR);
  console.log(`Found ${files.length} WebP files`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — no files will be uploaded.');
    console.log(`Would upload ${files.length} files to bucket: ${BUCKET}`);
    if (files.length > 0) {
      console.log('\nSample paths:');
      files.slice(0, 5).forEach(f => console.log(`  ${f.bucketPath}`));
    }
    return;
  }

  console.log(`\nUploading to bucket "${BUCKET}" with concurrency ${CONCURRENCY}...\n`);
  const start = Date.now();
  const { completed, failed, errors } = await runWithConcurrency(files, CONCURRENCY);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\nDone in ${elapsed}s`);
  console.log(`  Uploaded: ${completed}`);
  console.log(`  Failed:   ${failed}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Print a sample public URL
  if (completed > 0 && files.length > 0) {
    const sample = files[0].bucketPath;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(sample);
    console.log(`\nSample URL: ${data.publicUrl}`);
    console.log('Open it in browser to verify.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');

const SEGMENTS_DIR = path.join(__dirname, '..', '..', 'image-pipeline', 'segments');

function collectPaths(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const bucketPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectPaths(path.join(dir, entry.name), bucketPath));
    } else if (entry.name.endsWith('.webp')) {
      results.push({ path: bucketPath });
    }
  }
  return results;
}

const items = collectPaths(SEGMENTS_DIR);
const outPath = path.join(__dirname, '..', 'paths.json');
fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf-8');
console.log(`${items.length} paths written to paths.json`);

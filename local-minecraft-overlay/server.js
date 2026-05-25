import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const PORT = Number(process.env.MINECRAFT_OVERLAY_PORT || 2026);
const RECORDS_DIR = process.env.SPEEDRUNIGT_RECORDS_DIR || 'C:\\Users\\rania\\speedrunigt\\records';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'runs.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

const upsertRun = db.prepare(`
  INSERT INTO runs (
    id,
    date,
    is_completed,
    mc_version,
    category,
    run_type,
    final_igt,
    retimed_igt,
    final_rta,
    enter_nether_igt,
    enter_end_igt,
    last_updated
  ) VALUES (
    @id,
    @date,
    @is_completed,
    @mc_version,
    @category,
    @run_type,
    @final_igt,
    @retimed_igt,
    @final_rta,
    @enter_nether_igt,
    @enter_end_igt,
    @last_updated
  )
  ON CONFLICT(id) DO UPDATE SET
    date = excluded.date,
    is_completed = excluded.is_completed,
    mc_version = excluded.mc_version,
    category = excluded.category,
    run_type = excluded.run_type,
    final_igt = excluded.final_igt,
    retimed_igt = excluded.retimed_igt,
    final_rta = excluded.final_rta,
    enter_nether_igt = excluded.enter_nether_igt,
    enter_end_igt = excluded.enter_end_igt,
    last_updated = excluded.last_updated
`);

const deleteRun = db.prepare('DELETE FROM runs WHERE id = ?');

const fileMtimes = new Map();

function getTimelineIgt(timelines, name) {
  if (!Array.isArray(timelines)) return 0;
  const entry = timelines.find(t => t?.name === name);
  return Number(entry?.igt || 0) || 0;
}

function normalizeRun(data, fileName) {
  const timelines = data?.timelines || [];
  return {
    id: fileName,
    date: Number(data?.date || 0) || 0,
    is_completed: data?.is_completed ? 1 : 0,
    mc_version: String(data?.mc_version || ''),
    category: String(data?.category || ''),
    run_type: String(data?.run_type || ''),
    final_igt: Number(data?.final_igt || 0) || 0,
    retimed_igt: Number(data?.retimed_igt || 0) || 0,
    final_rta: Number(data?.final_rta || 0) || 0,
    enter_nether_igt: getTimelineIgt(timelines, 'enter_nether'),
    enter_end_igt: getTimelineIgt(timelines, 'enter_end'),
    last_updated: Date.now()
  };
}

async function handleFile(fileName) {
  if (!fileName || !fileName.endsWith('.json')) return;
  const fullPath = path.join(RECORDS_DIR, fileName);

  try {
    const stats = await fs.promises.stat(fullPath);
    const prevMtime = fileMtimes.get(fileName) || 0;
    if (stats.mtimeMs <= prevMtime) return;

    const raw = await fs.promises.readFile(fullPath, 'utf8');
    const data = JSON.parse(raw);
    const run = normalizeRun(data, fileName);
    upsertRun.run(run);
    fileMtimes.set(fileName, stats.mtimeMs);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      deleteRun.run(fileName);
      fileMtimes.delete(fileName);
      return;
    }
    console.error('[watch] Failed to process', fileName, error?.message || error);
  }
}

async function initialScan() {
  try {
    const files = await fs.promises.readdir(RECORDS_DIR);
    await Promise.all(files.map(handleFile));
  } catch (error) {
    console.error('[scan] Failed to read records dir', error?.message || error);
  }
}

let rescanTimer = null;
function scheduleRescan(fileName) {
  if (rescanTimer) clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => {
    handleFile(fileName);
  }, 150);
}

try {
  fs.watch(RECORDS_DIR, (eventType, fileName) => {
    if (!fileName) return;
    scheduleRescan(fileName);
  });
} catch (error) {
  console.error('[watch] Failed to watch records dir', error?.message || error);
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

const staticCache = new Map();
function getStatic(filePath, contentType) {
  const cached = staticCache.get(filePath);
  if (cached) return cached;
  const data = fs.readFileSync(filePath);
  const payload = { data, contentType };
  staticCache.set(filePath, payload);
  return payload;
}

function getStats() {
  const totals = db.prepare('SELECT COUNT(*) AS total_runs, SUM(is_completed) AS completed_runs FROM runs').get();
  const averages = db.prepare(`
    SELECT
      AVG(CASE WHEN final_igt > 0 THEN final_igt END) AS avg_final_igt_all,
      AVG(CASE WHEN is_completed = 1 AND final_igt > 0 THEN final_igt END) AS avg_final_igt_completed,
      AVG(CASE WHEN is_completed = 1 AND enter_nether_igt > 0 THEN enter_nether_igt END) AS avg_enter_nether_igt,
      AVG(CASE WHEN is_completed = 1 AND enter_end_igt > 0 THEN enter_end_igt END) AS avg_enter_end_igt
    FROM runs
  `).get();
  const best = db.prepare('SELECT MIN(CASE WHEN is_completed = 1 AND final_igt > 0 THEN final_igt END) AS best_final_igt FROM runs').get();

  return {
    totals: {
      totalRuns: totals?.total_runs || 0,
      completedRuns: totals?.completed_runs || 0
    },
    averages: {
      avgFinalIgtAll: averages?.avg_final_igt_all || 0,
      avgFinalIgtCompleted: averages?.avg_final_igt_completed || 0,
      avgEnterNetherIgt: averages?.avg_enter_nether_igt || 0,
      avgEnterEndIgt: averages?.avg_enter_end_igt || 0
    },
    bests: {
      bestFinalIgt: best?.best_final_igt || 0
    }
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/stats') {
    return json(res, 200, getStats());
  }

  if (url.pathname === '/' || url.pathname === '/overlay') {
    const filePath = path.join(PUBLIC_DIR, 'overlay.html');
    const { data, contentType } = getStatic(filePath, 'text/html; charset=utf-8');
    res.writeHead(200, { 'Content-Type': contentType });
    return res.end(data);
  }

  if (url.pathname === '/overlay.css') {
    const filePath = path.join(PUBLIC_DIR, 'overlay.css');
    const { data, contentType } = getStatic(filePath, 'text/css; charset=utf-8');
    res.writeHead(200, { 'Content-Type': contentType });
    return res.end(data);
  }

  if (url.pathname === '/overlay.js') {
    const filePath = path.join(PUBLIC_DIR, 'overlay.js');
    const { data, contentType } = getStatic(filePath, 'text/javascript; charset=utf-8');
    res.writeHead(200, { 'Content-Type': contentType });
    return res.end(data);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

initialScan().then(() => {
  server.listen(PORT, () => {
    console.log(`[minecraft-overlay] listening on http://localhost:${PORT}`);
    console.log(`[minecraft-overlay] records dir: ${RECORDS_DIR}`);
  });
});

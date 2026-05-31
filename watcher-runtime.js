/* global process */

import fs from 'fs';
import path from 'path';
import http from 'http';
import chokidar from 'chokidar';

const SAVES_DIR = 'C:/Users/rania/AppData/Roaming/PrismLauncher/instances/1.16.1 - Speedrunning/minecraft/saves';
const PORT = 2026;
const MINECRAFT_SERVER_URL = process.env.MINECRAFT_SERVER_URL || '';
const MINECRAFT_WEBHOOK_SECRET = process.env.MINECRAFT_WEBHOOK_SECRET || process.env.OVERLAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TIME_ZONE = 'Europe/Paris';

const GAMEMODE_BY_ID = {
  0: 'survival',
  1: 'creative',
  2: 'adventure',
  3: 'spectator'
};

let stats = {
  totals: { totalRuns: 0, completedRuns: 0 },
  averages: { avgFinalIgtCompleted: 0, avgEnterNetherIgt: 0, avgEnterEndIgt: 0 },
  bests: { bestFinalIgt: Infinity, bestEnterNetherIgt: Infinity, bestEnterEndIgt: Infinity }
};

let activeWorldPath = null;
let activeWorldData = null;
let activeWorldStartedAt = null;
let activeWorldSnapshotSent = false;
let clients = [];
let shuttingDown = false;

function coerceNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGamemode(value) {
  if (value == null) return 'unknown';

  if (typeof value === 'number') {
    return GAMEMODE_BY_ID[value] || 'unknown';
  }

  const text = String(value).trim().toLowerCase();
  if (!text) return 'unknown';

  if (text === '0' || text.includes('survival')) return 'survival';
  if (text === '1' || text.includes('creative')) return 'creative';
  if (text === '2' || text.includes('adventure')) return 'adventure';
  if (text === '3' || text.includes('spectator')) return 'spectator';

  return 'unknown';
}

function getWorldContext(filePath) {
  const recordPath = path.normalize(filePath);
  const worldDir = path.dirname(path.dirname(recordPath));
  const worldName = path.basename(worldDir);

  return {
    filePath: recordPath,
    worldPath: worldDir,
    worldId: worldDir.replace(/\\/g, '/'),
    worldName
  };
}

function pickFirstDefined(source, keys) {
  for (const key of keys) {
    if (source && Object.hasOwn(source, key) && source[key] != null) {
      return source[key];
    }
  }

  return undefined;
}

function detectStartGamemode(data) {
  if (!data || typeof data !== 'object') return 'unknown';

  const directValue = pickFirstDefined(data, [
    'start_gamemode',
    'startGamemode',
    'startingGamemode',
    'starting_gamemode',
    'gameMode',
    'gamemode',
    'mode'
  ]);
  const directGamemode = normalizeGamemode(directValue);
  if (directGamemode !== 'unknown') return directGamemode;

  const nestedSources = [data.player, data.metadata, data.world, data.settings, data.run, data.session];
  for (const source of nestedSources) {
    if (!source || typeof source !== 'object') continue;

    const nestedValue = pickFirstDefined(source, [
      'start_gamemode',
      'startGamemode',
      'startingGamemode',
      'starting_gamemode',
      'gameMode',
      'gamemode',
      'mode'
    ]);
    const nestedGamemode = normalizeGamemode(nestedValue);
    if (nestedGamemode !== 'unknown') return nestedGamemode;
  }

  return 'unknown';
}

function detectRunType({ startGamemode, worldName }) {
  const loweredWorldName = String(worldName || '').toLowerCase();

  if (loweredWorldName.includes('practice')) return 'practice';
  if (startGamemode === 'creative') return 'practice';
  if (startGamemode === 'survival') return 'speedrun';

  return 'unknown';
}

function extractIgtValue(data, keys) {
  const rawValue = pickFirstDefined(data, keys);
  return coerceNumber(rawValue, 0);
}

function buildMinecraftRunSnapshot({ filePath, data, seenAt = Date.now(), finalizedAt = null }) {
  const world = getWorldContext(filePath);
  const startGamemode = detectStartGamemode(data);
  const runType = detectRunType({ startGamemode, worldName: world.worldName });
  const capturedAt = finalizedAt || seenAt;

  return {
    ...world,
    startGamemode,
    runType,
    isCompleted: Boolean(data?.is_completed ?? data?.completed ?? data?.finished ?? data?.done),
    finalIgt: extractIgtValue(data, ['final_igt', 'finalIgt', 'igt', 'final_time', 'finalTime', 'finalTimeMs']),
    enterNetherIgt: extractIgtValue(data, ['enter_nether_igt', 'enterNetherIgt']),
    enterEndIgt: extractIgtValue(data, ['enter_end_igt', 'enterEndIgt']),
    observedDurationMs: Math.max(0, coerceNumber(capturedAt - seenAt, 0)),
    seenAt,
    capturedAt,
    rawData: data ?? null
  };
}

function toSupabaseRow(snapshot, date) {
  return {
    world_id: snapshot.worldId,
    world_name: snapshot.worldName,
    world_path: snapshot.worldPath,
    run_type: snapshot.runType,
    start_gamemode: snapshot.startGamemode,
    is_completed: snapshot.isCompleted,
    final_igt: snapshot.finalIgt,
    enter_nether_igt: snapshot.enterNetherIgt,
    enter_end_igt: snapshot.enterEndIgt,
    observed_duration_ms: snapshot.observedDurationMs,
    date,
    raw_data: snapshot.rawData,
    updated_at: new Date(snapshot.capturedAt).toISOString()
  };
}

function getTodayString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

function readWorldRecord(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch {
    return null;
  }
}

function findLatestExistingRecord() {
  try {
    const worlds = fs.readdirSync(SAVES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(SAVES_DIR, entry.name, 'speedrunigt', 'record.json'))
      .filter((filePath) => fs.existsSync(filePath))
      .map((filePath) => ({
        filePath,
        mtimeMs: fs.statSync(filePath).mtimeMs
      }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    return worlds[0]?.filePath || null;
  } catch (error) {
    console.error('[Watcher] Failed to scan existing worlds:', error.message);
    return null;
  }
}

function bootstrapExistingWorld() {
  const latestRecord = findLatestExistingRecord();
  if (!latestRecord) {
    console.log('[Watcher] No existing record.json found yet. Waiting for a new world.');
    return;
  }

  activeWorldPath = latestRecord;
  activeWorldStartedAt = fs.statSync(latestRecord).mtimeMs || Date.now();
  activeWorldData = readWorldRecord(latestRecord);
  console.log(`[Watcher] Bootstrapped active world from existing record: ${latestRecord}`);
}

async function publishRunSnapshot(snapshot) {
  if (!MINECRAFT_SERVER_URL || !MINECRAFT_WEBHOOK_SECRET) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.warn('[Watcher] No MINECRAFT_SERVER_URL or Supabase credentials available; skipping run write.');
      return;
    }

    try {
      console.log(`[Watcher] Writing directly to Supabase for ${snapshot.worldName || snapshot.world_id} (${snapshot.run_type || 'unknown'})`);
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { error } = await supabase
        .from('paceman')
        .upsert(snapshot, { onConflict: 'world_id' });

      if (error) {
        throw error;
      }

      return;
    } catch (error) {
      console.error('[Watcher] Direct Supabase write failed:', error.message);
      return;
    }
  }

  try {
    console.log(`[Watcher] Writing through relay for ${snapshot.worldName || snapshot.world_id} (${snapshot.run_type || 'unknown'})`);
    const response = await fetch(MINECRAFT_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MINECRAFT_WEBHOOK_SECRET ? { Authorization: `Bearer ${MINECRAFT_WEBHOOK_SECRET}` } : {})
      },
      body: JSON.stringify({
        ...snapshot,
        date: getTodayString()
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Watcher] Failed to publish run snapshot: ${response.status} ${text}`);
    }
  } catch (error) {
    console.error('[Watcher] Publish failed:', error.message);
  }
}

function broadcastStats() {
  const payload = JSON.stringify(stats);
  clients.forEach(client => client.write(`data: ${payload}\n\n`));
  console.log(`[SSE] Broadcasted stats:`, stats);
}

async function shutdown(reason = 'shutdown') {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[Server] Closing watcher backend (${reason})...`);

  try {
    await watcher.close();
  } catch (error) {
    console.error('[Server] Failed to close file watcher:', error.message);
  }

  for (const client of clients) {
    try {
      client.end();
    } catch {
      // Ignore socket teardown errors during shutdown.
    }
  }
  clients = [];

  try {
    await new Promise((resolve) => server.close(resolve));
  } catch (error) {
    console.error('[Server] Failed to close HTTP server:', error.message);
  }

  process.exit(0);
}

function resetActiveWorld(filePath) {
  activeWorldPath = filePath;
  activeWorldData = null;
  activeWorldStartedAt = Date.now();
  activeWorldSnapshotSent = false;
}

async function captureAndPublishActiveWorld(filePath, finalizedAt = null) {
  const data = readWorldRecord(filePath);
  if (!data) return null;

  activeWorldData = data;

  const snapshot = buildMinecraftRunSnapshot({
    filePath,
    data,
    seenAt: activeWorldStartedAt || Date.now(),
    finalizedAt: finalizedAt || Date.now()
  });

  if (!activeWorldSnapshotSent || finalizedAt) {
    activeWorldSnapshotSent = true;
    void publishRunSnapshot(toSupabaseRow(snapshot, getTodayString()));
  }

  return snapshot;
}

async function finalizePreviousRun(worldPath, data) {
  if (!data) return;

  const snapshot = buildMinecraftRunSnapshot({
    filePath: worldPath,
    data,
    seenAt: activeWorldStartedAt || Date.now(),
    finalizedAt: Date.now()
  });

  void publishRunSnapshot(toSupabaseRow(snapshot, getTodayString()));

  stats.totals.totalRuns += 1;

  if (snapshot.isCompleted) {
    stats.totals.completedRuns += 1;
    if (snapshot.finalIgt > 0 && snapshot.finalIgt < stats.bests.bestFinalIgt) {
      stats.bests.bestFinalIgt = snapshot.finalIgt;
    }
  }

  const netherStart = data.timelines?.find(t => t.name === 'enter_nether');
  const endStart = data.timelines?.find(t => t.name === 'enter_end');

  if (netherStart) {
    stats.averages.avgEnterNetherIgt = Math.round(
      (stats.averages.avgEnterNetherIgt * (stats.totals.totalRuns - 1) + netherStart.igt) / stats.totals.totalRuns
    );
    if (netherStart.igt > 0 && netherStart.igt < stats.bests.bestEnterNetherIgt) {
      stats.bests.bestEnterNetherIgt = netherStart.igt;
    }
  }

  if (endStart) {
    stats.averages.avgEnterEndIgt = Math.round(
      (stats.averages.avgEnterEndIgt * (stats.totals.totalRuns - 1) + endStart.igt) / stats.totals.totalRuns
    );
    if (endStart.igt > 0 && endStart.igt < stats.bests.bestEnterEndIgt) {
      stats.bests.bestEnterEndIgt = endStart.igt;
    }
  }

  console.log(`[Watcher] Finalized run for ${path.basename(path.dirname(worldPath))}. Total Runs: ${stats.totals.totalRuns}`);
  broadcastStats();
}

console.log(`[Watcher] Initializing file watcher on: ${SAVES_DIR}/*/speedrunigt/record.json`);
console.log(`[Watcher] Write mode: ${MINECRAFT_SERVER_URL && MINECRAFT_WEBHOOK_SECRET ? 'relay' : 'direct Supabase'}`);

bootstrapExistingWorld();

const watcher = chokidar.watch(`${SAVES_DIR}/*/speedrunigt/record.json`, {
  ignored: /(^|[/\\])\../,
  persistent: true,
  ignoreInitial: true
});

watcher.on('add', (filePath) => {
  console.log(`[Watcher] New world detected: ${filePath}`);

  if (activeWorldPath && activeWorldPath !== filePath) {
    void finalizePreviousRun(activeWorldPath, activeWorldData);
  }

  resetActiveWorld(filePath);
  void captureAndPublishActiveWorld(filePath);
});

watcher.on('change', (filePath) => {
  if (filePath === activeWorldPath) {
    void captureAndPublishActiveWorld(filePath);
  }
});

const server = http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`data: ${JSON.stringify(stats)}\n\n`);
    clients.push(res);

    console.log(`[Server] TiedInApp UI connected via SSE.`);

    req.on('close', () => {
      clients = clients.filter(c => c !== res);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[Server] Watcher backend running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGHUP', () => void shutdown('SIGHUP'));

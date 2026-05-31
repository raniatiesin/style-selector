/* global process */

import fs from 'fs';
import path from 'path';
import http from 'http';
import chokidar from 'chokidar';
import {
  buildMinecraftRunSnapshot,
  toSupabaseRow
} from './lib/minecraft-run.js';

const SAVES_DIR = 'C:/Users/rania/AppData/Roaming/PrismLauncher/instances/1.16.1 - Speedrunning/minecraft/saves';
const PORT = 2026;
const MINECRAFT_SERVER_URL = process.env.MINECRAFT_SERVER_URL || '';
const MINECRAFT_WEBHOOK_SECRET = process.env.MINECRAFT_WEBHOOK_SECRET || process.env.OVERLAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
const TIME_ZONE = 'Europe/Paris';

// In-memory stats to send to TiedInApp
let stats = {
  totals: { totalRuns: 0, completedRuns: 0 },
  averages: { avgFinalIgtCompleted: 0, avgEnterNetherIgt: 0, avgEnterEndIgt: 0 },
  bests: { bestFinalIgt: Infinity, bestEnterNetherIgt: Infinity, bestEnterEndIgt: Infinity }
};

// Track the live state of the currently active world
let activeWorldPath = null;
let activeWorldData = null;
let activeWorldStartedAt = null;
let activeWorldSnapshotSent = false;

// SSE Clients
let clients = [];

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

async function publishRunSnapshot(snapshot) {
  if (!MINECRAFT_SERVER_URL) return;

  try {
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

// Broadcast to TiedInApp
function broadcastStats() {
  const payload = JSON.stringify(stats);
  clients.forEach(client => client.write(`data: ${payload}\n\n`));
  console.log(`[SSE] Broadcasted stats:`, stats);
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

// Process a run once it's done (triggered by a NEW run starting)
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

  // Very naive average calc just to lay the foundation
  // We can expand this heavily as we parse specific timelines
  let netherStart = data.timelines?.find(t => t.name === 'enter_nether');
  let endStart = data.timelines?.find(t => t.name === 'enter_end');

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


// Watcher Initialization
console.log(`[Watcher] Initializing file watcher on: ${SAVES_DIR}/*/speedrunigt/record.json`);

const watcher = chokidar.watch(`${SAVES_DIR}/*/speedrunigt/record.json`, {
  ignored: /(^|[/\\])\../,
  persistent: true,
  ignoreInitial: true // Only watch for NEW events or changes while server is running
});

watcher.on('add', (filePath) => {
  console.log(`[Watcher] New world detected: ${filePath}`);
  
  // This is your genius idea: When a NEW record.json is added, 
  // we finalize the PREVIOUS run and update the database/UI.
  if (activeWorldPath && activeWorldPath !== filePath) {
    void finalizePreviousRun(activeWorldPath, activeWorldData);
  }

  resetActiveWorld(filePath);
  void captureAndPublishActiveWorld(filePath);
});

watcher.on('change', (filePath) => {
  // As the runner plays, speedrunigt constantly updates this file with new splits.
  // We just keep updating our active memory with the freshest data.
  if (filePath === activeWorldPath) {
    void captureAndPublishActiveWorld(filePath);
  }
});

// Setup HTTP Server for Server-Sent Events (SSE)
const server = http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*' // Allow TiedInApp to connect from localhost:5173
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

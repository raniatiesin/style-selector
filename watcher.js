import fs from 'fs';
import path from 'path';
import http from 'http';
import chokidar from 'chokidar';

const SAVES_DIR = 'C:/Users/rania/AppData/Roaming/PrismLauncher/instances/1.16.1 - Speedrunning/minecraft/saves';
const PORT = 2026;

// In-memory stats to send to TiedInApp
let stats = {
  totals: { totalRuns: 0, completedRuns: 0 },
  averages: { avgFinalIgtCompleted: 0, avgEnterNetherIgt: 0, avgEnterEndIgt: 0 },
  bests: { bestFinalIgt: Infinity }
};

// Track the live state of the currently active world
let activeWorldPath = null;
let activeWorldData = null;

// SSE Clients
let clients = [];

// Broadcast to TiedInApp
function broadcastStats() {
  const payload = JSON.stringify(stats);
  clients.forEach(client => client.write(`data: ${payload}\n\n`));
  console.log(`[SSE] Broadcasted stats:`, stats);
}

// Process a run once it's done (triggered by a NEW run starting)
function finalizePreviousRun(worldPath, data) {
  if (!data) return;

  stats.totals.totalRuns += 1;

  if (data.is_completed) {
    stats.totals.completedRuns += 1;
    if (data.final_igt > 0 && data.final_igt < stats.bests.bestFinalIgt) {
      stats.bests.bestFinalIgt = data.final_igt;
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
  }

  if (endStart) {
    stats.averages.avgEnterEndIgt = Math.round(
      (stats.averages.avgEnterEndIgt * (stats.totals.totalRuns - 1) + endStart.igt) / stats.totals.totalRuns
    );
  }

  console.log(`[Watcher] Finalized run for ${path.basename(path.dirname(worldPath))}. Total Runs: ${stats.totals.totalRuns}`);
  broadcastStats();
}


// Watcher Initialization
console.log(`[Watcher] Initializing file watcher on: ${SAVES_DIR}/*/speedrunigt/record.json`);

const watcher = chokidar.watch(`${SAVES_DIR}/*/speedrunigt/record.json`, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true // Only watch for NEW events or changes while server is running
});

watcher.on('add', (filePath) => {
  console.log(`[Watcher] New world detected: ${filePath}`);
  
  // This is your genius idea: When a NEW record.json is added, 
  // we finalize the PREVIOUS run and update the database/UI.
  if (activeWorldPath && activeWorldPath !== filePath) {
    finalizePreviousRun(activeWorldPath, activeWorldData);
  }

  activeWorldPath = filePath;
  activeWorldData = null; // Will be populated on next 'change' event
});

watcher.on('change', (filePath) => {
  // As the runner plays, speedrunigt constantly updates this file with new splits.
  // We just keep updating our active memory with the freshest data.
  if (filePath === activeWorldPath) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      activeWorldData = JSON.parse(fileContent);
    } catch (e) {
      // Ignored: File might be locked or partially written
    }
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

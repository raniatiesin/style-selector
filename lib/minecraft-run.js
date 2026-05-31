import path from 'node:path';

const GAMEMODE_BY_ID = {
  0: 'survival',
  1: 'creative',
  2: 'adventure',
  3: 'spectator'
};

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

export {
  buildMinecraftRunSnapshot,
  coerceNumber,
  detectRunType,
  detectStartGamemode,
  normalizeGamemode,
  toSupabaseRow
};
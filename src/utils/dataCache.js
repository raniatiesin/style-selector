let manifestCache = null;
let styleEntryMapCache = null;
let styleTallyMapCache = null;

export async function loadAllData() {
  const manifestRes = await fetch('/manifest.json');
  manifestCache = await manifestRes.json();

  styleEntryMapCache = new Map();
  styleTallyMapCache = new Map();

  manifestCache.forEach((entry) => {
    styleEntryMapCache.set(entry.id, entry);
    styleTallyMapCache.set(entry.id, entry.tally || '');
  });

  console.log(`Loaded ${manifestCache.length} styles`);
}

export const getManifest = () => manifestCache;
export const getStyleEntryMap = () => styleEntryMapCache;
export const getStyleTallyMap = () => styleTallyMapCache;

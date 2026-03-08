let manifestCache = null;

export async function loadAllData() {
  const manifestRes = await fetch('/manifest.json');
  manifestCache = await manifestRes.json();
  console.log(`Loaded ${manifestCache.length} styles`);
}

export const getManifest = () => manifestCache;

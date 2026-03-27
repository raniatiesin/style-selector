const preloaded = new Set();
const inFlight = new Map();

function loadImage(id) {
  if (preloaded.has(id)) return Promise.resolve();
  if (inFlight.has(id)) return inFlight.get(id);

  const promise = new Promise(resolve => {
    const img = new Image();
    img.onload = img.onerror = () => {
      preloaded.add(id);
      inFlight.delete(id);
      resolve();
    };
    img.src = `/images/rep/${id}.webp`;
  });

  inFlight.set(id, promise);
  return promise;
}

export function preloadImages(imageIds) {
  const toLoad = [...new Set(imageIds.filter(id => !preloaded.has(id)))];
  if (toLoad.length === 0) return;

  const load = () => {
    toLoad.forEach(id => {
      void loadImage(id);
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(load, { timeout: 2000 });
  } else {
    setTimeout(load, 150);
  }
}

export function preloadImagesPriority(imageIds) {
  const toLoad = [...new Set(imageIds.filter(id => !preloaded.has(id)))];
  if (toLoad.length === 0) return;
  toLoad.forEach(id => {
    void loadImage(id);
  });
}

/**
 * Preload images and return a Promise that resolves when `threshold` fraction
 * of images have loaded, or after `maxMs` milliseconds — whichever comes first.
 * Always resolves, never rejects.
 */
export function preloadImagesAsync(imageIds, { threshold = 0.75, maxMs = 2500 } = {}) {
  const toLoad = [...new Set(imageIds.filter(id => !preloaded.has(id)))];
  if (toLoad.length === 0) return Promise.resolve();

  const target = Math.ceil(toLoad.length * threshold);
  let loaded = 0;

  return new Promise(resolve => {
    let settled = false;
    let rafId = 0;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(timer);
      resolve();
    };

    const scheduleCheck = () => {
      if (rafId || settled) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (loaded >= target) finish();
      });
    };

    const timer = setTimeout(finish, maxMs);

    toLoad.forEach(id => {
      void loadImage(id).then(() => {
        if (settled) return;
        loaded++;
        scheduleCheck();
      });
    });
  });
}

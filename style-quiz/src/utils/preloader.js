const preloaded = new Set();

export function preloadImages(imageIds) {
  const toLoad = imageIds.filter(id => !preloaded.has(id));
  if (toLoad.length === 0) return;

  const load = () => {
    toLoad.forEach(id => {
      const img = new Image();
      img.src = `/images/rep/${id}.webp`;
      img.onload = () => preloaded.add(id);
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(load, { timeout: 2000 });
  } else {
    setTimeout(load, 150);
  }
}

export function preloadImagesPriority(imageIds) {
  const toLoad = imageIds.filter(id => !preloaded.has(id));
  if (toLoad.length === 0) return;
  toLoad.forEach(id => {
    const img = new Image();
    img.src = `/images/rep/${id}.webp`;
    img.onload = () => preloaded.add(id);
  });
}

/**
 * Preload images and return a Promise that resolves when `threshold` fraction
 * of images have loaded, or after `maxMs` milliseconds — whichever comes first.
 * Always resolves, never rejects.
 */
export function preloadImagesAsync(imageIds, { threshold = 0.75, maxMs = 2500 } = {}) {
  const toLoad = imageIds.filter(id => !preloaded.has(id));
  if (toLoad.length === 0) return Promise.resolve();

  const target = Math.ceil(toLoad.length * threshold);
  let loaded = 0;

  return new Promise(resolve => {
    const timer = setTimeout(resolve, maxMs);
    toLoad.forEach(id => {
      const img = new Image();
      img.src = `/images/rep/${id}.webp`;
      img.onload = img.onerror = () => {
        preloaded.add(id);
        loaded++;
        if (loaded >= target) {
          clearTimeout(timer);
          resolve();
        }
      };
    });
  });
}

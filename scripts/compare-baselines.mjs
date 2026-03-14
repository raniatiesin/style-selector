import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const target = process.argv[2] || 'http://127.0.0.1:5173';
const baseDir = path.resolve('tests/baselines');
const currentDir = path.resolve('tests/current');

const desktops = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function waitForStableScreenshotState(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('button[class*="makeBtn"]', { state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[class*="makeBtn"]');
    if (!btn) return false;
    const cs = window.getComputedStyle(btn);
    const op = parseFloat(cs.opacity || '0');
    return op >= 0.95;
  }, { timeout: 10000 });

  await page.evaluate(() => {
    if (!document.getElementById('screenshot-idle-style')) {
      const style = document.createElement('style');
      style.id = 'screenshot-idle-style';
      style.textContent = `
        *, *::before, *::after {
          animation-play-state: paused !important;
          transition: none !important;
          caret-color: transparent !important;
        }
      `;
      document.head.appendChild(style);
    }

    const g = window.gsap;
    if (g && typeof g.globalTimeline === 'function') {
      const t = g.globalTimeline();
      if (t && typeof t.pause === 'function') t.pause();
    }
  });
  await page.waitForFunction(() => {
    const loadingVisible = Array.from(document.querySelectorAll('[class*="loading"]'))
      .some((el) => {
        const cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;
      });

    const g = window.gsap;
    if (!g || typeof g.globalTimeline !== 'function') return !loadingVisible;
    const t = g.globalTimeline();
    return !loadingVisible && (!t || t.paused());
  }, { timeout: 10000 });
  await page.waitForTimeout(250);
}

function getPixelDiffPct(aRaw, bRaw, width, height, threshold = 8) {
  let changed = 0;
  for (let i = 0; i < aRaw.length; i += 4) {
    const dr = Math.abs(aRaw[i] - bRaw[i]);
    const dg = Math.abs(aRaw[i + 1] - bRaw[i + 1]);
    const db = Math.abs(aRaw[i + 2] - bRaw[i + 2]);
    const da = Math.abs(aRaw[i + 3] - bRaw[i + 3]);

    if (dr > threshold || dg > threshold || db > threshold || da > threshold) {
      changed += 1;
    }
  }

  const totalPixels = width * height;
  return (changed / totalPixels) * 100;
}

function getFocusRegion(meta) {
  // Compare only the centered hero-card core to avoid animated background drift noise.
  const left = Math.floor(meta.width * 0.34);
  const top = Math.floor(meta.height * 0.26);
  const width = Math.floor(meta.width * 0.32);
  const height = Math.floor(meta.height * 0.44);
  return { left, top, width, height };
}

await fs.mkdir(currentDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  for (const vp of desktops) {
    const context = await browser.newContext({ viewport: vp });
    await context.addInitScript(() => {
      let seed = 1337;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
    });
    const page = await context.newPage();
    await page.goto(target, { waitUntil: 'networkidle' });
    await waitForStableScreenshotState(page);

    const name = `${vp.width}x${vp.height}.png`;
    await page.screenshot({ path: path.join(currentDir, name), fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
}

for (const vp of desktops) {
  const name = `${vp.width}x${vp.height}.png`;
  const baselinePath = path.join(baseDir, name);
  const currentPath = path.join(currentDir, name);

  const a = sharp(baselinePath).ensureAlpha();
  const b = sharp(currentPath).ensureAlpha();

  const [aMeta, bMeta] = await Promise.all([a.metadata(), b.metadata()]);
  if (aMeta.width !== bMeta.width || aMeta.height !== bMeta.height) {
    console.log(`${name}: size mismatch`);
    continue;
  }

  const [aRaw, bRaw] = await Promise.all([
    a.raw().toBuffer(),
    b.raw().toBuffer(),
  ]);

  const fullDiffPct = getPixelDiffPct(aRaw, bRaw, aMeta.width, aMeta.height);

  const focusRegion = getFocusRegion(aMeta);
  const [aFocusRaw, bFocusRaw] = await Promise.all([
    sharp(baselinePath)
      .extract(focusRegion)
      .ensureAlpha()
      .raw()
      .toBuffer(),
    sharp(currentPath)
      .extract(focusRegion)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  ]);

  const focusDiffPct = getPixelDiffPct(
    aFocusRaw,
    bFocusRaw,
    focusRegion.width,
    focusRegion.height,
  );

  console.log(
    `${name}: full ${fullDiffPct.toFixed(3)}% | focus ${focusDiffPct.toFixed(3)}%`
  );
}

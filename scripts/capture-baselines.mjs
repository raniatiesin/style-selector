import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('tests/baselines');
const target = process.argv[2] || 'http://127.0.0.1:5173';
const onlyViewport = process.argv[3] || '';

const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

function matchesViewport(viewport, spec) {
  if (!spec) return true;
  const normalized = spec.toLowerCase().replace('x', ':');
  return normalized === `${viewport.width}:${viewport.height}`;
}

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

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  for (const vp of viewports) {
    if (!matchesViewport(vp, onlyViewport)) continue;

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

    const fileName = `${vp.width}x${vp.height}.png`;
    const filePath = path.join(outDir, fileName);
    await page.screenshot({ path: filePath, fullPage: true });

    await context.close();
    console.log(`Saved ${fileName}`);
  }
} finally {
  await browser.close();
}

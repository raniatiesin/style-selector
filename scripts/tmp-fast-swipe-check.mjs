import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function readLandedCardShimmer(page) {
  return page.evaluate(() => {
    const deck = document.querySelector('div[class*="mobileCardDeck"]');
    const slots = Array.from(document.querySelectorAll('div[class*="mobileCardSlot"]'));
    if (!deck || slots.length === 0) return { activeIndex: -1, shimmer: -1 };

    const r = deck.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    let idx = 0;
    let best = Infinity;

    slots.forEach((slot, i) => {
      const sr = slot.getBoundingClientRect();
      const d = Math.abs((sr.top + sr.height / 2) - cy);
      if (d < best) {
        best = d;
        idx = i;
      }
    });

    return {
      activeIndex: idx,
      shimmer: slots[idx].querySelectorAll('div[class*="shimmer"]').length,
    };
  });
}

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('[page error]', msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.log('[unhandled pageerror]', err?.message || String(err));
  });
  page.on('close', () => {
    console.log('[page closed]');
  });

  await page.goto(url, { waitUntil: 'networkidle' });

  const stateInjected = await page.evaluate(async () => {
    try {
      const mod = await import('/src/store/quizStore.js');
      mod.useQuizStore.setState({
        screen: 'output',
        outputResults: [
          { id: 'style_0001', similarity: 0.99 },
          { id: 'style_0002', similarity: 0.98 },
          { id: 'style_0003', similarity: 0.97 },
          { id: 'style_0004', similarity: 0.96 },
          { id: 'style_0005', similarity: 0.95 },
          { id: 'style_0006', similarity: 0.94 },
        ],
        selectedCarousel: 'style_0001',
        isSearching: false,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.message || String(err) };
    }
  });

  console.log('stateInjected', JSON.stringify(stateInjected));

  await page.waitForSelector('div[class*="splitLayout"]', { timeout: 15000 });
  await page.waitForSelector('div[class*="mobileCardDeck"]', { timeout: 10000 });

  const deck = page.locator('div[class*="mobileCardDeck"]').first();

  await deck.evaluate((el) => {
    const slot = el.querySelector('div[class*="mobileCardSlot"]');
    const step = slot ? slot.getBoundingClientRect().height : 600;
    el.scrollTop = step * 3.4;
  });

  const swipeStartTs = Date.now();
  let firstZeroMs = null;
  let firstSample = null;
  let finalSample = null;
  const samples = [];
  const timeoutMs = 3000;
  const pollMs = 25;

  while (Date.now() - swipeStartTs <= timeoutMs) {
    const sample = await readLandedCardShimmer(page);
    const elapsedMs = Date.now() - swipeStartTs;

    if (!firstSample) firstSample = { elapsedMs, ...sample };
    finalSample = { elapsedMs, ...sample };
    samples.push({ elapsedMs, shimmer: sample.shimmer, activeIndex: sample.activeIndex });

    if (sample.shimmer === 0) {
      firstZeroMs = elapsedMs;
      break;
    }

    await wait(pollMs);
  }

  if (firstZeroMs == null) {
    await wait(1500);
    const fallback = await readLandedCardShimmer(page);
    finalSample = { elapsedMs: Date.now() - swipeStartTs, ...fallback };
    samples.push({ elapsedMs: finalSample.elapsedMs, shimmer: fallback.shimmer, activeIndex: fallback.activeIndex });
  }

  console.log(JSON.stringify({
    thresholdMs: 300,
    firstZeroMs,
    firstSample,
    finalSample,
    firstFiveSamples: samples.slice(0, 5),
    lastFiveSamples: samples.slice(-5),
  }, null, 2));
  await context.close();
} finally {
  await browser.close();
}

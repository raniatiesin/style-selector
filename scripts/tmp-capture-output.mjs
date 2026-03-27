import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const url = 'http://127.0.0.1:5173';
const out = 'tests/baselines/output-1440x900.png';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(url, { waitUntil: 'networkidle' });
await page.click('button[class*=makeBtn]');

for (let i = 0; i < 36; i++) {
  await page.waitForSelector('button[class*=nextBtn]', { state: 'visible' });
  await page.click('button[class*=nextBtn]');
  await page.waitForTimeout(20);
}

await page.waitForSelector('[class*=splitLayout]', { state: 'visible', timeout: 60000 });
await page.waitForTimeout(2500);

await fs.mkdir('tests/baselines', { recursive: true });
await page.screenshot({ path: out, fullPage: true });

const data = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const split = q('[class*=splitLayout]');
  const left = q('[class*=leftPanel]');
  const right = q('[class*=rightPanel]');
  const grid = q('[class*=carouselGrid]');
  const selected = q('[class*=selectedCarouselWrap]');
  const tally = q('[class*=tallyGrid]');
  const buttons = q('[class*=buttonRow]');

  const rr = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
    };
  };

  const sr = rr(split);
  const lr = rr(left);
  const rp = rr(right);
  const gr = rr(grid);
  const sc = rr(selected);
  const tg = rr(tally);
  const br = rr(buttons);

  return {
    split: sr,
    left: lr,
    right: rp,
    grid: gr,
    selected: sc,
    tally: tg,
    buttons: br,
    leftOverflow: left ? { clientHeight: left.clientHeight, scrollHeight: left.scrollHeight } : null,
    ratios: (sr && lr && rp)
      ? {
          leftPct: +(lr.w / sr.w * 100).toFixed(1),
          rightPct: +(rp.w / sr.w * 100).toFixed(1),
        }
      : null,
    rightAlignGap: (rp && gr) ? Math.round(rp.right - gr.right) : null,
  };
});

console.log(JSON.stringify({ screenshot: out, ...data }, null, 2));

await context.close();
await browser.close();

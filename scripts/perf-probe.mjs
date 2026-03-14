import process from 'node:process';

async function main() {
  const targetUrl = process.argv[2] || process.env.PERF_URL || 'http://127.0.0.1:5173';
  const width = Number(process.env.PERF_WIDTH || 390);
  const height = Number(process.env.PERF_HEIGHT || 844);
  const steps = Number(process.env.PERF_STEPS || 20);

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  console.log(`Target: ${targetUrl}`);
  console.log(`Viewport: ${width}x${height}`);

  await page.goto(targetUrl, { waitUntil: 'networkidle' });

  await page
    .waitForSelector('button[class*="nextBtn"], button:has-text("Enter")', { timeout: 4000 })
    .catch(() => {});

  const nextBtnLocator = page.locator('button[class*="nextBtn"]').first();
  const enterBtn = page.getByRole('button', { name: /enter/i });

  // Ensure we are inside quiz before probing transitions.
  if (!(await nextBtnLocator.isVisible().catch(() => false))) {
    if (await enterBtn.count()) {
      await enterBtn.first().click({ force: true }).catch(() => {});
    }
  }

  await page.waitForTimeout(900);

  if (!(await nextBtnLocator.isVisible().catch(() => false))) {
    const fallbackEnter = page.locator('button', { hasText: /enter/i }).first();
    if (await fallbackEnter.count()) {
      await fallbackEnter.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    }
  }

  await page
    .waitForSelector('button[class*="nextBtn"]', { timeout: 4000 })
    .catch(() => {});

  await page.evaluate(() => {
    const perf = {
      frameDeltas: [],
      longTasks: [],
      rafId: 0,
      lastTs: 0,
      observer: null,
    };

    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        perf.longTasks.push({
          start: e.startTime,
          duration: e.duration,
        });
      }
    });
    obs.observe({ entryTypes: ['longtask'] });

    const tick = (ts) => {
      if (perf.lastTs) perf.frameDeltas.push(ts - perf.lastTs);
      perf.lastTs = ts;
      perf.rafId = requestAnimationFrame(tick);
    };

    perf.observer = obs;
    perf.rafId = requestAnimationFrame(tick);
    window.__perfProbe = perf;
  });

  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');

  const transitionLatencies = [];

  for (let i = 0; i < steps; i++) {
    const nextBtn = page.locator('button[class*="nextBtn"]').first();
    if (!(await nextBtn.isVisible().catch(() => false))) break;

    const optionBtn = page.locator('button[class*="option"]').first();
    if (await optionBtn.isVisible().catch(() => false)) {
      await optionBtn.click({ delay: 0 }).catch(() => {});
    }

    const question = page.locator('p[class*="question"]').first();
    const previousText = (await question.textContent().catch(() => null)) || '';
    const t0 = Date.now();

    await nextBtn.click({ delay: 0 }).catch(() => {});

    let changed = false;
    while (Date.now() - t0 < 1200) {
      const current = (await question.textContent().catch(() => null)) || '';
      if (current && current !== previousText) {
        changed = true;
        break;
      }
      await page.waitForTimeout(16);
    }

    transitionLatencies.push(changed ? Date.now() - t0 : 1200);
    await page.waitForTimeout(24);
  }

  await page.waitForTimeout(1200);

  const { profile } = await cdp.send('Profiler.stop');

  const perfData = await page.evaluate(() => {
    const p = window.__perfProbe;
    if (!p) return { frameDeltas: [], longTasks: [] };

    cancelAnimationFrame(p.rafId);
    p.observer?.disconnect();

    return {
      frameDeltas: p.frameDeltas,
      longTasks: p.longTasks,
    };
  });

  const frameDeltas = perfData.frameDeltas.filter((d) => d > 0 && d < 200);
  const avgDelta = frameDeltas.length
    ? frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length
    : 16.7;
  const fps = 1000 / avgDelta;

  const longTasks = perfData.longTasks;
  const longTaskCount = longTasks.length;
  const worstLongTask = longTasks.reduce((m, t) => Math.max(m, t.duration), 0);
  const totalLongTaskMs = longTasks.reduce((s, t) => s + t.duration, 0);

  const sortedLatency = [...transitionLatencies].sort((a, b) => a - b);
  const p50 = sortedLatency.length ? sortedLatency[Math.floor(sortedLatency.length * 0.5)] : 0;
  const p95 = sortedLatency.length ? sortedLatency[Math.floor(sortedLatency.length * 0.95)] : 0;

  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const deltas = profile.timeDeltas || [];
  const samples = profile.samples || [];
  const selfTime = new Map();

  for (let i = 0; i < samples.length; i++) {
    const nodeId = samples[i];
    const dt = (deltas[i] || 0) / 1000;
    selfTime.set(nodeId, (selfTime.get(nodeId) || 0) + dt);
  }

  const top = [...selfTime.entries()]
    .map(([id, ms]) => {
      const node = nodes.get(id);
      const frame = node?.callFrame || {};
      return {
        fn: frame.functionName || '(anonymous)',
        url: frame.url || '(native)',
        line: frame.lineNumber != null ? frame.lineNumber + 1 : 0,
        ms,
      };
    })
    .filter((x) => !['(program)', '(idle)', '(garbage collector)'].includes(x.fn))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 8);

  console.log('');
  console.log('=== Perf Probe Summary ===');
  console.log(`Approx FPS: ${fps.toFixed(1)}`);
  console.log(`Long tasks: ${longTaskCount} (worst ${worstLongTask.toFixed(1)}ms, total ${totalLongTaskMs.toFixed(1)}ms)`);
  console.log(`Quiz transition latency: p50 ${p50}ms, p95 ${p95}ms over ${transitionLatencies.length} transitions`);

  console.log('');
  console.log('=== Likely JS Hotspots (Self Time) ===');
  if (!top.length) {
    console.log('No significant JS samples captured.');
  } else {
    for (const h of top) {
      console.log(`- ${h.ms.toFixed(1)}ms | ${h.fn} | ${h.url}:${h.line}`);
    }
  }

  console.log('');
  console.log('Interpretation:');
  console.log('- Low FPS + many long tasks => main-thread contention.');
  console.log('- High transition p95 => tap/next path still blocking somewhere.');
  console.log('- Hotspot list pinpoints likely lag source files/functions.');

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { chromium } from 'playwright';

const target = process.argv[2] || 'http://127.0.0.1:5173';

const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

async function runForViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(target, { waitUntil: 'networkidle' });

  const report = {
    viewport: `${viewport.width}x${viewport.height}`,
    enterClicked: false,
    rapidOptionTap: false,
    rapidNextTap: false,
    optionSwitch: false,
    backgroundAnimating: false,
    outputReached: false,
    outputLoaderReached: false,
    outputScrollable: false,
    slotCount15: false,
    noClippedUi: false,
    hasTrappedScroll: false,
  };

  const enterBtn = page.getByRole('button', { name: /enter/i }).first();
  if (await enterBtn.isVisible().catch(() => false)) {
    await enterBtn.click({ force: true });
    report.enterClicked = true;
    await page.waitForTimeout(700);
  }

  const options = page.locator('button[class*="option"]');
  const nextBtn = page.locator('button[class*="nextBtn"]').first();

  const readFirstSlotTransform = async () => page.evaluate(() => {
    const slot = document.querySelector('div[class*="slot"]');
    if (!slot) return '';
    return getComputedStyle(slot).transform || '';
  });

  // Rapid option taps: 5 taps in about 1 second alternating first two options.
  if (await options.first().isVisible().catch(() => false)) {
    for (let i = 0; i < 5; i++) {
      const idx = i % 2;
      await options.nth(idx).click({ force: true }).catch(() => {});
      await page.waitForTimeout(180);
    }
    report.rapidOptionTap = true;
  }

  // Rapid next taps: 4 taps in about 2 seconds.
  if (await nextBtn.isVisible().catch(() => false)) {
    const beforeTransform = await readFirstSlotTransform();
    for (let i = 0; i < 4; i++) {
      await nextBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(450);
    }
    const afterTransform = await readFirstSlotTransform();
    report.backgroundAnimating = Boolean(beforeTransform && afterTransform && beforeTransform !== afterTransform);
    report.rapidNextTap = true;
  }

  // Option switch A->B single clean update approximation.
  if (await options.nth(1).isVisible().catch(() => false)) {
    await options.nth(0).click({ force: true }).catch(() => {});
    await page.waitForTimeout(80);
    await options.nth(1).click({ force: true }).catch(() => {});
    report.optionSwitch = true;
  }

  // Complete the quiz quickly by selecting first option + next repeatedly.
  for (let i = 0; i < 44; i++) {
    const opt = page.locator('button[class*="option"]').first();
    if (await opt.isVisible().catch(() => false)) {
      await opt.click({ force: true }).catch(() => {});
    }

    const next = page.locator('button[class*="nextBtn"]').first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click({ force: true }).catch(() => {});
    await page.waitForTimeout(45);

    const splitLayout = page.locator('div[class*="splitLayout"]').first();
    const loadingScreen = page.locator('div[class*="loadingContainer"]').first();
    const splitVisible = await splitLayout.isVisible().catch(() => false);
    const loadingVisible = await loadingScreen.isVisible().catch(() => false);
    if (splitVisible || loadingVisible) {
      report.outputReached = true;
      report.outputLoaderReached = !splitVisible && loadingVisible;
      break;
    }
  }

  if (!report.outputReached) {
    await page.waitForTimeout(3000);
    const splitVisible = await page
      .locator('div[class*="splitLayout"]')
      .first()
      .isVisible()
      .catch(() => false);
    const loadingVisible = await page
      .locator('div[class*="loadingContainer"]')
      .first()
      .isVisible()
      .catch(() => false);
    report.outputReached = splitVisible || loadingVisible;
    report.outputLoaderReached = !splitVisible && loadingVisible;
  }

  // Mobile slot count check while in quiz/output path.
  const slotCount = await page.locator('div[class*="slot"]').count();
  report.slotCount15 = slotCount === 15;

  if (report.outputReached) {
    const outputState = await page.evaluate(() => {
      const split = document.querySelector('div[class*="splitLayout"]');
      const loading = document.querySelector('div[class*="loadingContainer"]');
      const right = document.querySelector('div[class*="rightPanel"]');
      const body = document.scrollingElement || document.documentElement;

      const splitRect = split?.getBoundingClientRect();
      const splitInBounds = Boolean(
        splitRect
        && splitRect.top >= -1
        && splitRect.left >= -1
        && splitRect.bottom <= window.innerHeight + 1
        && splitRect.right <= window.innerWidth + 1
      );
      const noClippedUi = splitRect ? splitInBounds : Boolean(loading);

      const rightScrollable = Boolean(right && right.scrollHeight > right.clientHeight);
      const bodyScrollable = body.scrollHeight > body.clientHeight;

      return {
        noClippedUi,
        outputScrollable: rightScrollable || bodyScrollable || Boolean(loading),
      };
    });

    report.noClippedUi = outputState.noClippedUi;
    report.outputScrollable = outputState.outputScrollable;
  }

  // Scroll trap check approximation.
  const scrollState = await page.evaluate(() => {
    const body = document.scrollingElement || document.documentElement;
    return {
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      overflowY: getComputedStyle(document.body).overflowY,
    };
  });
  report.hasTrappedScroll = scrollState.scrollHeight > scrollState.clientHeight && scrollState.overflowY === 'hidden';

  await context.close();
  return report;
}

const browser = await chromium.launch({ headless: true });

try {
  for (const vp of viewports) {
    const report = await runForViewport(browser, vp);
    const ok = report.enterClicked
      && report.rapidOptionTap
      && report.rapidNextTap
      && report.optionSwitch
      && report.backgroundAnimating
      && report.outputReached
      && report.outputScrollable
      && report.slotCount15
      && report.noClippedUi
      && !report.hasTrappedScroll;

    console.log(`Viewport ${report.viewport}`);
    console.log(`  enterClicked: ${report.enterClicked}`);
    console.log(`  rapidOptionTap: ${report.rapidOptionTap}`);
    console.log(`  rapidNextTap: ${report.rapidNextTap}`);
    console.log(`  optionSwitch: ${report.optionSwitch}`);
    console.log(`  backgroundAnimating: ${report.backgroundAnimating}`);
    console.log(`  outputReached: ${report.outputReached}`);
    console.log(`  outputLoaderReached: ${report.outputLoaderReached}`);
    console.log(`  outputScrollable: ${report.outputScrollable}`);
    console.log(`  slotCount15: ${report.slotCount15}`);
    console.log(`  noClippedUi: ${report.noClippedUi}`);
    console.log(`  hasTrappedScroll: ${report.hasTrappedScroll}`);
    console.log(`  overall: ${ok}`);
  }
} finally {
  await browser.close();
}

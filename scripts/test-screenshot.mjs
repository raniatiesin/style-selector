import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/tiedin/index.html');
  await page.waitForTimeout(2000); // Wait for load
  
  // Force it into explain mode
  await page.evaluate(() => {
    document.querySelector('.overlay-root').className = 'overlay-root mode-explain';
  });
  
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'explain-screenshot.png' });
  await browser.close();
})();

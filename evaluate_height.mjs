import puppeteer from 'playwright';

(async () => {
  const browser = await puppeteer.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await page.goto("http://localhost:5173/tiedin/index.html?mode=minecraft");
  await page.waitForTimeout(1000);
  
  const boxHeights = await page.evaluate(() => {
    const box = document.querySelector('.minecraft-box');
    const shell = document.querySelector('.context-shell');
    const webcam = document.querySelector('.frame-webcam');
    return {
      shell: shell ? shell.getBoundingClientRect().toJSON() : null,
      box: box ? box.getBoundingClientRect().toJSON() : null,
      webcam: webcam ? webcam.getBoundingClientRect().toJSON() : null
    };
  });
  console.log(JSON.stringify(boxHeights, null, 2));
  await browser.close();
})();

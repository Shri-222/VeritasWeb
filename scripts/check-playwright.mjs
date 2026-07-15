import { chromium } from 'playwright';

let browser;

try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  const title = await page.title();

  if (!title.toLowerCase().includes('example')) {
    throw new Error(`Unexpected page title: ${title}`);
  }

  console.log(`Playwright Chromium OK: ${title}`);
} finally {
  await browser?.close();
}

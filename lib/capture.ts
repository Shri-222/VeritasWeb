import { chromium } from 'playwright';

export async function captureWebsite(url: string) {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 900,
    },
  });

  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  const html = await page.content();

  const screenshot = await page.screenshot({
    fullPage: true,
    type: 'png',
  });

  const title = await page.title();

  await browser.close();

  return {
    html,
    screenshot,
    title,
  };
}
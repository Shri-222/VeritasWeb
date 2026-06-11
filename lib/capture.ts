import { chromium } from 'playwright';

export async function captureWebsite(url: string) {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 900,
      },
    });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForLoadState('load');

    await page.waitForTimeout(3000);

    const statusCode = response?.status() ?? 200;

    const html = await page.content();

    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    const headers = response?.headers() ?? {};

    const title = await page.title();

    const finalUrl = page.url();

    return {
      html,
      screenshot,
      title,
      finalUrl,
      statusCode,
      headers,
    };
  } finally {
    await browser.close();
  }
}
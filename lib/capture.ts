import { chromium } from 'playwright';

export class CaptureWebsiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptureWebsiteError';
  }
}

export async function captureWebsite(url: string) {
  const capturedAt = new Date().toISOString();
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

    const response = await page
      .goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      .catch((error: unknown) => {
        throw new CaptureWebsiteError(
          error instanceof Error
            ? error.message
            : 'Navigation failed'
        );
      });

    if (!response) {
      throw new CaptureWebsiteError(
        'Navigation did not return a response'
      );
    }

    await page
      .waitForLoadState('load', {
        timeout: 10000,
      })
      .catch(() => undefined);

    await page.waitForTimeout(3000);

    const statusCode = response.status();

    const html = await page.content();

    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    const headers = response?.headers() ?? {};

    const title = await page.title();

    const finalUrl = page.url();

    return {
      originalUrl: url,
      html,
      screenshotBuffer,
      title,
      finalUrl,
      statusCode,
      headers,
      capturedAt,
    };
  } finally {
    await browser.close();
  }
}

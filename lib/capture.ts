import { chromium } from 'playwright';
import { validateCaptureUrl } from '@/lib/schemas';

export const UNSAFE_REDIRECT_MESSAGE =
  'Capture blocked because the target URL redirected to a private or unsafe address.';

export class CaptureWebsiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptureWebsiteError';
  }
}

export class UnsafeCaptureUrlError extends CaptureWebsiteError {
  constructor(
    message = UNSAFE_REDIRECT_MESSAGE
  ) {
    super(message);
    this.name = 'UnsafeCaptureUrlError';
  }
}

export async function captureWebsite(url: string) {
  const capturedAt = new Date().toISOString();
  const initialUrl = await validateCaptureUrl(url);

  if (!initialUrl.success) {
    throw new UnsafeCaptureUrlError(
      initialUrl.message
    );
  }

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
    let unsafeNavigationError: UnsafeCaptureUrlError | null =
      null;

    await page.route('**/*', async (route) => {
      const request = route.request();

      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        const targetUrl = request.url();
        const safeTarget =
          await validateCaptureUrl(targetUrl);

        if (!safeTarget.success) {
          unsafeNavigationError =
            new UnsafeCaptureUrlError();
          await route.abort('blockedbyclient');
          return;
        }
      }

      await route.continue();
    });

    const response = await page
      .goto(initialUrl.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      .catch((error: unknown) => {
        if (unsafeNavigationError) {
          throw unsafeNavigationError;
        }

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
    const safeFinalUrl = await validateCaptureUrl(finalUrl);

    if (!safeFinalUrl.success) {
      throw new UnsafeCaptureUrlError();
    }

    return {
      originalUrl: initialUrl.url,
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

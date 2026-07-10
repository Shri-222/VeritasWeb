export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  fetchOwnedCaptureById,
  getCaptureMonitor,
  getCaptureScreenshotPath,
} from '@/lib/captures';
import {
  createCaptureArtifactProvider,
  resolveCaptureStorageProvider,
} from '@/lib/storage';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';

const paramsSchema = z.object({
  captureId: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ captureId: string }>;
  }
) {
  try {
    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { captureId } = paramsSchema.parse(
      await context.params
    );

    const { data: capture, error } =
      await fetchOwnedCaptureById(
        auth.supabase,
        auth.user.id,
        captureId
      );

    if (error) {
      console.error('[capture:detail]', error);

      return apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to fetch capture.',
        500
      );
    }

    if (!capture) {
      return apiErrorResponse(
        'CAPTURE_NOT_FOUND',
        'Capture not found.',
        404
      );
    }

    const monitor = getCaptureMonitor(capture);
    const screenshotPath =
      getCaptureScreenshotPath(capture);

    let screenshotSignedUrl: string | null = null;

    if (screenshotPath) {
      try {
        const storage = createCaptureArtifactProvider(
          capture.storage_provider,
          getSupabaseAdmin()
        );
        screenshotSignedUrl =
          await storage.createSignedArtifactUrl(
            screenshotPath,
            60 * 10
          );
      } catch (storageError) {
        console.error(
          '[capture:detail:preview]',
          storageError
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: capture.id,
        monitorId: capture.monitor_id,
        monitorUrl: monitor?.url ?? null,
        pageTitle: capture.page_title,
        originalUrl: capture.original_url,
        finalUrl: capture.final_url,
        capturedAt:
          capture.captured_at ?? capture.timestamp,
        statusCode: capture.status_code,
        headers: capture.headers ?? {},
        screenshotPath,
        htmlPath: capture.html_path,
        manifestPath: capture.manifest_path,
        screenshotSignedUrl,
        screenshotSha256:
          capture.screenshot_sha256,
        htmlSha256: capture.html_sha256,
        manifestSha256:
          capture.manifest_sha256 ??
          capture.sha256_hash,
        previousCaptureHash:
          capture.previous_capture_hash,
        triggerType: capture.trigger_type,
        captureStatus: capture.capture_status,
        errorMessage: capture.error_message,
        createdAt: capture.created_at,
        storageProvider: resolveCaptureStorageProvider(
          capture.storage_provider
        ),
      },
    });
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Invalid capture ID.',
        400
      );
    }

    console.error('[capture:detail]', error);

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

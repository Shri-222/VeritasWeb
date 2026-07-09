export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCaptureBucketName } from '@/lib/storage';
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

    const { data: capture, error } = await auth.supabase
      .from('captures')
      .select(
        `
        id,
        monitor_id,
        timestamp,
        captured_at,
        storage_url,
        sha256_hash,
        screenshot_path,
        html_path,
        screenshot_sha256,
        html_sha256,
        manifest_sha256,
        manifest_path,
        original_url,
        final_url,
        page_title,
        capture_status,
        error_message,
        status_code,
        headers,
        previous_capture_hash,
        trigger_type,
        created_at,
        monitors!inner (
          id,
          url,
          user_id
        )
        `
      )
      .eq('id', captureId)
      .eq('monitors.user_id', auth.user.id)
      .maybeSingle();

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

    const monitor = Array.isArray(capture.monitors)
      ? capture.monitors[0]
      : capture.monitors;

    const screenshotPath =
      capture.screenshot_path ??
      capture.storage_url ??
      null;

    let screenshotSignedUrl: string | null = null;

    if (screenshotPath) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: signedUrlData } =
        await supabaseAdmin.storage
          .from(getCaptureBucketName())
          .createSignedUrl(
            screenshotPath,
            60 * 10
          );

      screenshotSignedUrl =
        signedUrlData?.signedUrl ?? null;
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
        captureStatus: capture.capture_status,
        errorMessage: capture.error_message,
        createdAt: capture.created_at,
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

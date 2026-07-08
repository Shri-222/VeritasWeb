export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import {
  verifyEvidenceIntegrity,
} from '@/lib/forensic';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';
import type { Json } from '@/types/database';

const paramsSchema = z.object({
  captureId: z.string().uuid(),
});

type VerificationStatus =
  | 'VERIFIED'
  | 'FAILED'
  | 'MISSING_ARTIFACT'
  | 'INCOMPLETE_METADATA';

function jsonResponse(
  captureId: string,
  status: VerificationStatus,
  message: string
) {
  return NextResponse.json({
    success: true,
    data: {
      captureId,
      verified: false,
      status,
      checks: {
        screenshot: null,
        html: null,
        manifest: null,
      },
      message,
    },
  });
}

function headersToRecord(headers: Json) {
  if (
    !headers ||
    typeof headers !== 'object' ||
    Array.isArray(headers)
  ) {
    return {};
  }

  return Object.entries(headers).reduce<
    Record<string, string>
  >((result, [key, value]) => {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (value !== null && value !== undefined) {
      result[key] = JSON.stringify(value);
    }

    return result;
  }, {});
}

async function blobToBuffer(blob: Blob) {
  return Buffer.from(await blob.arrayBuffer());
}

export async function POST(
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
        original_url,
        final_url,
        page_title,
        status_code,
        headers,
        previous_capture_hash,
        monitors!inner (
          id,
          user_id
        )
        `
      )
      .eq('id', captureId)
      .eq('monitors.user_id', auth.user.id)
      .maybeSingle();

    if (error) {
      console.error('[capture:verify:fetch]', error);

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

    const screenshotPath =
      capture.screenshot_path ??
      capture.storage_url ??
      null;

    const manifestSha256 =
      capture.manifest_sha256 ??
      capture.sha256_hash ??
      null;

    if (
      !screenshotPath ||
      !capture.html_path ||
      !capture.screenshot_sha256 ||
      !capture.html_sha256 ||
      !manifestSha256 ||
      !capture.original_url ||
      !capture.final_url ||
      !capture.captured_at
    ) {
      return jsonResponse(
        captureId,
        'INCOMPLETE_METADATA',
        'Capture metadata is incomplete for verification.'
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const {
      data: screenshotArtifact,
      error: screenshotError,
    } = await supabaseAdmin.storage
      .from('captures')
      .download(screenshotPath);

    const {
      data: htmlArtifact,
      error: htmlError,
    } = await supabaseAdmin.storage
      .from('captures')
      .download(capture.html_path);

    if (
      screenshotError ||
      htmlError ||
      !screenshotArtifact ||
      !htmlArtifact
    ) {
      if (screenshotError || htmlError) {
        console.error('[capture:verify:storage]', {
          screenshotError,
          htmlError,
        });
      }

      return jsonResponse(
        captureId,
        'MISSING_ARTIFACT',
        'One or more capture artifacts are missing.'
      );
    }

    const result = await verifyEvidenceIntegrity({
      screenshotContent:
        await blobToBuffer(screenshotArtifact),
      htmlContent: await blobToBuffer(htmlArtifact),
      manifestInput: {
        original_url: capture.original_url,
        final_url: capture.final_url,
        page_title: capture.page_title ?? null,
        captured_at: capture.captured_at,
        status_code: capture.status_code,
        headers: headersToRecord(capture.headers),
        screenshot_path: screenshotPath,
        html_path: capture.html_path,
        previous_capture_hash:
          capture.previous_capture_hash ?? null,
      },
      stored: {
        screenshot_sha256:
          capture.screenshot_sha256,
        html_sha256: capture.html_sha256,
        manifest_sha256: manifestSha256,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        captureId,
        ...result,
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

    console.error('[capture:verify]', error);

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

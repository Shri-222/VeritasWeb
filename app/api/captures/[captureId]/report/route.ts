export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import {
  fetchOwnedCaptureById,
} from '@/lib/captures';
import { generateCaptureReportPdf } from '@/lib/pdf-report';
import {
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';
import { verifyCaptureArtifacts } from '@/lib/verification';

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

    const rateLimit = checkRateLimit({
      key: `pdf-report:${auth.user.id}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse();
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
      console.error('[capture:report:fetch]', error);

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

    const supabaseAdmin = getSupabaseAdmin();
    const verification = await verifyCaptureArtifacts(
      capture,
      supabaseAdmin
    );

    const pdfBuffer = generateCaptureReportPdf({
      capture,
      verification,
      generatedAt: new Date().toISOString(),
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="veritasweb-capture-${captureId}.pdf"`,
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

    console.error('[capture:report]', error);

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

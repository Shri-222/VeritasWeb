import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import {
  CaptureServiceError,
  runMonitorCapture,
} from '@/lib/capture-service';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';

const captureNowSchema = z.object({
  monitorId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const body = await request.json();
    const { monitorId } =
      captureNowSchema.parse(body);

    const { data: monitor, error: monitorError } =
      await auth.supabase
        .from('monitors')
        .select('*')
        .eq('id', monitorId)
        .eq('user_id', auth.user.id)
        .maybeSingle();

    if (monitorError || !monitor) {
      if (monitorError) {
        console.error(
          '[capture-now:monitor]',
          monitorError
        );
      }

      return apiErrorResponse(
        'MONITOR_NOT_FOUND',
        'Monitor not found.',
        404
      );
    }

    const result = await runMonitorCapture({
      monitor,
      userId: auth.user.id,
      triggerType: 'manual',
      supabaseAdmin: getSupabaseAdmin(),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    if (error instanceof SyntaxError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Invalid JSON body.',
        400
      );
    }

    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'monitorId is required and must be a valid UUID.',
        400
      );
    }

    if (error instanceof CaptureServiceError) {
      return apiErrorResponse(
        error.code,
        error.safeMessage,
        error.status
      );
    }

    console.error('[capture-now]', error);

    return apiErrorResponse(
      'CAPTURE_FAILED',
      'Capture failed.',
      500
    );
  }
}

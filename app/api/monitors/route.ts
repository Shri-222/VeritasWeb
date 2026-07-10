/**
 * POST /api/monitors
 * 
 * Creates a new web monitoring job for the authenticated user.
 * Validates input with Zod and stores in Supabase with RLS.
 */

import {
  createMonitorSchema,
  validateCaptureUrl,
} from '@/lib/schemas';
import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BETA_LIMIT_MESSAGE, checkMonitorBetaLimit } from '@/lib/beta';

export async function POST(request: NextRequest) {
  try {
    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const betaLimit = await checkMonitorBetaLimit(auth.supabase, auth.user.id);
    if (!betaLimit.allowed) return apiErrorResponse('BETA_LIMIT_REACHED', BETA_LIMIT_MESSAGE, 429);

    const body = await request.json();

    // Validate request body with Zod
    const validatedData = createMonitorSchema.parse(body);

    const safeUrl = await validateCaptureUrl(
      validatedData.url
    );

    if (!safeUrl.success) {
      return apiErrorResponse(
        safeUrl.code,
        safeUrl.message,
        400
      );
    }

    if (validatedData.case_id) {
      const { data: ownedCase, error: caseError } = await auth.supabase
        .from('cases')
        .select('id')
        .eq('id', validatedData.case_id)
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (caseError || !ownedCase) {
        return apiErrorResponse('CASE_NOT_FOUND', 'Case not found.', 404);
      }
    }

    const now = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from('monitors')
      .insert({
        user_id: auth.user.id,

        url: safeUrl.url,

        normalized_url: safeUrl.url,

        frequency:
          validatedData.frequency,

        status: 'active',

        session_cookies:
          validatedData.session_cookies ??
          null,

        next_capture_at: now,
        last_capture_status: null,
        last_capture_error: null,
        capture_count: 0,
        capture_lock_until: null,
        case_id: validatedData.case_id ?? null,
      })
      .select();

    if (error) {
      console.error('[v0] Supabase insert error:', error);
      return apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to create monitor.',
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: data[0],
      },
      { status: 201 }
    );
  } catch (err) {
    if (isMissingSupabaseEnvError(err)) {
      return missingSupabaseEnvResponse();
    }

    if (err instanceof SyntaxError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Invalid JSON body.',
        400
      );
    }

    if (err instanceof z.ZodError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Monitor input is invalid.',
        400
      );
    }

    console.error('[v0] Unexpected error:', err);
    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

/**
 * GET /api/monitors
 * 
 * Retrieves all monitors for the authenticated user.
 * RLS ensures users only see their own data.
 */
export async function GET(request: NextRequest) {
  try {
    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { data, error } = await auth.supabase
      .from('monitors')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[v0] Supabase query error:', error);
      return apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to fetch monitors.',
        500
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    if (isMissingSupabaseEnvError(err)) {
      return missingSupabaseEnvResponse();
    }

    console.error('[v0] Unexpected error:', err);
    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

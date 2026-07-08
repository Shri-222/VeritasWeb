/**
 * POST /api/monitors
 * 
 * Creates a new web monitoring job for the authenticated user.
 * Validates input with Zod and stores in Supabase with RLS.
 */

import { createMonitorSchema } from '@/lib/schemas';
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

export async function POST(request: NextRequest) {
  try {
    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const body = await request.json();

    // Validate request body with Zod
    const validatedData = createMonitorSchema.parse(body);

    const normalizedUrl = new URL(
      validatedData.url
    ).toString();

    const { data, error } = await auth.supabase
      .from('monitors')
      .insert({
      user_id: auth.user.id,

      url: validatedData.url,

      normalized_url: normalizedUrl,

      frequency:
        validatedData.frequency,

      status: 'active',

      session_cookies:
        validatedData.session_cookies ??
        null,
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

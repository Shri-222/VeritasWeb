/**
 * GET /api/captures
 * POST /api/captures
 *
 * Forensic capture management endpoints.
 * Handles retrieval and creation of web capture snapshots
 * with cryptographic integrity validation.
 */

export const runtime = 'nodejs';

import {
  captureFiltersSchema,
} from '@/lib/schemas';

import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { z } from 'zod';

// -----------------------------------------------------
// POST /api/captures
// Client capture creation is intentionally disabled.
// -----------------------------------------------------

export async function POST(
  request: NextRequest
) {
  try {
    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    return apiErrorResponse(
      'FORBIDDEN',
      'Capture records must be created by the server capture pipeline.',
      403
    );
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    console.error(
      '[captures:post]',
      error
    );

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

// -----------------------------------------------------
// GET /api/captures
// Fetch forensic captures
// -----------------------------------------------------

export async function GET(
  request: NextRequest
) {
  try {
    // ---------------------------------------------
    // Authentication
    // ---------------------------------------------

    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    // ---------------------------------------------
    // Parse Query Parameters
    // ---------------------------------------------

    const searchParams =
      request.nextUrl.searchParams;

    const filters =
      captureFiltersSchema.parse({
        monitor_id:
          searchParams.get(
            'monitor_id'
          ) || undefined,

        start_date:
          searchParams.get(
            'start_date'
          ) || undefined,

        end_date:
          searchParams.get(
            'end_date'
          ) || undefined,

        limit: Number(
          searchParams.get('limit') ?? 50
        ),

        offset: Number(
          searchParams.get('offset') ?? 0
        ),
      });

    if (filters.monitor_id) {
      const {
        data: ownedMonitor,
        error: monitorError,
      } = await auth.supabase
        .from('monitors')
        .select('id')
        .eq('id', filters.monitor_id)
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (monitorError) {
        console.error(
          '[captures:get:monitor]',
          monitorError
        );

        return apiErrorResponse(
          'INTERNAL_ERROR',
          'Failed to verify monitor ownership.',
          500
        );
      }

      if (!ownedMonitor) {
        return apiErrorResponse(
          'MONITOR_NOT_FOUND',
          'Monitor not found.',
          404
        );
      }
    }

    // ---------------------------------------------
    // Build Query
    // ---------------------------------------------

    let query = auth.supabase
      .from('captures')
      .select(
        `
        id,
        monitor_id,
        timestamp,
        storage_url,
        sha256_hash,
        tsa_token,
        status_code,
        headers,
        previous_capture_hash,
        created_at,
        monitors!inner (
          id,
          url,
          user_id
        )
        `,
        {
          count: 'exact',
        }
      )
      .eq(
        'monitors.user_id',
        auth.user.id
      )
      .order('timestamp', {
        ascending: false,
      });

    // ---------------------------------------------
    // Apply Filters
    // ---------------------------------------------

    if (filters.monitor_id) {
      query = query.eq(
        'monitor_id',
        filters.monitor_id
      );
    }

    if (filters.start_date) {
      query = query.gte(
        'timestamp',
        filters.start_date
      );
    }

    if (filters.end_date) {
      query = query.lte(
        'timestamp',
        filters.end_date
      );
    }

    // ---------------------------------------------
    // Pagination
    // ---------------------------------------------

    query = query.range(
      filters.offset,
      filters.offset +
        filters.limit -
        1
    );

    // ---------------------------------------------
    // Execute Query
    // ---------------------------------------------

    const {
      data,
      error,
      count,
    } = await query;

    if (error) {
      console.error(
        '[captures:get]',
        error
      );

      return apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to fetch captures.',
        500
      );
    }

    // ---------------------------------------------
    // Success
    // ---------------------------------------------

    return NextResponse.json({
      success: true,
      data,

      pagination: {
        total: count ?? 0,
        limit: filters.limit,
        offset: filters.offset,
      },
    });
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    // ---------------------------------------------
    // Validation Errors
    // ---------------------------------------------

    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Invalid query parameters.',
        400
      );
    }

    // ---------------------------------------------
    // Unexpected Errors
    // ---------------------------------------------

    console.error(
      '[captures:get]',
      error
    );

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

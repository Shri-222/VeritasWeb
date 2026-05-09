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
  createCaptureSchema,
  captureFiltersSchema,
} from '@/lib/schemas';

import { supabaseAdmin } from '@/lib/supabase/admin';

import {
  generateInternalTimestampProof,
} from '@/lib/forensic';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { z } from 'zod';

// -----------------------------------------------------
// Auth Helper
// -----------------------------------------------------

async function getUserId(
  request: NextRequest
): Promise<string | null> {
  try {
    const authHeader =
      request.headers.get('Authorization');

    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ')
    ) {
      return null;
    }

    const token = authHeader.substring(7);

    const { data, error } =
      await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return data.user.id;
  } catch {
    return null;
  }
}

// -----------------------------------------------------
// POST /api/captures
// Create forensic capture
// -----------------------------------------------------

export async function POST(
  request: NextRequest
) {
  try {
    // ---------------------------------------------
    // Authentication
    // ---------------------------------------------

    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ---------------------------------------------
    // Parse & Validate Body
    // ---------------------------------------------

    const body = await request.json();

    const validatedData =
      createCaptureSchema.parse(body);

    // ---------------------------------------------
    // Verify Monitor Ownership
    // ---------------------------------------------

    const {
      data: monitor,
      error: monitorError,
    } = await supabaseAdmin
      .from('monitors')
      .select('id')
      .eq('id', validatedData.monitor_id)
      .eq('user_id', userId)
      .single();

    if (monitorError || !monitor) {
      return NextResponse.json(
        {
          error:
            'Monitor not found or unauthorized',
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------
    // Get Previous Capture
    // For forensic chaining
    // ---------------------------------------------

    const {
      data: previousCapture,
    } = await supabaseAdmin
      .from('captures')
      .select('sha256_hash')
      .eq(
        'monitor_id',
        validatedData.monitor_id
      )
      .order('timestamp', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    // ---------------------------------------------
    // Generate Timestamp Proof
    // ---------------------------------------------

    const tsaToken =
      await generateInternalTimestampProof(
        validatedData.sha256_hash
      );

    // ---------------------------------------------
    // Insert Capture
    // ---------------------------------------------

    const {
      data: capture,
      error: insertError,
    } = await supabaseAdmin
      .from('captures')
      .insert({
        monitor_id:
          validatedData.monitor_id,

        storage_url:
          validatedData.storage_url,

        sha256_hash:
          validatedData.sha256_hash
            .toLowerCase(),

        status_code:
          validatedData.status_code,

        headers:
          validatedData.headers,

        tsa_token: tsaToken,

        previous_capture_hash:
          previousCapture?.sha256_hash ??
          null,
      })
      .select()
      .single();

    if (insertError) {
      console.error(
        '[captures:create]',
        insertError
      );

      return NextResponse.json(
        {
          error:
            'Failed to create capture',
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------
    // Success
    // ---------------------------------------------

    return NextResponse.json(
      capture,
      { status: 201 }
    );
  } catch (error) {
    // ---------------------------------------------
    // Invalid JSON
    // ---------------------------------------------

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // Validation Errors
    // ---------------------------------------------

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.flatten(),
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // Unexpected Errors
    // ---------------------------------------------

    console.error(
      '[captures:post]',
      error
    );

    return NextResponse.json(
      {
        error:
          'Internal server error',
      },
      { status: 500 }
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

    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    // ---------------------------------------------
    // Build Query
    // ---------------------------------------------

    let query = supabaseAdmin
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
        userId
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

      return NextResponse.json(
        {
          error:
            'Failed to fetch captures',
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------
    // Success
    // ---------------------------------------------

    return NextResponse.json({
      data,

      pagination: {
        total: count ?? 0,
        limit: filters.limit,
        offset: filters.offset,
      },
    });
  } catch (error) {
    // ---------------------------------------------
    // Validation Errors
    // ---------------------------------------------

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            'Invalid query parameters',

          details:
            error.flatten(),
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // Unexpected Errors
    // ---------------------------------------------

    console.error(
      '[captures:get]',
      error
    );

    return NextResponse.json(
      {
        error:
          'Internal server error',
      },
      { status: 500 }
    );
  }
}
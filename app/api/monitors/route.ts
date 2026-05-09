/**
 * POST /api/monitors
 * 
 * Creates a new web monitoring job for the authenticated user.
 * Validates input with Zod and stores in Supabase with RLS.
 */

import { createMonitorSchema } from '@/lib/schemas';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';
import { NextRequest, NextResponse } from 'next/server';

// Helper: Extract user ID from Authorization header
async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // Verify token with Supabase
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validatedData = createMonitorSchema.parse(body);

    const normalizedUrl = new URL(
      validatedData.url
    ).toString();
    // Insert monitor into database
    // RLS will automatically enforce user_id isolation
    const { data, error } = await supabaseAdmin
      .from('monitors')
      .insert({
      user_id: userId,

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
      return NextResponse.json(
        { error: 'Failed to create monitor' },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0], { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    if (err instanceof Error && err.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: err.message },
        { status: 400 }
      );
    }

    console.error('[v0] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
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
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[v0] Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch monitors' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

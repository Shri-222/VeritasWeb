import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';

const caseInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { data, error } = await auth.supabase
    .from('cases')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[cases:list]', error);
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch cases.', 500);
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const input = caseInputSchema.parse(await request.json());
    const { data, error } = await auth.supabase
      .from('cases')
      .insert({
        user_id: auth.user.id,
        name: input.name,
        description: input.description ?? null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) {
      console.error('[cases:create]', error);
      return apiErrorResponse('INTERNAL_ERROR', 'Failed to create case.', 500);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse('VALIDATION_ERROR', 'Case input is invalid.', 400);
    }
    return apiErrorResponse('VALIDATION_ERROR', 'Invalid JSON body.', 400);
  }
}


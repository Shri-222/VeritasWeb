import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';
import {
  isMissingTableError,
  logSupabaseError,
} from '@/lib/database-errors';
import { rowsOrEmpty } from '@/lib/startup-compat';
import { findDuplicateCase } from '@/lib/case-duplicates';
import { mapUniqueViolation } from '@/lib/duplicate-conflicts';
import { normalizeCaseName } from '@/lib/normalization';

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
    logSupabaseError('[cases:list]', error);
    if (isMissingTableError(error, 'cases')) {
      return apiErrorResponse(
        'DATABASE_MIGRATION_REQUIRED',
        'The cases database migration has not been applied.',
        503
      );
    }
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch cases.', 500);
  }

  return NextResponse.json({ success: true, data: rowsOrEmpty(data) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const input = caseInputSchema.parse(await request.json());
    const normalizedName = normalizeCaseName(input.name);
    const duplicateResult = await findDuplicateCase(
      auth.supabase,
      {
        userId: auth.user.id,
        normalizedName,
      }
    );

    if (duplicateResult.error) {
      logSupabaseError(
        '[cases:create:duplicate-check]',
        duplicateResult.error
      );
      if (isMissingTableError(duplicateResult.error, 'cases')) {
        return apiErrorResponse(
          'DATABASE_MIGRATION_REQUIRED',
          'The cases database migration has not been applied.',
          503
        );
      }
      return apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to check existing cases.',
        500
      );
    }

    if (duplicateResult.data) {
      return apiErrorResponse(
        'CASE_ALREADY_EXISTS',
        'A case with this name already exists.',
        409
      );
    }

    const { data, error } = await auth.supabase
      .from('cases')
      .insert({
        user_id: auth.user.id,
        name: normalizedName,
        description: input.description ?? null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) {
      const duplicate = mapUniqueViolation(error, 'case');
      if (duplicate) {
        if (process.env.NODE_ENV !== 'production') {
          logSupabaseError('Case duplicate insert blocked', error);
        }
        return apiErrorResponse(
          duplicate.code,
          duplicate.message,
          duplicate.status
        );
      }
      logSupabaseError('[cases:create]', error);
      if (isMissingTableError(error, 'cases')) {
        return apiErrorResponse(
          'DATABASE_MIGRATION_REQUIRED',
          'The cases database migration has not been applied.',
          503
        );
      }
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

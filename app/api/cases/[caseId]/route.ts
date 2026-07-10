import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';
import {
  isMissingTableError,
  logSupabaseError,
} from '@/lib/database-errors';

const paramsSchema = z.object({ caseId: z.string().uuid() });
const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'No updates supplied');

async function getOwnedCase(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return { auth, caseId: null, data: null, errorResponse: auth.errorResponse };
  const { caseId } = paramsSchema.parse(await context.params);
  const { data, error } = await auth.supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) {
    logSupabaseError('[case:fetch]', error);
    if (isMissingTableError(error, 'cases')) {
      return { auth, caseId, data: null, errorResponse: apiErrorResponse('DATABASE_MIGRATION_REQUIRED', 'The cases database migration has not been applied.', 503) };
    }
    return { auth, caseId, data: null, errorResponse: apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch case.', 500) };
  }
  if (!data) return { auth, caseId, data: null, errorResponse: apiErrorResponse('CASE_NOT_FOUND', 'Case not found.', 404) };
  return { auth, caseId, data, errorResponse: null };
}

export async function GET(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const result = await getOwnedCase(request, context);
  if (result.errorResponse) return result.errorResponse;

  const { data: monitors, error: monitorError } = await result.auth.supabase
    .from('monitors')
    .select('id, url, status, frequency, capture_count, last_captured_at, next_capture_at')
    .eq('case_id', result.caseId)
    .eq('user_id', result.auth.user.id)
    .order('updated_at', { ascending: false });

  const monitorIds = (monitors ?? []).map((monitor) => monitor.id);
  const { data: captures, error: captureError } = monitorIds.length
    ? await result.auth.supabase
      .from('captures')
      .select('id, monitor_id, page_title, final_url, captured_at, capture_status, manifest_sha256')
      .in('monitor_id', monitorIds)
      .order('captured_at', { ascending: false })
      .limit(20)
    : { data: [], error: null };

  if (monitorError || captureError) {
    console.error('[case:detail]', monitorError ?? captureError);
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch case records.', 500);
  }
  return NextResponse.json({ success: true, data: { case: result.data, monitors, captures } });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const result = await getOwnedCase(request, context);
  if (result.errorResponse) return result.errorResponse;
  try {
    const input = updateSchema.parse(await request.json());
    const { data, error } = await result.auth.supabase
      .from('cases')
      .update(input)
      .eq('id', result.caseId)
      .eq('user_id', result.auth.user.id)
      .select('*')
      .single();
    if (error) {
      console.error('[case:update]', error);
      return apiErrorResponse('INTERNAL_ERROR', 'Failed to update case.', 500);
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse('VALIDATION_ERROR', error instanceof z.ZodError ? 'Case input is invalid.' : 'Invalid JSON body.', 400);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const result = await getOwnedCase(request, context);
  if (result.errorResponse) return result.errorResponse;
  const { count, error: countError } = await result.auth.supabase
    .from('monitors')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', result.caseId)
    .eq('user_id', result.auth.user.id);
  if (countError) return apiErrorResponse('INTERNAL_ERROR', 'Failed to inspect case records.', 500);

  if ((count ?? 0) > 0) {
    const { data, error } = await result.auth.supabase
      .from('cases')
      .update({ status: 'archived' })
      .eq('id', result.caseId)
      .select('*')
      .single();
    if (error) return apiErrorResponse('INTERNAL_ERROR', 'Failed to archive case.', 500);
    return NextResponse.json({ success: true, archived: true, data });
  }

  const { error } = await result.auth.supabase.from('cases').delete().eq('id', result.caseId);
  if (error) return apiErrorResponse('INTERNAL_ERROR', 'Failed to delete case.', 500);
  return NextResponse.json({ success: true, deleted: true });
}

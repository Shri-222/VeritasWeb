export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';
import { fetchOwnedCaptureById } from '@/lib/captures';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCaptureBucketName } from '@/lib/storage';
import {
  isMissingTableError,
  logSupabaseError,
} from '@/lib/database-errors';

const paramsSchema = z.object({ captureId: z.string().uuid() });

export async function GET(request: NextRequest, context: { params: Promise<{ captureId: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiErrorResponse('CAPTURE_NOT_FOUND', 'Capture not found.', 404);
  const { data: capture, error: captureError } = await fetchOwnedCaptureById(auth.supabase, auth.user.id, parsed.data.captureId);
  if (captureError) {
    console.error('[capture:diff:owner]', captureError);
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch capture.', 500);
  }
  if (!capture) return apiErrorResponse('CAPTURE_NOT_FOUND', 'Capture not found.', 404);

  const { data: diff, error } = await auth.supabase
    .from('capture_diffs')
    .select('*')
    .eq('current_capture_id', capture.id)
    .eq('monitor_id', capture.monitor_id)
    .maybeSingle();
  if (error) {
    logSupabaseError('[capture:diff:fetch]', error);
    if (isMissingTableError(error, 'capture_diffs')) {
      return apiErrorResponse(
        'DATABASE_MIGRATION_REQUIRED',
        'The change detection database migration has not been applied.',
        503
      );
    }
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch capture diff.', 500);
  }
  if (!diff) return NextResponse.json({ success: true, data: { status: 'FIRST_CAPTURE', diff: null } });

  let visualDiffSignedUrl: string | null = null;
  if (diff.visual_diff_path) {
    const { data } = await getSupabaseAdmin().storage.from(getCaptureBucketName()).createSignedUrl(diff.visual_diff_path, 600);
    visualDiffSignedUrl = data?.signedUrl ?? null;
  }
  return NextResponse.json({ success: true, data: { status: diff.changed ? 'CHANGED' : 'NO_CHANGE', diff, visualDiffSignedUrl } });
}

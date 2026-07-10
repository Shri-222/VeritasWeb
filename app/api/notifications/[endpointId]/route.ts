import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';
import {
  isMissingTableError,
  logSupabaseError,
} from '@/lib/database-errors';

const paramsSchema = z.object({ endpointId: z.string().uuid() });

export async function PATCH(request: NextRequest, context: { params: Promise<{ endpointId: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiErrorResponse('NOTIFICATION_NOT_FOUND', 'Notification endpoint not found.', 404);
  const body = await request.json().catch(() => null);
  const enabled = z.object({ enabled: z.boolean() }).safeParse(body);
  if (!enabled.success) return apiErrorResponse('VALIDATION_ERROR', 'Notification input is invalid.', 400);
  const { data, error } = await auth.supabase.from('notification_endpoints').update({ enabled: enabled.data.enabled }).eq('id', parsed.data.endpointId).eq('user_id', auth.user.id).select('id, type, destination, enabled, created_at').maybeSingle();
  if (error) {
    logSupabaseError('[notifications:update]', error);
    if (isMissingTableError(error, 'notification_endpoints')) {
      return apiErrorResponse('DATABASE_MIGRATION_REQUIRED', 'The notifications database migration has not been applied.', 503);
    }
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to update notification endpoint.', 500);
  }
  if (!data) return apiErrorResponse('NOTIFICATION_NOT_FOUND', 'Notification endpoint not found.', 404);
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ endpointId: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiErrorResponse('NOTIFICATION_NOT_FOUND', 'Notification endpoint not found.', 404);
  const { data, error } = await auth.supabase.from('notification_endpoints').delete().eq('id', parsed.data.endpointId).eq('user_id', auth.user.id).select('id').maybeSingle();
  if (error) {
    logSupabaseError('[notifications:delete]', error);
    if (isMissingTableError(error, 'notification_endpoints')) {
      return apiErrorResponse('DATABASE_MIGRATION_REQUIRED', 'The notifications database migration has not been applied.', 503);
    }
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to delete notification endpoint.', 500);
  }
  if (!data) return apiErrorResponse('NOTIFICATION_NOT_FOUND', 'Notification endpoint not found.', 404);
  return NextResponse.json({ success: true });
}

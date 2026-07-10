export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';
import { validateWebhookDestination } from '@/lib/notifications';
import {
  isMissingTableError,
  logSupabaseError,
} from '@/lib/database-errors';
import {
  emptyNotificationConfiguration,
  rowsOrEmpty,
} from '@/lib/startup-compat';

const inputSchema = z.object({
  type: z.enum(['webhook', 'email']),
  destination: z.string().trim().min(1).max(2048),
});

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase.from('notification_endpoints').select('id, type, destination, enabled, created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false });
  const emailAvailable = Boolean(process.env.EMAIL_PROVIDER && process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  if (error) {
    logSupabaseError('[notifications:list]', error);
    if (isMissingTableError(error, 'notification_endpoints')) {
      return NextResponse.json({
        success: true,
        data: emptyNotificationConfiguration(),
      });
    }
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch notification settings.', 500);
  }
  return NextResponse.json({ success: true, data: { endpoints: rowsOrEmpty(data), settings: null, emailAvailable } });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;
  try {
    const input = inputSchema.parse(await request.json());
    if (input.type === 'webhook') {
      const destination = await validateWebhookDestination(input.destination);
      if (!destination.success) return apiErrorResponse(destination.code, destination.message, 400);
      input.destination = destination.url;
    } else if (!process.env.EMAIL_PROVIDER || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      return apiErrorResponse('FEATURE_NOT_CONFIGURED', 'Email delivery is not configured.', 503);
    }
    const { data, error } = await auth.supabase.from('notification_endpoints').insert({ user_id: auth.user.id, type: input.type, destination: input.destination, enabled: true }).select('id, type, destination, enabled, created_at').single();
    if (error) {
      logSupabaseError('[notifications:create]', error);
      if (isMissingTableError(error, 'notification_endpoints')) {
        return apiErrorResponse('DATABASE_MIGRATION_REQUIRED', 'The notifications database migration has not been applied.', 503);
      }
      return apiErrorResponse('INTERNAL_ERROR', 'Failed to save notification endpoint.', 500);
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse('VALIDATION_ERROR', error instanceof z.ZodError ? 'Notification input is invalid.' : 'Invalid JSON body.', 400);
  }
}

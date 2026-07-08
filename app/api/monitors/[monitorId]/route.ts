import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import {
  updateMonitorSchema,
  validateCaptureUrl,
} from '@/lib/schemas';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

const paramsSchema = z.object({
  monitorId: z.string().uuid(),
});

type MonitorUpdate =
  Database['public']['Tables']['monitors']['Update'];

async function getOwnedMonitor(
  request: NextRequest,
  context: {
    params: Promise<{ monitorId: string }>;
  }
) {
  const auth = await authenticateApiRequest(request);

  if (auth.errorResponse) {
    return {
      auth,
      monitorId: null,
      monitor: null,
      errorResponse: auth.errorResponse,
    };
  }

  const { monitorId } = paramsSchema.parse(
    await context.params
  );

  const { data: monitor, error } = await auth.supabase
    .from('monitors')
    .select('*')
    .eq('id', monitorId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error) {
    console.error('[monitor:item:fetch]', error);

    return {
      auth,
      monitorId,
      monitor: null,
      errorResponse: apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to fetch monitor.',
        500
      ),
    };
  }

  if (!monitor) {
    return {
      auth,
      monitorId,
      monitor: null,
      errorResponse: apiErrorResponse(
        'MONITOR_NOT_FOUND',
        'Monitor not found.',
        404
      ),
    };
  }

  return {
    auth,
    monitorId,
    monitor,
    errorResponse: null,
  };
}

async function getCaptureCount(
  auth: Awaited<ReturnType<typeof authenticateApiRequest>>,
  monitorId: string
) {
  if (auth.errorResponse) {
    return {
      count: 0,
      error: null,
    };
  }

  const { count, error } = await auth.supabase
    .from('captures')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('monitor_id', monitorId);

  return {
    count: count ?? 0,
    error,
  };
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ monitorId: string }>;
  }
) {
  try {
    const result = await getOwnedMonitor(request, context);

    if (result.errorResponse) {
      return result.errorResponse;
    }

    return NextResponse.json({
      success: true,
      data: result.monitor,
    });
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Invalid monitor ID.',
        400
      );
    }

    console.error('[monitor:item:get]', error);

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ monitorId: string }>;
  }
) {
  try {
    const result = await getOwnedMonitor(request, context);

    if (result.errorResponse) {
      return result.errorResponse;
    }

    const body = await request.json();
    const input = updateMonitorSchema.parse(body);
    const update: MonitorUpdate = {};

    if (input.frequency) {
      update.frequency = input.frequency;
    }

    if (input.status) {
      update.status = input.status;

      if (input.status === 'paused') {
        update.next_capture_at = null;
        update.capture_lock_until = null;
      } else if (!result.monitor.next_capture_at) {
        update.next_capture_at = new Date().toISOString();
      }
    }

    if (input.session_cookies !== undefined) {
      update.session_cookies = input.session_cookies;
    }

    if (input.url) {
      const { count, error } = await getCaptureCount(
        result.auth,
        result.monitorId
      );

      if (error) {
        console.error(
          '[monitor:item:patch:capture-count]',
          error
        );

        return apiErrorResponse(
          'INTERNAL_ERROR',
          'Failed to inspect monitor captures.',
          500
        );
      }

      if (count > 0) {
        return apiErrorResponse(
          'MONITOR_HAS_CAPTURES',
          'Create a new monitor for a different URL because this monitor already has evidence records.',
          409
        );
      }

      const safeUrl = await validateCaptureUrl(input.url);

      if (!safeUrl.success) {
        return apiErrorResponse(
          safeUrl.code,
          safeUrl.message,
          400
        );
      }

      update.url = safeUrl.url;
      update.normalized_url = safeUrl.url;
    }

    const { data: monitor, error } =
      await result.auth.supabase
        .from('monitors')
        .update(update)
        .eq('id', result.monitorId)
        .eq('user_id', result.auth.user.id)
        .select()
        .single();

    if (error) {
      console.error('[monitor:item:patch]', error);

      return apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to update monitor.',
        500
      );
    }

    return NextResponse.json({
      success: true,
      data: monitor,
    });
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    if (error instanceof SyntaxError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Invalid JSON body.',
        400
      );
    }

    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Monitor update input is invalid.',
        400
      );
    }

    console.error('[monitor:item:patch]', error);

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ monitorId: string }>;
  }
) {
  try {
    const result = await getOwnedMonitor(request, context);

    if (result.errorResponse) {
      return result.errorResponse;
    }

    const { count, error: countError } =
      await getCaptureCount(
        result.auth,
        result.monitorId
      );

    if (countError) {
      console.error(
        '[monitor:item:delete:capture-count]',
        countError
      );

      return apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to inspect monitor captures.',
        500
      );
    }

    if (count > 0) {
      return apiErrorResponse(
        'MONITOR_HAS_CAPTURES',
        'Monitors with evidence records cannot be deleted. Pause the monitor instead.',
        409
      );
    }

    const { error } = await getSupabaseAdmin()
      .from('monitors')
      .delete()
      .eq('id', result.monitorId)
      .eq('user_id', result.auth.user.id);

    if (error) {
      console.error('[monitor:item:delete]', error);

      return apiErrorResponse(
        'INTERNAL_ERROR',
        'Failed to delete monitor.',
        500
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.monitorId,
        deleted: true,
      },
    });
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Invalid monitor ID.',
        400
      );
    }

    console.error('[monitor:item:delete]', error);

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}

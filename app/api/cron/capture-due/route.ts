export const runtime = 'nodejs';

import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CaptureServiceError,
  runMonitorCapture,
} from '@/lib/capture-service';
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';

const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(10)
  .default(5);

function unauthorizedCronResponse() {
  return NextResponse.json(
    {
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Invalid cron secret.',
    },
    { status: 401 }
  );
}

function getCronSecret(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

export async function POST(request: NextRequest) {
  try {
    const configuredSecret = process.env.CRON_SECRET;
    const providedSecret = getCronSecret(request);

    if (
      !configuredSecret ||
      !providedSecret ||
      providedSecret !== configuredSecret
    ) {
      return unauthorizedCronResponse();
    }

    const secretHash = createHash('sha256')
      .update(providedSecret)
      .digest('hex')
      .slice(0, 16);

    const rateLimit = checkRateLimit({
      key: `cron:${getClientIp(request)}:${secretHash}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse();
    }

    const limit = limitSchema.parse(
      request.nextUrl.searchParams.get('limit') ?? 5
    );

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: dueMonitors, error } =
      await supabaseAdmin
        .from('monitors')
        .select('*')
        .eq('status', 'active')
        .or(
          `next_capture_at.is.null,next_capture_at.lte.${now}`
        )
        .or(
          `capture_lock_until.is.null,capture_lock_until.lt.${now}`
        )
        .order('next_capture_at', {
          ascending: true,
          nullsFirst: true,
        })
        .limit(limit);

    if (error) {
      console.error('[cron:capture-due:select]', error);

      return NextResponse.json(
        {
          success: false,
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch due monitors.',
        },
        { status: 500 }
      );
    }

    const results: Array<
      | {
          monitorId: string;
          status: 'success';
          captureId: string;
        }
      | {
          monitorId: string;
          status: 'failed';
          error: string;
        }
      | {
          monitorId: string;
          status: 'skipped';
          reason: string;
        }
    > = [];

    for (const monitor of dueMonitors ?? []) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 10);

      const {
        data: lockedMonitor,
        error: lockError,
      } = await supabaseAdmin
        .from('monitors')
        .update({
          capture_lock_until: lockUntil.toISOString(),
        })
        .eq('id', monitor.id)
        .or(
          `capture_lock_until.is.null,capture_lock_until.lt.${now}`
        )
        .select()
        .maybeSingle();

      if (lockError || !lockedMonitor) {
        if (lockError) {
          console.error('[cron:capture-due:lock]', lockError);
        }

        results.push({
          monitorId: monitor.id,
          status: 'skipped',
          reason: 'Monitor is already locked.',
        });
        continue;
      }

      try {
        const capture = await runMonitorCapture({
          monitor: lockedMonitor,
          userId: lockedMonitor.user_id,
          triggerType: 'scheduled',
          supabaseAdmin,
        });

        results.push({
          monitorId: lockedMonitor.id,
          status: 'success',
          captureId: capture.captureId,
        });
      } catch (captureError) {
        if (captureError instanceof CaptureServiceError) {
          results.push({
            monitorId: lockedMonitor.id,
            status: 'failed',
            error: captureError.safeMessage,
          });
        } else {
          console.error(
            '[cron:capture-due:capture]',
            captureError
          );

          results.push({
            monitorId: lockedMonitor.id,
            status: 'failed',
            error: 'Capture failed.',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        checked: dueMonitors?.length ?? 0,
        captured: results.filter(
          (result) => result.status === 'success'
        ).length,
        failed: results.filter(
          (result) => result.status === 'failed'
        ).length,
        results,
      },
    });
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Invalid cron limit.',
        },
        { status: 400 }
      );
    }

    console.error('[cron:capture-due]', error);

    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
      },
      { status: 500 }
    );
  }
}

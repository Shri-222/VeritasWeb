import type { SupabaseClient } from '@supabase/supabase-js';
import {
  captureWebsite,
  UnsafeCaptureUrlError,
} from '@/lib/capture';
import {
  calculateSHA256Hash,
  createEvidenceManifestWithHash,
} from '@/lib/forensic';
import { validateCaptureUrl } from '@/lib/schemas';
import { getCaptureBucketName } from '@/lib/storage';
import type { Database } from '@/types/database';

export type CaptureTriggerType = 'manual' | 'scheduled';

export type MonitorForCapture =
  Database['public']['Tables']['monitors']['Row'];

export type RunMonitorCaptureInput = {
  monitor: MonitorForCapture;
  userId: string;
  triggerType: CaptureTriggerType;
  supabaseAdmin: SupabaseClient<Database>;
};

export type RunMonitorCaptureResult = {
  captureId: string;
  monitorId: string;
  screenshotPath: string;
  htmlPath: string;
  manifestSha256: string;
  screenshotSha256: string;
  htmlSha256: string;
  statusCode: number;
  pageTitle: string;
  finalUrl: string;
  capturedAt: string;
  nextCaptureAt: string;
};

export class CaptureServiceError extends Error {
  code: string;
  status: number;
  safeMessage: string;

  constructor(
    code: string,
    safeMessage: string,
    status = 500
  ) {
    super(safeMessage);
    this.name = 'CaptureServiceError';
    this.code = code;
    this.status = status;
    this.safeMessage = safeMessage;
  }
}

export function getNextCaptureAt(
  capturedAt: string,
  frequency: MonitorForCapture['frequency']
) {
  const date = new Date(capturedAt);

  if (frequency === 'hourly') {
    date.setHours(date.getHours() + 1);
  } else if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else {
    date.setDate(date.getDate() + 7);
  }

  return date.toISOString();
}

export function getRetryCaptureAt(
  frequency: MonitorForCapture['frequency'],
  fromDate = new Date()
) {
  const date = new Date(fromDate);

  if (frequency === 'hourly') {
    date.setMinutes(date.getMinutes() + 30);
  } else {
    date.setHours(date.getHours() + 1);
  }

  return date.toISOString();
}

function safeErrorMessage(error: unknown) {
  if (error instanceof CaptureServiceError) {
    return error.safeMessage;
  }

  if (error instanceof UnsafeCaptureUrlError) {
    return error.message;
  }

  return 'Capture failed.';
}

async function updateMonitorFailure(
  supabaseAdmin: SupabaseClient<Database>,
  monitor: MonitorForCapture,
  error: unknown
) {
  const safeMessage = safeErrorMessage(error);

  await supabaseAdmin
    .from('monitors')
    .update({
      last_capture_status: 'failed',
      last_capture_error: safeMessage,
      next_capture_at: getRetryCaptureAt(
        monitor.frequency
      ),
      capture_lock_until: null,
    })
    .eq('id', monitor.id);
}

export async function runMonitorCapture({
  monitor,
  userId,
  triggerType,
  supabaseAdmin,
}: RunMonitorCaptureInput): Promise<RunMonitorCaptureResult> {
  try {
    const bucketName = getCaptureBucketName();
    const safeUrl = await validateCaptureUrl(monitor.url);

    if (!safeUrl.success) {
      throw new CaptureServiceError(
        safeUrl.code,
        safeUrl.message,
        400
      );
    }

    const { data: previousCapture } = await supabaseAdmin
      .from('captures')
      .select('sha256_hash, manifest_sha256')
      .eq('monitor_id', monitor.id)
      .order('captured_at', {
        ascending: false,
      })
      .order('timestamp', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    const previousCaptureHash =
      previousCapture?.manifest_sha256 ??
      previousCapture?.sha256_hash ??
      null;

    const result = await captureWebsite(safeUrl.url);

    const screenshotSha256 =
      await calculateSHA256Hash(
        result.screenshotBuffer
      );

    const htmlSha256 = await calculateSHA256Hash(
      result.html
    );

    const pathTimestamp = result.capturedAt.replace(
      /[:.]/g,
      '-'
    );

    const screenshotPath = `${userId}/${monitor.id}/${pathTimestamp}/screenshot.png`;
    const htmlPath = `${userId}/${monitor.id}/${pathTimestamp}/page.html`;

    const { manifestHash } =
      await createEvidenceManifestWithHash({
        original_url: result.originalUrl,
        final_url: result.finalUrl,
        page_title: result.title || null,
        captured_at: result.capturedAt,
        status_code: result.statusCode,
        headers: result.headers,
        screenshot_path: screenshotPath,
        html_path: htmlPath,
        screenshot_sha256: screenshotSha256,
        html_sha256: htmlSha256,
        previous_capture_hash: previousCaptureHash,
      });

    const { error: screenshotUploadError } =
      await supabaseAdmin.storage
        .from(bucketName)
        .upload(screenshotPath, result.screenshotBuffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png',
        });

    if (screenshotUploadError) {
      throw screenshotUploadError;
    }

    const { error: htmlUploadError } =
      await supabaseAdmin.storage
        .from(bucketName)
        .upload(
          htmlPath,
          Buffer.from(result.html, 'utf-8'),
          {
            cacheControl: '3600',
            upsert: false,
            contentType: 'text/html; charset=utf-8',
          }
        );

    if (htmlUploadError) {
      throw htmlUploadError;
    }

    const {
      data: captureRecord,
      error: captureError,
    } = await supabaseAdmin
      .from('captures')
      .insert({
        monitor_id: monitor.id,
        timestamp: result.capturedAt,
        storage_url: screenshotPath,
        sha256_hash: manifestHash,
        tsa_token: null,
        status_code: result.statusCode,
        headers: result.headers ?? {},
        previous_capture_hash: previousCaptureHash,
        screenshot_path: screenshotPath,
        html_path: htmlPath,
        screenshot_sha256: screenshotSha256,
        html_sha256: htmlSha256,
        manifest_sha256: manifestHash,
        original_url: result.originalUrl,
        final_url: result.finalUrl,
        page_title: result.title,
        captured_at: result.capturedAt,
        capture_status: 'success',
        error_message: null,
        trigger_type: triggerType,
      })
      .select()
      .single();

    if (captureError) {
      throw captureError;
    }

    const nextCaptureAt = getNextCaptureAt(
      result.capturedAt,
      monitor.frequency
    );

    const { error: monitorUpdateError } =
      await supabaseAdmin.rpc(
        'increment_monitor_capture_success',
        {
          p_monitor_id: monitor.id,
          p_captured_at: result.capturedAt,
          p_next_capture_at: nextCaptureAt,
        }
      );

    if (monitorUpdateError) {
      throw monitorUpdateError;
    }

    return {
      captureId: captureRecord.id,
      monitorId: monitor.id,
      screenshotPath,
      htmlPath,
      manifestSha256: manifestHash,
      screenshotSha256,
      htmlSha256,
      statusCode: result.statusCode,
      pageTitle: result.title,
      finalUrl: result.finalUrl,
      capturedAt: result.capturedAt,
      nextCaptureAt,
    };
  } catch (error) {
    await updateMonitorFailure(
      supabaseAdmin,
      monitor,
      error
    );

    if (
      error instanceof CaptureServiceError ||
      error instanceof UnsafeCaptureUrlError
    ) {
      throw error instanceof CaptureServiceError
        ? error
        : new CaptureServiceError(
            'UNSAFE_URL',
            error.message,
            400
          );
    }

    console.error('[capture-service]', error);

    throw new CaptureServiceError(
      'CAPTURE_FAILED',
      'Capture failed.',
      500
    );
  }
}

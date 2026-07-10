import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import {
  isMissingColumnError,
  logSupabaseError,
} from './database-errors.ts';

export type OwnedCaptureRecord = {
  id: string;
  monitor_id: string;
  timestamp: string;
  captured_at: string;
  storage_url: string;
  sha256_hash: string;
  screenshot_path: string | null;
  html_path: string | null;
  screenshot_sha256: string | null;
  html_sha256: string | null;
  manifest_sha256: string | null;
  manifest_path: string | null;
  original_url: string | null;
  final_url: string | null;
  page_title: string | null;
  capture_status: string | null;
  error_message: string | null;
  status_code: number;
  headers: Json;
  previous_capture_hash: string | null;
  trigger_type: string | null;
  created_at: string;
  storage_provider: string | null;
  monitors:
    | {
        id: string;
        url: string;
        user_id: string;
      }
    | {
        id: string;
        url: string;
        user_id: string;
      }[]
    | null;
};

export const OWNED_CAPTURE_SELECT = `
  id,
  monitor_id,
  timestamp,
  captured_at,
  storage_url,
  sha256_hash,
  screenshot_path,
  html_path,
  screenshot_sha256,
  html_sha256,
  manifest_sha256,
  manifest_path,
  original_url,
  final_url,
  page_title,
  capture_status,
  error_message,
  status_code,
  headers,
  previous_capture_hash,
  trigger_type,
  created_at
`;

export async function fetchOwnedCaptureById(
  supabase: SupabaseClient<Database>,
  userId: string,
  captureId: string
) {
  const captureResult = await supabase
    .from('captures')
    .select(OWNED_CAPTURE_SELECT)
    .eq('id', captureId)
    .maybeSingle();

  if (captureResult.error) {
    logSupabaseError(
      'Capture fetch failed',
      captureResult.error
    );
    return { data: null, error: captureResult.error };
  }

  if (!captureResult.data) {
    return { data: null, error: null };
  }

  const monitorResult = await supabase
    .from('monitors')
    .select('id, url, user_id')
    .eq('id', captureResult.data.monitor_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (monitorResult.error) {
    logSupabaseError(
      'Capture ownership fetch failed',
      monitorResult.error
    );
    return { data: null, error: monitorResult.error };
  }

  if (!monitorResult.data) {
    return { data: null, error: null };
  }

  const providerResult = await supabase
    .from('captures')
    .select('storage_provider')
    .eq('id', captureId)
    .maybeSingle();

  if (
    providerResult.error &&
    !isMissingColumnError(
      providerResult.error,
      'storage_provider'
    )
  ) {
    logSupabaseError(
      'Capture storage provider fetch failed',
      providerResult.error
    );
  }

  return {
    data: {
      ...captureResult.data,
      storage_provider:
        providerResult.data?.storage_provider ?? null,
      monitors: monitorResult.data,
    } as OwnedCaptureRecord,
    error: null,
  };
}

export function getCaptureMonitor(
  capture: OwnedCaptureRecord
) {
  return Array.isArray(capture.monitors)
    ? capture.monitors[0]
    : capture.monitors;
}

export function getCaptureScreenshotPath(
  capture: OwnedCaptureRecord
) {
  return capture.screenshot_path ?? capture.storage_url ?? null;
}

export function getCaptureManifestHash(
  capture: OwnedCaptureRecord
) {
  return capture.manifest_sha256 ?? capture.sha256_hash ?? null;
}

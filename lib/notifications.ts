import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { validateCaptureUrl, UNSAFE_URL_MESSAGE } from '@/lib/schemas';

export type NotificationEvent = {
  type: 'page_changed' | 'status_changed' | 'capture_failed';
  monitorId: string;
  captureId?: string;
  monitoredUrl: string;
  changed?: boolean;
  statusCode?: number;
  capturedAt: string;
  dashboardRecordLink?: string;
};

export async function validateWebhookDestination(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return { success: false as const, code: 'VALIDATION_ERROR', message: 'Webhook URL is invalid.' }; }
  if (url.protocol !== 'https:') return { success: false as const, code: 'UNSAFE_URL', message: UNSAFE_URL_MESSAGE };
  const result = await validateCaptureUrl(url.toString());
  if (!result.success) return result;
  return { success: true as const, url: result.url };
}

function signature(body: string) {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  return secret ? crypto.createHmac('sha256', secret).update(body).digest('hex') : null;
}

export async function notifyWebhookEndpoints(
  supabaseAdmin: SupabaseClient<Database>,
  userId: string,
  event: NotificationEvent
) {
  const { data: endpoints, error } = await supabaseAdmin
    .from('notification_endpoints')
    .select('destination')
    .eq('user_id', userId)
    .eq('type', 'webhook')
    .eq('enabled', true);
  if (error || !endpoints?.length) return;
  const payload = JSON.stringify({ event: event.type, ...event });
  const webhookSignature = signature(payload);
  await Promise.allSettled(endpoints.map(async ({ destination }) => {
    const validation = await validateWebhookDestination(destination);
    if (!validation.success) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(validation.url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(webhookSignature ? { 'X-VeritasWeb-Signature': webhookSignature } : {}) }, body: payload, signal: controller.signal });
    } catch (sendError) {
      console.error('[notification:webhook]', sendError);
    } finally { clearTimeout(timeout); }
  }));
}


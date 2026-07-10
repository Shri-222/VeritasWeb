import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { getCaptureBucketName } from '@/lib/storage';
import { calculateSHA256Hash } from '@/lib/forensic';

const MAX_SEGMENTS = 40;
const MAX_SEGMENT_LENGTH = 240;

export type ChangeDetectionInput = {
  previous: {
    id: string;
    page_title: string | null;
    final_url: string | null;
    status_code: number;
    headers: Json;
    html_path: string | null;
    screenshot_path: string | null;
    screenshot_sha256: string | null;
    html_sha256: string | null;
  };
  current: {
    id: string;
    monitor_id: string;
    page_title: string | null;
    final_url: string | null;
    status_code: number;
    headers: Json;
    html: string;
    screenshot: Buffer;
  };
  previousHtml?: string;
};

function decodeHtml(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}

export function extractReadableText(html: string) {
  return decodeHtml(html).replace(/\s+/g, ' ').trim();
}

function segments(value: string) {
  return value
    .split(/(?<=[.!?])\s+|\s*\n\s*|\s{3,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function bounded(value: string) {
  return value.slice(0, MAX_SEGMENT_LENGTH);
}

function textDiff(previous: string, current: string) {
  const oldParts = new Set(segments(previous));
  const newParts = new Set(segments(current));
  const removed = [...oldParts].filter((part) => !newParts.has(part)).slice(0, MAX_SEGMENTS).map(bounded);
  const added = [...newParts].filter((part) => !oldParts.has(part)).slice(0, MAX_SEGMENTS).map(bounded);
  return { added, removed, truncated: removed.length === MAX_SEGMENTS || added.length === MAX_SEGMENTS };
}

function headerSubset(headers: Json) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};
  const source = headers as Record<string, Json | undefined>;
  return ['content-type', 'etag', 'last-modified', 'cache-control', 'location'].reduce<Record<string, Json>>((result, key) => {
    const actual = Object.keys(source).find((item) => item.toLowerCase() === key);
    if (actual && source[actual] !== undefined) result[key] = source[actual] as Json;
    return result;
  }, {});
}

export async function detectCaptureChanges(input: ChangeDetectionInput) {
  const previousText = input.previousHtml ? extractReadableText(input.previousHtml) : '';
  const currentText = extractReadableText(input.current.html);
  const screenshotHash = await calculateSHA256Hash(input.current.screenshot);
  const metadataDiff: Record<string, Json> = {};

  if (input.previous.page_title !== input.current.page_title) metadataDiff.page_title = { previous: input.previous.page_title, current: input.current.page_title };
  if (input.previous.final_url !== input.current.final_url) metadataDiff.final_url = { previous: input.previous.final_url, current: input.current.final_url };
  if (input.previous.status_code !== input.current.status_code) metadataDiff.status_code = { previous: input.previous.status_code, current: input.current.status_code };
  const oldHeaders = JSON.stringify(headerSubset(input.previous.headers));
  const newHeaders = JSON.stringify(headerSubset(input.current.headers));
  if (oldHeaders !== newHeaders) metadataDiff.headers = { previous: headerSubset(input.previous.headers), current: headerSubset(input.current.headers) };
  if (input.previous.screenshot_sha256 !== screenshotHash) metadataDiff.screenshot_hash = { previous: input.previous.screenshot_sha256, current: screenshotHash };

  const diff = textDiff(previousText ?? currentText, currentText);
  const changed = diff.added.length > 0 || diff.removed.length > 0 || Object.keys(metadataDiff).length > 0;
  const textMagnitude = Math.min(1, (diff.added.length + diff.removed.length) / 20);
  const metadataMagnitude = Math.min(1, Object.keys(metadataDiff).length / 5);

  return {
    changed,
    changeScore: Number((Math.min(1, textMagnitude * 0.7 + metadataMagnitude * 0.3)).toFixed(3)),
    textAdded: diff.added,
    textRemoved: diff.removed,
    textDiff: diff,
    metadataDiff: { ...metadataDiff, visual_comparison: 'unavailable_without_png_decoder' } as Json,
  };
}

export async function createCaptureDiffForSuccessfulCapture(
  supabaseAdmin: SupabaseClient<Database>,
  previous: ChangeDetectionInput['previous'] | null,
  current: ChangeDetectionInput['current']
) {
  if (!previous?.id || !previous.html_path || !previous.screenshot_path) return null;
  const bucket = getCaptureBucketName();
  const [{ data: oldHtml }, { data: oldScreenshot }] = await Promise.all([
    supabaseAdmin.storage.from(bucket).download(previous.html_path),
    supabaseAdmin.storage.from(bucket).download(previous.screenshot_path),
  ]);
  if (!oldHtml || !oldScreenshot) return null;
  const oldHtmlBuffer = Buffer.from(await oldHtml.arrayBuffer());
  const result = await detectCaptureChanges({
    previous,
    current,
    previousHtml: oldHtmlBuffer.toString('utf-8'),
  });
  const previousText = extractReadableText(oldHtmlBuffer.toString('utf-8'));
  const currentText = extractReadableText(current.html);
  const actualTextDiff = textDiff(previousText, currentText);
  const changed = actualTextDiff.added.length > 0 || actualTextDiff.removed.length > 0 || Object.keys(result.metadataDiff as object).length > 1;
  const finalResult = { ...result, changed, textAdded: actualTextDiff.added, textRemoved: actualTextDiff.removed, textDiff: actualTextDiff };

  const { data, error } = await supabaseAdmin.from('capture_diffs').insert({
    monitor_id: current.monitor_id,
    previous_capture_id: previous.id,
    current_capture_id: current.id,
    changed: finalResult.changed,
    change_score: finalResult.changeScore,
    text_added_count: finalResult.textAdded.length,
    text_removed_count: finalResult.textRemoved.length,
    text_diff: finalResult.textDiff as Json,
    metadata_diff: finalResult.metadataDiff as Json,
    visual_diff_path: null,
  }).select('*').single();
  if (error) {
    console.error('[capture:diff]', error);
    return null;
  }
  return data;
}

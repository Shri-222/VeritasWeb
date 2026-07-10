export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';
import { fetchOwnedCaptureById, getCaptureManifestHash, getCaptureScreenshotPath } from '@/lib/captures';
import { createEvidenceManifest, jsonFromManifest } from '@/lib/forensic';
import { generateCaptureReportPdf } from '@/lib/pdf-report';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCaptureBucketName } from '@/lib/storage';
import { headersToRecord, verifyCaptureArtifacts, serializeVerificationResult } from '@/lib/verification';
import { createZip } from '@/lib/zip';

const paramsSchema = z.object({ captureId: z.string().uuid() });

async function toBuffer(blob: Blob | null) { return blob ? Buffer.from(await blob.arrayBuffer()) : null; }

export async function GET(request: NextRequest, context: { params: Promise<{ captureId: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;
  const limit = checkRateLimit({ key: `capture-bundle:${auth.user.id}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return rateLimitResponse();
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiErrorResponse('CAPTURE_NOT_FOUND', 'Capture not found.', 404);
  const { data: capture, error } = await fetchOwnedCaptureById(auth.supabase, auth.user.id, parsed.data.captureId);
  if (error) return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch capture.', 500);
  if (!capture) return apiErrorResponse('CAPTURE_NOT_FOUND', 'Capture not found.', 404);

  const admin = getSupabaseAdmin();
  const verification = await verifyCaptureArtifacts(capture, admin);
  if (!verification.artifacts) return apiErrorResponse('ARTIFACTS_MISSING', 'Required capture artifacts are unavailable.', 409);
  const bucket = getCaptureBucketName();
  const manifestPath = capture.manifest_path;
  let manifestBuffer = manifestPath ? await toBuffer((await admin.storage.from(bucket).download(manifestPath)).data) : null;
  if (!manifestBuffer) {
    if (!capture.original_url || !capture.final_url || !capture.captured_at || !capture.html_path || !getCaptureScreenshotPath(capture)) return apiErrorResponse('INCOMPLETE_METADATA', 'Capture metadata is incomplete for a bundle.', 409);
    const manifest = createEvidenceManifest({ monitor_id: capture.monitor_id, original_url: capture.original_url, final_url: capture.final_url, page_title: capture.page_title, captured_at: capture.captured_at, status_code: capture.status_code, headers: headersToRecord(capture.headers), screenshot_path: getCaptureScreenshotPath(capture)!, html_path: capture.html_path, screenshot_sha256: capture.screenshot_sha256 ?? '', html_sha256: capture.html_sha256 ?? '', previous_capture_hash: capture.previous_capture_hash, trigger_type: capture.trigger_type ?? 'manual' });
    manifestBuffer = Buffer.from(JSON.stringify(jsonFromManifest(manifest), null, 2), 'utf8');
  }

  const { data: diff } = await admin.from('capture_diffs').select('*').eq('current_capture_id', capture.id).maybeSingle();
  const metadata = { capture_id: capture.id, monitor_id: capture.monitor_id, original_url: capture.original_url, final_url: capture.final_url, page_title: capture.page_title, captured_at: capture.captured_at, status_code: capture.status_code, headers: capture.headers, trigger_type: capture.trigger_type, storage_provider: 'supabase' };
  const hashes = [`screenshot_sha256=${capture.screenshot_sha256 ?? ''}`, `html_sha256=${capture.html_sha256 ?? ''}`, `manifest_sha256=${getCaptureManifestHash(capture) ?? ''}`].join('\n') + '\n';
  const entries = [
    { name: 'evidence-report.pdf', data: generateCaptureReportPdf({ capture, verification, generatedAt: new Date().toISOString() }) },
    { name: 'screenshot.png', data: verification.artifacts.screenshotBuffer },
    { name: 'page.html', data: verification.artifacts.htmlBuffer },
    { name: 'manifest.json', data: manifestBuffer },
    { name: 'metadata.json', data: Buffer.from(JSON.stringify(metadata, null, 2), 'utf8') },
    { name: 'hashes.txt', data: Buffer.from(hashes, 'utf8') },
    { name: 'verification.json', data: Buffer.from(JSON.stringify(serializeVerificationResult(verification), null, 2), 'utf8') },
  ];
  if (diff) entries.push({ name: 'change-diff.json', data: Buffer.from(JSON.stringify(diff, null, 2), 'utf8') });
  if (diff?.visual_diff_path) {
    const visual = await toBuffer((await admin.storage.from(bucket).download(diff.visual_diff_path)).data);
    if (visual) entries.push({ name: 'visual-diff.png', data: visual });
  }
  const zip = createZip(entries);
  return new NextResponse(zip, { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="veritasweb-evidence-${capture.id}.zip"` } });
}

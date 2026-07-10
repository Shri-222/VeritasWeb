export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';
import { fetchOwnedCaptureById } from '@/lib/captures';
import { getBetaLimits } from '@/lib/beta';
import { generateCaptureReportPdf } from '@/lib/pdf-report';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyCaptureArtifacts, serializeVerificationResult } from '@/lib/verification';
import { createZip } from '@/lib/zip';
import {
  isMissingTableError,
  logSupabaseError,
} from '@/lib/database-errors';

const paramsSchema = z.object({ caseId: z.string().uuid() });

export async function GET(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiErrorResponse('CASE_NOT_FOUND', 'Case not found.', 404);
  const { data: ownedCase, error: caseError } = await auth.supabase.from('cases').select('id, name, description, status').eq('id', parsed.data.caseId).eq('user_id', auth.user.id).maybeSingle();
  if (caseError) {
    logSupabaseError('[case:bundle:fetch]', caseError);
    if (isMissingTableError(caseError, 'cases')) return apiErrorResponse('DATABASE_MIGRATION_REQUIRED', 'The cases database migration has not been applied.', 503);
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch case.', 500);
  }
  if (!ownedCase) return apiErrorResponse('CASE_NOT_FOUND', 'Case not found.', 404);
  const { data: monitors, error: monitorsError } = await auth.supabase.from('monitors').select('id').eq('case_id', ownedCase.id).eq('user_id', auth.user.id);
  if (monitorsError) return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch case monitors.', 500);
  const monitorIds = (monitors ?? []).map((monitor) => monitor.id);
  const maxBundleCaptures = getBetaLimits().maxBundleCaptures;
  const { data: captureRows, error: capturesError } = monitorIds.length ? await auth.supabase.from('captures').select('id').in('monitor_id', monitorIds).order('captured_at', { ascending: false }).limit(maxBundleCaptures + 1) : { data: [], error: null };
  if (capturesError) return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch case captures.', 500);
  if ((captureRows?.length ?? 0) > maxBundleCaptures) return apiErrorResponse('BETA_LIMIT_REACHED', 'This case bundle exceeds the beta capture limit.', 429);
  const admin = getSupabaseAdmin();
  const entries: Array<{ name: string; data: Buffer }> = [{ name: 'case-summary.json', data: Buffer.from(JSON.stringify({ case: ownedCase, capture_count: captureRows?.length ?? 0 }, null, 2), 'utf8') }];
  for (const row of captureRows ?? []) {
    const { data: capture } = await fetchOwnedCaptureById(auth.supabase, auth.user.id, row.id);
    if (!capture) continue;
    const verification = await verifyCaptureArtifacts(capture, admin);
    if (!verification.artifacts) continue;
    const prefix = `captures/${capture.id}`;
    entries.push({ name: `${prefix}/evidence-report.pdf`, data: generateCaptureReportPdf({ capture, verification, generatedAt: new Date().toISOString() }) });
    entries.push({ name: `${prefix}/screenshot.png`, data: verification.artifacts.screenshotBuffer });
    entries.push({ name: `${prefix}/page.html`, data: verification.artifacts.htmlBuffer });
    entries.push({ name: `${prefix}/verification.json`, data: Buffer.from(JSON.stringify(serializeVerificationResult(verification), null, 2), 'utf8') });
  }
  const zip = createZip(entries);
  return new NextResponse(zip, { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="veritasweb-case-${ownedCase.id}.zip"` } });
}

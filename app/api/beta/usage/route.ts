import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, authenticateApiRequest } from '@/lib/auth';
import { checkDailyCaptureBetaLimit, checkMonitorBetaLimit, getBetaLimits } from '@/lib/beta';

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.errorResponse) return auth.errorResponse;
  try {
    const [monitors, captures] = await Promise.all([
      checkMonitorBetaLimit(auth.supabase, auth.user.id),
      checkDailyCaptureBetaLimit(auth.supabase, auth.user.id),
    ]);
    return NextResponse.json({ success: true, data: { monitors, capturesToday: captures, bundleCaptureLimit: getBetaLimits().maxBundleCaptures } });
  } catch (error) {
    console.error('[beta:usage]', error);
    return apiErrorResponse('INTERNAL_ERROR', 'Failed to fetch beta usage.', 500);
  }
}


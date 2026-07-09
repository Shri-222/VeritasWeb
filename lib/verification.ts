import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateSHA256Hash,
  compareHashes,
  verifyEvidenceIntegrity,
} from '@/lib/forensic';
import {
  getCaptureManifestHash,
  getCaptureScreenshotPath,
  type OwnedCaptureRecord,
} from '@/lib/captures';
import { getCaptureBucketName } from '@/lib/storage';
import type { Database, Json } from '@/types/database';
import type { EvidenceHashCheck } from '@/lib/forensic';

export type VerificationStatus =
  | 'VERIFIED'
  | 'FAILED'
  | 'MISSING_ARTIFACT'
  | 'INCOMPLETE_METADATA'
  | 'NOT_RUN';

export type CaptureVerificationResult = {
  captureId: string;
  verified: boolean;
  status: VerificationStatus;
  checks: {
    screenshot: EvidenceHashCheck | null;
    html: EvidenceHashCheck | null;
    manifest: EvidenceHashCheck | null;
  };
  message: string;
  verifiedAt: string;
  artifacts?: {
    screenshotBuffer: Buffer;
    htmlBuffer: Buffer;
  };
};

function emptyResult(
  captureId: string,
  status: VerificationStatus,
  message: string
): CaptureVerificationResult {
  return {
    captureId,
    verified: false,
    status,
    checks: {
      screenshot: null,
      html: null,
      manifest: null,
    },
    message,
    verifiedAt: new Date().toISOString(),
  };
}

export function headersToRecord(headers: Json) {
  if (
    !headers ||
    typeof headers !== 'object' ||
    Array.isArray(headers)
  ) {
    return {};
  }

  return Object.entries(headers).reduce<
    Record<string, string>
  >((result, [key, value]) => {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (value !== null && value !== undefined) {
      result[key] = JSON.stringify(value);
    }

    return result;
  }, {});
}

async function blobToBuffer(blob: Blob) {
  return Buffer.from(await blob.arrayBuffer());
}

export async function verifyCaptureArtifacts(
  capture: OwnedCaptureRecord,
  supabaseAdmin: SupabaseClient<Database>
): Promise<CaptureVerificationResult> {
  const screenshotPath = getCaptureScreenshotPath(capture);
  const manifestSha256 = getCaptureManifestHash(capture);
  const bucketName = getCaptureBucketName();

  if (
    !screenshotPath ||
    !capture.html_path ||
    !capture.screenshot_sha256 ||
    !capture.html_sha256 ||
    !manifestSha256 ||
    !capture.original_url ||
    !capture.final_url ||
    !capture.captured_at
  ) {
    return emptyResult(
      capture.id,
      'INCOMPLETE_METADATA',
      'Capture metadata is incomplete for verification.'
    );
  }

  const {
    data: screenshotArtifact,
    error: screenshotError,
  } = await supabaseAdmin.storage
    .from(bucketName)
    .download(screenshotPath);

  const {
    data: htmlArtifact,
    error: htmlError,
  } = await supabaseAdmin.storage
    .from(bucketName)
    .download(capture.html_path);

  if (
    screenshotError ||
    htmlError ||
    !screenshotArtifact ||
    !htmlArtifact
  ) {
    if (screenshotError || htmlError) {
      console.error('[capture:verify:storage]', {
        screenshotError,
        htmlError,
      });
    }

    return emptyResult(
      capture.id,
      'MISSING_ARTIFACT',
      'One or more capture artifacts are missing.'
    );
  }

  const screenshotBuffer =
    await blobToBuffer(screenshotArtifact);
  const htmlBuffer = await blobToBuffer(htmlArtifact);
  const screenshotSha256 =
    await calculateSHA256Hash(screenshotBuffer);
  const htmlSha256 = await calculateSHA256Hash(htmlBuffer);

  if (capture.manifest_path) {
    const {
      data: manifestArtifact,
      error: manifestError,
    } = await supabaseAdmin.storage
      .from(bucketName)
      .download(capture.manifest_path);

    if (manifestError || !manifestArtifact) {
      if (manifestError) {
        console.error('[capture:verify:manifest]', manifestError);
      }

      return emptyResult(
        capture.id,
        'MISSING_ARTIFACT',
        'Capture manifest artifact is missing.'
      );
    }

    const manifestBuffer =
      await blobToBuffer(manifestArtifact);

    const manifestComputedSha256 =
      await calculateSHA256Hash(manifestBuffer);

    const checks = {
      screenshot: compareHashes(
        capture.screenshot_sha256,
        screenshotSha256
      ),
      html: compareHashes(
        capture.html_sha256,
        htmlSha256
      ),
      manifest: compareHashes(
        manifestSha256,
        manifestComputedSha256
      ),
    };

    const verified =
      checks.screenshot.match &&
      checks.html.match &&
      checks.manifest.match;

    return {
      captureId: capture.id,
      verified,
      status: verified ? 'VERIFIED' : 'FAILED',
      checks,
      message: verified
        ? 'Capture integrity verified.'
        : 'Capture integrity verification failed.',
      verifiedAt: new Date().toISOString(),
      artifacts: {
        screenshotBuffer,
        htmlBuffer,
      },
    };
  }

  const result = await verifyEvidenceIntegrity({
    screenshotContent: screenshotBuffer,
    htmlContent: htmlBuffer,
    manifestInput: {
      monitor_id: capture.monitor_id,
      original_url: capture.original_url,
      final_url: capture.final_url,
      page_title: capture.page_title ?? null,
      captured_at: capture.captured_at,
      status_code: capture.status_code,
      headers: headersToRecord(capture.headers),
      screenshot_path: screenshotPath,
      html_path: capture.html_path,
      previous_capture_hash:
        capture.previous_capture_hash ?? null,
      trigger_type: capture.trigger_type ?? 'manual',
    },
    stored: {
      screenshot_sha256: capture.screenshot_sha256,
      html_sha256: capture.html_sha256,
      manifest_sha256: manifestSha256,
    },
  });

  return {
    captureId: capture.id,
    ...result,
    verifiedAt: new Date().toISOString(),
    artifacts: {
      screenshotBuffer,
      htmlBuffer,
    },
  };
}

export function serializeVerificationResult(
  result: CaptureVerificationResult
) {
  return {
    captureId: result.captureId,
    verified: result.verified,
    status: result.status,
    checks: result.checks,
    message: result.message,
    verifiedAt: result.verifiedAt,
  };
}

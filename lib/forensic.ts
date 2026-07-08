/**
 * VeritasWeb Forensic Utilities
 * 
 * This module provides cryptographic hashing and RFC 3161 Time Stamp Authority
 * signing capabilities for forensic integrity verification.
 */

import crypto from 'crypto';
import type { Json } from '@/types/database';

type StableJson =
  | string
  | number
  | boolean
  | null
  | StableJson[]
  | { [key: string]: StableJson };

export type EvidenceManifestInput = {
  original_url: string;
  final_url: string;
  page_title: string | null;
  captured_at: string;
  status_code: number;
  headers: Record<string, string>;
  screenshot_path: string;
  html_path: string;
  screenshot_sha256: string;
  html_sha256: string;
  previous_capture_hash: string | null;
};

export type EvidenceManifest = EvidenceManifestInput & {
  schema_version: 'veritasweb.capture.v1';
  hash_algorithm: 'sha256';
};

export type EvidenceIntegrityStatus =
  | 'VERIFIED'
  | 'FAILED';

export type EvidenceHashCheck = {
  stored: string | null;
  computed: string;
  match: boolean;
};

export type VerifyEvidenceIntegrityInput = {
  screenshotContent: Buffer;
  htmlContent: string | Buffer;
  manifestInput: Omit<
    EvidenceManifestInput,
    'screenshot_sha256' | 'html_sha256'
  >;
  stored: {
    screenshot_sha256: string | null;
    html_sha256: string | null;
    manifest_sha256: string | null;
  };
};

/**
 * Calculate SHA-256 hash of content for forensic verification
 * @param content - The content to hash (string or buffer)
 * @returns Hex-encoded SHA-256 hash
 */
export async function calculateSHA256Hash(content: string | Buffer): Promise<string> {
  const data = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash;
}

function normalizeForStableJson(value: unknown): StableJson {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeForStableJson(item)
    );
  }

  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, StableJson>>(
        (result, key) => {
          result[key] = normalizeForStableJson(
            (value as Record<string, unknown>)[key]
          );
          return result;
        },
        {}
      );
  }

  return null;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForStableJson(value));
}

export function createEvidenceManifest(
  input: EvidenceManifestInput
): EvidenceManifest {
  return {
    schema_version: 'veritasweb.capture.v1',
    hash_algorithm: 'sha256',
    original_url: input.original_url,
    final_url: input.final_url,
    page_title: input.page_title ?? null,
    captured_at: input.captured_at,
    status_code: input.status_code,
    headers: normalizeHeaders(input.headers),
    screenshot_path: input.screenshot_path,
    html_path: input.html_path,
    screenshot_sha256: input.screenshot_sha256,
    html_sha256: input.html_sha256,
    previous_capture_hash:
      input.previous_capture_hash ?? null,
  };
}

export async function calculateManifestHash(
  manifest: EvidenceManifest
) {
  return calculateSHA256Hash(stableStringify(manifest));
}

export async function createEvidenceManifestWithHash(
  input: EvidenceManifestInput
) {
  const manifest = createEvidenceManifest(input);
  const manifestHash = await calculateManifestHash(manifest);

  return {
    manifest,
    manifestHash,
  };
}

export async function calculateEvidenceManifestHash(
  input: EvidenceManifestInput
) {
  const { manifestHash } =
    await createEvidenceManifestWithHash(input);

  return manifestHash;
}

export async function verifyEvidenceIntegrity(
  input: VerifyEvidenceIntegrityInput
) {
  const screenshotSha256 =
    await calculateSHA256Hash(input.screenshotContent);

  const htmlSha256 = await calculateSHA256Hash(
    input.htmlContent
  );

  const manifestSha256 =
    await calculateEvidenceManifestHash({
      ...input.manifestInput,
      screenshot_sha256: screenshotSha256,
      html_sha256: htmlSha256,
    });

  const checks = {
    screenshot: {
      stored: input.stored.screenshot_sha256,
      computed: screenshotSha256,
      match:
        input.stored.screenshot_sha256 ===
        screenshotSha256,
    },
    html: {
      stored: input.stored.html_sha256,
      computed: htmlSha256,
      match:
        input.stored.html_sha256 === htmlSha256,
    },
    manifest: {
      stored: input.stored.manifest_sha256,
      computed: manifestSha256,
      match:
        input.stored.manifest_sha256 ===
        manifestSha256,
    },
  } satisfies Record<string, EvidenceHashCheck>;

  const verified =
    checks.screenshot.match &&
    checks.html.match &&
    checks.manifest.match;

  return {
    verified,
    status: verified
      ? 'VERIFIED'
      : 'FAILED',
    checks,
    message: verified
      ? 'Capture integrity verified.'
      : 'Capture integrity verification failed.',
  } satisfies {
    verified: boolean;
    status: EvidenceIntegrityStatus;
    checks: typeof checks;
    message: string;
  };
}

export function normalizeHeaders(
  headers: Record<string, string>
) {
  return Object.keys(headers)
    .sort()
    .reduce<Record<string, string>>((result, key) => {
      result[key.toLowerCase()] = headers[key];
      return result;
    }, {});
}

export function jsonFromManifest(
  manifest: EvidenceManifest
): Json {
  return normalizeForStableJson(manifest) as Json;
}

/**
 * RFC 3161 Time Stamp Authority (TSA) Signing
 * 
 * This is a placeholder for implementing RFC 3161 TSA signing.
 * In production, this would:
 * 1. Create a Time Stamp Request (TSR) with the hash
 * 2. Send it to a trusted TSA (e.g., Digicert, GlobalSign)
 * 3. Receive a signed TSR token proving the time of capture
 * 
 * For now, this creates a mock token structure.
 */
export async function generateInternalTimestampProof(sha256Hash: string): Promise<string> {
  // Mock implementation: In production, call a real TSA like:
  // POST https://tsa.authority.example.com/rfc3161
  // with the sha256Hash and receive a cryptographic proof
  
  // For demonstration, we create a structured token with metadata
  const timestamp = new Date().toISOString();
  const mockToken = {
    version: '3161',
    hashAlgorithm: 'sha256',
    hash: sha256Hash,
    timestamp: timestamp,
    // In production, this would be a real signature from the TSA
    signature: crypto
      .createHmac('sha256', process.env.SUPABASE_JWT_SECRET || 'dev-secret')
      .update(`${sha256Hash}${timestamp}`)
      .digest('hex'),
  };

  return JSON.stringify(mockToken);
}

/**
 * Verify the integrity of a capture using its hash
 * @param content - The original content
 * @param expectedHash - The expected SHA-256 hash
 * @returns True if content matches the expected hash
 */
export async function verifyIntegrity(
  content: string | Buffer,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await calculateSHA256Hash(content);
  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

/**
 * Generate forensic metadata for a capture
 * Combines hash, timestamp, and headers for audit trail
 */
export function generateForensicMetadata(
  sha256Hash: string,
  statusCode: number,
  // headers: Record<string, string | string[]>,
  timestamp: Date = new Date()
) {
  return {
    hash: sha256Hash,
    hashAlgorithm: 'SHA-256-v1',
    timestamp: timestamp.toISOString(),
    statusCode,
    // headers,
    forensicFormat: 'VeritasWeb v1',
  };
}

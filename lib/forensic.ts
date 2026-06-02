/**
 * VeritasWeb Forensic Utilities
 * 
 * This module provides cryptographic hashing and RFC 3161 Time Stamp Authority
 * signing capabilities for forensic integrity verification.
 */

import crypto from 'crypto';

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

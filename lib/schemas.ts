/**
 * VeritasWeb Validation Schemas
 *
 * Production-oriented validation schemas using Zod.
 * Includes:
 * - Strong URL validation
 * - SSRF protection basics
 * - Safer cookie validation
 * - Better date validation
 * - Strict forensic validation
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';

// -----------------------------------------------------
// Constants
// -----------------------------------------------------

const MAX_URL_LENGTH = 2048;
const MAX_COOKIE_COUNT = 50;
const MAX_COOKIE_NAME_LENGTH = 200;
const MAX_COOKIE_VALUE_LENGTH = 4000;

const BLOCKED_HOSTS = [
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.azure.internal',
];

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part));

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 0
  );
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fe90:') ||
    normalized.startsWith('fea0:') ||
    normalized.startsWith('feb0:')
  ) {
    return true;
  }

  const firstHextet = Number.parseInt(
    normalized.split(':')[0] || '0',
    16
  );

  if (
    Number.isFinite(firstHextet) &&
    firstHextet >= 0xfc00 &&
    firstHextet <= 0xfdff
  ) {
    return true;
  }

  const mappedIpv4 = normalized.match(
    /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/
  );

  return mappedIpv4
    ? isPrivateIpv4(mappedIpv4[1])
    : false;
}

function normalizeHostname(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');
}

function isInternalHostname(hostname: string) {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.test')
  ) {
    return true;
  }

  return isIP(hostname) === 0 && !hostname.includes('.');
}

function isPrivateOrInternalAddress(address: string) {
  const normalized = normalizeHostname(address);
  const ipVersion = isIP(normalized);

  if (ipVersion === 4) {
    return isPrivateIpv4(normalized);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(normalized);
  }

  return isInternalHostname(normalized);
}

/**
 * Basic synchronous SSRF protection for form/schema validation.
 * Capture execution uses validateCaptureUrl() for DNS-backed checks.
 */
export function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const hostname = normalizeHostname(url.hostname);

    if (
      BLOCKED_HOSTS.includes(hostname) ||
      isPrivateOrInternalAddress(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export type CaptureUrlValidationResult =
  | {
      success: true;
      url: string;
      hostname: string;
      resolvedAddresses: string[];
    }
  | {
      success: false;
      code: 'UNSAFE_URL' | 'VALIDATION_ERROR';
      message: string;
    };

export async function validateCaptureUrl(
  value: string
): Promise<CaptureUrlValidationResult> {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return {
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Invalid URL format.',
    };
  }

  if (!isSafePublicUrl(url.toString())) {
    return {
      success: false,
      code: 'UNSAFE_URL',
      message: 'Only public HTTP/HTTPS URLs are allowed.',
    };
  }

  const hostname = normalizeHostname(url.hostname);

  if (isIP(hostname) !== 0) {
    return {
      success: true,
      url: url.toString(),
      hostname,
      resolvedAddresses: [hostname],
    };
  }

  try {
    const resolved = await lookup(hostname, {
      all: true,
      verbatim: true,
    });

    const addresses = resolved.map((entry) => entry.address);

    if (
      addresses.length === 0 ||
      addresses.some(isPrivateOrInternalAddress)
    ) {
      return {
        success: false,
        code: 'UNSAFE_URL',
        message:
          'URL resolved to an internal or private network address.',
      };
    }

    return {
      success: true,
      url: url.toString(),
      hostname,
      resolvedAddresses: addresses,
    };
  } catch {
    return {
      success: false,
      code: 'UNSAFE_URL',
      message:
        'URL hostname could not be resolved safely.',
    };
  }
}

// -----------------------------------------------------
// Shared Schemas
// -----------------------------------------------------

export const safeUrlSchema = z
  .string()
  .trim()
  .min(1, 'URL is required')
  .max(MAX_URL_LENGTH, 'URL too long')
  .url('Invalid URL format')
  .refine(isSafePublicUrl, {
    message:
      'Only public HTTP/HTTPS URLs are allowed',
  });

export const sha256Schema = z
  .string()
  .trim()
  .regex(
    /^[A-Fa-f0-9]{64}$/,
    'Invalid SHA-256 hash'
  );

export const cookieSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_COOKIE_NAME_LENGTH),

  value: z
    .string()
    .max(MAX_COOKIE_VALUE_LENGTH),
});

// -----------------------------------------------------
// Monitor Creation Schema
// -----------------------------------------------------

export const createMonitorSchema = z.object({
  url: safeUrlSchema,

  frequency: z.enum([
    'hourly',
    'daily',
    'weekly',
  ]),

  session_cookies: z
    .array(cookieSchema)
    .max(
      MAX_COOKIE_COUNT,
      'Too many cookies provided'
    )
    .optional(),
});

export type CreateMonitorInput =
  z.infer<typeof createMonitorSchema>;

// -----------------------------------------------------
// Monitor Update Schema
// -----------------------------------------------------

export const updateMonitorSchema = z
  .object({
    url: safeUrlSchema.optional(),

    frequency: z
      .enum(['hourly', 'daily', 'weekly'])
      .optional(),

    status: z
      .enum(['active', 'paused'])
      .optional(),

    session_cookies: z
      .array(cookieSchema)
      .max(MAX_COOKIE_COUNT)
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message:
        'At least one field must be provided',
    }
  );

export type UpdateMonitorInput =
  z.infer<typeof updateMonitorSchema>;

// -----------------------------------------------------
// Capture Creation Schema
// -----------------------------------------------------

export const createCaptureSchema = z.object({
  monitor_id: z.string().uuid('Invalid monitor ID'),

  storage_url: safeUrlSchema,

  sha256_hash: sha256Schema,

  status_code: z
    .number()
    .int()
    .min(100)
    .max(599),

  headers: z
    .record(
      z.union([
        z.string(),
        z.array(z.string()),
      ])
    )
    .default({}),
});

export type CreateCaptureInput =
  z.infer<typeof createCaptureSchema>;

// -----------------------------------------------------
// Capture Filter Schema
// -----------------------------------------------------

export const captureFiltersSchema = z
  .object({
    monitor_id: z
      .string()
      .uuid()
      .optional(),

    start_date: z
      .string()
      .datetime()
      .optional(),

    end_date: z
      .string()
      .datetime()
      .optional(),

    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50),

    offset: z
      .number()
      .int()
      .min(0)
      .default(0),
  })
  .refine(
    (data) => {
      if (
        !data.start_date ||
        !data.end_date
      ) {
        return true;
      }

      return (
        new Date(data.start_date) <=
        new Date(data.end_date)
      );
    },
    {
      message:
        'start_date must be before end_date',
      path: ['start_date'],
    }
  );

export type CaptureFilters =
  z.infer<typeof captureFiltersSchema>;

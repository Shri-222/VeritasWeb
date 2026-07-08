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

import { z } from 'zod';

// -----------------------------------------------------
// Constants
// -----------------------------------------------------

const MAX_URL_LENGTH = 2048;
const MAX_COOKIE_COUNT = 50;
const MAX_COOKIE_NAME_LENGTH = 200;
const MAX_COOKIE_VALUE_LENGTH = 4000;

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

/**
 * Basic SSRF protection
 * Blocks:
 * - localhost
 * - private IPs
 * - loopback
 * - internal hostnames
 */
export function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname
      .toLowerCase()
      .replace(/^\[/, '')
      .replace(/\]$/, '');

    // Block localhost
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      return false;
    }

    // Block internal hostnames
    if (
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }

    // Block private IPv4 ranges
    const privateIpPatterns = [
      /^10\./,
      /^127\./,
      /^169\.254\./,
      /^172\.(1[6-9]|2\d|3[0-1])\./,
      /^192\.168\./,
    ];

    if (
      privateIpPatterns.some((pattern) =>
        pattern.test(hostname)
      )
    ) {
      return false;
    }

    if (
      hostname.includes(':') &&
      (hostname.startsWith('fc') ||
        hostname.startsWith('fd') ||
        hostname.startsWith('fe80:'))
    ) {
      return false;
    }

    // Block AWS/GCP/Azure metadata endpoints
    const blockedHosts = [
      '169.254.169.254',
      'metadata.google.internal',
      'metadata.azure.internal',
    ];

    if (blockedHosts.includes(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
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

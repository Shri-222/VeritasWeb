import { NextRequest } from 'next/server';
import { apiErrorResponse } from '@/lib/auth';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;

  if (buckets.size > 5000) {
    for (const [bucketKey, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

export function rateLimitResponse() {
  return apiErrorResponse(
    'RATE_LIMITED',
    'Too many requests. Please try again later.',
    429
  );
}

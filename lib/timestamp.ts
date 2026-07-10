export type TimestampStatus = 'not_configured' | 'pending' | 'issued' | 'failed';

export function getTrustedTimestampStatus() {
  return {
    status: 'not_configured' as const,
    provider: null,
    message: 'Trusted timestamping is not configured. Application capture time is not an independent trusted timestamp.',
  };
}


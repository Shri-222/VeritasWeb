export function normalizeMonitorUrl(value: string) {
  const url = new URL(value.trim());

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('Monitor URL must use HTTP or HTTPS.');
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if (url.pathname === '/' && !url.search && !url.hash) {
    return url.origin;
  }

  return url.toString();
}

export function monitorUrlComparisonValues(normalizedUrl: string) {
  return [...new Set([
    normalizedUrl,
    new URL(normalizedUrl).toString(),
  ])];
}

export function normalizeCaseName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}


type DownloadErrorPayload = {
  message?: unknown;
};

export type ParsedDownloadResponse =
  | {
      ok: true;
      blob: Blob;
      filename: string;
    }
  | {
      ok: false;
      message: string;
    };

export function filenameFromContentDisposition(
  value: string | null,
  fallback: string
) {
  if (!value) return fallback;

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/^"|"$/g, ''));
    } catch {
      return fallback;
    }
  }

  const basicMatch = value.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1]?.trim() || fallback;
}

export async function parseDownloadResponse(
  response: Response,
  fallbackFilename: string,
  fallbackMessage: string
): Promise<ParsedDownloadResponse> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok || contentType.includes('application/json')) {
    let message = fallbackMessage;

    if (contentType.includes('application/json')) {
      try {
        const payload = (await response.json()) as DownloadErrorPayload;
        if (typeof payload.message === 'string' && payload.message.trim()) {
          message = payload.message;
        }
      } catch {
        // Keep the safe fallback when an invalid JSON error body is returned.
      }
    }

    return { ok: false, message };
  }

  return {
    ok: true,
    blob: await response.blob(),
    filename: filenameFromContentDisposition(
      response.headers.get('content-disposition'),
      fallbackFilename
    ),
  };
}

export function triggerBrowserDownload(
  blob: Blob,
  filename: string
) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

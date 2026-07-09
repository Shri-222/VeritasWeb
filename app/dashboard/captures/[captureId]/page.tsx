'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

type CaptureDetail = {
  id: string;
  monitorId: string;
  monitorUrl: string | null;
  pageTitle: string | null;
  originalUrl: string | null;
  finalUrl: string | null;
  capturedAt: string;
  statusCode: number;
  headers: unknown;
  screenshotPath: string | null;
  htmlPath: string | null;
  manifestPath: string | null;
  screenshotSignedUrl: string | null;
  screenshotSha256: string | null;
  htmlSha256: string | null;
  manifestSha256: string | null;
  previousCaptureHash: string | null;
  captureStatus: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type HashCheck = {
  stored: string | null;
  computed: string;
  match: boolean;
};

type VerificationResult = {
  captureId: string;
  verified: boolean;
  status:
    | 'VERIFIED'
    | 'FAILED'
    | 'MISSING_ARTIFACT'
    | 'INCOMPLETE_METADATA';
  checks: {
    screenshot: HashCheck | null;
    html: HashCheck | null;
    manifest: HashCheck | null;
  };
  message: string;
};

function statusLabel(status: VerificationResult['status']) {
  if (status === 'VERIFIED') return 'Verified';
  if (status === 'MISSING_ARTIFACT') return 'Missing Artifact';
  if (status === 'INCOMPLETE_METADATA') return 'Incomplete Metadata';
  return 'Failed';
}

function HashComparison({
  label,
  check,
}: {
  label: string;
  check: HashCheck | null;
}) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">
          {label}
        </p>
        <span
          className={
            check?.match
              ? 'text-xs text-green-400'
              : 'text-xs text-red-300'
          }
        >
          {check?.match ? 'Match' : 'No match'}
        </span>
      </div>
      <p className="break-all text-xs text-slate-400">
        Stored: {check?.stored || 'Unavailable'}
      </p>
      <p className="mt-1 break-all text-xs text-slate-400">
        Computed: {check?.computed || 'Unavailable'}
      </p>
    </div>
  );
}

async function getAccessToken() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export default function CaptureDetailPage() {
  const params = useParams<{ captureId: string }>();
  const captureId = params.captureId;

  const [capture, setCapture] =
    useState<CaptureDetail | null>(null);
  const [verification, setVerification] =
    useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const fetchCapture = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getAccessToken();

      if (!token) {
        setError('Authentication required.');
        return;
      }

      const response = await fetch(
        `/api/captures/${captureId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            'Failed to load capture.'
        );
      }

      setCapture(result.data);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load capture.'
      );
    } finally {
      setLoading(false);
    }
  }, [captureId]);

  async function verifyCapture() {
    setVerifying(true);
    setError('');

    try {
      const token = await getAccessToken();

      if (!token) {
        setError('Authentication required.');
        return;
      }

      const response = await fetch(
        `/api/captures/${captureId}/verify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            'Verification failed.'
        );
      }

      setVerification(result.data);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'Verification failed.'
      );
    } finally {
      setVerifying(false);
    }
  }

  async function exportPdfReport() {
    setExporting(true);
    setError('');

    try {
      const token = await getAccessToken();

      if (!token) {
        setError('Authentication required.');
        return;
      }

      const response = await fetch(
        `/api/captures/${captureId}/report`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.message ||
            'PDF export failed.'
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `veritasweb-capture-${captureId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'PDF export failed.'
      );
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    fetchCapture();
  }, [fetchCapture]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/dashboard"
          className="text-sm text-cyan-300 hover:underline"
        >
          Back to dashboard
        </Link>

        {loading && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-slate-300">
              Loading capture...
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="bg-slate-800 border-red-500/40">
            <CardContent className="pt-6 text-red-300">
              {error}
            </CardContent>
          </Card>
        )}

        {capture && (
          <>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  {capture.pageTitle || 'Untitled capture'}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {capture.monitorUrl ||
                    capture.originalUrl ||
                    'Unknown URL'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-slate-300 md:grid-cols-2">
                <p>
                  <span className="font-medium">Captured:</span>{' '}
                  {new Date(capture.capturedAt).toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Status code:</span>{' '}
                  {capture.statusCode}
                </p>
                <p className="break-all">
                  <span className="font-medium">Original URL:</span>{' '}
                  {capture.originalUrl || 'Unavailable'}
                </p>
                <p className="break-all">
                  <span className="font-medium">Final URL:</span>{' '}
                  {capture.finalUrl || 'Unavailable'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  Evidence Artifacts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-300">
                <p className="break-all">
                  <span className="font-medium">Screenshot path:</span>{' '}
                  {capture.screenshotPath || 'Unavailable'}
                </p>
                <p className="break-all">
                  <span className="font-medium">HTML path:</span>{' '}
                  {capture.htmlPath || 'Unavailable'}
                </p>
                <p className="break-all">
                  <span className="font-medium">Manifest path:</span>{' '}
                  {capture.manifestPath || 'Legacy capture or unavailable'}
                </p>
                {capture.screenshotSignedUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={capture.screenshotSignedUrl}
                    alt="Captured page screenshot"
                    className="max-h-[520px] w-full rounded-md border border-slate-700 object-contain"
                  />
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  Integrity Hashes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <p className="break-all">
                  <span className="font-medium">Screenshot SHA-256:</span>{' '}
                  {capture.screenshotSha256 || 'Unavailable'}
                </p>
                <p className="break-all">
                  <span className="font-medium">HTML SHA-256:</span>{' '}
                  {capture.htmlSha256 || 'Unavailable'}
                </p>
                <p className="break-all">
                  <span className="font-medium">Manifest SHA-256:</span>{' '}
                  {capture.manifestSha256 || 'Unavailable'}
                </p>
                <p className="break-all">
                  <span className="font-medium">Previous capture hash:</span>{' '}
                  {capture.previousCaptureHash || 'None'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  HTTP Metadata
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-300">
                  {JSON.stringify(capture.headers, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  Verification
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Recompute artifact and manifest hashes from stored evidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={verifyCapture}
                  disabled={verifying}
                  className="bg-cyan-500 text-white hover:bg-cyan-600"
                >
                  {verifying
                    ? 'Verifying...'
                    : 'Verify Integrity'}
                </Button>
                <Button
                  onClick={exportPdfReport}
                  disabled={exporting}
                  variant="outline"
                  className="ml-2 border-slate-600 bg-slate-700 text-white hover:bg-slate-600"
                >
                  {exporting
                    ? 'Exporting...'
                    : 'Export PDF Report'}
                </Button>

                {verification && (
                  <div className="space-y-4">
                    <div
                      className={
                        verification.verified
                          ? 'rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-green-300'
                          : 'rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300'
                      }
                    >
                      {statusLabel(verification.status)}: {verification.message}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <HashComparison
                        label="Screenshot"
                        check={verification.checks.screenshot}
                      />
                      <HashComparison
                        label="HTML"
                        check={verification.checks.html}
                      />
                      <HashComparison
                        label="Manifest"
                        check={verification.checks.manifest}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

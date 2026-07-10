'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowLeft,
  Code2,
  Download,
  ExternalLink,
  FileJson,
  Image as ImageIcon,
  type LucideIcon,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AppShell,
  CopyButton,
  InlineAlert,
  StatusBadge,
} from '@/components/veritas-ui';
import { createClient } from '@/lib/supabase/client';
import { parseDownloadResponse } from '@/lib/download-response';

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
  triggerType: string | null;
  captureStatus: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type HashCheck = {
  stored: string | null;
  computed: string | null;
  match: boolean;
};

type VerificationResult = {
  captureId: string;
  verified: boolean;
  status:
    | 'VERIFIED'
    | 'FAILED'
    | 'MISSING_ARTIFACT'
    | 'INCOMPLETE_METADATA'
    | 'NOT_RUN';
  checks: {
    screenshot: HashCheck | null;
    html: HashCheck | null;
    manifest: HashCheck | null;
  };
  message: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Unavailable';

  return new Date(value).toLocaleString();
}

function titleCase(value: string | null | undefined) {
  if (!value) return 'Unknown';

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusCodeTone(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) return 'success' as const;
  if (statusCode >= 400) return 'danger' as const;

  return 'warning' as const;
}

function statusCodeLabel(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) {
    return `${statusCode} OK`;
  }

  return String(statusCode);
}

function integrityBadge(verification: VerificationResult | null) {
  if (!verification) {
    return {
      tone: 'info' as const,
      label: 'Verification Ready',
    };
  }

  if (verification.status === 'VERIFIED') {
    return {
      tone: 'success' as const,
      label: 'Integrity Verified',
    };
  }

  if (verification.status === 'MISSING_ARTIFACT') {
    return {
      tone: 'warning' as const,
      label: 'Artifact Missing',
    };
  }

  return {
    tone: 'danger' as const,
    label: 'Verification Failed',
  };
}

function verificationCopy(verification: VerificationResult) {
  if (verification.status === 'VERIFIED') {
    return {
      tone: 'success' as const,
      title: 'Integrity Verified',
      body: 'All stored artifacts match their recorded SHA-256 hashes.',
    };
  }

  if (verification.status === 'MISSING_ARTIFACT') {
    return {
      tone: 'warning' as const,
      title: 'Artifact Missing',
      body: 'One or more stored evidence artifacts could not be found.',
    };
  }

  return {
    tone: 'danger' as const,
    title: 'Integrity Check Failed',
    body: 'One or more stored artifacts no longer match the recorded hashes.',
  };
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-4">
      <p className="text-xs font-medium uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-all text-sm text-slate-200">
        {value || 'Unavailable'}
      </p>
    </div>
  );
}

function ArtifactCard({
  icon: Icon,
  title,
  subtitle,
  path,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  path: string | null;
}) {
  return (
    <div className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-50">
              {title}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <StatusBadge tone={path ? 'success' : 'default'}>
          {path ? 'Stored' : 'Missing'}
        </StatusBadge>
      </div>
      <div className="mt-4 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-[#2A3A52] bg-[#0B1120] p-3 text-xs text-slate-300">
          {path || 'Unavailable'}
        </code>
        <CopyButton value={path} label={`Copy ${title} path`} />
      </div>
    </div>
  );
}

function HashCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">{label}</h3>
          <p className="mt-1 text-xs text-slate-400">
            Recorded at capture time
          </p>
        </div>
        <CopyButton value={value} label={`Copy ${label}`} />
      </div>
      <code className="mt-4 block break-all rounded-lg border border-[#2A3A52] bg-[#0B1120] p-3 text-xs text-slate-300">
        {value || 'Unavailable'}
      </code>
    </div>
  );
}

function HashComparison({
  label,
  check,
}: {
  label: string;
  check: HashCheck | null;
}) {
  return (
    <div className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-50">{label}</p>
        <StatusBadge tone={check?.match ? 'success' : 'danger'}>
          {check?.match ? 'Match' : 'No match'}
        </StatusBadge>
      </div>
      <p className="break-all font-mono text-xs text-slate-400">
        Stored: {check?.stored || 'Unavailable'}
      </p>
      <p className="mt-2 break-all font-mono text-xs text-slate-400">
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
  const router = useRouter();
  const params = useParams<{ captureId: string }>();
  const captureId = params.captureId;

  const [capture, setCapture] = useState<CaptureDetail | null>(null);
  const [verification, setVerification] =
    useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bundling, setBundling] = useState(false);
  const [error, setError] = useState('');

  const headersJson = useMemo(
    () => JSON.stringify(capture?.headers ?? {}, null, 2),
    [capture?.headers]
  );

  const fetchCapture = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getAccessToken();

      if (!token) {
        setError('Authentication required.');
        return;
      }

      const response = await fetch(`/api/captures/${captureId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || 'Failed to load capture.');
        return;
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

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
    });
    router.push('/login');
    router.refresh();
  }

  async function verifyCapture() {
    setVerifying(true);
    setError('');

    try {
      const token = await getAccessToken();

      if (!token) {
        setError('Authentication required.');
        return;
      }

      const response = await fetch(`/api/captures/${captureId}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || 'Verification failed.');
        return;
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

      const response = await fetch(`/api/captures/${captureId}/report`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await parseDownloadResponse(
        response,
        `veritasweb-capture-${captureId}.pdf`,
        'PDF export failed.'
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }

      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
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

  async function downloadEvidenceBundle() {
    setBundling(true);
    setError('');
    try {
      const token = await getAccessToken();
      if (!token) { setError('Authentication required.'); return; }
      const response = await fetch(`/api/captures/${captureId}/bundle`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await parseDownloadResponse(
        response,
        `veritasweb-evidence-${captureId}.zip`,
        'Evidence bundle export failed.'
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const objectUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (bundleError) {
      setError(bundleError instanceof Error ? bundleError.message : 'Evidence bundle export failed.');
    } finally {
      setBundling(false);
    }
  }

  useEffect(() => {
    fetchCapture();
  }, [fetchCapture]);

  const badge = integrityBadge(verification);

  return (
    <AppShell onLogout={handleLogout}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Link>

        {loading && (
          <div className="mt-6 rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-6 text-sm text-slate-300">
            Loading evidence record...
          </div>
        )}

        {error && (
          <div className="mt-6">
            <InlineAlert tone="danger">{error}</InlineAlert>
          </div>
        )}

        {capture && (
          <div className="mt-6 space-y-8">
            <section className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-6 shadow-lg shadow-black/20">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-cyan-300">
                    Evidence Record
                  </p>
                  <h1 className="mt-2 break-words text-3xl font-semibold leading-tight text-slate-50">
                    {capture.pageTitle || 'Untitled capture'}
                  </h1>
                  <p className="mt-3 break-all text-sm text-slate-400">
                    {capture.finalUrl ||
                      capture.originalUrl ||
                      capture.monitorUrl ||
                      'Unknown URL'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge tone={statusCodeTone(capture.statusCode)}>
                      {statusCodeLabel(capture.statusCode)}
                    </StatusBadge>
                    <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    {capture.triggerType && (
                      <StatusBadge tone="info">
                        {titleCase(capture.triggerType)} Capture
                      </StatusBadge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SummaryCard
                  label="Captured At"
                  value={formatDate(capture.capturedAt)}
                />
                <SummaryCard
                  label="HTTP Status"
                  value={statusCodeLabel(capture.statusCode)}
                />
                <SummaryCard
                  label="Original URL"
                  value={capture.originalUrl}
                />
                <SummaryCard label="Final URL" value={capture.finalUrl} />
                <SummaryCard label="Capture ID" value={capture.id} />
                <SummaryCard label="Monitor ID" value={capture.monitorId} />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-50">
                      Visual Capture
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Rendered by Playwright in an isolated browser context.
                    </p>
                  </div>
                  {capture.screenshotSignedUrl && (
                    <a
                      href={capture.screenshotSignedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-[#2A3A52] bg-[#172033] px-3 py-2 text-sm text-slate-100 transition hover:bg-[#1E293B]"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Open Full Screenshot
                    </a>
                  )}
                </div>
                <div className="mt-5 max-h-[560px] overflow-auto rounded-xl border border-[#2A3A52] bg-[#0B1120] p-3">
                  {capture.screenshotSignedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={capture.screenshotSignedUrl}
                      alt="Captured page screenshot"
                      className="mx-auto max-h-[520px] w-full rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex min-h-64 items-center justify-center text-slate-500">
                      <ImageIcon className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">
                    Stored Evidence Artifacts
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Private storage paths for the saved capture artifacts.
                  </p>
                </div>
                <ArtifactCard
                  icon={ImageIcon}
                  title="Screenshot PNG"
                  subtitle="Private storage artifact"
                  path={capture.screenshotPath}
                />
                <ArtifactCard
                  icon={Code2}
                  title="HTML Snapshot"
                  subtitle="Captured page source"
                  path={capture.htmlPath}
                />
                <ArtifactCard
                  icon={FileJson}
                  title="Manifest JSON"
                  subtitle="Deterministic evidence manifest"
                  path={capture.manifestPath}
                />
              </div>
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-50">
                  Integrity Hashes
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  SHA-256 hashes are used to verify stored artifacts and the
                  evidence manifest.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <HashCard
                  label="Screenshot SHA-256"
                  value={capture.screenshotSha256}
                />
                <HashCard label="HTML SHA-256" value={capture.htmlSha256} />
                <HashCard
                  label="Manifest SHA-256"
                  value={capture.manifestSha256}
                />
              </div>
              {capture.previousCaptureHash && (
                <div className="mt-4 rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-50">
                        Previous capture hash
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Links this record to the prior capture for the monitor.
                      </p>
                    </div>
                    <CopyButton
                      value={capture.previousCaptureHash}
                      label="Copy previous capture hash"
                    />
                  </div>
                  <code className="mt-4 block break-all rounded-lg border border-[#2A3A52] bg-[#0B1120] p-3 text-xs text-slate-300">
                    {capture.previousCaptureHash}
                  </code>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">
                    HTTP Response Metadata
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Headers and response data captured during page navigation.
                  </p>
                </div>
                <CopyButton value={headersJson} label="Copy response headers" />
              </div>
              <pre className="max-h-80 overflow-auto rounded-xl border border-[#2A3A52] bg-[#0B1120] p-4 font-mono text-xs leading-5 text-slate-300">
                {headersJson}
              </pre>
            </section>

            <section className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">
                    Integrity Verification
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    Recompute stored artifact hashes and compare them with the
                    original evidence manifest.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={verifyCapture}
                    disabled={verifying}
                    className="bg-cyan-500 font-semibold text-[#06111A] hover:bg-cyan-600"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {verifying ? 'Verifying...' : 'Verify Integrity'}
                  </Button>
                  <Button
                    onClick={exportPdfReport}
                    disabled={exporting}
                    variant="outline"
                    className="border-[#2A3A52] bg-[#172033] text-slate-100 hover:bg-[#1E293B]"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {exporting ? 'Generating Report...' : 'Export Evidence Report'}
                  </Button>
                  <Button
                    onClick={downloadEvidenceBundle}
                    disabled={bundling}
                    variant="outline"
                    className="border-[#2A3A52] bg-[#172033] text-slate-100 hover:bg-[#1E293B]"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {bundling ? 'Preparing Bundle...' : 'Download Evidence Bundle'}
                  </Button>
                </div>
              </div>

              {verification ? (
                <div className="mt-5 space-y-4">
                  {(() => {
                    const copy = verificationCopy(verification);

                    return (
                      <InlineAlert tone={copy.tone}>
                        <span className="font-semibold">{copy.title}</span>
                        <span className="block pt-1">{copy.body}</span>
                      </InlineAlert>
                    );
                  })()}
                  <div className="grid gap-4 lg:grid-cols-3">
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
              ) : (
                <div className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                  Verification has not been run in this browser session.
                </div>
              )}
            </section>

            <p className="text-xs text-slate-500">
              Hashes computed using SHA-256. Reports are generated from stored
              data, not live recapture.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

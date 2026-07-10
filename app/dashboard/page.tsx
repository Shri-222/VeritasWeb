'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Activity,
  Briefcase,
  CalendarClock,
  Camera,
  Image as ImageIcon,
  type LucideIcon,
  Pause,
  Play,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AppShell,
  InlineAlert,
  StatusBadge,
} from '@/components/veritas-ui';
import type { Database } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

const UNSAFE_URL_MESSAGE =
  'Unsafe URL blocked. This URL points to a private, local, or internal address. Use a public HTTP/HTTPS website.';

type Monitor =
  Database['public']['Tables']['monitors']['Row'];
type CaseRecord = Database['public']['Tables']['cases']['Row'];

type CaptureHistoryItem = {
  id: string;
  monitor_id: string;
  monitor_url: string | null;
  captured_at: string;
  original_url: string | null;
  final_url: string | null;
  page_title: string | null;
  status_code: number;
  screenshot_path: string | null;
  screenshot_signed_url: string | null;
  html_path: string | null;
  screenshot_sha256: string | null;
  html_sha256: string | null;
  manifest_sha256: string | null;
  previous_capture_hash: string | null;
  capture_status: string | null;
  error_message: string | null;
  created_at: string;
};

type Message = {
  tone: 'success' | 'danger' | 'warning' | 'info';
  text: string;
};

type BetaUsage = {
  monitors: { used: number; limit: number };
  capturesToday: { used: number; limit: number };
  bundleCaptureLimit: number;
};

type NotificationEndpoint = { id: string; type: string; destination: string; enabled: boolean };

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled';

  return new Date(value).toLocaleString();
}

function titleCase(value: string | null | undefined) {
  if (!value) return 'Unknown';

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function truncateHash(value: string | null | undefined) {
  if (!value) return 'Missing';

  return `${value.slice(0, 18)}...${value.slice(-8)}`;
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

function artifactCount(capture: CaptureHistoryItem) {
  return [
    capture.screenshot_path,
    capture.html_path,
    capture.manifest_sha256,
  ].filter(Boolean).length;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helper: string;
  tone: 'cyan' | 'blue' | 'green' | 'amber';
}) {
  const toneClass = {
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    green: 'border-green-500/30 bg-green-500/10 text-green-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  }[tone];

  return (
    <div className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-5 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-400">{helper}</p>
        </div>
        <span className={`rounded-lg border p-2 ${toneClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [captures, setCaptures] = useState<CaptureHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState<Record<string, boolean>>({});
  const [monitorActionLoading, setMonitorActionLoading] =
    useState<Record<string, boolean>>({});
  const [frequencyDrafts, setFrequencyDrafts] =
    useState<Record<string, Monitor['frequency']>>({});
  const [statusMessage, setStatusMessage] = useState<Message | null>(null);
  const [createMessage, setCreateMessage] = useState<Message | null>(null);
  const [url, setUrl] = useState('');
  const [frequency, setFrequency] = useState<Monitor['frequency']>('daily');
  const [caseId, setCaseId] = useState<string>('');
  const [caseName, setCaseName] = useState('');
  const [caseMessage, setCaseMessage] = useState<Message | null>(null);
  const [usage, setUsage] = useState<BetaUsage | null>(null);
  const [notifications, setNotifications] = useState<NotificationEndpoint[]>([]);
  const [webhook, setWebhook] = useState('');
  const [notificationMessage, setNotificationMessage] = useState<Message | null>(null);

  const metrics = useMemo(() => {
    const activeMonitors = monitors.filter(
      (monitor) => monitor.status === 'active'
    );
    const integrityRecords = captures.filter(
      (capture) => Boolean(capture.manifest_sha256)
    );
    const scheduledMonitors = activeMonitors.filter(
      (monitor) => Boolean(monitor.next_capture_at)
    );

    return {
      activeMonitors: activeMonitors.length,
      totalCaptures: captures.length,
      integrityRecords: integrityRecords.length,
      scheduledMonitors: scheduledMonitors.length,
    };
  }, [captures, monitors]);

  const getSession = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session;
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
    });
    router.push('/login');
    router.refresh();
  }

  const handleCreateMonitor = async () => {
    if (!url) {
      setCreateMessage({
        tone: 'danger',
        text: 'Enter a public URL to monitor.',
      });
      return;
    }

    setIsLoading(true);
    setCreateMessage(null);
    try {
      const session = await getSession();

      if (!session) {
        setCreateMessage({
          tone: 'danger',
          text: 'You must be logged in.',
        });
        return;
      }

      const response = await fetch('/api/monitors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          url,
          frequency,
          ...(caseId ? { case_id: caseId } : {}),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        if (result.code === 'UNSAFE_URL') {
          setCreateMessage({
            tone: 'danger',
            text: UNSAFE_URL_MESSAGE,
          });
          return;
        }

        if (result.code === 'VALIDATION_ERROR') {
          setCreateMessage({
            tone: 'danger',
            text: result.message || 'Monitor input is invalid.',
          });
          return;
        }

        setCreateMessage({
          tone: 'danger',
          text:
            result.message ||
            result.error ||
            'Failed to create monitor. Please try again.',
        });
        return;
      }

      await fetchMonitors();
      await fetchCases();
      await fetchCaptures();
      setUrl('');
      setCreateMessage({
        tone: 'success',
        text: 'Monitor created successfully.',
      });
    } catch (error) {
      console.error('[v0] Monitor creation error:', error);
      setCreateMessage({
        tone: 'danger',
        text: 'Failed to create monitor. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonitors = useCallback(async () => {
    try {
      const session = await getSession();

      if (!session) return;

      const response = await fetch('/api/monitors', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to fetch monitors');
      }

      const nextMonitors = Array.isArray(result)
        ? result
        : result.data ?? [];

      setMonitors(nextMonitors);
      setFrequencyDrafts((current) => {
        const next = { ...current };

        nextMonitors.forEach((monitor: Monitor) => {
          next[monitor.id] = next[monitor.id] ?? monitor.frequency;
        });

        return next;
      });
    } catch (error) {
      console.error('Fetch monitors error:', error);
    }
  }, [getSession]);

  const fetchCaptures = useCallback(async () => {
    try {
      const session = await getSession();

      if (!session) return;

      const response = await fetch('/api/captures', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch captures');
      }

      setCaptures(result.data ?? []);
    } catch (error) {
      console.error('Fetch captures error:', error);
    }
  }, [getSession]);

  const fetchCases = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) return;
      const response = await fetch('/api/cases', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json();
      if (!response.ok) {
        setCases([]);
        setCaseMessage({
          tone: 'danger',
          text: result.message || 'Cases are currently unavailable.',
        });
        return;
      }
      setCases(result.data ?? []);
    } catch {
      setCases([]);
      setCaseMessage({
        tone: 'danger',
        text: 'Cases are currently unavailable. Please try again.',
      });
    }
  }, [getSession]);

  const handleCreateCase = async () => {
    if (!caseName.trim()) {
      setCaseMessage({ tone: 'danger', text: 'Enter a case name.' });
      return;
    }
    try {
      const session = await getSession();
      if (!session) return;
      const response = await fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ name: caseName }) });
      const result = await response.json();
      if (!response.ok) {
        setCaseMessage({ tone: 'danger', text: result.message || 'Failed to create case.' });
        return;
      }
      setCaseName('');
      setCaseMessage({ tone: 'success', text: 'Case created.' });
      await fetchCases();
      if (result.data?.id) setCaseId(result.data.id);
    } catch (error) {
      setCaseMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Failed to create case.' });
    }
  };

  const fetchUsage = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) return;
      const response = await fetch('/api/beta/usage', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json();
      if (response.ok) setUsage(result.data);
    } catch (error) { console.error('Fetch beta usage error:', error); }
  }, [getSession]);

  const fetchNotifications = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) return;
      const response = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json();
      if (!response.ok) {
        setNotifications([]);
        setNotificationMessage({ tone: 'danger', text: result.message || 'Notification settings are unavailable.' });
        return;
      }
      const endpoints = Array.isArray(result.data)
        ? result.data
        : result.data?.endpoints ?? [];
      setNotifications(endpoints);
    } catch {
      setNotifications([]);
      setNotificationMessage({ tone: 'danger', text: 'Notification settings are unavailable. Please try again.' });
    }
  }, [getSession]);

  const handleAddWebhook = async () => {
    try {
      const session = await getSession();
      if (!session) return;
      const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ type: 'webhook', destination: webhook }) });
      const result = await response.json();
      if (!response.ok) {
        setNotificationMessage({ tone: 'danger', text: result.message || 'Failed to save webhook.' });
        return;
      }
      setWebhook(''); setNotificationMessage({ tone: 'success', text: 'Webhook notification enabled.' }); await fetchNotifications();
    } catch (error) { setNotificationMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Failed to save webhook.' }); }
  };

  const handleCaptureNow = async (monitorId: string) => {
    if (captureLoading[monitorId]) return;

    setCaptureLoading((current) => ({
      ...current,
      [monitorId]: true,
    }));
    setStatusMessage({
      tone: 'info',
      text: 'Capture running...',
    });

    try {
      const session = await getSession();

      if (!session) {
        setStatusMessage({
          tone: 'danger',
          text: 'You must be logged in.',
        });
        return;
      }

      const response = await fetch('/api/capture-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          monitorId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Capture failed');
      }

      await fetchCaptures();
      await fetchMonitors();
      setStatusMessage({
        tone: 'success',
        text: 'Capture completed successfully.',
      });
    } catch (error) {
      console.error('Capture now error:', error);
      setStatusMessage({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Capture failed.',
      });
    } finally {
      setCaptureLoading((current) => ({
        ...current,
        [monitorId]: false,
      }));
    }
  };

  const handleUpdateMonitor = async (
    monitorId: string,
    body: Partial<Pick<Monitor, 'frequency' | 'status'>>
  ) => {
    if (monitorActionLoading[monitorId]) return;

    setMonitorActionLoading((current) => ({
      ...current,
      [monitorId]: true,
    }));

    try {
      const session = await getSession();

      if (!session) {
        setStatusMessage({
          tone: 'danger',
          text: 'You must be logged in.',
        });
        return;
      }

      const response = await fetch(`/api/monitors/${monitorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Monitor update failed.');
      }

      await fetchMonitors();
      setStatusMessage({
        tone: 'success',
        text: 'Monitor updated successfully.',
      });
    } catch (error) {
      console.error('Monitor update error:', error);
      setStatusMessage({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Monitor update failed.',
      });
    } finally {
      setMonitorActionLoading((current) => ({
        ...current,
        [monitorId]: false,
      }));
    }
  };

  const handleDeleteMonitor = async (monitorId: string) => {
    if (monitorActionLoading[monitorId]) return;

    const confirmed = window.confirm(
      'Delete this monitor? This is only allowed before it has evidence captures.'
    );

    if (!confirmed) return;

    setMonitorActionLoading((current) => ({
      ...current,
      [monitorId]: true,
    }));

    try {
      const session = await getSession();

      if (!session) {
        setStatusMessage({
          tone: 'danger',
          text: 'You must be logged in.',
        });
        return;
      }

      const response = await fetch(`/api/monitors/${monitorId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Monitor deletion failed.');
      }

      await fetchMonitors();
      await fetchCaptures();
      setStatusMessage({
        tone: 'success',
        text: 'Monitor deleted successfully.',
      });
    } catch (error) {
      console.error('Monitor deletion error:', error);
      setStatusMessage({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Monitor deletion failed.',
      });
    } finally {
      setMonitorActionLoading((current) => ({
        ...current,
        [monitorId]: false,
      }));
    }
  };

  useEffect(() => {
    fetchMonitors();
    fetchCaptures();
    fetchCases();
    fetchUsage();
    fetchNotifications();
  }, [fetchCaptures, fetchCases, fetchMonitors, fetchNotifications, fetchUsage]);

  return (
    <AppShell onLogout={handleLogout}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <section className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-medium text-cyan-300">
              Dashboard
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-slate-50">
              Preserve web pages before they change.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Create monitors, capture public web pages, verify stored
              artifacts, and export evidence reports from one secure workspace.
            </p>
          </div>
          <a
            href="#create-monitor"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#06111A] transition hover:bg-cyan-600"
          >
            Create Monitor
          </a>
          <Link href="#cases" className="text-sm text-cyan-300 hover:text-cyan-200">Cases</Link>
        </section>

        {monitors.length === 0 && (
          <section className="mb-8 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <p className="text-sm font-semibold text-cyan-100">Welcome to VeritasWeb</p>
            <p className="mt-2 text-sm text-cyan-50/80">Complete your first evidence workflow:</p>
            <ol className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-5">
              {['Add your first public URL', 'Run a capture', 'Open the evidence record', 'Verify integrity', 'Export an evidence report'].map((item, index) => <li key={item} className="flex gap-2"><span className="font-mono text-cyan-300">{index + 1}.</span>{item}</li>)}
            </ol>
            <p className="mt-4 text-xs leading-5 text-slate-400">Try <button type="button" onClick={() => setUrl('https://example.com')} className="font-mono text-cyan-300 hover:text-cyan-200">https://example.com</button>. Manual captures run on demand; scheduled captures use the frequency you select. Stored artifacts stay private, and local or private URLs are blocked.</p>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Activity}
            label="Active Monitors"
            value={metrics.activeMonitors}
            helper={`${monitors.length} total monitor${monitors.length === 1 ? '' : 's'}`}
            tone="cyan"
          />
          <MetricCard
            icon={Camera}
            label="Total Captures"
            value={metrics.totalCaptures}
            helper="Loaded evidence records"
            tone="blue"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Integrity Records"
            value={metrics.integrityRecords}
            helper="Records with manifest hashes"
            tone="green"
          />
          <MetricCard
            icon={CalendarClock}
            label="Scheduled Monitors"
            value={metrics.scheduledMonitors}
            helper="Active monitors with next capture"
            tone="amber"
          />
        </section>

        {usage && <section className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-lg border border-[#2A3A52] bg-[#111827]/70 px-4 py-3 text-slate-400">Beta monitors <span className="font-semibold text-slate-100">{usage.monitors.used}/{usage.monitors.limit}</span></div><div className="rounded-lg border border-[#2A3A52] bg-[#111827]/70 px-4 py-3 text-slate-400">Captures today <span className="font-semibold text-slate-100">{usage.capturesToday.used}/{usage.capturesToday.limit}</span></div><div className="rounded-lg border border-[#2A3A52] bg-[#111827]/70 px-4 py-3 text-slate-400">Bundle cap <span className="font-semibold text-slate-100">{usage.bundleCaptureLimit} records</span></div></section>}

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(320px,2fr)_minmax(0,3fr)]">
          <div
            id="create-monitor"
            className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-5 shadow-lg shadow-black/20"
          >
            <h2 className="text-lg font-semibold text-slate-50">
              Create Monitor
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Add a public webpage to begin preserving capture records.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Public URL
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="border-[#2A3A52] bg-[#0B1120] text-slate-50 placeholder:text-slate-500 focus-visible:ring-cyan-500"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Only public HTTP/HTTPS URLs are supported. Local, private, and
                  internal addresses are blocked.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Case / workspace</label>
                <select value={caseId} onChange={(event) => setCaseId(event.target.value)} className="w-full rounded-md border border-[#2A3A52] bg-[#0B1120] px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-500">
                  <option value="">No Case</option>
                  {cases.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Capture Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as Monitor['frequency'])
                  }
                  className="w-full rounded-md border border-[#2A3A52] bg-[#0B1120] px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {createMessage && (
                <InlineAlert tone={createMessage.tone}>
                  {createMessage.text}
                </InlineAlert>
              )}

              <Button
                onClick={handleCreateMonitor}
                disabled={isLoading}
                className="w-full bg-cyan-500 font-semibold text-[#06111A] hover:bg-cyan-600"
              >
                {isLoading ? 'Creating...' : 'Create Monitor'}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">
                  Monitors
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Capture, preserve, verify, and report web evidence.
                </p>
              </div>
            </div>

            <div id="cases" className="rounded-xl border border-[#2A3A52] bg-[#111827]/70 p-4">
              <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold text-slate-50">Cases</h2></div>
              <p className="mt-1 text-xs text-slate-500">Group monitors and records without changing their ownership or retention.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={caseName} onChange={(event) => setCaseName(event.target.value)} placeholder="New case name" className="border-[#2A3A52] bg-[#0B1120] text-slate-50 placeholder:text-slate-500" /><Button onClick={handleCreateCase} variant="outline" className="border-cyan-500/50 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20">Create Case</Button></div>
              {caseMessage && <div className="mt-3"><InlineAlert tone={caseMessage.tone}>{caseMessage.text}</InlineAlert></div>}
              {cases.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{cases.map((item) => <Link key={item.id} href={`/dashboard/cases/${item.id}`} className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-400/50 hover:text-white">{item.name} <span className="text-slate-500">{item.status}</span></Link>)}</div>}
              <div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Webhook notifications</p><p className="mt-1 text-xs text-slate-500">Optional HTTPS alerts for changed pages. Private/internal destinations are blocked.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={webhook} onChange={(event) => setWebhook(event.target.value)} placeholder="https://hooks.example.com/..." className="border-[#2A3A52] bg-[#0B1120] text-slate-50 placeholder:text-slate-500" /><Button onClick={handleAddWebhook} variant="outline" className="border-cyan-500/50 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20">Add Webhook</Button></div>{notificationMessage && <div className="mt-3"><InlineAlert tone={notificationMessage.tone}>{notificationMessage.text}</InlineAlert></div>}{notifications.length > 0 && <p className="mt-3 text-xs text-emerald-300">{notifications.filter((item) => item.enabled).length} webhook endpoint(s) enabled.</p>}</div>
            </div>

            {statusMessage && (
              <InlineAlert tone={statusMessage.tone}>
                {statusMessage.text}
              </InlineAlert>
            )}

            {monitors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#2A3A52] bg-[#111827]/70 p-8 text-center">
                <p className="text-sm text-slate-300">
                  No monitors yet. Create one to begin preserving capture
                  records.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {monitors.map((monitor) => {
                  const hasCaptures = (monitor.capture_count ?? 0) > 0;
                  const isActive = monitor.status === 'active';

                  return (
                    <article
                      key={monitor.id}
                      className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-4 shadow-lg shadow-black/20 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <StatusBadge tone={isActive ? 'success' : 'warning'}>
                            {isActive ? 'Active' : 'Paused'}
                          </StatusBadge>
                          <StatusBadge tone="info">
                            {titleCase(monitor.frequency)}
                          </StatusBadge>
                        </div>

                        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                          <Button
                            variant="outline"
                            onClick={() => handleCaptureNow(monitor.id)}
                            disabled={
                              captureLoading[monitor.id] ||
                              monitorActionLoading[monitor.id]
                            }
                            className="border-cyan-500/50 bg-cyan-500 text-[#06111A] hover:bg-cyan-600"
                          >
                            <Play className="h-4 w-4" aria-hidden="true" />
                            {captureLoading[monitor.id]
                              ? 'Running...'
                              : 'Run Capture'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleUpdateMonitor(monitor.id, {
                                status: isActive ? 'paused' : 'active',
                              })
                            }
                            disabled={monitorActionLoading[monitor.id]}
                            className="border-[#2A3A52] bg-[#172033] text-slate-100 hover:bg-[#1E293B]"
                          >
                            {isActive ? (
                              <Pause className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Play className="h-4 w-4" aria-hidden="true" />
                            )}
                            {monitorActionLoading[monitor.id]
                              ? 'Updating...'
                              : isActive
                                ? 'Pause'
                                : 'Resume'}
                          </Button>
                          <select
                            value={
                              frequencyDrafts[monitor.id] ?? monitor.frequency
                            }
                            onChange={(event) =>
                              setFrequencyDrafts((current) => ({
                                ...current,
                                [monitor.id]: event.target
                                  .value as Monitor['frequency'],
                              }))
                            }
                            disabled={monitorActionLoading[monitor.id]}
                            className="h-10 min-w-[8rem] rounded-md border border-[#2A3A52] bg-[#0B1120] px-3 text-sm text-slate-50 outline-none focus:border-cyan-500"
                          >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleUpdateMonitor(monitor.id, {
                                frequency:
                                  frequencyDrafts[monitor.id] ??
                                  monitor.frequency,
                              })
                            }
                            disabled={
                              monitorActionLoading[monitor.id] ||
                              (frequencyDrafts[monitor.id] ??
                                monitor.frequency) === monitor.frequency
                            }
                            className="border-[#2A3A52] bg-[#172033] text-slate-100 hover:bg-[#1E293B]"
                          >
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Save Frequency
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleDeleteMonitor(monitor.id)}
                            disabled={
                              hasCaptures || monitorActionLoading[monitor.id]
                            }
                            title={
                              hasCaptures
                                ? 'Monitors with captures cannot be deleted. Pause instead.'
                                : 'Delete monitor'
                            }
                            className="border-red-500/30 bg-red-950/60 text-red-100 hover:bg-red-900 disabled:border-[#2A3A52] disabled:bg-[#0B1120] disabled:text-slate-500"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 min-w-0">
                        <h3
                          className="line-clamp-2 break-words text-base font-semibold leading-6 text-slate-50"
                          title={monitor.url}
                        >
                          {monitor.url}
                        </h3>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0 rounded-lg border border-[#2A3A52]/70 bg-[#0B1120]/60 p-3">
                          <p className="text-xs text-slate-500">
                            Last captured
                          </p>
                          <p className="mt-1 truncate text-slate-300">
                            {formatDate(monitor.last_captured_at)}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-[#2A3A52]/70 bg-[#0B1120]/60 p-3">
                          <p className="text-xs text-slate-500">
                            Next capture
                          </p>
                          <p className="mt-1 truncate text-slate-300">
                            {formatDate(monitor.next_capture_at)}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-[#2A3A52]/70 bg-[#0B1120]/60 p-3">
                          <p className="text-xs text-slate-500">
                            Capture count
                          </p>
                          <p className="mt-1 text-slate-300">
                            {monitor.capture_count ?? 0}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-[#2A3A52]/70 bg-[#0B1120]/60 p-3">
                          <p className="text-xs text-slate-500">
                            Last status
                          </p>
                          <p className="mt-1 truncate text-slate-300">
                            {titleCase(monitor.last_capture_status)}
                          </p>
                        </div>
                      </div>

                      {monitor.last_capture_error && (
                        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                          {monitor.last_capture_error}
                        </p>
                      )}

                      {hasCaptures && (
                        <p className="mt-4 text-xs text-slate-500">
                          Monitors with captures cannot be deleted. Pause
                          instead.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-semibold text-slate-50">
                Evidence Records
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Recent captures generated from your monitored URLs.
              </p>
            </div>
          </div>

          {captures.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2A3A52] bg-[#111827]/70 p-8 text-center">
              <p className="text-sm text-slate-300">
                No evidence records yet.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Run a capture from one of your monitors to generate your first
                stored record.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              {captures.map((capture) => (
                <article
                  key={capture.id}
                  className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-4 shadow-lg shadow-black/20"
                >
                  <div className="flex gap-4">
                    <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg border border-[#2A3A52] bg-[#0B1120]">
                      {capture.screenshot_signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={capture.screenshot_signed_url}
                          alt="Evidence record screenshot"
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-600">
                          <ImageIcon className="h-6 w-6" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <StatusBadge tone={statusCodeTone(capture.status_code)}>
                          {statusCodeLabel(capture.status_code)}
                        </StatusBadge>
                        <StatusBadge tone="info">
                          {artifactCount(capture)}/3 Artifacts Stored
                        </StatusBadge>
                      </div>
                      <h3 className="line-clamp-2 text-sm font-semibold text-slate-50">
                        {capture.page_title || 'Untitled page'}
                      </h3>
                      <p className="mt-1 line-clamp-2 break-words text-xs text-slate-400">
                        {capture.final_url ||
                          capture.original_url ||
                          capture.monitor_url ||
                          'Unknown URL'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-400">
                    <p>
                      Captured:{' '}
                      <span className="text-slate-300">
                        {formatDate(capture.captured_at)}
                      </span>
                    </p>
                    <p className="font-mono break-words">
                      Manifest: {truncateHash(capture.manifest_sha256)}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <StatusBadge tone={capture.screenshot_path ? 'success' : 'default'}>
                        Screenshot
                      </StatusBadge>
                      <StatusBadge tone={capture.html_path ? 'success' : 'default'}>
                        HTML
                      </StatusBadge>
                      <StatusBadge tone={capture.manifest_sha256 ? 'success' : 'default'}>
                        Manifest
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/captures/${capture.id}`}
                      className="inline-flex items-center justify-center rounded-md border border-cyan-500/50 bg-cyan-500 px-3 py-2 text-sm font-medium text-[#06111A] transition hover:bg-cyan-600"
                    >
                      View Record
                    </Link>
                    {capture.screenshot_signed_url && (
                      <a
                        href={capture.screenshot_signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-md border border-[#2A3A52] bg-[#172033] px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-[#1E293B]"
                      >
                        Open Screenshot
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="relative border-t border-[#2A3A52]/80 bg-[#070B14]/85">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
          Built for forensic-style web capture workflows. Consult legal counsel
          for admissibility requirements.
        </div>
      </footer>
    </AppShell>
  );
}

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Database } from '@/types/database';
import { createClient  } from '@/lib/supabase/client';

type Monitor =
  Database['public']['Tables']['monitors']['Row'];

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
  created_at: string;
};


export default function HomePage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [captures, setCaptures] = useState<CaptureHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState<Record<string, boolean>>({});
  const [monitorActionLoading, setMonitorActionLoading] = useState<Record<string, boolean>>({});
  const [frequencyDrafts, setFrequencyDrafts] = useState<Record<string, Monitor['frequency']>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [url, setUrl] = useState('');
  const [frequency, setFrequency] = useState<Monitor['frequency']>('daily');

  const handleCreateMonitor = async () => {
    if (!url) {
      alert('Please enter a URL');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          alert('You must be logged in');
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
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            'Failed to create monitor.'
        );
      }

      await fetchMonitors();
      await fetchCaptures();
      setUrl('');
      setStatusMessage('Monitor created successfully.');
    } catch (error) {
      console.error('[v0] Monitor creation error:', error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Failed to create monitor.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonitors = async () => {
    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch('/api/monitors', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            'Failed to fetch monitors'
        );
      }

      const nextMonitors = Array.isArray(result)
        ? result
        : result.data ?? [];

      setMonitors(nextMonitors);
      setFrequencyDrafts((current) => {
        const next = { ...current };

        nextMonitors.forEach((monitor: Monitor) => {
          next[monitor.id] =
            next[monitor.id] ?? monitor.frequency;
        });

        return next;
      });
    } catch (error) {
      console.error('Fetch monitors error:', error);
    }
  };

  const fetchCaptures = async () => {
    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch('/api/captures', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            'Failed to fetch captures'
        );
      }

      setCaptures(result.data ?? []);
    } catch (error) {
      console.error('Fetch captures error:', error);
    }
  };

  const handleCaptureNow = async (monitorId: string) => {
    if (captureLoading[monitorId]) return;

    setCaptureLoading((current) => ({
      ...current,
      [monitorId]: true,
    }));
    setStatusMessage('Capture running...');

    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('You must be logged in.');
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
        throw new Error(
          result.message ||
            'Capture failed'
        );
      }

      await fetchCaptures();
      await fetchMonitors();
      setStatusMessage('Capture completed successfully.');
    } catch (error) {
      console.error('Capture now error:', error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Capture failed.'
      );
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
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('You must be logged in.');
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
        throw new Error(
          result.message || 'Monitor update failed.'
        );
      }

      await fetchMonitors();
      setStatusMessage('Monitor updated successfully.');
    } catch (error) {
      console.error('Monitor update error:', error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Monitor update failed.'
      );
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
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('You must be logged in.');
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
        throw new Error(
          result.message || 'Monitor deletion failed.'
        );
      }

      await fetchMonitors();
      await fetchCaptures();
      setStatusMessage('Monitor deleted successfully.');
    } catch (error) {
      console.error('Monitor deletion error:', error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Monitor deletion failed.'
      );
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
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">VeritasWeb</h1>
              <p className="text-sm text-slate-400">Forensic Web Capture Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Introduction */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Capture the Web, Verify the Truth
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl">
            VeritasWeb helps legal professionals and investigators preserve, hash, and review stored web capture records.
          </p>
        </div>

        {/* Create Monitor Card */}
        <Card className="mb-8 bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Create New Monitor</CardTitle>
            <CardDescription className="text-slate-400">
              Set up continuous monitoring of a webpage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  URL to Monitor
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Capture Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(
                      e.target.value as Monitor['frequency']
                    )
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <Button
                onClick={handleCreateMonitor}
                disabled={isLoading}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                {isLoading ? 'Creating...' : 'Create Monitor'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Monitors List */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-white">Monitors</h3>
          {statusMessage && (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-300">
                  {statusMessage}
                </p>
              </CardContent>
            </Card>
          )}
          {monitors.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <p className="text-slate-400 text-center">
                  No monitors yet. Create one to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            monitors.map((monitor) => (
              <Card key={monitor.id} className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">{monitor.url}</CardTitle>
                  <CardDescription className="text-slate-400">
                    Created: {new Date(monitor.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-300">
                        <span className="font-medium">Frequency:</span> {monitor.frequency}
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="font-medium">Status:</span>{' '}
                        <span className="text-green-400">{monitor.status}</span>
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="font-medium">Last captured:</span>{' '}
                        {monitor.last_captured_at
                          ? new Date(monitor.last_captured_at).toLocaleString()
                          : 'Never'}
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="font-medium">Next capture:</span>{' '}
                        {monitor.next_capture_at
                          ? new Date(monitor.next_capture_at).toLocaleString()
                          : 'Not scheduled'}
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="font-medium">Last capture status:</span>{' '}
                        {monitor.last_capture_status || 'None'}
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="font-medium">Capture count:</span>{' '}
                        {monitor.capture_count ?? 0}
                      </p>
                      {monitor.last_capture_error && (
                        <p className="text-sm text-red-300">
                          <span className="font-medium">Last error:</span>{' '}
                          {monitor.last_capture_error}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleCaptureNow(monitor.id)}
                        disabled={captureLoading[monitor.id] || monitorActionLoading[monitor.id]}
                        className="bg-cyan-500 border-cyan-500 text-white hover:bg-cyan-600"
                      >
                        {captureLoading[monitor.id]
                          ? 'Capturing...'
                          : 'Capture Now'}
                      </Button>
                      {monitor.status === 'active' ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleUpdateMonitor(monitor.id, {
                              status: 'paused',
                            })
                          }
                          disabled={monitorActionLoading[monitor.id]}
                          className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                        >
                          {monitorActionLoading[monitor.id]
                            ? 'Updating...'
                            : 'Pause'}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleUpdateMonitor(monitor.id, {
                              status: 'active',
                            })
                          }
                          disabled={monitorActionLoading[monitor.id]}
                          className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                        >
                          {monitorActionLoading[monitor.id]
                            ? 'Updating...'
                            : 'Resume'}
                        </Button>
                      )}
                      <select
                        value={
                          frequencyDrafts[monitor.id] ??
                          monitor.frequency
                        }
                        onChange={(event) =>
                          setFrequencyDrafts((current) => ({
                            ...current,
                            [monitor.id]: event.target
                              .value as Monitor['frequency'],
                          }))
                        }
                        disabled={monitorActionLoading[monitor.id]}
                        className="rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
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
                        className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                      >
                        Save Frequency
                      </Button>
                      {(monitor.capture_count ?? 0) === 0 && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleDeleteMonitor(monitor.id)
                          }
                          disabled={monitorActionLoading[monitor.id]}
                          className="bg-red-950 border-red-800 text-red-100 hover:bg-red-900"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Capture History */}
        <div className="space-y-4 mt-12">
          <h3 className="text-2xl font-bold text-white">Recent Captures</h3>
          {captures.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <p className="text-slate-400 text-center">
                  No captures yet. Run Capture Now on a monitor to create one.
                </p>
              </CardContent>
            </Card>
          ) : (
            captures.map((capture) => (
              <Card key={capture.id} className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">
                    {capture.page_title || 'Untitled page'}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {capture.monitor_url || capture.original_url || 'Unknown URL'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <div className="space-y-2 text-sm text-slate-300">
                      <p>
                        <span className="font-medium">Captured:</span>{' '}
                        {new Date(capture.captured_at).toLocaleString()}
                      </p>
                      <p>
                        <span className="font-medium">Status:</span>{' '}
                        {capture.status_code}
                      </p>
                      <p className="break-all">
                        <span className="font-medium">Final URL:</span>{' '}
                        {capture.final_url || 'Not recorded'}
                      </p>
                      <p className="break-all">
                        <span className="font-medium">Manifest:</span>{' '}
                        {capture.manifest_sha256
                          ? `${capture.manifest_sha256.slice(0, 16)}...`
                          : 'Missing'}
                      </p>
                      <p>
                        <span className="font-medium">HTML:</span>{' '}
                        {capture.html_path ? 'stored' : 'not stored'}
                      </p>
                    </div>
                    <div className="flex items-start">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/dashboard/captures/${capture.id}`}
                          className="rounded-md border border-cyan-500 bg-cyan-500 px-3 py-2 text-center text-sm text-white hover:bg-cyan-600"
                        >
                          View Details
                        </Link>
                        {capture.screenshot_signed_url ? (
                          <a
                            href={capture.screenshot_signed_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-center text-sm text-white hover:bg-slate-600"
                          >
                            Open Screenshot
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">
                            Screenshot stored
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Cryptographic Hashing</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              Every capture is SHA-256 hashed for integrity verification and tampering detection.
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Capture Metadata</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              Reports include capture timestamps, URLs, HTTP status, headers, artifact paths, and integrity hashes.
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Evidence Reports</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              Export stored capture data into an evidence preservation PDF with an honest limitations section.
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/80 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-slate-400">
          <p>VeritasWeb &mdash; Forensic Web Capture Platform v1.0</p>
          <p className="text-xs mt-2">
            This platform is designed for legal professionals. Always consult with legal counsel regarding evidence preservation and admissibility.
          </p>
        </div>
      </footer>
    </div>
  );
}

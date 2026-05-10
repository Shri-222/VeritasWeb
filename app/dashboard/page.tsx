'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Database } from '@/types/database';
import { createClient  } from '@/lib/supabase/client';

type Monitor =
  Database['public']['Tables']['monitors']['Row'];


export default function HomePage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [frequency, setFrequency] = useState('daily');

  const supabase = createClient();

  const handleCreateMonitor = async () => {
    if (!url) {
      alert('Please enter a URL');
      return;
    }

    setIsLoading(true);
    try {

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

      if (!response.ok) {
        throw new Error('Failed to create monitor');
      }

      await fetchMonitors();
      setUrl('');
      alert('Monitor created successfully!');
    } catch (error) {
      console.error('[v0] Monitor creation error:', error);
      alert('Failed to create monitor');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonitors = async () => {
    try {
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
        throw new Error(result.error);
      }

      setMonitors(result);
    } catch (error) {
      console.error('Fetch monitors error:', error);
    }
  };

  useEffect(() => {
    fetchMonitors();
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
            VeritasWeb enables legal professionals and investigators to capture, cryptographically hash, and validate web content for use in legal proceedings.
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
                  onChange={(e) => setFrequency(e.target.value)}
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
          <h3 className="text-2xl font-bold text-white">Active Monitors</h3>
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
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                      >
                        View Captures
                      </Button>
                      <Button
                        variant="outline"
                        className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                      >
                        Export Affidavit
                      </Button>
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
              <CardTitle className="text-white">Timestamping</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              RFC 3161 Time Stamp Authority integration provides cryptographic proof of capture time.
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Legal Compliance</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              Affidavit generation complies with FRE 901(b)(5) and 902(13) rules of evidence.
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

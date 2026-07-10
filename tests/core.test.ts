import assert from 'node:assert/strict';
import test from 'node:test';
import { compareHashes, stableStringify } from '../lib/forensic.ts';
import { isSafePublicUrl } from '../lib/schemas.ts';
import { getConfiguredStorageProvider, getStorageProviderStatus } from '../lib/storage/index.ts';
import { getBetaLimits } from '../lib/beta.ts';
import { createZip } from '../lib/zip.ts';
import {
  isMissingColumnError,
  isMissingTableError,
} from '../lib/database-errors.ts';
import {
  emptyNotificationConfiguration,
  rowsOrEmpty,
} from '../lib/startup-compat.ts';
import { resolveCaptureStorageProvider } from '../lib/storage/index.ts';
import { parseDownloadResponse } from '../lib/download-response.ts';
import { generateCaptureReportPdf } from '../lib/pdf-report.ts';
import type { OwnedCaptureRecord } from '../lib/captures.ts';
import type { CaptureVerificationResult } from '../lib/verification.ts';

test('stable manifest serialization recursively sorts object keys', () => {
  assert.equal(stableStringify({ b: { z: 1, a: 2 }, a: [3, { d: 4, c: 5 }] }), stableStringify({ a: [3, { c: 5, d: 4 }], b: { a: 2, z: 1 } }));
});

test('hash comparison only matches normalized equal hashes', () => {
  assert.equal(compareHashes(' ABC ', 'abc').match, true);
  assert.equal(compareHashes('abc', 'def').match, false);
  assert.equal(compareHashes(null, 'abc').match, false);
});

test('unsafe URL validation blocks local, private, metadata, and non-http URLs', () => {
  for (const value of ['http://localhost:3000', 'http://127.0.0.1', 'http://192.168.1.1', 'http://169.254.169.254', 'file:///etc/passwd']) {
    assert.equal(isSafePublicUrl(value), false, value);
  }
  assert.equal(isSafePublicUrl('https://example.com'), true);
});

test('storage defaults to Supabase and reports missing R2 configuration honestly', () => {
  const previous = process.env.STORAGE_PROVIDER;
  delete process.env.STORAGE_PROVIDER;
  assert.equal(getConfiguredStorageProvider(), 'supabase');
  process.env.STORAGE_PROVIDER = 'r2';
  assert.equal(getStorageProviderStatus().available, false);
  if (previous === undefined) delete process.env.STORAGE_PROVIDER; else process.env.STORAGE_PROVIDER = previous;
});

test('beta limits use configured positive values', () => {
  const old = process.env.BETA_MAX_MONITORS_PER_USER;
  process.env.BETA_MAX_MONITORS_PER_USER = '7';
  assert.equal(getBetaLimits().maxMonitors, 7);
  if (old === undefined) delete process.env.BETA_MAX_MONITORS_PER_USER; else process.env.BETA_MAX_MONITORS_PER_USER = old;
});

test('zip builder emits a ZIP local header and central directory', () => {
  const archive = createZip([{ name: 'safe.txt', data: Buffer.from('hello') }]);
  assert.equal(archive.subarray(0, 4).toString('hex'), '504b0304');
  assert.notEqual(archive.indexOf(Buffer.from('504b0102', 'hex')), -1);
  assert.notEqual(archive.indexOf(Buffer.from('504b0506', 'hex')), -1);
});

test('startup schema errors identify missing optional tables and columns', () => {
  assert.equal(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.cases'" }, 'cases'), true);
  assert.equal(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.captures'" }, 'cases'), false);
  assert.equal(isMissingColumnError({ code: '42703', message: 'column captures.storage_provider does not exist' }, 'storage_provider'), true);
});

test('optional case and notification reads have safe empty states', () => {
  assert.deepEqual(rowsOrEmpty(null), []);
  assert.deepEqual(emptyNotificationConfiguration(), {
    endpoints: [],
    settings: null,
    emailAvailable: false,
  });
});

test('legacy captures default to Supabase storage without provider metadata', () => {
  const previous = process.env.STORAGE_PROVIDER;
  delete process.env.STORAGE_PROVIDER;
  assert.equal(resolveCaptureStorageProvider(null), 'supabase');
  process.env.STORAGE_PROVIDER = 'r2';
  assert.equal(resolveCaptureStorageProvider('supabase'), 'supabase');
  if (previous === undefined) delete process.env.STORAGE_PROVIDER; else process.env.STORAGE_PROVIDER = previous;
});

test('report generation accepts a legacy capture without startup optional data', () => {
  const capture: OwnedCaptureRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    monitor_id: '22222222-2222-4222-8222-222222222222',
    timestamp: '2026-01-01T00:00:00.000Z',
    captured_at: '2026-01-01T00:00:00.000Z',
    storage_url: 'user/monitor/capture/screenshot.png',
    sha256_hash: 'a'.repeat(64),
    screenshot_path: 'user/monitor/capture/screenshot.png',
    html_path: 'user/monitor/capture/page.html',
    screenshot_sha256: 'b'.repeat(64),
    html_sha256: 'c'.repeat(64),
    manifest_sha256: 'a'.repeat(64),
    manifest_path: null,
    original_url: 'https://example.com',
    final_url: 'https://example.com',
    page_title: 'Example Domain',
    capture_status: 'success',
    error_message: null,
    status_code: 200,
    headers: { 'content-type': 'text/html' },
    previous_capture_hash: null,
    trigger_type: 'manual',
    created_at: '2026-01-01T00:00:00.000Z',
    storage_provider: null,
    monitors: {
      id: '22222222-2222-4222-8222-222222222222',
      url: 'https://example.com',
      user_id: '33333333-3333-4333-8333-333333333333',
    },
  };
  const verification: CaptureVerificationResult = {
    captureId: capture.id,
    verified: false,
    status: 'NOT_RUN',
    checks: { screenshot: null, html: null, manifest: null },
    message: 'Verification was not run.',
    verifiedAt: '2026-01-01T00:05:00.000Z',
  };

  const pdf = generateCaptureReportPdf({
    capture,
    verification,
    generatedAt: '2026-01-01T00:05:00.000Z',
  });
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('bundle generation works with core entries and no optional assets', () => {
  const archive = createZip([
    { name: 'screenshot.png', data: Buffer.from('png') },
    { name: 'page.html', data: Buffer.from('<html></html>') },
    { name: 'manifest.json', data: Buffer.from('{}') },
  ]);
  assert.notEqual(archive.indexOf(Buffer.from('manifest.json')), -1);
  assert.equal(archive.indexOf(Buffer.from('change-diff.json')), -1);
});

test('download parser returns JSON API messages instead of error blobs', async () => {
  const response = new Response(JSON.stringify({ success: false, code: 'INTERNAL_ERROR', message: 'Report generation failed.' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await parseDownloadResponse(response, 'fallback.pdf', 'Download failed.');
  assert.deepEqual(result, { ok: false, message: 'Report generation failed.' });
});

test('download parser uses the server Content-Disposition filename', async () => {
  const response = new Response(new Blob(['pdf']), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="evidence.pdf"',
    },
  });
  const result = await parseDownloadResponse(response, 'fallback.pdf', 'Download failed.');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.filename, 'evidence.pdf');
});

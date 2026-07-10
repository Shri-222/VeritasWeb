import assert from 'node:assert/strict';
import test from 'node:test';
import { compareHashes, stableStringify } from '../lib/forensic.ts';
import { isSafePublicUrl } from '../lib/schemas.ts';
import { getConfiguredStorageProvider, getStorageProviderStatus } from '../lib/storage/index.ts';
import { getBetaLimits } from '../lib/beta.ts';
import { createZip } from '../lib/zip.ts';

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


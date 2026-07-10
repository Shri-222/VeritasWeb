import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createSupabaseArtifactProvider } from './supabase-provider.ts';
import type {
  ArtifactStorageProvider,
  StorageProviderName,
} from './types';

export function getConfiguredStorageProvider(): StorageProviderName {
  const value = (process.env.STORAGE_PROVIDER || 'supabase').toLowerCase();
  return value === 'r2' ? 'r2' : 'supabase';
}

export function resolveCaptureStorageProvider(
  captureProvider?: string | null
): StorageProviderName {
  const value = (
    captureProvider ??
    process.env.STORAGE_PROVIDER ??
    'supabase'
  ).toLowerCase();

  return value === 'r2' ? 'r2' : 'supabase';
}

export class StorageProviderUnavailableError extends Error {
  readonly provider: StorageProviderName;

  constructor(provider: StorageProviderName) {
    super(
      provider === 'r2'
        ? 'R2 artifact storage is not configured for this deployment.'
        : 'Artifact storage is unavailable.'
    );
    this.name = 'StorageProviderUnavailableError';
    this.provider = provider;
  }
}

export function createCaptureArtifactProvider(
  captureProvider: string | null | undefined,
  supabaseAdmin: SupabaseClient<Database>
): ArtifactStorageProvider {
  const provider = resolveCaptureStorageProvider(captureProvider);

  if (provider === 'supabase') {
    return createSupabaseArtifactProvider(
      supabaseAdmin,
      process.env.SUPABASE_STORAGE_BUCKET || 'captures'
    );
  }

  // R2 is optional and is never initialized unless a capture selects it.
  throw new StorageProviderUnavailableError(provider);
}

export function isR2Configured() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_ENDPOINT);
}

export function getStorageProviderStatus() {
  const provider = getConfiguredStorageProvider();
  return { provider, available: provider === 'supabase' || isR2Configured(), message: provider === 'r2' && !isR2Configured() ? 'R2 is selected but its credentials are not configured.' : 'Supabase Storage is active.' };
}

import type { StorageProviderName } from './types';

export function getConfiguredStorageProvider(): StorageProviderName {
  const value = (process.env.STORAGE_PROVIDER || 'supabase').toLowerCase();
  return value === 'r2' ? 'r2' : 'supabase';
}

export function isR2Configured() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_ENDPOINT);
}

export function getStorageProviderStatus() {
  const provider = getConfiguredStorageProvider();
  return { provider, available: provider === 'supabase' || isR2Configured(), message: provider === 'r2' && !isR2Configured() ? 'R2 is selected but its credentials are not configured.' : 'Supabase Storage is active.' };
}


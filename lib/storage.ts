export function getCaptureBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET || 'captures';
}

export {
  createCaptureArtifactProvider,
  resolveCaptureStorageProvider,
  StorageProviderUnavailableError,
} from './storage/index';

export function getCaptureBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET || 'captures';
}

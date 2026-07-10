import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ArtifactStorageProvider } from './types';

export function createSupabaseArtifactProvider(client: SupabaseClient<Database>, bucket: string): ArtifactStorageProvider {
  return {
    async uploadArtifact(path, data, contentType) {
      const { error } = await client.storage.from(bucket).upload(path, data, { contentType, upsert: false, cacheControl: '3600' });
      if (error) throw error;
    },
    async downloadArtifact(path) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) throw error ?? new Error('Artifact not found.');
      return Buffer.from(await data.arrayBuffer());
    },
    async deleteArtifact(path) {
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) throw error;
    },
    async createSignedArtifactUrl(path, expiresIn) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
      if (error || !data?.signedUrl) throw error ?? new Error('Could not sign artifact URL.');
      return data.signedUrl;
    },
    async artifactExists(path) {
      try { await this.downloadArtifact(path); return true; } catch { return false; }
    },
  };
}


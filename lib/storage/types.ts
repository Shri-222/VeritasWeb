export type StorageProviderName = 'supabase' | 'r2';

export type ArtifactStorageProvider = {
  uploadArtifact(path: string, data: Buffer, contentType: string): Promise<void>;
  downloadArtifact(path: string): Promise<Buffer>;
  deleteArtifact(path: string): Promise<void>;
  createSignedArtifactUrl(path: string, expiresIn: number): Promise<string>;
  artifactExists(path: string): Promise<boolean>;
};


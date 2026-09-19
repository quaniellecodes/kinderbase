import { createServiceClient } from '@/lib/supabase/server';

export const CREDENTIALS_BUCKET = 'credentials';

export async function uploadCredentialFile(
  userId: string,
  file: File,
): Promise<string> {
  const supabase = createServiceClient();
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(CREDENTIALS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function getCredentialSignedUrl(storagePath: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(CREDENTIALS_BUCKET)
    .createSignedUrl(storagePath, 60 * 15); // 15 minutes

  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}

export async function deleteCredentialFile(storagePath: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(CREDENTIALS_BUCKET)
    .remove([storagePath]);

  if (error) throw new Error(`Delete failed: ${error.message}`);
}

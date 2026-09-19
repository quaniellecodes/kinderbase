import { createServiceClient } from '@/lib/supabase/server';

export const ORG_ICONS_BUCKET = 'org-icons';

export async function uploadOrgIcon(orgId: string, file: File): Promise<string> {
  const supabase = createServiceClient();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const path = `${orgId}/icon.${ext}`;

  const { error } = await supabase.storage
    .from(ORG_ICONS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export function getOrgIconPublicUrl(path: string): string {
  const supabase = createServiceClient();
  const { data } = supabase.storage.from(ORG_ICONS_BUCKET).getPublicUrl(path);
  // Bust cache on each new upload by appending a stable hash of the path
  return `${data.publicUrl}?v=${Buffer.from(path).toString('base64').slice(0, 8)}`;
}

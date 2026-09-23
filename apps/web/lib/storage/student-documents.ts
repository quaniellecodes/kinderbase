import { createServiceClient } from '@/lib/supabase/server';

export const STUDENT_DOCS_BUCKET = 'student-documents';

export async function uploadStudentDocFile(childId: string, file: File): Promise<string> {
  const supabase = createServiceClient();
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `${childId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(STUDENT_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function getStudentDocSignedUrl(storagePath: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(STUDENT_DOCS_BUCKET)
    .createSignedUrl(storagePath, 60 * 15); // 15 minutes
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}

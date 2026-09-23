import { NextResponse } from 'next/server';
import { studentContext, isEditor } from '@/app/(dashboard)/students/access';
import { getStudentDocSignedUrl } from '@/lib/storage/student-documents';

/**
 * Redirects to a short-lived (15-min) signed URL for a student document.
 * Auth: must be a member of the student's center; confidential documents require
 * director/admin. Never exposes a public URL.
 */
export async function GET(_req: Request, { params }: { params: { id: string; docId: string } }) {
  const ctx = await studentContext(params.id);
  if (!ctx) return new NextResponse('Not found', { status: 404 });

  const { data: doc } = await ctx.service
    .from('student_documents')
    .select('storage_path, is_confidential')
    .eq('id', params.docId)
    .eq('child_id', params.id)
    .maybeSingle();

  if (!doc || !doc.storage_path) return new NextResponse('Not found', { status: 404 });
  if (doc.is_confidential && !isEditor(ctx.role)) return new NextResponse('Forbidden', { status: 403 });

  const url = await getStudentDocSignedUrl(doc.storage_path);
  return NextResponse.redirect(url);
}

'use server';

import { revalidatePath } from 'next/cache';
import { studentContext, isEditor, orNull } from '../access';
import { uploadStudentDocFile } from '@/lib/storage/student-documents';

export type DocStatus = 'current' | 'review_due' | 'missing' | 'na';

export type StudentDoc = {
  id: string;
  docType: string;
  label: string;
  status: DocStatus;
  isRequired: boolean;
  isConfidential: boolean;
  hasFile: boolean;
  signedBy: string;
  signedOn: string;
  reviewDue: string;
  uploadedAt: string | null;
};

export type StudentDocuments = { canEdit: boolean; canSeeConfidential: boolean; docs: StudentDoc[] };

export async function getStudentDocuments(childId: string): Promise<StudentDocuments | null> {
  const ctx = await studentContext(childId);
  if (!ctx) return null;
  const { service, role } = ctx;
  const canSeeConfidential = isEditor(role);

  let q = service
    .from('student_documents')
    .select('id, doc_type, label, status, is_required, is_confidential, storage_path, signed_by, signed_on, review_due, uploaded_at')
    .eq('child_id', childId)
    .is('superseded_by', null)
    .order('is_required', { ascending: false })
    .order('label');
  if (!canSeeConfidential) q = q.eq('is_confidential', false);
  const { data } = await q;

  return {
    canEdit: isEditor(role),
    canSeeConfidential,
    docs: (data ?? []).map((d) => ({
      id: d.id,
      docType: d.doc_type,
      label: d.label,
      status: d.status as DocStatus,
      isRequired: d.is_required,
      isConfidential: d.is_confidential,
      hasFile: !!d.storage_path,
      signedBy: d.signed_by ?? '',
      signedOn: d.signed_on ?? '',
      reviewDue: d.review_due ?? '',
      uploadedAt: d.uploaded_at,
    })),
  };
}

export type DocMeta = {
  label: string;
  docType: string;
  status: DocStatus;
  isRequired: boolean;
  isConfidential: boolean;
  signedBy: string;
  signedOn: string;
  reviewDue: string;
};

function docRow(m: DocMeta) {
  return {
    label: m.label.trim() || 'Document',
    doc_type: m.docType.trim() || 'other',
    status: m.status,
    is_required: m.isRequired,
    is_confidential: m.isConfidential,
    signed_by: orNull(m.signedBy),
    signed_on: m.signedOn || null,
    review_due: m.reviewDue || null,
  };
}

export async function addDocument(childId: string, meta: DocMeta): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { error } = await ctx.service.from('student_documents').insert({ child_id: childId, ...docRow(meta) });
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function updateDocument(childId: string, id: string, meta: DocMeta): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { error } = await ctx.service.from('student_documents').update(docRow(meta)).eq('id', id).eq('child_id', childId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${childId}`);
}

export async function deleteDocument(childId: string, id: string): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  await ctx.service.from('student_documents').delete().eq('id', id).eq('child_id', childId);
  revalidatePath(`/students/${childId}`);
}

/**
 * Upload (or re-upload) a file for a document. If the target already has a file,
 * a NEW row is created carrying the new file and the old row is marked
 * superseded (history preserved); otherwise the file lands on the existing row.
 */
export async function uploadStudentDocument(childId: string, docId: string, formData: FormData): Promise<void> {
  const ctx = await studentContext(childId);
  if (!ctx || !isEditor(ctx.role)) throw new Error('Forbidden');
  const { service, userId } = ctx;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('No file provided');

  const { data: doc } = await service
    .from('student_documents')
    .select('doc_type, label, is_required, is_confidential, storage_path')
    .eq('id', docId)
    .eq('child_id', childId)
    .maybeSingle();
  if (!doc) throw new Error('Document not found');

  const path = await uploadStudentDocFile(childId, file);
  const now = new Date().toISOString();

  if (doc.storage_path) {
    // Re-upload: create a new current row, supersede the old.
    const { data: created, error: insErr } = await service
      .from('student_documents')
      .insert({
        child_id: childId,
        doc_type: doc.doc_type,
        label: doc.label,
        is_required: doc.is_required,
        is_confidential: doc.is_confidential,
        status: 'current',
        storage_path: path,
        uploaded_by: userId,
        uploaded_at: now,
      })
      .select('id')
      .single();
    if (insErr) throw new Error(insErr.message);
    await service.from('student_documents').update({ superseded_by: created.id }).eq('id', docId);
  } else {
    const { error } = await service
      .from('student_documents')
      .update({ storage_path: path, status: 'current', uploaded_by: userId, uploaded_at: now })
      .eq('id', docId)
      .eq('child_id', childId);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/students/${childId}`);
}

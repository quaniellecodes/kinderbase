'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Download, Upload, Lock, FileText } from 'lucide-react';
import { Card, Modal, Button, Input, Select, Label, Badge, EmptyState, type BadgeTone } from '@/components/ui';
import { addDocument, updateDocument, deleteDocument, uploadStudentDocument, type StudentDocuments, type StudentDoc, type DocStatus, type DocMeta } from './documents-actions';

const STATUS_META: Record<DocStatus, { label: string; tone: BadgeTone }> = {
  current: { label: 'Current', tone: 'green' },
  review_due: { label: 'Review due', tone: 'amber' },
  missing: { label: 'Missing', tone: 'red' },
  na: { label: 'N/A', tone: 'neutral' },
};
const STATUS_OPTIONS = (Object.keys(STATUS_META) as DocStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label }));

const EMPTY: DocMeta = { label: '', docType: '', status: 'missing', isRequired: false, isConfidential: false, signedBy: '', signedOn: '', reviewDue: '' };

function toMeta(d: StudentDoc): DocMeta {
  return { label: d.label, docType: d.docType, status: d.status, isRequired: d.isRequired, isConfidential: d.isConfidential, signedBy: d.signedBy, signedOn: d.signedOn, reviewDue: d.reviewDue };
}

function DocRow({ childId, d, canEdit, onEdit }: { childId: string; d: StudentDoc; canEdit: boolean; onEdit: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const status = STATUS_META[d.status];

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set('file', file);
    startTransition(async () => {
      await uploadStudentDocument(childId, d.id, fd);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    });
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${pending ? 'opacity-50' : ''}`}>
      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{d.label}</span>
          {d.isRequired && <Badge tone="neutral" size="sm">Required</Badge>}
          {d.isConfidential && <Lock className="w-3 h-3 text-gray-400" aria-label="Confidential" />}
        </div>
        <p className="text-xs text-gray-400">
          {[d.signedBy && `signed by ${d.signedBy}`, d.signedOn, d.reviewDue && `review ${d.reviewDue}`].filter(Boolean).join(' · ') || d.docType}
        </p>
      </div>
      <Badge tone={status.tone} size="sm">{status.label}</Badge>
      {d.hasFile && (
        <a href={`/api/students/${childId}/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand" aria-label="Download">
          <Download className="w-4 h-4" />
        </a>
      )}
      {canEdit && (
        <>
          <button onClick={() => fileRef.current?.click()} disabled={pending} className="text-gray-400 hover:text-brand" aria-label={d.hasFile ? 'Replace file' : 'Upload file'}>
            <Upload className="w-4 h-4" />
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={onFile} accept=".pdf,.png,.jpg,.jpeg,.heic,.webp" />
          <button onClick={onEdit} className="text-gray-300 hover:text-gray-600" aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => { if (confirm(`Remove ${d.label}?`)) startTransition(() => deleteDocument(childId, d.id).then(() => router.refresh())); }} className="text-gray-300 hover:text-red-500" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
        </>
      )}
    </div>
  );
}

export function DocumentsEditor({ childId, documents }: { childId: string; documents: StudentDocuments }) {
  const router = useRouter();
  const editable = documents.canEdit;
  const [pending, startTransition] = useTransition();
  const [edit, setEdit] = useState<{ id: string | null; data: DocMeta } | null>(null);

  function save() {
    if (!edit) return;
    startTransition(async () => {
      if (edit.id) await updateDocument(childId, edit.id, edit.data);
      else await addDocument(childId, edit.data);
      setEdit(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
        {editable && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setEdit({ id: null, data: { ...EMPTY } })}>
            <Plus className="w-3.5 h-3.5" /> Add document
          </Button>
        )}
      </div>

      {documents.docs.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={<FileText className="w-7 h-7" />} title="No documents" description={editable ? 'Add required forms and records to track enrollment paperwork.' : undefined} />
        </Card>
      ) : (
        <Card padding="none" className="divide-y divide-gray-50">
          {documents.docs.map((d) => (
            <DocRow key={d.id} childId={childId} d={d} canEdit={editable} onEdit={() => setEdit({ id: d.id, data: toMeta(d) })} />
          ))}
        </Card>
      )}

      {!documents.canSeeConfidential && (
        <p className="text-xs text-gray-400 mt-2">Confidential documents are visible to directors and admins only.</p>
      )}

      <Modal open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }} title={edit?.id ? 'Edit document' : 'Add document'}>
        {edit && (
          <>
            <div className="p-5 space-y-3">
              <div><Label className="mb-1">Label</Label><Input value={edit.data.label} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, label: e.target.value } })} placeholder="Immunization record" autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1">Type</Label><Input value={edit.data.docType} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, docType: e.target.value } })} placeholder="immunization" /></div>
                <div><Label className="mb-1">Status</Label><Select value={edit.data.status} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, status: e.target.value as DocStatus } })}>{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1">Signed by</Label><Input value={edit.data.signedBy} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, signedBy: e.target.value } })} /></div>
                <div><Label className="mb-1">Signed on</Label><Input type="date" value={edit.data.signedOn} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, signedOn: e.target.value } })} /></div>
              </div>
              <div><Label className="mb-1">Review due</Label><Input type="date" value={edit.data.reviewDue} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, reviewDue: e.target.value } })} /></div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={edit.data.isRequired} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, isRequired: e.target.checked } })} /> Required</label>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={edit.data.isConfidential} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, isConfidential: e.target.checked } })} /> Confidential</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setEdit(null)} disabled={pending}>Cancel</Button>
              <Button onClick={save} disabled={pending || !edit.data.label.trim()}>{pending ? 'Saving…' : 'Save'}</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

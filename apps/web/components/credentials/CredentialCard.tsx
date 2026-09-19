'use client';

import { useState } from 'react';
import { FileText, Trash2, Eye, EyeOff } from 'lucide-react';
import type { CredentialRow } from '@kinderbase/types';
import { CREDENTIAL_TYPE_LABELS } from '@kinderbase/types';
import { CredentialStatusBadge } from './CredentialStatusBadge';
import { deleteCredential, toggleCredentialVisibility } from '@/app/(dashboard)/credentials/actions';

type Props = {
  credential: CredentialRow;
  onViewDocument: (credentialId: string) => void;
};

export function CredentialCard({ credential, onViewDocument }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const label =
    credential.credential_type === 'other' && credential.custom_type_name
      ? credential.custom_type_name
      : CREDENTIAL_TYPE_LABELS[credential.credential_type];

  const issuedDate = new Date(credential.issued_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const expiresDate = credential.expires_at
    ? new Date(credential.expires_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  async function handleDelete() {
    if (!confirm('Delete this credential? This cannot be undone.')) return;
    setDeleting(true);
    await deleteCredential(credential.id, credential.storage_path);
  }

  async function handleToggleVisibility() {
    setToggling(true);
    await toggleCredentialVisibility(credential.id, !credential.show_on_profile);
    setToggling(false);
  }

  return (
    <div className={`rounded-card border bg-white p-4 ${credential.status === 'expired' ? 'border-status-red/30' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-chip bg-gray-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-gray-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{credential.issuing_org}</p>
          </div>
        </div>
        <CredentialStatusBadge status={credential.status} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>Issued {issuedDate}</span>
        {expiresDate && <span>Expires {expiresDate}</span>}
      </div>

      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={() => onViewDocument(credential.id)}
          className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-chip border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <FileText className="w-3.5 h-3.5" />
          View
        </button>
        <button
          onClick={handleToggleVisibility}
          disabled={toggling}
          title={credential.show_on_profile ? 'Hide from public profile' : 'Show on public profile'}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-chip border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          {credential.show_on_profile
            ? <Eye className="w-4 h-4" />
            : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Delete credential"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-chip border border-status-red/30 text-status-red hover:bg-status-red/5 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

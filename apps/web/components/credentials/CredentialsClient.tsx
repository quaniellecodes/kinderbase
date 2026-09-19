'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { CredentialRow } from '@kinderbase/types';
import { CredentialCard } from './CredentialCard';
import { CredentialForm } from './CredentialForm';
import { getCredentialSignedUrl } from '@/app/(dashboard)/credentials/actions';

type Props = {
  credentials: CredentialRow[];
};

export function CredentialsClient({ credentials }: Props) {
  const [showForm, setShowForm] = useState(false);

  async function handleViewDocument(credentialId: string) {
    const result = await getCredentialSignedUrl(credentialId);
    if ('error' in result) { alert(result.error); return; }
    window.open(result.url, '_blank', 'noopener');
  }

  if (showForm) {
    return (
      <div className="p-4 md:p-8 max-w-lg">
        <h2 className="text-base font-medium text-gray-900 mb-4">Add credential</h2>
        <CredentialForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium text-gray-900">My Credentials</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-[10px] bg-brand text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {credentials.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No credentials yet.</p>
          <p className="text-xs mt-1">Tap Add to upload your first credential.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {credentials.map(c => (
            <CredentialCard
              key={c.id}
              credential={c}
              onViewDocument={handleViewDocument}
            />
          ))}
        </div>
      )}
    </div>
  );
}

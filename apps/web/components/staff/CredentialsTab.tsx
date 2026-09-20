import { FileText, Download, AlertCircle } from 'lucide-react';
import type { StaffCredential } from '@/app/(dashboard)/staff/[userId]/actions';
import type { CredentialStatus } from '@kinderbase/types';

const STATUS: Record<CredentialStatus, { label: string; chip: string }> = {
  active: { label: 'Active', chip: 'bg-green-50 text-green-700' },
  expiring_soon: { label: 'Expiring', chip: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Expired', chip: 'bg-red-50 text-red-700' },
  no_expiration: { label: 'No expiry', chip: 'bg-gray-100 text-gray-500' },
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
}

export function CredentialsTab({ userId, credentials }: { userId: string; credentials: StaffCredential[] }) {
  const expiring = credentials.filter((c) => c.status === 'expiring_soon' || c.status === 'expired').length;

  return (
    <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-900">Credential portfolio</h2>
        <a href={`/api/staff/${userId}/credential-bundle`} target="_blank" className="text-xs text-brand hover:underline">Download all</a>
      </div>

      {expiring > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800">{expiring} credential{expiring > 1 ? 's' : ''} expiring or expired — renewal needed before next OCC inspection.</p>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {credentials.length === 0 && <p className="text-sm text-gray-400 py-4">No credentials on file.</p>}
        {credentials.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${STATUS[c.status].chip}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{c.typeLabel}</p>
              <p className="text-xs text-gray-500 truncate">
                {c.issuing_org} · {fmt(c.issued_at)}
                {c.expires_at ? ` · Expires ${fmt(c.expires_at)}` : ' · No expiration'}
              </p>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-chip font-medium ${STATUS[c.status].chip}`}>{STATUS[c.status].label}</span>
            <a href={`/api/credentials/${c.id}/download`} target="_blank" className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300" title="Download">
              <Download className="w-4 h-4" />
            </a>
          </div>
        ))}
      </div>

      <a href={`/api/staff/${userId}/credential-bundle`} target="_blank" className="mt-3 flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-700 hover:border-gray-300">
        <Download className="w-4 h-4" /> Download full credential bundle (PDF)
      </a>
    </div>
  );
}

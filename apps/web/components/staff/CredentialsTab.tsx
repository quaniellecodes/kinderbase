import { FileText, Download, AlertCircle } from 'lucide-react';
import { Alert, Badge, Card, type BadgeTone } from '@/components/ui';
import type { StaffCredential } from '@/app/(dashboard)/staff/[userId]/actions';
import type { CredentialStatus } from '@kinderbase/types';

const STATUS: Record<CredentialStatus, { label: string; tone: BadgeTone; iconBg: string }> = {
  active: { label: 'Active', tone: 'green', iconBg: 'bg-green-50 text-green-700' },
  expiring_soon: { label: 'Expiring', tone: 'amber', iconBg: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Expired', tone: 'red', iconBg: 'bg-red-50 text-red-700' },
  no_expiration: { label: 'No expiry', tone: 'neutral', iconBg: 'bg-gray-100 text-gray-500' },
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
}

export function CredentialsTab({ userId, credentials }: { userId: string; credentials: StaffCredential[] }) {
  const expiring = credentials.filter((c) => c.status === 'expiring_soon' || c.status === 'expired').length;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-900">Credential portfolio</h2>
        <a href={`/api/staff/${userId}/credential-bundle`} target="_blank" className="text-xs text-brand hover:underline">Download all</a>
      </div>

      {expiring > 0 && (
        <Alert tone="amber" className="mb-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          {expiring} credential{expiring > 1 ? 's' : ''} expiring or expired — renewal needed before next OCC inspection.
        </Alert>
      )}

      <div className="divide-y divide-gray-100">
        {credentials.length === 0 && <p className="text-sm text-gray-400 py-4">No credentials on file.</p>}
        {credentials.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${STATUS[c.status].iconBg}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{c.typeLabel}</p>
              <p className="text-xs text-gray-500 truncate">
                {c.issuing_org} · {fmt(c.issued_at)}
                {c.expires_at ? ` · Expires ${fmt(c.expires_at)}` : ' · No expiration'}
              </p>
            </div>
            <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
            <a href={`/api/credentials/${c.id}/download`} target="_blank" className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300" title="Download">
              <Download className="w-4 h-4" />
            </a>
          </div>
        ))}
      </div>

      <a href={`/api/staff/${userId}/credential-bundle`} target="_blank" className="mt-3 flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-700 hover:border-gray-300">
        <Download className="w-4 h-4" /> Download full credential bundle (PDF)
      </a>
    </Card>
  );
}

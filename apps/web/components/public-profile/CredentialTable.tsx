import type { CredentialRow } from '@kinderbase/types';
import { CREDENTIAL_TYPE_LABELS } from '@kinderbase/types';
import { CredentialStatusBadge } from '@/components/credentials/CredentialStatusBadge';
import { Card } from '@/components/ui';

type Props = {
  credentials: CredentialRow[];
};

export function CredentialTable({ credentials }: Props) {
  if (credentials.length === 0) {
    return (
      <Card padding="none" className="px-4 py-10 text-center">
        <p className="text-sm text-gray-400">No credentials shared yet.</p>
      </Card>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-900">
          Credentials
          <span className="ml-2 text-xs font-normal text-gray-400">{credentials.length}</span>
        </h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {credentials.map(c => {
          const label =
            c.credential_type === 'other' && c.custom_type_name
              ? c.custom_type_name
              : CREDENTIAL_TYPE_LABELS[c.credential_type];

          const issuedDate = new Date(c.issued_at).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          });

          const expiresDate = c.expires_at
            ? new Date(c.expires_at).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })
            : null;

          return (
            <li key={c.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {c.issuing_org}
                  {expiresDate ? ` · Expires ${expiresDate}` : ` · Issued ${issuedDate}`}
                </p>
              </div>
              <div className="flex-shrink-0">
                <CredentialStatusBadge status={c.status} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

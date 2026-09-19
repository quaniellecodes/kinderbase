import type { CredentialStatus } from '@kinderbase/types';

const CONFIG: Record<CredentialStatus, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-status-green/10 text-status-green' },
  expiring_soon: { label: 'Expiring Soon', classes: 'bg-status-amber/10 text-status-amber' },
  expired: { label: 'Expired', classes: 'bg-status-red/10 text-status-red' },
  no_expiration: { label: 'No Expiration', classes: 'bg-gray-100 text-gray-500' },
};

export function CredentialStatusBadge({ status }: { status: CredentialStatus }) {
  const { label, classes } = CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

import type { CredentialStatus } from '@kinderbase/types';
import { Badge, type BadgeTone } from '@/components/ui';

const CONFIG: Record<CredentialStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'green' },
  expiring_soon: { label: 'Expiring Soon', tone: 'amber' },
  expired: { label: 'Expired', tone: 'red' },
  no_expiration: { label: 'No Expiration', tone: 'neutral' },
};

export function CredentialStatusBadge({ status }: { status: CredentialStatus }) {
  const { label, tone } = CONFIG[status];
  return <Badge tone={tone} className="text-xs">{label}</Badge>;
}

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card, Avatar, Badge, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { getExpiringCredentials } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ExpiringCredentialsPage() {
  const items = await getExpiringCredentials();
  return (
    <div className="p-4">
      <Link href="/m/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 mb-2"><ChevronLeft className="w-4 h-4" /> Back</Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Expiring credentials</h1>
      <p className="text-xs text-gray-500 mb-3">Renewals due this month, soonest first.</p>
      {items.length === 0 ? (
        <Card padding="none"><EmptyState title="Nothing expiring" description="Every staff credential is current." /></Card>
      ) : (
        <Card padding="none" className="divide-y divide-gray-50">
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={c.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{c.credential}{c.expiresAt ? ` · expires ${formatDate(c.expiresAt)}` : ''}</p>
              </div>
              <Badge tone={c.expired ? 'red' : 'amber'} size="sm" className="flex-shrink-0">{c.expired ? 'Expired' : 'Expiring'}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

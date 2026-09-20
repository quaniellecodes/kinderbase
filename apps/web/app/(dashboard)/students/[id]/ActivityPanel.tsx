import { notFound } from 'next/navigation';
import { LogIn, LogOut, MessageSquare } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { getStudentActivity, type ActivityItem } from './activity-actions';

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ItemIcon({ kind }: { kind: ActivityItem['kind'] }) {
  if (kind === 'signin') return <LogIn className="w-4 h-4 text-green-500" />;
  if (kind === 'signout') return <LogOut className="w-4 h-4 text-gray-400" />;
  return <MessageSquare className="w-4 h-4 text-brand" />;
}

export async function ActivityPanel({ childId }: { childId: string }) {
  const items = await getStudentActivity(childId);
  if (!items) notFound();

  if (items.length === 0) {
    return (
      <Card padding="none">
        <EmptyState icon={<MessageSquare className="w-7 h-7" />} title="No activity yet" description="Care-log updates and sign-in/out events will appear here." />
      </Card>
    );
  }

  return (
    <Card padding="none" className="divide-y divide-gray-50">
      {items.map((it) => (
        <div key={it.id} className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 flex-shrink-0">
            <ItemIcon kind={it.kind} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900 capitalize">{it.label}</span>
              <span className="text-xs text-gray-400">{when(it.at)}</span>
            </div>
            {it.body && <p className="text-sm text-gray-600 mt-0.5">{it.body}</p>}
            {it.author && <p className="text-xs text-gray-400 mt-0.5">{it.author}</p>}
          </div>
        </div>
      ))}
    </Card>
  );
}

import { Card, EmptyState } from '@/components/ui';
import { Inbox } from 'lucide-react';

export default function AdminInboxPage() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-gray-900 mb-3">Inbox</h1>
      <Card padding="none">
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title="Approvals arrive in Phase 4b"
          description="Time corrections, leave, schedule changes, and lesson-plan review land here next."
        />
      </Card>
    </div>
  );
}

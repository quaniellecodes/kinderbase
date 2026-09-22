import { Card, EmptyState } from '@/components/ui';
import { Users } from 'lucide-react';

export default function AdminPeoplePage() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-gray-900 mb-3">People</h1>
      <Card padding="none">
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="Staff & students arrive in Phase 4b"
          description="Rated staff with qualification/flag pills and the student directory land here next."
        />
      </Card>
    </div>
  );
}

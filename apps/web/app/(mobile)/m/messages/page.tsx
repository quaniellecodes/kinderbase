import { Card, EmptyState } from '@/components/ui';
import { MessageSquare } from 'lucide-react';

export default function MessagesPage() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-gray-900 mb-3">Messages</h1>
      <Card padding="none">
        <EmptyState
          icon={<MessageSquare className="w-8 h-8" />}
          title="Messaging arrives in a later step"
          description="Team channels, family threads, translation, and quiet hours are Session 5."
        />
      </Card>
    </div>
  );
}

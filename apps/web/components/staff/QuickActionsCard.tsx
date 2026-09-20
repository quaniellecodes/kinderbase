'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Bell, Download, Send, Trash2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { nudgeStaff, sendStaffNotification, removeFromCenter, createStaffRequest } from '@/app/(dashboard)/staff/[userId]/actions';

export function QuickActionsCard({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  const actions = [
    {
      icon: <Clock className="w-4 h-4" />, label: 'Submit time correction',
      onClick: () => start(async () => { await createStaffRequest(userId, 'time_correction', 'Time correction submitted by admin'); flash('Time correction submitted'); router.refresh(); }),
    },
    {
      icon: <Bell className="w-4 h-4" />, label: 'Nudge to post update',
      onClick: () => start(async () => { await nudgeStaff(userId, userName); flash('Nudge sent'); }),
    },
    {
      icon: <Download className="w-4 h-4" />, label: 'Download credential bundle',
      onClick: () => window.open(`/api/staff/${userId}/credential-bundle`, '_blank'),
    },
    {
      icon: <Send className="w-4 h-4" />, label: 'Send notification',
      onClick: () => start(async () => { await sendStaffNotification(userId, userName, 'Notification from admin'); flash('Notification sent'); }),
    },
  ];

  function remove() {
    if (!window.confirm(`Remove ${userName} from this center? Their record is kept but they lose access.`)) return;
    start(async () => { await removeFromCenter(userId); router.push('/staff'); });
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-gray-900 mb-3">Actions</h2>
      <div className="space-y-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            variant="secondary"
            size="lg"
            onClick={a.onClick}
            disabled={isPending}
            className="w-full justify-start gap-2.5"
          >
            <span className="text-gray-400">{a.icon}</span>{a.label}
          </Button>
        ))}
        <Button onClick={remove} variant="danger" size="lg" disabled={isPending} className="w-full justify-start gap-2.5">
          <Trash2 className="w-4 h-4" /> Remove from center
        </Button>
      </div>
      {toast && <p className="text-xs text-status-green mt-2 text-center">{toast}</p>}
    </Card>
  );
}

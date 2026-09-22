'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { Avatar, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { getFloatCandidates, assignFloat, type FloatCandidate } from './actions';

const toneCls: Record<FloatCandidate['tone'], string> = {
  ok: 'bg-green-50 text-green-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-red-50 text-red-700',
};

export function FloatSheet({ room, onClose }: { room: { id: string; name: string } | null; onClose: () => void }) {
  const router = useRouter();
  const [cands, setCands] = useState<FloatCandidate[] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!room) {
      setCands(null);
      return;
    }
    let live = true;
    getFloatCandidates(room.id).then((c) => live && setCands(c));
    return () => {
      live = false;
    };
  }, [room]);

  function assign(userId: string, name: string, blocked: boolean, pill: string) {
    if (blocked) return toast(pill);
    if (!room) return;
    start(async () => {
      await assignFloat(room.id, userId);
      onClose();
      router.refresh();
      toast(`${name.split(' ')[0]} assigned to ${room.name}`);
    });
  }

  return (
    <BottomSheet open={!!room} onClose={onClose} title={room ? `Assign to ${room.name}` : ''}>
      {cands === null ? (
        <p className="text-sm text-gray-400 py-6 text-center">Simulating candidates…</p>
      ) : cands.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No available staff to pull in.</p>
      ) : (
        <div className="space-y-2 pb-2">
          {cands.map((c) => (
            <button
              key={c.userId}
              onClick={() => assign(c.userId, c.name, c.blocked, c.pill)}
              disabled={pending}
              className={cn('w-full flex items-center gap-3 rounded-xl border p-2.5 text-left', c.blocked ? 'border-gray-100 opacity-70' : 'border-gray-200')}
            >
              <Avatar name={c.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{c.roleLabel}{c.currentRoom ? ` · now in ${c.currentRoom}` : ''}</p>
              </div>
              <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0', toneCls[c.tone])}>{c.pill}</span>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

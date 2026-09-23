'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Shield } from 'lucide-react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { enterRoomMode } from '../classroom/actions';

/** Preview vs Cover choice (docs/DECISIONS.md §2) before stepping into a room. */
export function RoomModeSheet({ room, onClose }: { room: { id: string; name: string } | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function enter(mode: 'preview' | 'cover') {
    if (!room) return;
    start(async () => {
      await enterRoomMode(room.id, mode);
      router.push(`/m/classroom/${room.id}`);
    });
  }

  return (
    <BottomSheet open={!!room} onClose={onClose} title={room ? `Enter ${room.name}` : ''}>
      <p className="text-[12px] text-gray-500 mb-3">How are you going in?</p>
      <button onClick={() => enter('preview')} disabled={pending} className="w-full flex items-start gap-3 rounded-xl border border-gray-200 p-3.5 mb-2 text-left">
        <span className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0"><Eye className="w-4 h-4 text-white" /></span>
        <span>
          <span className="block text-[14px] font-semibold text-gray-900">Preview</span>
          <span className="block text-[12px] text-gray-500 mt-0.5">See exactly what a teacher sees. Read-only — nothing posts, and you don’t count toward ratio.</span>
        </span>
      </button>
      <button onClick={() => enter('cover')} disabled={pending} className="w-full flex items-start gap-3 rounded-xl border border-gray-200 p-3.5 text-left">
        <span className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center flex-shrink-0"><Shield className="w-4 h-4 text-white" /></span>
        <span>
          <span className="block text-[14px] font-semibold text-gray-900">Cover this room</span>
          <span className="block text-[12px] text-gray-500 mt-0.5">Step onto the floor. You count toward ratio, posts carry your name (tagged covering), and your time is recorded.</span>
        </span>
      </button>
    </BottomSheet>
  );
}

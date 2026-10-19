'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Languages } from 'lucide-react';
import { toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { sendParentMessage } from '@/app/(parent)/p/messages/actions';
import type { ParentMessages, ParentMessage, ParentConvKind } from '@/lib/parent/messages';

const META: Record<ParentConvKind, { label: string; disclosure: string }> = {
  family: { label: 'Classroom', disclosure: "Your child's teachers and the center director can see this." },
  office: { label: 'Office', disclosure: 'A private line to the front office. Your teachers don’t see this.' },
};

// The parent messaging view: two conversations — the Classroom thread (teachers +
// director) and the Office line (admins only). Mirrors the staff chat, but the
// guardian is "mine" (right-aligned). Realtime works because the guardian is a
// thread_members row (RLS lets their browser client see INSERTs).
export function ParentMessagesClient({ data, initialKind = 'family' }: { data: ParentMessages; initialKind?: ParentConvKind }) {
  const router = useRouter();
  const [active, setActive] = useState<ParentConvKind>(data.conversations.some((c) => c.kind === initialKind) ? initialKind : 'family');
  const [draft, setDraft] = useState<Record<ParentConvKind, string>>({ family: '', office: '' });
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const conv = data.conversations.find((c) => c.kind === active) ?? data.conversations[0]!;
  const text = draft[active];

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [conv.messages.length, active]);

  // Live updates for the active conversation (if its thread exists yet).
  useEffect(() => {
    if (!conv.threadId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`thread:${conv.threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${conv.threadId}` }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conv.threadId, router]);

  function send() {
    const body = text.trim();
    if (!body || pending) return;
    const kind = active;
    setDraft((d) => ({ ...d, [kind]: '' }));
    start(async () => {
      try {
        await sendParentMessage(kind, body);
        router.refresh();
      } catch (e) {
        setDraft((d) => ({ ...d, [kind]: body })); // restore the draft so nothing is lost
        toast(e instanceof Error ? e.message : 'Message not sent — tap send to try again');
      }
    });
  }

  return (
    <div className="flex flex-col">
      {/* Conversation switcher */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {data.conversations.map((c) => (
            <button
              key={c.kind}
              onClick={() => setActive(c.kind)}
              className={cn('flex-1 py-1.5 rounded-lg text-[13px] font-semibold', active === c.kind ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}
            >
              {META[c.kind].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
          {data.translating && <Languages className="w-3 h-3 text-indigo-500 flex-shrink-0" />}
          {META[active].disclosure}
        </p>
      </div>

      {/* Messages */}
      <div className="px-4 py-3 space-y-2.5 pb-28">
        {conv.messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 mt-8">
            {active === 'office' ? 'No messages yet. Reach the front office here.' : `No messages yet. Say hello to ${data.childFirst}’s teachers.`}
          </p>
        ) : (
          conv.messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Composer — fixed above the bottom nav */}
      <div className="fixed inset-x-0 z-30 flex items-end gap-2 px-3 py-2.5 border-t border-gray-100 bg-white" style={{ bottom: 'calc(54px + env(safe-area-inset-bottom))' }}>
        <textarea
          value={text}
          onChange={(e) => setDraft((d) => ({ ...d, [active]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={data.translating ? `Message ${META[active].label.toLowerCase()} (auto-translated)…` : `Message ${META[active].label.toLowerCase()}…`}
          className="flex-1 resize-none rounded-2xl border border-gray-200 px-3.5 py-2 text-[13px] max-h-28 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button onClick={send} disabled={!text.trim() || pending} className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40" aria-label="Send">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ParentMessage }) {
  const time = m.at ? new Date(m.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <div className={cn('flex flex-col max-w-[80%]', m.mine ? 'ml-auto items-end' : 'items-start')}>
      {!m.mine && <span className="text-[10px] font-medium text-gray-400 mb-0.5 px-1">{m.author}</span>}
      <div className={cn('rounded-2xl px-3.5 py-2 text-[13px] leading-snug', m.mine ? 'bg-brand text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md')}>
        <p>{m.body}</p>
        {m.original && (
          <p className={cn('mt-1 pt-1 text-[12px] border-t', m.mine ? 'border-white/25 text-white/80' : 'border-gray-200 text-gray-500')}>
            <Languages className="inline w-3 h-3 mr-1 -mt-0.5" />
            {m.original}
          </p>
        )}
      </div>
      <span className="text-[9px] text-gray-300 mt-0.5 px-1">{time}</span>
    </div>
  );
}

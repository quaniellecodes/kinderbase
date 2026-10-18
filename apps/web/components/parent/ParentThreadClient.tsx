'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { sendParentMessage } from '@/app/(parent)/p/messages/actions';
import type { ParentThread, ParentMessage } from '@/lib/parent/messages';

// The parent chat view. Mirrors the staff ThreadClient, but the guardian is "mine"
// (right-aligned) and there is no Idea-Garden branch. Realtime works because the
// guardian is a thread_members row (RLS lets their browser client see INSERTs).
export function ParentThreadClient({ thread }: { thread: ParentThread }) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [thread.messages.length]);

  useEffect(() => {
    if (!thread.threadId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`thread:${thread.threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${thread.threadId}` }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [thread.threadId, router]);

  function send() {
    const body = draft.trim();
    if (!body || pending) return;
    setDraft('');
    start(async () => {
      try {
        await sendParentMessage(body);
        router.refresh();
      } catch {
        setDraft(body); // restore the draft so nothing is lost
      }
    });
  }

  return (
    <div className="flex flex-col">
      {/* Context + disclosure */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-1.5">
          <h1 className="text-sm font-semibold text-gray-900 truncate">{thread.roomName || 'Your room'}</h1>
          {thread.translating && <Languages className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />}
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">{thread.disclosure}</p>
      </div>

      {/* Messages */}
      <div className="px-4 py-3 space-y-2.5 pb-28">
        {thread.messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 mt-8">No messages yet. Say hello to {thread.childFirst}&apos;s teachers.</p>
        ) : (
          thread.messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Composer — fixed above the bottom nav */}
      <div
        className="fixed inset-x-0 z-30 flex items-end gap-2 px-3 py-2.5 border-t border-gray-100 bg-white"
        style={{ bottom: 'calc(54px + env(safe-area-inset-bottom))' }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={thread.translating ? 'Message (auto-translated)…' : 'Message…'}
          className="flex-1 resize-none rounded-2xl border border-gray-200 px-3.5 py-2 text-[13px] max-h-28 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || pending}
          className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40"
          aria-label="Send"
        >
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

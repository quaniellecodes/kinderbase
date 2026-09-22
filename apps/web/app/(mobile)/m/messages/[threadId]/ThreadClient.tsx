'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Send, Languages, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendMessage, type ThreadDetail, type ThreadMessage } from '../actions';

export function ThreadClient({ thread }: { thread: ThreadDetail }) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [thread.messages.length]);

  function send() {
    const body = draft.trim();
    if (!body || pending) return;
    setDraft('');
    start(async () => {
      await sendMessage(thread.id, body);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <Link href="/m/messages" className="p-1 -ml-1 text-gray-500" aria-label="Back">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-semibold text-gray-900 truncate">{thread.name}</h1>
            {thread.lang && <Languages className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />}
          </div>
          {thread.sub && <p className="text-[11px] text-gray-400 truncate">{thread.sub}</p>}
        </div>
      </header>

      {/* Disclosure */}
      <p className="px-4 py-1.5 text-[10px] text-gray-400 bg-gray-50/70 border-b border-gray-100 flex-shrink-0">{thread.disclosure}</p>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {thread.messages.length === 0 && <p className="text-center text-xs text-gray-400 mt-8">No messages yet. Say hello.</p>}
        {thread.messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      {thread.canReply ? (
        <div className="flex items-end gap-2 px-3 py-2.5 border-t border-gray-100 bg-white flex-shrink-0" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
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
            placeholder={thread.lang ? 'Message (auto-translated)…' : 'Message…'}
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
      ) : (
        <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400 flex-shrink-0">
          <Lock className="w-3 h-3" /> Read-only
        </div>
      )}
    </div>
  );
}

function Bubble({ m }: { m: ThreadMessage }) {
  const time = m.at ? new Date(m.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <div className={cn('flex flex-col max-w-[80%]', m.mine ? 'ml-auto items-end' : 'items-start')}>
      {!m.mine && <span className="text-[10px] font-medium text-gray-400 mb-0.5 px-1">{m.author}{m.isGuardian ? ' · family' : ''}</span>}
      <div className={cn('rounded-2xl px-3.5 py-2 text-[13px] leading-snug', m.mine ? 'bg-brand text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md')}>
        <p>{m.body}</p>
        {m.translated && (
          <p className={cn('mt-1 pt-1 text-[12px] border-t', m.mine ? 'border-white/25 text-white/80' : 'border-gray-200 text-gray-500')}>
            <Languages className="inline w-3 h-3 mr-1 -mt-0.5" />
            {m.translated}
          </p>
        )}
      </div>
      <span className="text-[9px] text-gray-300 mt-0.5 px-1">{time}</span>
    </div>
  );
}

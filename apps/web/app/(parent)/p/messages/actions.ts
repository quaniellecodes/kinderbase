'use server';

import { revalidatePath } from 'next/cache';
import { translate } from '@kinderbase/core';
import { parentContext, assertCanWrite } from '@/lib/parent/principal';
import type { ParentConvKind } from '@/lib/parent/messages';

// Parent → staff reply (docs/PARENT-DECISIONS.md §1). `kind` picks the conversation:
//   • 'family' — the classroom thread (teachers + director).
//   • 'office' — the admins-only office line (no teachers).
// The parent writes in their own language; we store that and translate to English
// into message_translations so staff (who read English) see it. Parent messages
// deliver immediately — quiet-hours deferral is a staff→family courtesy only.

export async function sendParentMessage(kind: ParentConvKind, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  if (kind !== 'family' && kind !== 'office') throw new Error('Bad request');

  const p = await parentContext();
  if (!p || p.childIds.length === 0) throw new Error('Not found');
  assertCanWrite(p); // refuse writes while emulating a family
  const childId = p.childIds[0]!;
  const svc = p.service;

  const { data: child } = await svc.from('children').select('center_id, classroom_id').eq('id', childId).maybeSingle();
  if (!child) throw new Error('Not found');

  const { data: gs } = await svc.from('guardians').select('app_user_id, preferred_lang, is_primary').eq('child_id', childId);
  const lang = ((gs ?? []).find((g) => g.app_user_id === p.userId) ?? (gs ?? []).find((g) => g.is_primary) ?? gs?.[0])?.preferred_lang ?? 'en';

  // Get-or-create the child's thread of this kind (one per child+kind). The office
  // line is center-level, so it carries no classroom_id; the classroom thread does.
  let threadId: string;
  const { data: existing } = await svc.from('threads').select('id').eq('student_id', childId).eq('kind', kind).maybeSingle();
  if (existing) {
    threadId = existing.id;
  } else {
    const { data: created, error: tErr } = await svc
      .from('threads')
      .insert({ center_id: child.center_id, kind, classroom_id: kind === 'family' ? child.classroom_id : null, student_id: childId, title: null })
      .select('id')
      .single();
    if (tErr) throw new Error(tErr.message);
    threadId = created.id;
  }

  // Ensure the guardian is a member (RLS + realtime + read cursor).
  const { error: mErr } = await svc.from('thread_members').upsert(
    { thread_id: threadId, user_id: p.userId, role: 'guardian', last_read_at: new Date().toISOString() },
    { onConflict: 'thread_id,user_id' },
  );
  if (mErr) throw new Error(mErr.message);

  const { data: msg, error: msgErr } = await svc
    .from('messages')
    .insert({ thread_id: threadId, author_id: p.userId, body: trimmed, lang })
    .select('id')
    .single();
  if (msgErr) throw new Error(msgErr.message);

  if (lang !== 'en') {
    const en = await translate(trimmed, 'en');
    const { error: trErr } = await svc.from('message_translations').insert({ message_id: msg.id, lang: 'en', body: en });
    if (trErr) throw new Error(trErr.message);
  }

  revalidatePath('/p/messages');
}

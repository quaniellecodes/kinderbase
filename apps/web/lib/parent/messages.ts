import 'server-only';
import { redactNames } from '@kinderbase/core';
import { parentContext } from './principal';

// The family's two conversations (docs/PARENT-DECISIONS.md §1):
//   • Classroom (kind='family') — the room's teachers + the center director.
//   • Office    (kind='office') — a private line to management; teachers never see it.
// Both are per-child (threads unique on (student_id, kind)). Parents have NO direct
// RLS read on message bodies — a staff line can name a classmate and RLS can't
// rewrite text — so this reader fetches via the service client and scrubs every
// OTHER child's name before any body leaves the server. Each message is shown in the
// guardian's preferred language, with the original kept as a sub-line.

export type ParentConvKind = 'family' | 'office';
export type ParentMessage = { id: string; author: string; mine: boolean; body: string; original: string | null; at: string };
export type ParentConversation = { kind: ParentConvKind; threadId: string | null; messages: ParentMessage[] };
export type ParentMessages = {
  childFirst: string;
  roomName: string;
  translating: boolean;
  conversations: ParentConversation[];
};

const KIND_ORDER: ParentConvKind[] = ['family', 'office'];

export async function getParentMessages(): Promise<ParentMessages | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const childId = p.activeChildId;
  const svc = p.service;

  const { data: child } = await svc
    .from('children')
    .select('first_name, preferred_name, classroom_id, classrooms(name)')
    .eq('id', childId)
    .maybeSingle();
  if (!child) return null;
  const childFirst = child.preferred_name ?? child.first_name;
  const roomName = (Array.isArray(child.classrooms) ? child.classrooms[0] : child.classrooms)?.name ?? '';

  // Other children in the room → the names to scrub from staff-written bodies.
  const { data: roommates } = child.classroom_id
    ? await svc.from('children').select('first_name, preferred_name').eq('classroom_id', child.classroom_id).neq('id', childId)
    : { data: [] as { first_name: string; preferred_name: string | null }[] };
  const otherNames = (roommates ?? []).flatMap((r) => [r.first_name, r.preferred_name]).filter((n): n is string => !!n);

  // The viewing guardian's language (their own row; the primary guardian under emulation).
  const { data: gs } = await svc.from('guardians').select('app_user_id, preferred_lang, is_primary').eq('child_id', childId);
  const prefLang = ((gs ?? []).find((g) => g.app_user_id === p.userId) ?? (gs ?? []).find((g) => g.is_primary) ?? gs?.[0])?.preferred_lang ?? 'en';

  const { data: threadRows } = await svc.from('threads').select('id, kind').eq('student_id', childId).in('kind', ['family', 'office']);
  const threadByKind = new Map<ParentConvKind, string>();
  for (const t of threadRows ?? []) if (t.kind === 'family' || t.kind === 'office') threadByKind.set(t.kind, t.id);
  const threadIds = [...threadByKind.values()];

  // All messages for both threads in one query, grouped by thread.
  type Row = { id: string; thread_id: string; author_id: string; body: string; lang: string; created_at: string | null; users: { full_name: string } | { full_name: string }[] | null };
  const { data: rows } = threadIds.length
    ? await svc.from('messages').select('id, thread_id, author_id, body, lang, created_at, users(full_name)').in('thread_id', threadIds).order('created_at')
    : { data: [] as Row[] };
  const msgs = (rows ?? []) as Row[];

  // Translations into the guardian's language for any message not already in it.
  const needTr = msgs.filter((m) => m.lang !== prefLang).map((m) => m.id);
  const trByMsg = new Map<string, string>();
  if (needTr.length) {
    const { data: trs } = await svc.from('message_translations').select('message_id, body').in('message_id', needTr).eq('lang', prefLang);
    for (const t of trs ?? []) trByMsg.set(t.message_id, t.body);
  }

  const build = (m: Row): ParentMessage => {
    const display = m.lang === prefLang ? m.body : trByMsg.get(m.id) ?? m.body;
    const original = display !== m.body ? m.body : null;
    return {
      id: m.id,
      author: (Array.isArray(m.users) ? m.users[0] : m.users)?.full_name ?? 'Staff',
      mine: m.author_id === p.userId,
      body: redactNames(display, otherNames),
      original: original ? redactNames(original, otherNames) : null,
      at: m.created_at ?? '',
    };
  };

  const conversations: ParentConversation[] = KIND_ORDER.map((kind) => {
    const threadId = threadByKind.get(kind) ?? null;
    const messages = threadId ? msgs.filter((m) => m.thread_id === threadId).map(build) : [];
    return { kind, threadId, messages };
  });

  // Mark read — never while emulating (read-only). The guardian is the verified
  // authority (assertReachable via parentContext), so upserting their own
  // membership/read cursor is correct, not a privilege grant.
  if (!p.emulated && threadIds.length) {
    const nowIso = new Date().toISOString();
    await svc.from('thread_members').upsert(
      threadIds.map((id) => ({ thread_id: id, user_id: p.userId, role: 'guardian', last_read_at: nowIso })),
      { onConflict: 'thread_id,user_id' },
    );
  }

  return { childFirst, roomName, translating: prefLang !== 'en', conversations };
}

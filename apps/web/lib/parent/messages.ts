import 'server-only';
import { redactNames } from '@kinderbase/core';
import { parentContext } from './principal';

// The family thread as a parent sees it (docs/PARENT-DECISIONS.md §1). One thread
// per child (threads.student_id UNIQUE, kind='family'). Parents have NO direct RLS
// read on message bodies — a staff-written line can name a classmate and RLS can't
// rewrite text — so this reader fetches via the service client and scrubs every
// OTHER child's name before any body leaves the server. Two-way translation: each
// message is shown in the guardian's preferred language, with the original kept as
// a sub-line for transparency.

export type ParentMessage = { id: string; author: string; mine: boolean; body: string; original: string | null; at: string };
export type ParentThread = {
  threadId: string | null;
  roomName: string;
  childFirst: string;
  translating: boolean;
  disclosure: string;
  messages: ParentMessage[];
};

const DISCLOSURE = "Your child's teachers and the center director can see this conversation.";

/** The viewing guardian's language — their own row when a real guardian is signed in, else the primary guardian (emulation). */
async function preferredLang(svc: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>, childId: string, userId: string): Promise<string> {
  const { data: gs } = await svc.from('guardians').select('app_user_id, preferred_lang, is_primary').eq('child_id', childId);
  const mine = (gs ?? []).find((g) => g.app_user_id === userId);
  const primary = (gs ?? []).find((g) => g.is_primary);
  return (mine ?? primary ?? gs?.[0])?.preferred_lang ?? 'en';
}

export async function getParentThread(): Promise<ParentThread | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const childId = p.childIds[0]!;
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

  const prefLang = await preferredLang(svc, childId, p.userId);

  const { data: thread } = await svc.from('threads').select('id').eq('student_id', childId).eq('kind', 'family').maybeSingle();
  if (!thread) {
    // No thread yet — show an empty conversation the parent can start (lazily created on first send).
    return { threadId: null, roomName, childFirst, translating: prefLang !== 'en', disclosure: DISCLOSURE, messages: [] };
  }

  const { data: rows } = await svc
    .from('messages')
    .select('id, author_id, body, lang, created_at, users(full_name)')
    .eq('thread_id', thread.id)
    .order('created_at');
  type Row = { id: string; author_id: string; body: string; lang: string; created_at: string | null; users: { full_name: string } | { full_name: string }[] | null };
  const msgs = (rows ?? []) as Row[];

  // Translations into the guardian's language for any message not already in it.
  const needTr = msgs.filter((m) => m.lang !== prefLang).map((m) => m.id);
  const trByMsg = new Map<string, string>();
  if (needTr.length) {
    const { data: trs } = await svc.from('message_translations').select('message_id, body').in('message_id', needTr).eq('lang', prefLang);
    for (const t of trs ?? []) trByMsg.set(t.message_id, t.body);
  }

  const messages: ParentMessage[] = msgs.map((m) => {
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
  });

  // Mark read — but never while emulating (read-only). The guardian is the verified
  // authority here (assertReachable via parentContext), so upserting their own
  // membership/read cursor is correct, not a privilege grant.
  if (!p.emulated) {
    await svc.from('thread_members').upsert(
      { thread_id: thread.id, user_id: p.userId, role: 'guardian', last_read_at: new Date().toISOString() },
      { onConflict: 'thread_id,user_id' },
    );
  }

  return { threadId: thread.id, roomName, childFirst, translating: prefLang !== 'en', disclosure: DISCLOSURE, messages };
}

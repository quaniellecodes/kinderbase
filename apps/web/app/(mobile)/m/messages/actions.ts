'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { translate } from '@kinderbase/core';
import { isAdmin, childDisplayName, type CenterRole } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

async function ctx(): Promise<{ service: Service; userId: string; centerId: string; role: CenterRole; admin: boolean } | null> {
  const active = getActiveContextFromCookies();
  if (!active) return null;
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return null;
  return { service: createServiceClient(), userId: user.id, centerId: active.centerId, role: active.role, admin: isAdmin(active.role) };
}

async function myRoomIds(service: Service, userId: string, centerId: string, admin: boolean): Promise<string[]> {
  if (admin) {
    const { data } = await service.from('classrooms').select('id').eq('center_id', centerId).is('deleted_at', null);
    return (data ?? []).map((r) => r.id);
  }
  const { data } = await service.from('classroom_staff').select('classroom_id').eq('user_id', userId);
  return [...new Set((data ?? []).map((r) => r.classroom_id))];
}

export type ThreadSummary = { id: string; kind: string; name: string; sub: string; avatar: string; lastBody: string; lastAt: string; unread: boolean; lang: string | null; aging: boolean };
export type ThreadGroups = { team: ThreadSummary[]; families: ThreadSummary[]; quiet: { start: string; end: string } };

export async function getThreads(): Promise<ThreadGroups | null> {
  const c = await ctx();
  if (!c) return null;
  const { service, userId, centerId, admin } = c;
  const rooms = await myRoomIds(service, userId, centerId, admin);
  const noId = ['00000000-0000-0000-0000-000000000000'];

  // Threads visible to this user (app-enforced; RLS is the DB backstop).
  const { data: memberThreadIds } = await service.from('thread_members').select('thread_id').eq('user_id', userId);
  const myThreadIds = new Set((memberThreadIds ?? []).map((m) => m.thread_id));

  const { data: threads } = await service
    .from('threads')
    .select('id, kind, classroom_id, student_id, title, classrooms(name), children(id, first_name, last_name)')
    .eq('center_id', centerId);
  const visible = (threads ?? []).filter((t) => {
    if (t.kind === 'announcement' || t.kind === 'idea') return true;
    if (t.kind === 'room') return admin || (t.classroom_id != null && rooms.includes(t.classroom_id));
    if (t.kind === 'family') return admin || (t.classroom_id != null && rooms.includes(t.classroom_id));
    if (t.kind === 'dm') return myThreadIds.has(t.id); // members only — no admin override
    return false;
  });
  const ids = visible.map((t) => t.id);

  // Latest message per thread + my last_read.
  const { data: msgs } = ids.length
    ? await service.from('messages').select('thread_id, author_id, body, created_at').in('thread_id', ids).order('created_at', { ascending: false })
    : { data: [] as { thread_id: string; author_id: string; body: string; created_at: string }[] };
  const latest = new Map<string, { author_id: string; body: string; created_at: string }>();
  for (const m of msgs ?? []) if (!latest.has(m.thread_id)) latest.set(m.thread_id, { author_id: m.author_id, body: m.body, created_at: m.created_at ?? '' });

  const { data: reads } = ids.length ? await service.from('thread_members').select('thread_id, last_read_at, role').eq('user_id', userId).in('thread_id', ids) : { data: [] as { thread_id: string; last_read_at: string | null; role: string }[] };
  const myRead = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));

  // Guardian members (for aging) + family language.
  const { data: guardianMembers } = ids.length ? await service.from('thread_members').select('thread_id, user_id, role').in('thread_id', ids).eq('role', 'guardian') : { data: [] as { thread_id: string; user_id: string; role: string }[] };
  const guardianByThread = new Map<string, Set<string>>();
  for (const g of guardianMembers ?? []) {
    if (!guardianByThread.has(g.thread_id)) guardianByThread.set(g.thread_id, new Set());
    guardianByThread.get(g.thread_id)!.add(g.user_id);
  }
  const studentIds = visible.filter((t) => t.kind === 'family' && t.student_id).map((t) => t.student_id as string);
  const { data: langs } = studentIds.length ? await service.from('guardians').select('child_id, preferred_lang').in('child_id', studentIds.length ? studentIds : noId) : { data: [] as { child_id: string; preferred_lang: string }[] };
  const langByChild = new Map<string, string>();
  for (const l of langs ?? []) if (l.preferred_lang !== 'en') langByChild.set(l.child_id, l.preferred_lang);

  const now = getClock().now().getTime();
  const summaries: ThreadSummary[] = visible.map((t) => {
    const last = latest.get(t.id);
    const read = myRead.get(t.id);
    const unread = !!last && last.author_id !== userId && (!read || last.created_at > read);
    const child = Array.isArray(t.children) ? t.children[0] : t.children;
    const room = Array.isArray(t.classrooms) ? t.classrooms[0] : t.classrooms;
    const name = t.kind === 'announcement' ? 'Management' : t.kind === 'idea' ? 'Idea Garden' : t.kind === 'room' ? (room as { name: string } | null)?.name ?? 'Room' : t.kind === 'family' ? (child ? `${childDisplayName(child)} family` : 'Family') : t.title ?? 'Direct message';
    const lang = t.kind === 'family' && t.student_id ? langByChild.get(t.student_id) ?? null : null;
    const guardians = guardianByThread.get(t.id);
    const agingHours = last ? (now - new Date(last.created_at).getTime()) / 3_600_000 : 0;
    const aging = t.kind === 'family' && !!last && !!guardians?.has(last.author_id) && agingHours > 24;
    return {
      id: t.id,
      kind: t.kind,
      name,
      sub: t.kind === 'family' ? ((room as { name: string } | null)?.name ?? '') : '',
      avatar: t.kind === 'announcement' ? '📢' : t.kind === 'idea' ? '💡' : t.kind === 'room' ? '🏫' : t.kind === 'family' ? (child ? child.first_name[0]! : 'F') : '💬',
      lastBody: last?.body ?? 'No messages yet',
      lastAt: last?.created_at ?? '',
      unread,
      lang,
      aging,
    };
  });
  summaries.sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1));

  const { data: center } = await service.from('centers').select('quiet_hours_start, quiet_hours_end').eq('id', centerId).maybeSingle();
  const order = { announcement: 0, room: 1, idea: 2, dm: 3, family: 4 } as Record<string, number>;
  const team = summaries.filter((s) => s.kind !== 'family').sort((a, b) => order[a.kind]! - order[b.kind]!);
  const families = summaries.filter((s) => s.kind === 'family');
  return { team, families, quiet: { start: center?.quiet_hours_start ?? '18:30', end: center?.quiet_hours_end ?? '07:00' } };
}

export type ThreadMessage = { id: string; author: string; mine: boolean; isGuardian: boolean; body: string; translated: string | null; at: string; votes: number; voted: boolean };
export type ThreadDetail = { id: string; kind: string; name: string; sub: string; disclosure: string; canReply: boolean; canPromote: boolean; lang: string | null; messages: ThreadMessage[] };

export async function getThread(threadId: string): Promise<ThreadDetail | null> {
  const c = await ctx();
  if (!c) return null;
  const { service, userId, centerId, admin } = c;
  const { data: t } = await service.from('threads').select('id, kind, center_id, classroom_id, student_id, title, classrooms(name), children(id, first_name, last_name)').eq('id', threadId).maybeSingle();
  if (!t || t.center_id !== centerId) return null;

  const rooms = await myRoomIds(service, userId, centerId, admin);
  const { data: myMember } = await service.from('thread_members').select('role').eq('thread_id', threadId).eq('user_id', userId).maybeSingle();
  // Access (app-enforced; DMs are members-only, no admin override).
  const canAccess =
    t.kind === 'announcement' || t.kind === 'idea'
      ? true
      : t.kind === 'room' || t.kind === 'family'
        ? admin || (t.classroom_id != null && rooms.includes(t.classroom_id)) || !!myMember
        : !!myMember; // dm
  if (!canAccess) return null;

  // Float assigned to a family room is read-only.
  const isFloatOnly = t.kind === 'family' && !admin && !myMember && !!t.classroom_id;
  const canReply = t.kind === 'announcement' ? admin : !isFloatOnly;

  const { data: members } = await service.from('thread_members').select('user_id, role').eq('thread_id', threadId);
  const roleByUser = new Map((members ?? []).map((m) => [m.user_id, m.role]));

  const { data: msgs } = await service.from('messages').select('id, author_id, body, lang, created_at, users(full_name)').eq('thread_id', threadId).order('created_at');
  const ids = (msgs ?? []).map((m) => m.id);
  const { data: trans } = ids.length ? await service.from('message_translations').select('message_id, body').in('message_id', ids).eq('lang', 'en') : { data: [] as { message_id: string; body: string }[] };
  const enByMsg = new Map((trans ?? []).map((t2) => [t2.message_id, t2.body]));

  // Idea Garden vote tallies.
  const voteCount = new Map<string, number>();
  const myVotes = new Set<string>();
  if (t.kind === 'idea' && ids.length) {
    const { data: votes } = await service.from('idea_votes').select('message_id, user_id').in('message_id', ids);
    for (const v of votes ?? []) {
      voteCount.set(v.message_id, (voteCount.get(v.message_id) ?? 0) + 1);
      if (v.user_id === userId) myVotes.add(v.message_id);
    }
  }

  const messages: ThreadMessage[] = (msgs ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    const isGuardian = roleByUser.get(m.author_id) === 'guardian';
    // Show the English translation beneath non-English guardian messages.
    const translated = m.lang !== 'en' ? enByMsg.get(m.id) ?? null : null;
    return { id: m.id, author: u?.full_name ?? 'User', mine: m.author_id === userId, isGuardian, body: m.body, translated, at: m.created_at ?? '', votes: voteCount.get(m.id) ?? 0, voted: myVotes.has(m.id) };
  });

  await service.from('thread_members').upsert({ thread_id: threadId, user_id: userId, last_read_at: getClock().now().toISOString() }, { onConflict: 'thread_id,user_id' });

  const child = Array.isArray(t.children) ? t.children[0] : t.children;
  const room = Array.isArray(t.classrooms) ? t.classrooms[0] : t.classrooms;
  const name = t.kind === 'announcement' ? 'Management' : t.kind === 'idea' ? 'Idea Garden' : t.kind === 'room' ? (room as { name: string } | null)?.name ?? 'Room' : t.kind === 'family' ? (child ? `${childDisplayName(child)} family` : 'Family') : t.title ?? 'Direct message';
  const disclosure =
    t.kind === 'family'
      ? isFloatOnly
        ? 'You can read this thread. Replies route to the room’s lead.'
        : 'Center record — directors can view this thread.'
      : t.kind === 'dm'
        ? 'Direct message — private. Admins cannot read this.'
        : t.kind === 'announcement'
          ? 'Announcement channel — replies go to management only.'
          : t.kind === 'idea'
            ? 'Idea Garden — visible to all staff and management.'
            : 'Internal staff channel — families cannot see this.';
  const lang = t.kind === 'family' && t.student_id ? await familyLang(service, t.student_id) : null;

  return { id: t.id, kind: t.kind, name, sub: t.kind === 'family' ? ((room as { name: string } | null)?.name ?? '') : '', disclosure, canReply, canPromote: t.kind === 'idea' && admin, lang, messages };
}

/** Toggle the current user's upvote on an Idea Garden message. */
export async function toggleIdeaVote(messageId: string): Promise<void> {
  const c = await ctx();
  if (!c) throw new Error('Forbidden');
  const { service, userId, centerId } = c;
  // Confirm the message belongs to an idea thread at this center.
  const { data: m } = await service.from('messages').select('thread_id, threads(kind, center_id)').eq('id', messageId).maybeSingle();
  const thr = m ? (Array.isArray(m.threads) ? m.threads[0] : m.threads) : null;
  if (!thr || thr.kind !== 'idea' || thr.center_id !== centerId) throw new Error('Forbidden');
  const { data: existing } = await service.from('idea_votes').select('user_id').eq('message_id', messageId).eq('user_id', userId).maybeSingle();
  if (existing) await service.from('idea_votes').delete().eq('message_id', messageId).eq('user_id', userId);
  else await service.from('idea_votes').insert({ message_id: messageId, user_id: userId });
  revalidatePath(`/m/messages/${m!.thread_id}`);
}

/** Admin promotes an idea into an assigned task (Idea Garden → action). */
export async function promoteIdeaToTask(messageId: string): Promise<void> {
  const c = await ctx();
  if (!c) throw new Error('Forbidden');
  const { service, userId, centerId, admin } = c;
  if (!admin) throw new Error('Only management can promote an idea.');
  const { data: m } = await service.from('messages').select('body, thread_id, threads(kind, center_id)').eq('id', messageId).maybeSingle();
  const thr = m ? (Array.isArray(m.threads) ? m.threads[0] : m.threads) : null;
  if (!thr || thr.kind !== 'idea' || thr.center_id !== centerId) throw new Error('Forbidden');
  const title = m!.body.length > 80 ? `${m!.body.slice(0, 77)}…` : m!.body;
  await service.from('staff_tasks').insert({ center_id: centerId, assigned_to: userId, assigned_by: userId, title, detail: 'Promoted from the Idea Garden', source: 'assigned' });
  revalidatePath(`/m/messages/${m!.thread_id}`);
  revalidatePath('/m/admin/inbox');
}

export type AgingThread = { id: string; childName: string; room: string; hours: number; snippet: string };

/**
 * Family threads whose latest message is from a guardian and has gone
 * unanswered for over 24h. Scoped to the caller's rooms (all center rooms for
 * admins). Powers the red aging tags on teacher Today, admin Home, and Inbox.
 */
export async function getAgingFamilyThreads(): Promise<AgingThread[]> {
  const c = await ctx();
  if (!c) return [];
  const { service, userId, centerId, admin } = c;
  const rooms = await myRoomIds(service, userId, centerId, admin);
  if (!rooms.length) return [];
  const { data: threads } = await service
    .from('threads')
    .select('id, student_id, classroom_id, children(first_name, last_name), classrooms(name)')
    .eq('center_id', centerId)
    .eq('kind', 'family')
    .in('classroom_id', rooms);
  if (!threads?.length) return [];
  const ids = threads.map((t) => t.id);
  const { data: msgs } = await service.from('messages').select('thread_id, author_id, body, created_at').in('thread_id', ids).order('created_at', { ascending: false });
  const { data: guardianMembers } = await service.from('thread_members').select('thread_id, user_id').in('thread_id', ids).eq('role', 'guardian');
  const guardianByThread = new Map<string, Set<string>>();
  for (const g of guardianMembers ?? []) {
    if (!guardianByThread.has(g.thread_id)) guardianByThread.set(g.thread_id, new Set());
    guardianByThread.get(g.thread_id)!.add(g.user_id);
  }
  const latest = new Map<string, { author_id: string; body: string; created_at: string }>();
  for (const m of msgs ?? []) if (!latest.has(m.thread_id)) latest.set(m.thread_id, { author_id: m.author_id, body: m.body, created_at: m.created_at ?? '' });

  const now = getClock().now().getTime();
  const out: AgingThread[] = [];
  for (const t of threads) {
    const last = latest.get(t.id);
    if (!last || !guardianByThread.get(t.id)?.has(last.author_id)) continue;
    const hours = (now - new Date(last.created_at).getTime()) / 3_600_000;
    if (hours <= 24) continue;
    const child = Array.isArray(t.children) ? t.children[0] : t.children;
    const room = Array.isArray(t.classrooms) ? t.classrooms[0] : t.classrooms;
    out.push({ id: t.id, childName: child ? childDisplayName(child) : 'Family', room: (room as { name: string } | null)?.name ?? '', hours: Math.round(hours), snippet: last.body.length > 60 ? `${last.body.slice(0, 57)}…` : last.body });
  }
  return out.sort((a, b) => b.hours - a.hours);
}

async function familyLang(service: Service, childId: string): Promise<string | null> {
  const { data } = await service.from('guardians').select('preferred_lang').eq('child_id', childId).neq('preferred_lang', 'en').limit(1).maybeSingle();
  return data?.preferred_lang ?? null;
}

export async function sendMessage(threadId: string, body: string): Promise<void> {
  const c = await ctx();
  if (!c) throw new Error('Forbidden');
  const { service, userId, centerId } = c;
  if (!body.trim()) return;
  const { data: t } = await service.from('threads').select('kind, center_id, student_id, classroom_id').eq('id', threadId).maybeSingle();
  if (!t || t.center_id !== centerId) throw new Error('Forbidden');

  // Quiet hours: to families outside 7:00 AM–6:30 PM, deliver at next 7:00 AM.
  const now = getClock().now();
  let deliverAt = now;
  if (t.kind === 'family') {
    const { data: center } = await service.from('centers').select('quiet_hours_start, quiet_hours_end').eq('id', centerId).maybeSingle();
    const start = center?.quiet_hours_start ?? '18:30';
    const end = center?.quiet_hours_end ?? '07:00';
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    if (mins >= toMin(start) || mins < toMin(end)) {
      const d = new Date(now);
      if (mins >= toMin(start)) d.setDate(d.getDate() + 1);
      d.setHours(Number(end.slice(0, 2)), Number(end.slice(3, 5)), 0, 0);
      deliverAt = d;
    }
  }

  const { data: msg, error } = await service.from('messages').insert({ thread_id: threadId, author_id: userId, body: body.trim(), lang: 'en', deliver_at: deliverAt.toISOString() }).select('id').single();
  if (error) throw new Error(error.message);

  // Translate outward for a non-English family.
  if (t.kind === 'family' && t.student_id) {
    const lang = await familyLang(service, t.student_id);
    if (lang) {
      const translated = await translate(body.trim(), lang);
      await service.from('message_translations').insert({ message_id: msg.id, lang, body: translated });
    }
  }
  await service.from('thread_members').upsert({ thread_id: threadId, user_id: userId, last_read_at: now.toISOString() }, { onConflict: 'thread_id,user_id' });
  revalidatePath(`/m/messages/${threadId}`);
  revalidatePath('/m/messages');
}

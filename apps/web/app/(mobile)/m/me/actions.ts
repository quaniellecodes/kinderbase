'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { computeCredentialStatus, type CenterRole } from '@kinderbase/types';

export type Signal = { label: string; weight: number; value: number; def: string };
export type MeData = {
  userId: string;
  name: string;
  role: CenterRole;
  isFloat: boolean;
  centerName: string;
  sinceYear: number | null;
  score: number;
  lifetime: number;
  signals: Signal[];
  closestWin: string;
  attendance: number; // 0–5 signal
  tenureYears: number | null;
  expiring: number;
  week: { label: string; state: string; today: boolean }[];
  leave: { sick: number; vacation: number; personal: number };
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_LABEL: Record<string, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F' };

export async function getMe(): Promise<MeData | null> {
  const active = getActiveContextFromCookies();
  if (!active) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const role = active.role;
  const isFloat = role === 'substitute';

  const { data: me } = await service.from('users').select('full_name').eq('id', user.id).maybeSingle();
  const { data: membership } = await service.from('center_memberships').select('joined_at').eq('user_id', user.id).eq('center_id', active.centerId).is('left_at', null).maybeSingle();
  const sinceYear = membership?.joined_at ? new Date(membership.joined_at).getFullYear() : null;
  const now = getClock().now();
  const tenureYears = membership?.joined_at ? Math.max(0, now.getFullYear() - new Date(membership.joined_at).getFullYear()) : null;

  const { data: ts } = await service.from('teacher_scores').select('*').eq('user_id', user.id).eq('center_id', active.centerId).maybeSingle();
  const score = Number(ts?.teacher_visible_score ?? ts?.center_score ?? 0);
  const lifetime = Math.max(0, score - 0.1);

  const allSignals: Signal[] = [
    { label: 'Attendance', weight: 30, value: Number(ts?.attendance_score ?? 0), def: 'Days present vs scheduled, rolling 90 days.' },
    { label: isFloat ? 'Posts / floor hour' : 'Posts', weight: 25, value: Number(ts?.posting_score ?? 0), def: 'Updates per child per week (floats: per floor hour).' },
    { label: 'Lesson plans', weight: 20, value: Number(ts?.lesson_plan_score ?? 0), def: 'Submitted before Monday 8 AM.' },
    { label: 'Schedule', weight: 15, value: Number(ts?.schedule_score ?? 0), def: 'Shifts worked as scheduled.' },
    { label: 'Observations', weight: 10, value: Number(ts?.observation_score ?? 0), def: 'Completed coaching cycles — never what was observed.' },
  ];
  // Floats: drop lesson plans, renormalize remaining weights.
  let signals = allSignals;
  if (isFloat) {
    const kept = allSignals.filter((s) => s.label !== 'Lesson plans');
    const total = kept.reduce((a, s) => a + s.weight, 0);
    signals = kept.map((s) => ({ ...s, weight: Math.round((s.weight / total) * 100) }));
  }
  const lowest = [...signals].sort((a, b) => a.value - b.value)[0];
  const closestWin = lowest ? `${lowest.label} is your lowest signal right now — small, steady wins there move your score the fastest.` : 'You’re tracking well across every signal.';

  const { data: creds } = await service.from('credentials').select('expires_at').eq('user_id', user.id).is('deleted_at', null);
  const expiring = (creds ?? []).filter((c) => {
    const st = computeCredentialStatus(c.expires_at);
    return st === 'expiring_soon' || st === 'expired';
  }).length;

  const { data: profile } = await service.from('staff_profiles').select('availability, sick_hours, vacation_hours, personal_hours').eq('user_id', user.id).eq('center_id', active.centerId).maybeSingle();
  const avail = (profile?.availability ?? {}) as Record<string, string>;
  const todayKey = DAY_KEYS[(now.getDay() + 6) % 7] ?? '';
  const week = DAY_KEYS.map((k) => ({ label: DAY_LABEL[k]!, state: avail[k] ?? 'full', today: k === todayKey }));

  return {
    userId: user.id,
    name: me?.full_name ?? 'You',
    role,
    isFloat,
    centerName: active.centerName,
    sinceYear,
    score,
    lifetime,
    signals,
    closestWin,
    attendance: Number(ts?.attendance_score ?? 0),
    tenureYears,
    expiring,
    week,
    leave: { sick: Number(profile?.sick_hours ?? 0), vacation: Number(profile?.vacation_hours ?? 0), personal: Number(profile?.personal_hours ?? 0) },
  };
}

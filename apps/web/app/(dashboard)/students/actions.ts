'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  childDisplayName,
  ageInMonths,
  nextComarBoundary,
  daysUntil,
  AGE_GROUP_LABELS,
  type AgeGroup,
  type CenterRole,
} from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

export type EnrollmentStatus = 'active' | 'inactive' | 'waitlist' | 'graduated';

export type StudentReclass = { days: number; toGroup: AgeGroup; toLabel: string };

export type StudentCard = {
  id: string;
  name: string; // preferred/first + last initial
  ageMonths: number;
  ageLabel: string;
  classroomId: string | null;
  classroomName: string | null;
  enrollmentStatus: EnrollmentStatus;
  tags: string[];
  present: boolean;
  signedInAt: string | null;
  alerts: { severeAllergy: boolean; missingDocs: number; reclass: StudentReclass | null };
};

export type StudentDirectory = {
  students: StudentCard[];
  classrooms: { id: string; name: string }[];
  tags: string[];
};

// ── date + label helpers (server-local "today") ────────────────────────────
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Compact age for cards: "2y 6m", "11 mo", "3 wk". */
function compactAge(months: number, birthdate: string): string {
  if (months < 1) {
    // Age in days = days elapsed from birthdate to today.
    const days = Math.max(0, daysUntil(todayISO(), new Date(`${birthdate}T00:00:00`)));
    const weeks = Math.floor(days / 7);
    return weeks >= 1 ? `${weeks} wk` : `${days} d`;
  }
  if (months < 24) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}y` : `${y}y ${m}m`;
}

// ── auth ────────────────────────────────────────────────────────────────────
async function requireCenterMember(
  centerId: string,
): Promise<{ service: Service; userId: string; role: CenterRole } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: m } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', centerId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();
  if (!m) return null;
  return { service, userId: user.id, role: m.role as CenterRole };
}

// ── directory ─────────────────────────────────────────────────────────────
export async function getStudentDirectory(centerId: string): Promise<StudentDirectory> {
  const authed = await requireCenterMember(centerId);
  if (!authed) return { students: [], classrooms: [], tags: [] };
  const { service } = authed;
  const today = todayISO();

  const { data: kids } = await service
    .from('children')
    .select('id, first_name, last_name, preferred_name, birthdate, classroom_id, enrollment_status, tags')
    .eq('center_id', centerId)
    .is('deleted_at', null)
    .order('first_name');
  const children = kids ?? [];
  const childIds = children.map((c) => c.id);
  const noIds = ['00000000-0000-0000-0000-000000000000'];

  const { data: classroomRows } = await service
    .from('classrooms')
    .select('id, name')
    .eq('center_id', centerId)
    .is('deleted_at', null)
    .order('name');
  const classrooms = classroomRows ?? [];
  const classroomName = new Map(classrooms.map((c) => [c.id, c.name]));

  // Present today (signed in, not out).
  const { data: attendance } = await service
    .from('child_attendance')
    .select('child_id, signed_in_at, signed_out_at')
    .eq('attendance_date', today)
    .in('child_id', childIds.length ? childIds : noIds);
  const attByChild = new Map((attendance ?? []).map((a) => [a.child_id, a]));

  // Severe allergies (any severe health entry).
  const { data: severe } = await service
    .from('student_health')
    .select('child_id')
    .eq('severity', 'severe')
    .in('child_id', childIds.length ? childIds : noIds);
  const severeSet = new Set((severe ?? []).map((h) => h.child_id));

  // Missing required documents (not superseded).
  const { data: missing } = await service
    .from('student_documents')
    .select('child_id')
    .eq('is_required', true)
    .eq('status', 'missing')
    .is('superseded_by', null)
    .in('child_id', childIds.length ? childIds : noIds);
  const missingByChild = new Map<string, number>();
  for (const d of missing ?? []) missingByChild.set(d.child_id, (missingByChild.get(d.child_id) ?? 0) + 1);

  const tagSet = new Set<string>();
  const students: StudentCard[] = children.map((c) => {
    for (const t of c.tags ?? []) tagSet.add(t);
    const att = attByChild.get(c.id);
    const ageMonths = ageInMonths(c.birthdate);
    const boundary = nextComarBoundary(c.birthdate);
    const bDays = boundary ? daysUntil(boundary.date) : -1;
    const displayFirst = c.preferred_name?.trim() || c.first_name;
    return {
      id: c.id,
      name: childDisplayName({ first_name: displayFirst, last_name: c.last_name }),
      ageMonths,
      ageLabel: compactAge(ageMonths, c.birthdate),
      classroomId: c.classroom_id,
      classroomName: c.classroom_id ? classroomName.get(c.classroom_id) ?? null : null,
      enrollmentStatus: c.enrollment_status as EnrollmentStatus,
      tags: c.tags ?? [],
      present: !!att?.signed_in_at && !att?.signed_out_at,
      signedInAt: att?.signed_in_at ?? null,
      alerts: {
        severeAllergy: severeSet.has(c.id),
        missingDocs: missingByChild.get(c.id) ?? 0,
        reclass:
          boundary && bDays >= 0 && bDays <= 14
            ? { days: bDays, toGroup: boundary.toGroup, toLabel: AGE_GROUP_LABELS[boundary.toGroup] }
            : null,
      },
    };
  });

  return {
    students,
    classrooms: classrooms.map((c) => ({ id: c.id, name: c.name })),
    tags: [...tagSet].sort(),
  };
}

// ── profile header ──────────────────────────────────────────────────────────
export type StudentHeader = {
  id: string;
  centerId: string;
  name: string; // preferred/first + full last name
  legalName: string; // first middle last
  ageMonths: number;
  ageLabel: string;
  classroomName: string | null;
  enrollmentStatus: EnrollmentStatus;
  present: boolean;
  studentCode: string | null;
  tags: string[];
  severeAllergies: string[]; // names of severe health entries
  canEdit: boolean;
};

export async function getStudentHeader(childId: string): Promise<StudentHeader | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();

  const { data: child } = await service
    .from('children')
    .select(
      'id, center_id, first_name, middle_name, last_name, preferred_name, birthdate, classroom_id, enrollment_status, student_code, tags, classrooms(name)',
    )
    .eq('id', childId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!child) return null;

  const { data: m } = await service
    .from('center_memberships')
    .select('role')
    .eq('center_id', child.center_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();
  if (!m) return null; // not a member of this student's center

  const today = todayISO();
  const { data: att } = await service
    .from('child_attendance')
    .select('signed_in_at, signed_out_at')
    .eq('child_id', childId)
    .eq('attendance_date', today)
    .maybeSingle();

  const { data: severe } = await service
    .from('student_health')
    .select('name')
    .eq('child_id', childId)
    .eq('severity', 'severe');

  const ageMonths = ageInMonths(child.birthdate);
  const displayFirst = child.preferred_name?.trim() || child.first_name;
  const classroom = Array.isArray(child.classrooms) ? child.classrooms[0] : child.classrooms;
  const legalName = [child.first_name, child.middle_name, child.last_name].filter(Boolean).join(' ');

  return {
    id: child.id,
    centerId: child.center_id,
    name: `${displayFirst} ${child.last_name}`.trim(),
    legalName,
    ageMonths,
    ageLabel: compactAge(ageMonths, child.birthdate),
    classroomName: (classroom as { name: string } | null)?.name ?? null,
    enrollmentStatus: child.enrollment_status as EnrollmentStatus,
    present: !!att?.signed_in_at && !att?.signed_out_at,
    studentCode: child.student_code,
    tags: child.tags ?? [],
    severeAllergies: (severe ?? []).map((s) => s.name),
    canEdit: (m.role as CenterRole) === 'director' || (m.role as CenterRole) === 'admin',
  };
}

export type CenterRole =
  | 'director'
  | 'admin'
  | 'lead_teacher'
  | 'assistant_teacher'
  | 'aide'
  | 'substitute';

export type ActiveContext = {
  centerId: string;
  centerName: string;
  role: CenterRole;
};

export const ADMIN_ROLES: CenterRole[] = ['director', 'admin'];
export const TEACHER_ROLES: CenterRole[] = [
  'lead_teacher',
  'assistant_teacher',
  'aide',
  'substitute',
];

export function isAdmin(role: CenterRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export const CENTER_ROLE_LABELS: Record<CenterRole, string> = {
  director: 'Director',
  admin: 'Admin',
  lead_teacher: 'Lead Teacher',
  assistant_teacher: 'Assistant Teacher',
  aide: 'Aide',
  substitute: 'Substitute',
};

export type Platform = 'ios' | 'android' | 'web';

export type CredentialType =
  | 'preschool_90hr'
  | 'infant_toddler_9hr'
  | 'communication_9hr'
  | 'ada_training'
  | 'first_aid_cpr'
  | 'child_abuse_prevention'
  | 'medication_administration'
  | 'cda'
  | 'directors_certification'
  | 'college_degree'
  | 'other';

export type CredentialStatus = 'active' | 'expiring_soon' | 'expired' | 'no_expiration';

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  preschool_90hr: '90-Hour Preschool',
  infant_toddler_9hr: '9-Hour Infant/Toddler',
  communication_9hr: '9-Hour Communication',
  ada_training: 'ADA Training',
  first_aid_cpr: 'First Aid & CPR',
  child_abuse_prevention: 'Child Abuse Prevention',
  medication_administration: 'Medication Administration',
  cda: 'Child Development Associate (CDA)',
  directors_certification: "Director's Certification",
  college_degree: 'College Degree',
  other: 'Other',
};

export type CredentialRow = {
  id: string;
  user_id: string;
  credential_type: CredentialType;
  custom_type_name: string | null;
  issuing_org: string;
  issued_at: string;
  expires_at: string | null;
  storage_path: string;
  show_on_profile: boolean;
  created_at: string;
  deleted_at: string | null;
  status: CredentialStatus;
};

export type EmploymentHistoryRow = {
  id: string;
  user_id: string;
  employer_name: string;
  center_id: string | null;
  role_title: string;
  start_date: string;
  end_date: string | null;
  show_on_profile: boolean;
  created_at: string;
};

export type AgeGroup = 'infant' | 'toddler' | 'two_year' | 'preschool' | 'school_age';

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  infant: 'Infant',
  toddler: 'Toddler',
  two_year: '2-Year-Old',
  preschool: 'Preschool',
  school_age: 'School-Age',
};

export type ClassroomRow = {
  id: string;
  center_id: string;
  name: string;
  age_group: AgeGroup;
  licensed_capacity: number;
  typical_enrollment: number;
  pattern_effective_date: string | null;
  open_slot: number | null;
  close_slot: number | null;
  operating_days: number[] | null;
  created_at: string;
  deleted_at: string | null;
};

export type StaffingPatternRow = {
  id: string;
  classroom_id: string;
  day_of_week: number;
  hour: number;
  staff_count: number;
};

export type TimeEntryRow = {
  id: string;
  user_id: string;
  center_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  notes: string | null;
  created_at: string;
};

export type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  created_at: string;
};

export function computeCredentialStatus(expires_at: string | null): CredentialStatus {
  if (!expires_at) return 'no_expiration';
  const expiry = new Date(expires_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
  if (expiry < today) return 'expired';
  if (expiry <= thirtyDaysOut) return 'expiring_soon';
  return 'active';
}

// ── OCC 1206 staffing pattern ─────────────────────────────────────────────
//
// Times are 30-minute SLOT INDICES. Slot s covers the half-open interval
// [s*30min, (s+1)*30min): slot 0 = 00:00, slot 11 = 05:30, slot 24 = 12:00,
// slot 48 = 24:00. Paintable / child-count slots are 0..47; a center's
// close_slot may be 48 (midnight). A contiguous run of present slots renders
// as one bar; gaps between runs are breaks.

export const SLOTS_PER_DAY = 48;
export const SLOT_MINUTES = 30;

export const OPERATING_DAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

/** Format a slot index as a 12-hour clock label, e.g. 11 → "5:30 AM", 48 → "12:00 AM". */
export function slotToLabel(slot: number): string {
  const minutes = slot * SLOT_MINUTES;
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

/** Collapse a set of present slot indices into half-open [start, end) runs (bars). */
export function collapseRuns(slots: number[]): Array<{ start: number; end: number }> {
  if (slots.length === 0) return [];
  const sorted = [...new Set(slots)].sort((a, b) => a - b);
  const runs: Array<{ start: number; end: number }> = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i]!;
    if (s === prev + 1) {
      prev = s;
    } else {
      runs.push({ start, end: prev + 1 });
      start = s;
      prev = s;
    }
  }
  runs.push({ start, end: prev + 1 });
  return runs;
}

// OCC 1206 position codes (see the form legend):
// D = Director, TI = Teacher Infants/Toddlers, TP = Teacher Preschool,
// TS = Teacher School Age, ATS = Assistant Teacher School Age, A = Aide.
export type OccPositionCode = 'D' | 'TI' | 'TP' | 'TS' | 'ATS' | 'A';

export const OCC_POSITION_LABELS: Record<OccPositionCode, string> = {
  D: 'Director',
  TI: 'Teacher — Infants/Toddlers',
  TP: 'Teacher — Preschool',
  TS: 'Teacher — School Age',
  ATS: 'Assistant Teacher — School Age',
  A: 'Aide',
};

/** Default OCC position from a member's center role + the room's age group. Overridable per roster row. */
export function deriveOccPosition(role: CenterRole, ageGroup: AgeGroup): OccPositionCode {
  if (role === 'director' || role === 'admin') return 'D';
  if (role === 'lead_teacher') {
    if (ageGroup === 'infant' || ageGroup === 'toddler') return 'TI';
    if (ageGroup === 'school_age') return 'TS';
    return 'TP'; // two_year, preschool
  }
  if (role === 'assistant_teacher') {
    return ageGroup === 'school_age' ? 'ATS' : 'A';
  }
  return 'A'; // aide, substitute
}

export type ClassroomStaffRow = {
  id: string;
  classroom_id: string;
  user_id: string | null;
  staff_name: string | null;
  position_code: OccPositionCode | null;
  sort_order: number;
  created_at: string;
};

export type StaffShiftSlotRow = {
  id: string;
  classroom_staff_id: string;
  day_of_week: number;
  slot: number;
};

export type ClassroomChildCountRow = {
  id: string;
  classroom_id: string;
  day_of_week: number;
  slot: number;
  total_children: number;
};

/** One Y-axis row of the pattern: a staff member plus their presence slots per day. */
export type StaffingRosterEntry = {
  id: string; // classroom_staff.id
  userId: string | null;
  displayName: string;
  positionCode: OccPositionCode; // resolved (override ?? derived)
  positionOverride: OccPositionCode | null;
  sortOrder: number;
  slotsByDay: Record<number, number[]>; // day_of_week -> present slot indices
};

// ── Children domain ────────────────────────────────────────────────────────

export type ChildRow = {
  id: string;
  center_id: string;
  classroom_id: string | null;
  first_name: string;
  last_name: string;
  birthdate: string;
  enrolled_at: string;
  status: 'enrolled' | 'withdrawn';
  created_at: string;
  deleted_at: string | null;
};

export type ChildAttendanceRow = {
  id: string;
  child_id: string;
  classroom_id: string;
  attendance_date: string;
  signed_in_at: string | null;
  signed_out_at: string | null;
  created_at: string;
};

export type UpdateType = 'meal' | 'nap' | 'milestone' | 'incident';

export type ChildUpdateRow = {
  id: string;
  classroom_id: string;
  author_id: string | null;
  update_type: UpdateType;
  body: string;
  created_at: string;
};

export const UPDATE_TYPE_LABELS: Record<UpdateType, string> = {
  meal: 'Meal',
  nap: 'Nap',
  milestone: 'Milestone',
  incident: 'Incident',
};

/** Chip classes for care-update types (matches the activity-feed screenshots). */
export const UPDATE_TYPE_CHIP: Record<UpdateType, string> = {
  meal: 'bg-green-50 text-green-700',
  nap: 'bg-indigo-50 text-indigo-700',
  milestone: 'bg-amber-50 text-amber-700',
  incident: 'bg-red-50 text-red-700',
};

/** "Amara J." — first name + last initial. */
export function childDisplayName(child: { first_name: string; last_name: string }): string {
  const initial = child.last_name ? `${child.last_name[0]}.` : '';
  return `${child.first_name} ${initial}`.trim();
}

// COMAR age bands (months → age group). Thresholds are best-effort MD values —
// confirm against current regulation. A birthday alert fires when a child will
// cross one of these boundaries within 14 days.
export const COMAR_AGE_BANDS: { minMonths: number; group: AgeGroup }[] = [
  { minMonths: 0, group: 'infant' },
  { minMonths: 12, group: 'toddler' },
  { minMonths: 24, group: 'two_year' },
  { minMonths: 36, group: 'preschool' },
  { minMonths: 60, group: 'school_age' },
];

function parseDate(d: string): Date {
  return new Date(`${d}T00:00:00`);
}

export function ageInMonths(birthdate: string, asOf: Date = new Date()): number {
  const b = parseDate(birthdate);
  let months = (asOf.getFullYear() - b.getFullYear()) * 12 + (asOf.getMonth() - b.getMonth());
  if (asOf.getDate() < b.getDate()) months--;
  return Math.max(0, months);
}

export function formatAgeMonths(months: number, style: 'short' | 'long' = 'long'): string {
  if (style === 'short') return `${months} mo`;
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

export function comarGroupForMonths(months: number): AgeGroup {
  let group: AgeGroup = 'infant';
  for (const band of COMAR_AGE_BANDS) if (months >= band.minMonths) group = band.group;
  return group;
}

/** Whole days from asOf (date-only) to a YYYY-MM-DD date. Negative if in the past. */
export function daysUntil(dateStr: string, asOf: Date = new Date()): number {
  const target = parseDate(dateStr);
  const base = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

/** The next date this child crosses into a new COMAR age group, or null if already oldest band. */
export function nextComarBoundary(
  birthdate: string,
  asOf: Date = new Date()
): { date: string; fromGroup: AgeGroup; toGroup: AgeGroup } | null {
  const months = ageInMonths(birthdate, asOf);
  const current = comarGroupForMonths(months);
  const next = COMAR_AGE_BANDS.find((b) => b.minMonths > months);
  if (!next) return null;
  const d = parseDate(birthdate);
  d.setMonth(d.getMonth() + next.minMonths);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { date, fromGroup: current, toGroup: next.group };
}

// ── Staff profile ──────────────────────────────────────────────────────────

export type NoteCategory = 'general' | 'hr' | 'performance_review' | 'commendation' | 'incident';

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: 'General',
  hr: 'HR',
  performance_review: 'Performance review',
  commendation: 'Commendation',
  incident: 'Incident',
};

export const NOTE_CATEGORY_CHIP: Record<NoteCategory, string> = {
  general: 'bg-gray-100 text-gray-600',
  hr: 'bg-blue-50 text-blue-700',
  performance_review: 'bg-purple-50 text-purple-700',
  commendation: 'bg-green-50 text-green-700',
  incident: 'bg-red-50 text-red-700',
};

export type AvailabilityStatus = 'full' | 'am' | 'pm' | 'none';

export const AVAILABILITY_CHIP: Record<AvailabilityStatus, string> = {
  full: 'bg-green-100 text-green-700 border-green-200',
  am: 'bg-amber-100 text-amber-700 border-amber-200',
  pm: 'bg-amber-100 text-amber-700 border-amber-200',
  none: 'bg-gray-50 text-gray-300 border-gray-200',
};

export type LeaveKind = 'pto' | 'sick' | 'personal' | 'unexcused';
export type StaffRequestType = 'schedule' | 'time_correction' | 'leave';
export type StaffRequestStatus = 'pending' | 'approved' | 'rejected';

export type StaffNoteRow = {
  id: string;
  user_id: string;
  center_id: string;
  written_by: string;
  content: string;
  category: NoteCategory;
  created_at: string;
};

export type TeacherScoreRow = {
  id: string;
  user_id: string;
  center_id: string;
  attendance_score: number;
  posting_score: number;
  lesson_plan_score: number;
  schedule_score: number;
  observation_score: number;
  center_score: number;
  teacher_visible_score: number | null;
  teacher_visible_as_of: string | null;
  computed_at: string;
};

export type StaffProfileRow = {
  id: string;
  user_id: string;
  center_id: string;
  personal_email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  availability: Record<string, AvailabilityStatus>;
  sick_hours: number;
  vacation_hours: number;
  personal_hours: number;
  updated_at: string;
};

export type StaffLeaveDayRow = {
  id: string;
  user_id: string;
  center_id: string;
  day: string;
  kind: LeaveKind;
  created_at: string;
};

export type StaffRequestRow = {
  id: string;
  user_id: string;
  center_id: string;
  type: StaffRequestType;
  status: StaffRequestStatus;
  for_date: string | null;
  time_entry_id: string | null;
  details: string | null;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
};

/** Everything the staffing-pattern grid (and future OCC 1206 PDF) needs for a classroom. */
export type ClassroomStaffingView = {
  classroomId: string;
  name: string;
  ageGroup: AgeGroup;
  licensedCapacity: number;
  typicalEnrollment: number;
  patternEffectiveDate: string | null;
  state: string;
  openSlot: number;
  closeSlot: number;
  operatingDays: number[];
  roster: StaffingRosterEntry[];
  childCountsByDay: Record<number, Record<number, number>>; // day -> slot -> total
};

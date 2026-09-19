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

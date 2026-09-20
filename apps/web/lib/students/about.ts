/**
 * "All About Me" descriptor groups for the student profile About card.
 * Keys are stable and must match the group_key values seeded into
 * student_descriptors (see apps/web/supabase/seed-elof.ts DEFAULT_DESCRIPTORS).
 * Labels are display-only.
 */
export const ABOUT_GROUPS = [
  { key: 'loves', label: 'Loves' },
  { key: 'comfort', label: 'Comfort & soothing' },
  { key: 'sleep', label: 'Naps & sleep' },
  { key: 'eating', label: 'Eating & food' },
  { key: 'friends', label: 'Friends & play' },
  { key: 'words', label: 'Words we use' },
  { key: 'dislikes', label: 'Dislikes & sensitivities' },
  { key: 'routines', label: 'Routines' },
  { key: 'family', label: 'Family & culture' },
] as const;

export type AboutGroupKey = (typeof ABOUT_GROUPS)[number]['key'];

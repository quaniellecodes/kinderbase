import 'server-only';

// Parent-facing presentation for ELOF domains + goals (docs/PARENT-DECISIONS.md §2).
// The framework stores clinical names/text; families get warm, plain-language labels.
// Keyed by the domain "family" (the code suffix after IT-/P-, e.g. IT-SE → SE) so one
// entry serves both the infant/toddler and preschool views.

export type DomainMeta = { name: string; subtitle: string; icon: string; colour: string };

export const DOMAIN_META: Record<string, DomainMeta> = {
  ATL: { name: 'Approaches to Learning', subtitle: 'Curiosity, attention, persistence', icon: '🔍', colour: '#D97706' },
  SE: { name: 'Social & Emotional', subtitle: 'Relationships, feelings, trust', icon: '💛', colour: '#DC2626' },
  LC: { name: 'Language & Communication', subtitle: 'Sounds, gestures, words', icon: '💬', colour: '#2563EB' },
  C: { name: 'Cognition', subtitle: 'Exploring, problem solving, memory', icon: '🧩', colour: '#7C3AED' },
  PMP: { name: 'Perceptual, Motor & Physical', subtitle: 'Movement, grasp, senses', icon: '🤸', colour: '#16A34A' },
  LIT: { name: 'Literacy', subtitle: 'Letters, sounds, print', icon: '📖', colour: '#4F46E5' },
  MATH: { name: 'Mathematics', subtitle: 'Numbers, shapes, patterns', icon: '🔢', colour: '#0D9488' },
  SCI: { name: 'Scientific Reasoning', subtitle: 'Observing, predicting, testing', icon: '🔬', colour: '#0284C7' },
};

/** The code suffix that keys DOMAIN_META: "IT-SE" → "SE", "P-MATH" → "MATH". */
export function domainFamily(code: string): string {
  const parts = code.split('-');
  return parts[parts.length - 1]!.trim();
}

export function domainMeta(code: string): DomainMeta {
  return DOMAIN_META[domainFamily(code)] ?? { name: code, subtitle: '', icon: '🌱', colour: '#6b7280' };
}

// Warm labels for the goals we surface to families. A goal not listed falls back to a
// trimmed form of its clinical text so the pill is never empty.
export const FRIENDLY_GOAL: Record<string, string> = {
  'IT-C 1': 'Uses senses and objects to explore',
  'IT-SE 1': 'Looks to a familiar adult for comfort and help',
  'IT-PMP 1': 'Moves body to reach something they want',
  'IT-PMP 2': 'Picks up small objects with thumb and finger',
  'IT-LC 1': 'Responds to their name and simple words',
  'P-LIT 1': 'Writes and recognizes letters',
  'P-MATH 1': 'Counts and compares small groups',
  'P-ATL 1': 'Manages big feelings with less help',
  'P-SE 1': 'Plays and solves problems with friends',
  'P-SCI 1': 'Observes, predicts, and tests ideas',
};

export function friendlyGoal(code: string | null | undefined, goalText?: string | null): string | null {
  if (code && FRIENDLY_GOAL[code]) return FRIENDLY_GOAL[code]!;
  if (!goalText) return null;
  // Fallback: first clause of the clinical text, "Child ..." stripped, trimmed short.
  const cleaned = goalText.replace(/^Child\s+/i, '').replace(/[.,;].*$/, '').trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : null;
}

import 'server-only';

// Parent-facing presentation for ELOF domains + goals (docs/PARENT-DECISIONS.md §2).
// The framework stores clinical names/text; families get warm, plain-language labels.
// Domain meta is keyed by the code "family" (suffix after IT-/P-, e.g. IT-SE → SE) so
// one entry serves both the infant/toddler and preschool views.

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

// Warm labels for the goals we surface to families — the "what teachers watch for"
// set (~2 per domain). A goal not listed falls back to a trimmed form of its clinical
// text so nothing is ever blank.
export const FRIENDLY_GOAL: Record<string, string> = {
  // Infant / toddler
  'IT-ATL 1': "Manages feelings with a grown-up's help",
  'IT-ATL 2': "Manages actions with a grown-up's help",
  'IT-SE 1': 'Looks to a familiar adult for comfort and help',
  'IT-SE 2': 'Warms up to other familiar grown-ups',
  'IT-LC 1': 'Responds to their name and simple words',
  'IT-LC 2': 'Uses sounds, gestures and words to communicate',
  'IT-C 1': 'Uses senses and objects to explore',
  'IT-C 2': 'Learns how things work by trying',
  'IT-PMP 1': 'Moves body to reach something they want',
  'IT-PMP 2': 'Picks up small objects with thumb and finger',
  // Preschool
  'P-ATL 1': 'Manages big feelings with less help',
  'P-ATL 2': 'Follows routines more independently',
  'P-SE 1': 'Plays and solves problems with friends',
  'P-SE 2': 'Cooperates and helps',
  'P-LC 1': 'Listens and responds in conversation',
  'P-LC 2': 'Understands longer directions and stories',
  'P-LIT 1': 'Writes and recognizes letters',
  'P-LIT 2': 'Knows how books and print work',
  'P-MATH 1': 'Counts and compares small groups',
  'P-MATH 2': 'Sees how many without counting',
  'P-PMP 1': 'Runs, climbs and balances',
  'P-PMP 2': 'Coordinates movements with what they see',
  'P-SCI 1': 'Observes, predicts, and tests ideas',
  'P-SCI 2': 'Talks about what they notice',
};

export function isParentGoal(code: string): boolean {
  return code in FRIENDLY_GOAL;
}

function shorten(text: string): string {
  const cleaned = text.replace(/^Child\s+/i, '').trim();
  // First sentence, else first clause, trimmed to a readable length.
  const firstSentence = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned;
  const clause = firstSentence.length > 70 ? (firstSentence.split(/[,;—]/)[0] ?? firstSentence) : firstSentence;
  const out = clause.replace(/[.\s]+$/, '').trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : text;
}

export function friendlyGoal(code: string | null | undefined, goalText?: string | null): string | null {
  if (code && FRIENDLY_GOAL[code]) return FRIENDLY_GOAL[code]!;
  if (!goalText) return null;
  return shorten(goalText);
}

/** A short, family-friendly step for a goal's progression descriptor ("how this grows"). */
export function shortStep(descriptor: string): string {
  return shorten(descriptor);
}

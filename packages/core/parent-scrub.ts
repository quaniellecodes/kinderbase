/**
 * Parent privacy scrub (docs/PARENT-DECISIONS.md §1).
 *
 * "Another child appearing in a photo is not a leak; another child's name is."
 * A note or caption a teacher wrote for the room can mention a second child by
 * name; before any of it reaches a family it must be redacted to the viewing
 * family. These are the pure pieces — the app-side wrapper assembles the name
 * sets from the DB and calls them (apps/web/lib/parent/scrub.ts).
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Redact each name in `names` from `text`, whole-word and case-insensitive, so a
 * sibling's first name never survives in a caption but a substring (e.g. "Max"
 * inside "maximum") is left alone. Pass only names that do NOT belong to the
 * viewing family — the caller never redacts the family's own child.
 */
export function redactNames(text: string | null | undefined, names: string[], replacement = 'a friend'): string {
  if (!text) return text ?? '';
  let out = text;
  // Longest first, so "Mary Jane" is redacted before "Mary".
  for (const raw of [...names].sort((a, b) => b.length - a.length)) {
    const n = raw.trim();
    if (n.length < 2) continue;
    out = out.replace(new RegExp(`\\b${escapeRegExp(n)}\\b`, 'gi'), replacement);
  }
  return out;
}

/** Keep only the items tagged to a child the viewer is allowed to see. */
export function ownTaggedOnly<T>(tagged: T[], childIdOf: (t: T) => string, allowed: Set<string>): T[] {
  return tagged.filter((t) => allowed.has(childIdOf(t)));
}

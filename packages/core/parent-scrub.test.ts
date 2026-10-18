import { describe, it, expect } from 'vitest';
import { redactNames, ownTaggedOnly } from './parent-scrub';

describe('redactNames', () => {
  it('redacts another child by first name, whole-word, case-insensitive', () => {
    expect(redactNames('Maya and Jordan napped 12:30–2', ['Jordan'])).toBe('Maya and a friend napped 12:30–2');
    expect(redactNames('jordan shared the blocks', ['Jordan'])).toBe('a friend shared the blocks');
  });

  it('leaves substrings alone (Max != maximum)', () => {
    expect(redactNames('reached maximum height', ['Max'])).toBe('reached maximum height');
    expect(redactNames('Max climbed high', ['Max'])).toBe('a friend climbed high');
  });

  it('never touches the viewing family name (caller passes only OTHERS)', () => {
    // Amara is the viewing child, so she is NOT in the redact list.
    expect(redactNames('Amara and Jordan built a tower', ['Jordan'])).toBe('Amara and a friend built a tower');
  });

  it('redacts multiple names, longest first', () => {
    expect(redactNames('Mary Jane and Mary played', ['Mary', 'Mary Jane'])).toBe('a friend and a friend played');
  });

  it('handles empty / null text', () => {
    expect(redactNames('', ['Jordan'])).toBe('');
    expect(redactNames(null, ['Jordan'])).toBe('');
    expect(redactNames(undefined, ['Jordan'])).toBe('');
  });

  it('ignores one-letter names (too risky to redact)', () => {
    expect(redactNames('A is for apple', ['A'])).toBe('A is for apple');
  });

  it('redacts a possessive and leaves punctuation', () => {
    expect(redactNames("Jordan's cup was next to Maya", ['Jordan'])).toBe("a friend's cup was next to Maya");
    expect(redactNames('Jordan, Maya, and Max played', ['Jordan', 'Max'])).toBe('a friend, Maya, and a friend played');
  });

  it('replaces every occurrence of a repeated name', () => {
    expect(redactNames('Jordan and Jordan again', ['Jordan'])).toBe('a friend and a friend again');
  });

  it('handles regex-special characters in a name (escaped)', () => {
    expect(redactNames("D'Angelo shared", ["D'Angelo"])).toBe('a friend shared');
    expect(redactNames('Mary-Kate waved', ['Mary-Kate'])).toBe('a friend waved');
  });

  it('honors a custom replacement', () => {
    expect(redactNames('Jordan napped', ['Jordan'], 'another child')).toBe('another child napped');
  });
});

describe('ownTaggedOnly edge cases', () => {
  const rows = [{ childId: 'a' }, { childId: 'b' }];
  it('empty allowed set → nothing', () => {
    expect(ownTaggedOnly(rows, (r) => r.childId, new Set())).toEqual([]);
  });
  it('empty input → empty', () => {
    expect(ownTaggedOnly([], (r: { childId: string }) => r.childId, new Set(['a']))).toEqual([]);
  });
  it('allowed id not present → nothing kept', () => {
    expect(ownTaggedOnly(rows, (r) => r.childId, new Set(['zzz']))).toEqual([]);
  });
});

describe('ownTaggedOnly', () => {
  it('keeps only tags for allowed children', () => {
    const tagged = [{ childId: 'a', name: 'Amara' }, { childId: 'b', name: 'Jordan' }, { childId: 'c', name: 'Maya' }];
    const out = ownTaggedOnly(tagged, (t) => t.childId, new Set(['a']));
    expect(out).toEqual([{ childId: 'a', name: 'Amara' }]);
  });
});

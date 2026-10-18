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
});

describe('ownTaggedOnly', () => {
  it('keeps only tags for allowed children', () => {
    const tagged = [{ childId: 'a', name: 'Amara' }, { childId: 'b', name: 'Jordan' }, { childId: 'c', name: 'Maya' }];
    const out = ownTaggedOnly(tagged, (t) => t.childId, new Set(['a']));
    expect(out).toEqual([{ childId: 'a', name: 'Amara' }]);
  });
});

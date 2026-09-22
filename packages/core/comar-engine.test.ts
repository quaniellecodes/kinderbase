import { describe, it, expect } from 'vitest';
import {
  bandFor,
  evaluate,
  canStepOut,
  nextAgeTransition,
  suggestAgeMixFix,
  type Child,
  type Staff,
  type RoomInput,
} from './comar-engine';

const AT = new Date('2026-09-26T09:00:00');

function dobMonths(months: number, at = AT): Date {
  const d = new Date(at);
  d.setMonth(d.getMonth() - months);
  return d;
}
function dobDays(days: number, at = AT): Date {
  return new Date(at.getTime() - days * 86_400_000);
}
function kids(monthsArr: number[], at = AT): Child[] {
  return monthsArr.map((m, i) => ({ id: `k${i}`, dob: dobMonths(m, at) }));
}
const lead = (id: string): Staff => ({ id, leadQualified: true, infantToddlerTrained: true });
const leadNoIT = (id: string): Staff => ({ id, leadQualified: true, infantToddlerTrained: false });
const aide = (id: string): Staff => ({ id, leadQualified: false, infantToddlerTrained: false });
function room(children: Child[], staff: Staff[], napState: RoomInput['napState'] = 'awake'): RoomInput {
  return { children, staff, napState, at: AT };
}
const ruleOf = (monthsArr: number[]) => evaluate(room(kids(monthsArr), [])).rule;

describe('bands', () => {
  it('1. cutoffs at 18/24/36/60 months', () => {
    expect(bandFor(dobMonths(17), AT)).toBe('infant');
    expect(bandFor(dobMonths(18), AT)).toBe('toddler');
    expect(bandFor(dobMonths(24), AT)).toBe('two');
    expect(bandFor(dobMonths(36), AT)).toBe('preschool');
    expect(bandFor(dobMonths(60), AT)).toBe('school');
  });
  it('2. six weeks old is an infant', () => {
    expect(bandFor(dobDays(42), AT)).toBe('infant');
  });
});

describe('same-age tables (§C)', () => {
  it('3. 6 infants → 1:3, max 6, min 2', () => {
    const r = ruleOf(Array(6).fill(10));
    expect(r.ratio).toBe(3);
    expect(r.maxGroup).toBe(6);
    expect(r.minStaff).toBe(2);
  });
  it('4. 9 toddlers → max 9, min 3', () => {
    const r = ruleOf(Array(9).fill(20));
    expect(r.maxGroup).toBe(9);
    expect(r.minStaff).toBe(3);
  });
  it('5. 2 infants + 7 toddlers → max 9', () => {
    expect(ruleOf([10, 10, 20, 20, 20, 20, 20, 20, 20]).maxGroup).toBe(9);
  });
  it('6. 3 infants + 3 toddlers → max 6', () => {
    expect(ruleOf([10, 10, 10, 20, 20, 20]).maxGroup).toBe(6);
  });
  it('7. 12 twos → 1:6, min 2', () => {
    const r = ruleOf(Array(12).fill(28));
    expect(r.ratio).toBe(6);
    expect(r.minStaff).toBe(2);
  });
  it('8. 20 preschoolers → 1:10, min 2', () => {
    const r = ruleOf(Array(20).fill(48));
    expect(r.ratio).toBe(10);
    expect(r.minStaff).toBe(2);
  });
  it('9. 30 school-age → 1:15, min 2', () => {
    const r = ruleOf(Array(30).fill(72));
    expect(r.ratio).toBe(15);
    expect(r.minStaff).toBe(2);
  });
});

describe('mixed (§D)', () => {
  it('10. 4 toddlers + 2 twos → §D(1), max 9, min 3', () => {
    const r = ruleOf([20, 20, 20, 20, 28, 28]);
    expect(r.ratio).toBeNull();
    expect(r.maxGroup).toBe(9);
    expect(r.minStaff).toBe(3);
  });
  it('11. 3 toddlers + 3 twos → min 2', () => {
    expect(ruleOf([20, 20, 20, 28, 28, 28]).minStaff).toBe(2);
  });
  it('12. 1 toddler + 6 twos → max 12, min 3', () => {
    const r = ruleOf([20, 28, 28, 28, 28, 28, 28]);
    expect(r.maxGroup).toBe(12);
    expect(r.minStaff).toBe(3);
  });
  it('13. 13 preschoolers + 7 twos → max-twos 6, size fails', () => {
    const r = room([...kids(Array(13).fill(48)), ...kids(Array(7).fill(28))], [lead('a'), lead('b')]);
    const e = evaluate(r);
    expect(e.rule.maxTwos).toBe(6);
    expect(e.checks.find((c) => c.key === 'size')!.pass).toBe(false);
  });
});

describe('lead', () => {
  it('14. aide alone with toddlers → lead check fails', () => {
    const e = evaluate(room(kids([20, 20, 20]), [aide('x')]));
    expect(e.checks.find((c) => c.key === 'lead')!.pass).toBe(false);
    expect(e.ok).toBe(false);
  });
  it('15. three aides with 9 infants → lead fails though count passes', () => {
    const e = evaluate(room(kids(Array(9).fill(10)), [aide('a'), aide('b'), aide('c')]));
    expect(e.checks.find((c) => c.key === 'staff')!.pass).toBe(true);
    expect(e.checks.find((c) => c.key === 'lead')!.pass).toBe(false);
  });
  it('16. one lead + two aides with 9 infants → staff + lead checks pass', () => {
    // (9 infants is over the size-6 max group; tests 15/16 isolate the lead rule)
    const e = evaluate(room(kids(Array(9).fill(10)), [lead('l'), aide('a'), aide('b')]));
    expect(e.checks.find((c) => c.key === 'staff')!.pass).toBe(true);
    expect(e.checks.find((c) => c.key === 'lead')!.pass).toBe(true);
  });
  it('17. lead-qualified but not infant/toddler trained, in an infant room → counts as Aide', () => {
    const e = evaluate(room(kids([10, 10, 10]), [leadNoIT('l')]));
    expect(e.leadsPresent).toHaveLength(0);
    expect(e.checks.find((c) => c.key === 'lead')!.pass).toBe(false);
  });
});

describe('nap & breaks', () => {
  it('18. 4 infants, lead + aide, resting → required stays 2; lead cannot step out', () => {
    const r = room(kids(Array(4).fill(10)), [lead('l'), aide('a')], 'resting');
    expect(evaluate(r).requiredNow).toBe(2);
    expect(canStepOut(r, 'l').allowed).toBe(false);
  });
  it('19. 4 toddlers + 2 twos, resting → no reduction (youngest governs)', () => {
    const r = room([...kids(Array(4).fill(20)), ...kids(Array(2).fill(28))], [lead('l'), lead('m'), aide('a')], 'resting');
    expect(evaluate(r).requiredNow).toBe(3);
  });
  it('20. 18 preschoolers, 2 leads, settling → neither can step out', () => {
    const r = room(kids(Array(18).fill(48)), [lead('l'), lead('m')], 'settling');
    expect(canStepOut(r, 'l').allowed).toBe(false);
    expect(canStepOut(r, 'm').allowed).toBe(false);
  });
  it('21. same room resting → one may step out; the last may not', () => {
    const two = room(kids(Array(18).fill(48)), [lead('l'), lead('m')], 'resting');
    expect(canStepOut(two, 'l').allowed).toBe(true);
    const one = room(kids(Array(18).fill(48)), [lead('l')], 'resting');
    expect(canStepOut(one, 'l').allowed).toBe(false);
  });
  it('22. back to awake with one on break → status out', () => {
    const e = evaluate(room(kids(Array(18).fill(48)), [lead('l')], 'awake'));
    expect(e.status).toBe('out');
  });
  it('23. blocked-break reasons name remaining staff and their roles', () => {
    const r = room(kids(Array(4).fill(10)), [lead('l'), aide('andre')], 'awake');
    const reasons = canStepOut(r, 'l').reasons;
    expect(reasons.some((x) => x.includes('Aide') && x.includes('andre'))).toBe(true);
  });
});

describe('projection & fix', () => {
  it('24. toddler 11 days from 24 months → nextAgeTransition, after.minStaff 2', () => {
    const turning = { id: 'turner', dob: (() => { const d = dobMonths(24); d.setDate(d.getDate() + 11); return d; })() };
    const r = room([turning, ...kids([20, 20, 20]), ...kids(Array(2).fill(28))], []);
    const t = nextAgeTransition(r);
    expect(t?.childId).toBe('turner');
    expect(t?.to).toBe('two');
    expect(t?.after.minStaff).toBe(2);
  });
  it('25. suggestAgeMixFix moves the twos to a compliant 3–4 room', () => {
    const source = room([...kids(Array(4).fill(20)), ...kids(Array(2).fill(28))], [lead('l')]);
    const others = { C: room(kids(Array(18).fill(48)), [lead('a'), lead('b')]) };
    const fix = suggestAgeMixFix(source, others);
    expect(fix?.to).toBe('C');
    expect(fix?.move).toHaveLength(2);
    expect(fix?.minStaffBefore).toBe(3);
    expect(fix?.minStaffAfter).toBe(2);
  });
  it('26. suggestAgeMixFix returns null when no room can take them', () => {
    const source = room([...kids(Array(4).fill(20)), ...kids(Array(2).fill(28))], [lead('l')]);
    const others = { C: room(kids(Array(20).fill(48)), [lead('a'), lead('b')]) }; // already at max 20
    expect(suggestAgeMixFix(source, others)).toBeNull();
  });
});

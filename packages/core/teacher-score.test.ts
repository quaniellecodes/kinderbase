import { describe, it, expect } from 'vitest';
import { SCORE_SIGNALS, computeCenterScore, toStars, signalExplanation } from './teacher-score';

describe('SCORE_SIGNALS', () => {
  it('weights sum to 1', () => {
    const total = SCORE_SIGNALS.reduce((s, x) => s + x.weight, 0);
    expect(Math.round(total * 100) / 100).toBe(1);
  });
});

describe('computeCenterScore', () => {
  it('weights the sub-scores (matches the mock: 4.2)', () => {
    // Attendance 4.7, Posts 3.2, Lesson 5.0, Schedule 4.5, Observations 4.0
    const score = computeCenterScore({
      attendance_score: 4.7,
      posting_score: 3.2,
      lesson_plan_score: 5.0,
      schedule_score: 4.5,
      observation_score: 4.0,
    });
    expect(score).toBeCloseTo(4.24, 1);
  });
});

describe('toStars', () => {
  it('splits a score into full/half/empty', () => {
    expect(toStars(4.2)).toEqual({ full: 4, half: false, empty: 1 });
    expect(toStars(4.5)).toEqual({ full: 4, half: true, empty: 0 });
    expect(toStars(3.8)).toEqual({ full: 4, half: false, empty: 1 });
    expect(toStars(0)).toEqual({ full: 0, half: false, empty: 5 });
    expect(toStars(5)).toEqual({ full: 5, half: false, empty: 0 });
  });
});

describe('signalExplanation', () => {
  it('employee posting line names the target', () => {
    expect(signalExplanation('posting', 3.2, true)).toContain('Target: 2+');
  });
  it('attendance uses the provided percentage', () => {
    expect(signalExplanation('attendance', 4.7, false, { attendancePct: 94 })).toContain('94%');
  });
});

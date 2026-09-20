// Teacher quality score — DISPLAY ONLY this session. The nightly computation
// that populates teacher_scores lands in Session 9; here we render the row and
// explain the weighting. Weights match the score-breakdown mock.

export type ScoreSignalKey = 'attendance' | 'posting' | 'lesson_plan' | 'schedule' | 'observation';

export type TeacherScoreInput = {
  attendance_score: number;
  posting_score: number;
  lesson_plan_score: number;
  schedule_score: number;
  observation_score: number;
};

export const SCORE_SIGNALS: {
  key: ScoreSignalKey;
  field: keyof TeacherScoreInput;
  label: string;
  weight: number; // fraction (sums to 1)
}[] = [
  { key: 'attendance', field: 'attendance_score', label: 'Attendance', weight: 0.30 },
  { key: 'posting', field: 'posting_score', label: 'Activity posts', weight: 0.25 },
  { key: 'lesson_plan', field: 'lesson_plan_score', label: 'Lesson plans', weight: 0.20 },
  { key: 'schedule', field: 'schedule_score', label: 'Schedule adherence', weight: 0.15 },
  { key: 'observation', field: 'observation_score', label: 'Observations', weight: 0.10 },
];

/** Weighted center score (0–5) from the five sub-scores. */
export function computeCenterScore(input: TeacherScoreInput): number {
  const total = SCORE_SIGNALS.reduce((sum, s) => sum + input[s.field] * s.weight, 0);
  return Math.round(total * 100) / 100;
}

/** Split a 0–5 score into filled / half / empty stars (5 total). */
export function toStars(score: number): { full: number; half: boolean; empty: number } {
  const clamped = Math.max(0, Math.min(5, score));
  const whole = Math.floor(clamped);
  const frac = clamped - whole;
  const half = frac >= 0.25 && frac < 0.75;
  const roundUp = frac >= 0.75 ? 1 : 0;
  const full = whole + roundUp;
  return { full, half, empty: 5 - full - (half ? 1 : 0) };
}

/**
 * One-line explanation for a signal. Admin phrasing is descriptive; employee
 * phrasing adds a target benchmark and never references the admin override.
 */
export function signalExplanation(
  key: ScoreSignalKey,
  score: number,
  forEmployee: boolean,
  ctx?: { attendancePct?: number }
): string {
  switch (key) {
    case 'attendance': {
      const pct = ctx?.attendancePct != null ? `${ctx.attendancePct}% ` : '';
      return forEmployee
        ? `You've been present ${pct}of scheduled days · rolling 90 days`
        : `Present ${pct}of scheduled days · rolling 90 days`;
    }
    case 'posting':
      return forEmployee
        ? 'Avg posts per child/week. Target: 2+'
        : 'Care updates posted per child, per week';
    case 'lesson_plan':
      return score >= 4.5
        ? 'All lesson plans submitted on time'
        : 'Lesson plans submitted on time';
    case 'schedule':
      return forEmployee
        ? 'Last-minute schedule changes this period. Fewer is better'
        : 'Last-minute schedule changes this period';
    case 'observation':
      return 'Average across admin observations this quarter';
  }
}

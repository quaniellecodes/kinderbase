import { describe, it, expect } from 'vitest';
import { computeRatio } from './staffing-engine';

describe('computeRatio — MD rules', () => {
  it('infant: 3 children, 1 staff → warning (exactly at ratio)', () => {
    const r = computeRatio('infant', 3, 1, 'MD');
    expect(r.status).toBe('warning');
    expect(r.requiredStaff).toBe(1);
  });

  it('infant: 3 children, 2 staff → ok (buffer)', () => {
    const r = computeRatio('infant', 3, 2, 'MD');
    expect(r.status).toBe('ok');
  });

  it('infant: 4 children, 1 staff → violation (needs 2)', () => {
    const r = computeRatio('infant', 4, 1, 'MD');
    expect(r.status).toBe('violation');
    expect(r.requiredStaff).toBe(2);
  });

  it('infant: 7 children → violation (over max group size 6)', () => {
    const r = computeRatio('infant', 7, 3, 'MD');
    expect(r.status).toBe('violation');
    expect(r.overCapacity).toBe(true);
  });

  it('preschool: 10 children, 1 staff → warning', () => {
    const r = computeRatio('preschool', 10, 1, 'MD');
    expect(r.status).toBe('warning');
    expect(r.requiredStaff).toBe(1);
  });

  it('preschool: 11 children, 1 staff → violation', () => {
    const r = computeRatio('preschool', 11, 1, 'MD');
    expect(r.status).toBe('violation');
    expect(r.requiredStaff).toBe(2);
  });

  it('preschool: 21 children → violation (over max group 20)', () => {
    const r = computeRatio('preschool', 21, 3, 'MD');
    expect(r.overCapacity).toBe(true);
    expect(r.status).toBe('violation');
  });

  it('0 children, 0 staff → ok', () => {
    const r = computeRatio('toddler', 0, 0, 'MD');
    expect(r.status).toBe('ok');
    expect(r.requiredStaff).toBe(0);
  });

  it('unknown state falls back to MD rules', () => {
    const md = computeRatio('preschool', 10, 1, 'MD');
    const unknown = computeRatio('preschool', 10, 1, 'XX');
    expect(md.status).toBe(unknown.status);
    expect(md.requiredStaff).toBe(unknown.requiredStaff);
  });
});

import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isDemo } from '@/lib/demo';

// Access gate for the partner-facing /demo (docs/sessions/06 §6). A viewer must
// pass a passcode or a signed invite link; success sets a 7-day httpOnly cookie.
// The cookie value is itself HMAC-signed so it can't be forged client-side.

const GATE_COOKIE = 'kb_demo_gate';
const GATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
  // A dedicated secret is required in real deploys; local dev falls back so the
  // gate still functions. assertNotProd() elsewhere keeps this off production.
  return process.env.DEMO_INVITE_SECRET ?? process.env.DEMO_PASSCODE ?? 'kinderbase-demo';
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Mint the signed gate-cookie value (`<expiry>.<sig>`). */
export function mintGateToken(now: number): string {
  const exp = String(now + GATE_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

function tokenValid(token: string | undefined, now: number): boolean {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < now) return false;
  return safeEqual(sig, sign(exp));
}

/** True if the current request carries a valid, unexpired gate cookie. */
export function hasValidGate(now = Date.now()): boolean {
  return tokenValid(cookies().get(GATE_COOKIE)?.value, now);
}

/** Check a submitted passcode against DEMO_PASSCODE (default for local dev). */
export function checkPasscode(input: string): boolean {
  const expected = process.env.DEMO_PASSCODE ?? 'kinderbase';
  return !!input && safeEqual(input.trim(), expected);
}

/**
 * Validate a signed invite token from `/demo?invite=<token>`. Format:
 * `<expiryMs>.<hmac(expiryMs)>`. Same HMAC secret as the gate cookie.
 */
export function checkInvite(token: string, now = Date.now()): boolean {
  return tokenValid(token, now);
}

/** Generate an invite token (used by tooling to hand out links). */
export function mintInvite(ttlMs = GATE_TTL_MS, now = Date.now()): string {
  const exp = String(now + ttlMs);
  return `${exp}.${sign(exp)}`;
}

export const GATE_COOKIE_NAME = GATE_COOKIE;
export const GATE_MAX_AGE_SECONDS = GATE_TTL_MS / 1000;

/** Set the gate cookie on the current response (call from a Route Handler). */
export function setGateCookie(): void {
  if (!isDemo()) return;
  cookies().set(GATE_COOKIE, mintGateToken(Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GATE_MAX_AGE_SECONDS,
    path: '/',
  });
}

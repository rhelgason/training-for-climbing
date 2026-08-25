/**
 * Authentication helpers for the API routes: password hashing (bcrypt) and
 * signed session tokens (JWT). One account = one private snapshot.
 *
 * Ported from the standalone Express server (`server/auth.js`) when the backend
 * moved into Next route handlers. The signing secret and password hashes are
 * unchanged, so credentials issued by the old deployment stay valid.
 *
 * The token's identity claim moved from `email` to `username` when accounts
 * stopped being keyed by email. That's safe for tokens already in the wild:
 * `userIdFromRequest` authorizes on `sub` alone and nothing reads the identity
 * claim, so a year-old token keeps working and nobody is signed out.
 *
 * Env:
 *   JWT_SECRET  – secret used to sign session tokens. Falls back to SYNC_TOKEN
 *                 so an existing deployment keeps working without a new variable.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';

// Long-lived tokens — this is a personal app, not a high-security service.
const TOKEN_TTL = '365d';
const BCRYPT_ROUNDS = 10;
export const MIN_PASSWORD_LENGTH = 8;

export interface SessionUser {
  id: string;
  username: string;
}

/**
 * Read the signing secret at call time rather than module load: serverless
 * bundles are evaluated before request env is guaranteed, and tests set it
 * per-case.
 */
function secret(): string {
  return process.env.JWT_SECRET || process.env.SYNC_TOKEN || '';
}

/** Whether a signing secret is available (else auth endpoints can't work). */
export function isAuthConfigured(): boolean {
  return Boolean(secret());
}

export function normalizeUsername(username: unknown): string {
  return String(username || '')
    .trim()
    .toLowerCase();
}

/**
 * Deliberately narrow: lowercase letters, digits, underscore and hyphen. No '@'
 * or '.', which keeps usernames disjoint from email addresses — `login` accepts
 * either, so the two namespaces must never overlap.
 */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]{3,30}$/.test(username);
}

/**
 * Email is optional, so absent and empty both mean "no address" — and must
 * become SQL NULL rather than '', or the second account without an email would
 * collide on the UNIQUE index.
 */
export function normalizeOptionalEmail(email: unknown): string | null {
  const normalized = String(email ?? '')
    .trim()
    .toLowerCase();
  return normalized || null;
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function isValidPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: SessionUser): string {
  return jwt.sign({ sub: user.id, username: user.username }, secret(), { expiresIn: TOKEN_TTL });
}

/** Returns the decoded payload, or null if the token is missing/invalid/expired. */
export function verifyToken(token: string): JwtPayload | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret());
    return typeof payload === 'string' ? null : payload;
  } catch {
    return null;
  }
}

export function newUserId(): string {
  return crypto.randomUUID();
}

/**
 * Resolve the Bearer token on `req` to a user id, or null when the header is
 * missing/invalid. Callers turn null into a 401.
 */
export function userIdFromRequest(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token);
  const sub = payload?.sub;
  return typeof sub === 'string' && sub ? sub : null;
}

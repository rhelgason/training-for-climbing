/**
 * Authentication helpers for the sync server: password hashing (bcrypt) and
 * signed session tokens (JWT). One account = one private snapshot.
 *
 * Env:
 *   JWT_SECRET  – secret used to sign session tokens. Falls back to SYNC_TOKEN
 *                 so an existing deployment keeps working without a new variable.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || process.env.SYNC_TOKEN || '';
// Long-lived tokens — this is a personal app, not a high-security service.
const TOKEN_TTL = '365d';
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

/** Whether a signing secret is available (else auth endpoints can't work). */
function isAuthConfigured() {
  return Boolean(SECRET);
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: TOKEN_TTL });
}

/** Returns the decoded payload, or null if the token is missing/invalid/expired. */
function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function newUserId() {
  return crypto.randomUUID();
}

// Recovery code: human-readable, unambiguous (no 0/O/1/I), grouped for legibility.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generate a one-time recovery code like "K7QM-2XFD-9WRP-J4TB". */
function generateRecoveryCode() {
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i += 1) {
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
    if (i % 4 === 3 && i !== 15) out += '-';
  }
  return out;
}

/** Normalise user-entered codes: uppercase, strip spaces/dashes for comparison. */
function normalizeRecoveryCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function hashRecoveryCode(code) {
  return bcrypt.hash(normalizeRecoveryCode(code), BCRYPT_ROUNDS);
}

function verifyRecoveryCode(code, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(normalizeRecoveryCode(code), hash);
}

module.exports = {
  isAuthConfigured,
  normalizeEmail,
  isValidEmail,
  isValidPassword,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  newUserId,
  generateRecoveryCode,
  normalizeRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
  MIN_PASSWORD_LENGTH,
};

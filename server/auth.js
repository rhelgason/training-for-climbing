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
  MIN_PASSWORD_LENGTH,
};

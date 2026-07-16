/**
 * Transactional email for password-reset codes. Provider-agnostic: uses whichever
 * key is set — Resend (RESEND_API_KEY) or Brevo (BREVO_API_KEY). Both have free
 * tiers. Brevo needs no custom domain (just a verified sender); Resend needs a
 * verified domain to email arbitrary recipients.
 *
 * Env:
 *   RESEND_API_KEY  – enables Resend
 *   BREVO_API_KEY   – enables Brevo
 *   EMAIL_FROM      – sender, e.g. "Training for Climbing <you@example.com>"
 *                     (Resend defaults to onboarding@resend.dev if unset)
 */
const RESET_TTL_MIN = 30;

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY);
}

/** Parse "Name <email>" or "email" into { name, email }. */
function parseFrom(value, fallbackEmail) {
  const raw = String(value || '').trim();
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || 'Training for Climbing', email: m[2] };
  if (raw.includes('@')) return { name: 'Training for Climbing', email: raw };
  return { name: 'Training for Climbing', email: fallbackEmail };
}

function content(code) {
  return {
    subject: 'Your password reset code',
    text: `Your Training for Climbing password reset code is ${code}. It expires in ${RESET_TTL_MIN} minutes. If you didn't request this, ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5">
      <p>Your password reset code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
      <p style="color:#666">It expires in ${RESET_TTL_MIN} minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>`,
  };
}

async function sendViaResend(to, code) {
  const from = process.env.EMAIL_FROM || 'Training for Climbing <onboarding@resend.dev>';
  const { subject, text, html } = content(code);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend failed (HTTP ${res.status}): ${await res.text()}`);
}

async function sendViaBrevo(to, code) {
  const sender = parseFrom(process.env.EMAIL_FROM, 'no-reply@example.com');
  const { subject, text, html } = content(code);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo failed (HTTP ${res.status}): ${await res.text()}`);
}

/** Send a reset code. Throws if no provider is configured or the send fails. */
async function sendResetEmail(to, code) {
  if (process.env.RESEND_API_KEY) return sendViaResend(to, code);
  if (process.env.BREVO_API_KEY) return sendViaBrevo(to, code);
  throw new Error('no email provider configured');
}

module.exports = { isEmailConfigured, sendResetEmail, RESET_TTL_MIN };

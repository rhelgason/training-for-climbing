/**
 * Numeric/string design tokens for use in TSX where CSS classes don't fit —
 * e.g. inline SVG charts. Mirrors packages/core's mobile theme so the two apps
 * stay visually identical. Keep in sync with app/globals.css.
 */
import type { TriadArea } from '@tfc/core';

export const colors = {
  background: '#0f1115',
  surface: '#1a1d24',
  surfaceAlt: '#232730',
  border: '#2e333d',
  text: '#f5f7fa',
  textMuted: '#9aa3b2',
  primary: '#4f8cff',
  primaryText: '#ffffff',
  success: '#3ec07b',
  warning: '#f5a623',
  danger: '#ef5350',
} as const;

export const triadColors: Record<TriadArea, string> = {
  mental: '#a78bfa',
  technical: '#4f8cff',
  physical: '#3ec07b',
};

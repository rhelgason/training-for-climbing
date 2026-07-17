import { type TriadArea } from '@tfc/core';
/** Lightweight design tokens shared across the app. */

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
};

/** Distinct accent per triad area, used in charts and labels. */
export const triadColors: Record<TriadArea, string> = {
  mental: '#a78bfa',
  technical: '#4f8cff',
  physical: '#3ec07b',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

export const fontSize = {
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
};

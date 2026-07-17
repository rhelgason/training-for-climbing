import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TriadScores } from '@tfc/core';
import { TriadBars } from './TriadBars';

const scores: TriadScores = { mental: 30, technical: 45, physical: 20 };
const maxPerArea: TriadScores = { mental: 50, technical: 50, physical: 50 };

describe('TriadBars', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the three triad labels', () => {
    render(<TriadBars scores={scores} maxPerArea={maxPerArea} />);
    expect(screen.getByText('Mental')).toBeInTheDocument();
    expect(screen.getByText('Technical')).toBeInTheDocument();
    expect(screen.getByText('Physical')).toBeInTheDocument();
  });

  it('renders each score as value/max', () => {
    render(<TriadBars scores={scores} maxPerArea={maxPerArea} />);
    expect(screen.getByText('30/50')).toBeInTheDocument();
    expect(screen.getByText('45/50')).toBeInTheDocument();
    expect(screen.getByText('20/50')).toBeInTheDocument();
  });

  it('marks the weakest area', () => {
    render(<TriadBars scores={scores} maxPerArea={maxPerArea} weakestArea="physical" />);
    expect(screen.getByText(/weakest/)).toBeInTheDocument();
  });
});

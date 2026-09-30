import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClimbRecord } from '@tfc/core';
import { PersonalBests } from './PersonalBests';

afterEach(cleanup);

function climb(partial: Partial<ClimbRecord> & Pick<ClimbRecord, 'id' | 'grade'>): ClimbRecord {
  return {
    createdAt: 0,
    updatedAt: 0,
    date: Date.UTC(2026, 8, 12),
    environment: 'indoor',
    discipline: 'boulder',
    outcome: 'send',
    ...partial,
  };
}

describe('PersonalBests', () => {
  it('asks for a send when there are none', () => {
    render(<PersonalBests climbs={[]} />);
    expect(screen.getByText(/log a send/i)).toBeInTheDocument();
  });

  it('shows indoor and outdoor in one card and skips an empty discipline', () => {
    render(
      <PersonalBests
        climbs={[
          climb({ id: 'gym', grade: 'V8', outcome: 'flash', environment: 'indoor' }),
          climb({
            id: 'rock',
            grade: 'V4',
            outcome: 'send',
            environment: 'outdoor',
            discipline: 'boulder',
            date: Date.UTC(2026, 7, 2),
          }),
          climb({
            id: 'lead',
            grade: '5.12a',
            outcome: 'send',
            discipline: 'lead',
            environment: 'indoor',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Boulder')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.queryByText('Top-rope')).not.toBeInTheDocument();
    expect(screen.getByText('V8')).toBeInTheDocument();
    expect(screen.getByText('V4')).toBeInTheDocument();
    expect(screen.getByText('5.12a')).toBeInTheDocument();
    expect(screen.getByText('Flash')).toBeInTheDocument();
    expect(screen.getAllByText('Redpoint')).toHaveLength(2);
    expect(screen.queryByText(/Send \(redpoint\)/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Indoor')).toHaveLength(2);
    expect(screen.getAllByText('Outdoor')).toHaveLength(2);
    expect(screen.getByLabelText('No outdoor send')).toBeInTheDocument();
  });
});

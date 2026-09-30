import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayContext, type TodayContextValue } from './TodayContext';

afterEach(cleanup);

const assumed: TodayContextValue = {
  environment: 'indoor',
  equipment: ['boulder-wall'],
  sessionLength: 'standard',
  readiness: 'ok',
};

describe('TodayContext', () => {
  it('does not confirm until they say the assumed row is right', () => {
    const onChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <TodayContext value={assumed} onChange={onChange} onConfirm={onConfirm} confirmed={false} />,
    );

    expect(screen.getByText(/not confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/coach does not run/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'This is right' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens the feeling editor without confirming', () => {
    const onConfirm = vi.fn();
    render(
      <TodayContext value={assumed} onChange={vi.fn()} onConfirm={onConfirm} confirmed={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByText('How do you feel?')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Done on an unchanged editor confirms the row', () => {
    const onConfirm = vi.fn();
    const onChange = vi.fn();
    render(
      <TodayContext value={assumed} onChange={onChange} onConfirm={onConfirm} confirmed={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hides the confirm prompt once today is saved', () => {
    render(
      <TodayContext value={assumed} onChange={vi.fn()} onConfirm={vi.fn()} confirmed={true} />,
    );

    expect(screen.queryByText(/not confirmed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'This is right' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });
});

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { protocolById, type TrackableProtocol } from '@tfc/core';
import { ProtocolMetric } from './ProtocolMetric';

const hang = protocolById('protocol-max-weight-hang')!;

function renderMetric(props: Partial<React.ComponentProps<typeof ProtocolMetric>> = {}) {
  const onChange = vi.fn();
  render(
    <ProtocolMetric protocol={hang} value={35} previous={40} onChange={onChange} {...props} />,
  );
  return { onChange };
}

afterEach(cleanup);

describe('ProtocolMetric', () => {
  it('shows the value in the protocol’s own units', () => {
    renderMetric();
    expect(screen.getByText('+35 lb')).toBeInTheDocument();
  });

  it('steps by the protocol’s increment', () => {
    const { onChange } = renderMetric();
    fireEvent.click(screen.getByRole('button', { name: /Increase/i }));
    expect(onChange).toHaveBeenCalledWith(35 + hang.step);
    fireEvent.click(screen.getByRole('button', { name: /Decrease/i }));
    expect(onChange).toHaveBeenCalledWith(35 - hang.step);
  });

  it('will not step below zero', () => {
    const { onChange } = renderMetric({ value: 0 });
    fireEvent.click(screen.getByRole('button', { name: /Decrease/i }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('calls the first session a baseline rather than a comparison', () => {
    renderMetric({ previous: null });
    expect(screen.getByText(/this becomes your baseline/i)).toBeInTheDocument();
  });

  it('reports an improvement against the last session', () => {
    renderMetric({ value: 45, previous: 40 });
    expect(screen.getByText(/up on last session/i)).toBeInTheDocument();
  });

  it('reports a drop against the last session', () => {
    renderMetric({ value: 35, previous: 40 });
    expect(screen.getByText(/down on last session/i)).toBeInTheDocument();
  });

  it('says so plainly when nothing changed', () => {
    renderMetric({ value: 40, previous: 40 });
    expect(screen.getByText(/Same as last time/i)).toBeInTheDocument();
  });

  it('does not call a prescribed set a regression', () => {
    // A working set at a fraction of max is *meant* to sit below the last
    // recorded number. Flagging that as "down" reads as the app being wrong
    // when it is the plan working correctly.
    renderMetric({ value: 35, previous: 40, prescribed: true });
    expect(screen.queryByText(/down on last session/i)).not.toBeInTheDocument();
    // The comparison still shows — only the judgement goes.
    expect(screen.getByText(/Last time \+40 lb/)).toBeInTheDocument();
  });

  it('treats a smaller number as progress where smaller is better', () => {
    // No shipped protocol uses this yet; it pins the direction for the edge-size
    // protocol the content module is already shaped for.
    const edge: TrackableProtocol = {
      ...hang,
      id: 'protocol-min-edge',
      unit: 'mm',
      lowerIsBetter: true,
      step: 1,
    };
    render(<ProtocolMetric protocol={edge} value={18} previous={20} onChange={vi.fn()} />);
    expect(screen.getByText(/up on last session/i)).toBeInTheDocument();
  });

  it('disables both controls while the session is saving', () => {
    renderMetric({ disabled: true });
    expect(screen.getByRole('button', { name: /Increase/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Decrease/i })).toBeDisabled();
  });

  it('shows what is being held constant, so the number means something', () => {
    renderMetric();
    expect(screen.getByText(hang.heldConstant!)).toBeInTheDocument();
  });
});

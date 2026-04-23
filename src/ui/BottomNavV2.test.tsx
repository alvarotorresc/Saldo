import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomNavV2 } from './BottomNavV2';

describe('BottomNavV2', () => {
  it('renders all 4 tab labels', () => {
    render(<BottomNavV2 value="home" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'HOME' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'LEDGER' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nueva transacción' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'MORE' })).toBeTruthy();
  });

  it('active tab has data-active=true', () => {
    render(<BottomNavV2 value="ledger" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'LEDGER' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: 'HOME' })).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('button', { name: 'MORE' })).toHaveAttribute('data-active', 'false');
  });

  it('calls onChange with correct tab for HOME', () => {
    const onChange = vi.fn();
    render(<BottomNavV2 value="ledger" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));
    expect(onChange).toHaveBeenCalledWith('home');
  });

  it('calls onChange with correct tab for LEDGER', () => {
    const onChange = vi.fn();
    render(<BottomNavV2 value="home" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'LEDGER' }));
    expect(onChange).toHaveBeenCalledWith('ledger');
  });

  it('calls onChange with "new" when FAB is clicked', () => {
    const onChange = vi.fn();
    render(<BottomNavV2 value="home" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva transacción' }));
    expect(onChange).toHaveBeenCalledWith('new');
  });

  it('calls onChange with "more" when MORE is clicked', () => {
    const onChange = vi.fn();
    render(<BottomNavV2 value="home" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'MORE' }));
    expect(onChange).toHaveBeenCalledWith('more');
  });

  it('FAB has aria-pressed when active', () => {
    render(<BottomNavV2 value="new" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Nueva transacción' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('FAB is type=button (keyboard accessible)', () => {
    render(<BottomNavV2 value="home" onChange={vi.fn()} />);
    const fab = screen.getByRole('button', { name: 'Nueva transacción' });
    expect(fab).toHaveAttribute('type', 'button');
  });

  it('all regular tab buttons are type=button', () => {
    render(<BottomNavV2 value="home" onChange={vi.fn()} />);
    const tabs = ['HOME', 'LEDGER', 'MORE'];
    tabs.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('type', 'button');
    });
  });
});

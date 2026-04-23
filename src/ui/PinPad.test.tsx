import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PinPad } from './PinPad';

describe('PinPad', () => {
  it('renders 6 dots by default', () => {
    render(<PinPad value="" onChange={vi.fn()} />);
    // status region with aria-label
    const status = screen.getByRole('status');
    expect(status).toBeTruthy();
    // 6 dot divs inside
    const dots = status.querySelectorAll('[data-filled]');
    expect(dots).toHaveLength(6);
  });

  it('renders custom maxLength dots', () => {
    render(<PinPad value="" onChange={vi.fn()} maxLength={4} />);
    const status = screen.getByRole('status');
    const dots = status.querySelectorAll('[data-filled]');
    expect(dots).toHaveLength(4);
  });

  it('marks filled dots correctly', () => {
    render(<PinPad value="12" onChange={vi.fn()} maxLength={4} />);
    const status = screen.getByRole('status');
    const dots = status.querySelectorAll('[data-filled]');
    expect(dots[0]).toHaveAttribute('data-filled', 'true');
    expect(dots[1]).toHaveAttribute('data-filled', 'true');
    expect(dots[2]).toHaveAttribute('data-filled', 'false');
    expect(dots[3]).toHaveAttribute('data-filled', 'false');
  });

  it('calls onChange with appended digit when a digit button is clicked', () => {
    const onChange = vi.fn();
    render(<PinPad value="12" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith('123');
  });

  it('does not append beyond maxLength', () => {
    const onChange = vi.fn();
    render(<PinPad value="123456" onChange={onChange} maxLength={6} />);
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with truncated value on backspace', () => {
    const onChange = vi.fn();
    render(<PinPad value="123" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(onChange).toHaveBeenCalledWith('12');
  });

  it('backspace does nothing when value is empty', () => {
    const onChange = vi.fn();
    render(<PinPad value="" onChange={onChange} />);
    // Backspace button is disabled when value is empty
    const backBtn = screen.getByRole('button', { name: 'Borrar' });
    expect(backBtn).toBeDisabled();
    fireEvent.click(backBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders 0 button and appends zero', () => {
    const onChange = vi.fn();
    render(<PinPad value="1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    expect(onChange).toHaveBeenCalledWith('10');
  });

  it('renders all digit buttons 1-9', () => {
    render(<PinPad value="" onChange={vi.fn()} />);
    for (let d = 1; d <= 9; d++) {
      expect(screen.getByRole('button', { name: String(d) })).toBeTruthy();
    }
  });

  it('all digit buttons are type=button (keyboard accessible)', () => {
    render(<PinPad value="" onChange={vi.fn()} />);
    for (let d = 0; d <= 9; d++) {
      const btn = screen.getByRole('button', { name: String(d) });
      expect(btn).toHaveAttribute('type', 'button');
    }
  });

  it('dots use accent classes when dotsAccent=true (default)', () => {
    render(<PinPad value="1" onChange={vi.fn()} maxLength={2} />);
    const status = screen.getByRole('status');
    const filledDot = status.querySelector('[data-filled="true"]') as HTMLElement;
    expect(filledDot.className).toContain('bg-accent');
  });

  it('dots use dim classes when dotsAccent=false', () => {
    render(<PinPad value="1" onChange={vi.fn()} maxLength={2} dotsAccent={false} />);
    const status = screen.getByRole('status');
    const filledDot = status.querySelector('[data-filled="true"]') as HTMLElement;
    expect(filledDot.className).toContain('bg-dim');
  });
});

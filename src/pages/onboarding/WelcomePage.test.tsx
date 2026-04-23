import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WelcomePage } from './WelcomePage';

describe('WelcomePage', () => {
  it('renders main claim text', () => {
    render(<WelcomePage onContinue={vi.fn()} />);
    expect(screen.getByText('Tus finanzas.')).toBeTruthy();
    expect(screen.getByText('Locales.')).toBeTruthy();
    expect(screen.getByText('Para siempre.')).toBeTruthy();
  });

  it('renders header with version', () => {
    render(<WelcomePage onContinue={vi.fn()} />);
    expect(screen.getByText(/SALDO · v0\.2\.0/)).toBeTruthy();
  });

  it('renders security sub-paragraph', () => {
    render(<WelcomePage onContinue={vi.fn()} />);
    expect(screen.getByText(/Cero servidores/)).toBeTruthy();
  });

  it('renders all 3 checklist items', () => {
    render(<WelcomePage onContinue={vi.fn()} />);
    expect(screen.getByText('Datos solo en tu dispositivo')).toBeTruthy();
    expect(screen.getByText('Sin cuenta, sin registro')).toBeTruthy();
    expect(screen.getByText('Cifrado end-to-end')).toBeTruthy();
  });

  it('calls onContinue when COMENZAR button is clicked', () => {
    const onContinue = vi.fn();
    render(<WelcomePage onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /COMENZAR/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('hides restore link when onRestore is undefined', () => {
    render(<WelcomePage onContinue={vi.fn()} />);
    expect(screen.queryByText(/Restaurar/)).toBeNull();
  });

  it('shows restore link when onRestore is provided', () => {
    const onRestore = vi.fn();
    render(<WelcomePage onContinue={vi.fn()} onRestore={onRestore} />);
    expect(screen.getByText(/Restaurar/)).toBeTruthy();
  });

  it('calls onRestore when restore link is clicked', () => {
    const onRestore = vi.fn();
    render(<WelcomePage onContinue={vi.fn()} onRestore={onRestore} />);
    fireEvent.click(screen.getByText(/Restaurar/));
    expect(onRestore).toHaveBeenCalledOnce();
  });
});

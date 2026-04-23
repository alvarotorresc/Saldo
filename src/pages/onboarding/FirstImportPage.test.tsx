import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FirstImportPage } from './FirstImportPage';

describe('FirstImportPage', () => {
  it('renders all 4 option cards', () => {
    render(<FirstImportPage onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Import CSV (recomendado)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrada manual' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restaurar backup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saltar por ahora' })).toBeTruthy();
  });

  it('renders option descriptions', () => {
    render(<FirstImportPage onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText(/N26\/BBVA/)).toBeTruthy();
    expect(screen.getByText('Añade transacciones una a una')).toBeTruthy();
    expect(screen.getByText(/backup/i)).toBeTruthy();
    expect(screen.getByText('Empezar vacio')).toBeTruthy();
  });

  it('calls onComplete when CSV import option is clicked', () => {
    const onComplete = vi.fn();
    render(<FirstImportPage onComplete={onComplete} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV (recomendado)' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('calls onComplete when manual entry option is clicked', () => {
    const onComplete = vi.fn();
    render(<FirstImportPage onComplete={onComplete} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Entrada manual' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('calls onComplete when restore backup option is clicked', () => {
    const onComplete = vi.fn();
    render(<FirstImportPage onComplete={onComplete} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar backup' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('calls onSkip when "Saltar" option is clicked', () => {
    const onSkip = vi.fn();
    render(<FirstImportPage onComplete={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saltar por ahora' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('does NOT call onSkip when non-skip options are clicked', () => {
    const onSkip = vi.fn();
    render(<FirstImportPage onComplete={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Entrada manual' }));
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('all option buttons are type=button', () => {
    render(<FirstImportPage onComplete={vi.fn()} onSkip={vi.fn()} />);
    const buttons = [
      'Import CSV (recomendado)',
      'Entrada manual',
      'Restaurar backup',
      'Saltar por ahora',
    ];
    buttons.forEach((name) => {
      expect(screen.getByRole('button', { name })).toHaveAttribute('type', 'button');
    });
  });
});

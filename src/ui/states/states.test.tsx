import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalEmpty } from './TerminalEmpty';
import { TerminalLoading } from './TerminalLoading';
import { TerminalError } from './TerminalError';

describe('TerminalEmpty', () => {
  it('renders title, subtitle and terminal line', () => {
    render(
      <TerminalEmpty
        title="NO TRANSACTIONS"
        subtitle="El ledger está vacío"
        terminalLine="wc -l ledger.db → 0"
      />,
    );
    expect(screen.getByText('NO TRANSACTIONS')).toBeInTheDocument();
    expect(screen.getByText('El ledger está vacío')).toBeInTheDocument();
    expect(screen.getByText(/ledger\.db/)).toBeInTheDocument();
  });

  it('renders a configurable data-testid for different variants', () => {
    render(<TerminalEmpty title="NO GOALS" data-testid="empty-goals" />);
    expect(screen.getByTestId('empty-goals')).toBeInTheDocument();
  });
});

describe('TerminalLoading', () => {
  it('renders each checklist step with the right visual marker by status', () => {
    render(
      <TerminalLoading
        title="BOOTING"
        steps={[
          { id: 'cripto', label: 'derive key', status: 'done' },
          { id: 'dexie', label: 'open db', status: 'running' },
          { id: 'seed', label: 'seed defaults', status: 'pending' },
        ]}
      />,
    );
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('loading-step-cripto')).toHaveTextContent('✓');
    expect(screen.getByTestId('loading-step-dexie')).toHaveTextContent('…');
    expect(screen.getByTestId('loading-step-seed')).toHaveTextContent('○');
  });
});

describe('TerminalError', () => {
  it('renders the error message and exposes retry + copy actions', async () => {
    const onRetry = vi.fn();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(
      <TerminalError
        error={{ message: 'db lock', stack: 'Error: db lock\n    at open (db.ts:1:1)' }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/PANIC · db lock/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('err-retry'));
    expect(onRetry).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('err-report'));
    // clipboard mock may resolve asynchronously — we just confirm click did not crash.
    expect(screen.getByTestId('terminal-error')).toBeInTheDocument();
  });
});

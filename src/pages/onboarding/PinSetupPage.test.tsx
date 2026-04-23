import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LockState } from '@/stores/lock';
import { useLock } from '@/stores/lock';
import { PinSetupPage } from './PinSetupPage';

// Mock setupPin to avoid real 600k-iteration PBKDF2 in tests.
beforeEach(() => {
  useLock.setState({
    setupPin: vi.fn().mockResolvedValue(undefined) as LockState['setupPin'],
    status: 'setup',
    master: null,
    failedAttempts: 0,
    lockedOutUntil: null,
  });
});

// Helper: type digits into the pad
function clickDigits(digits: string) {
  for (const d of digits) {
    const btn = screen.getByRole('button', { name: d === '0' ? '0' : d });
    fireEvent.click(btn);
  }
}

describe('PinSetupPage', () => {
  it('renders enter step label initially', () => {
    render(<PinSetupPage onComplete={vi.fn()} />);
    expect(screen.getByText(/Crea tu PIN/i)).toBeTruthy();
  });

  it('CONTINUAR button is disabled until 4 digits entered', () => {
    render(<PinSetupPage onComplete={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /CONTINUAR/i });
    expect(btn).toBeDisabled();
    clickDigits('123');
    expect(btn).toBeDisabled();
    clickDigits('4');
    expect(btn).not.toBeDisabled();
  });

  it('advances to confirm step when CONTINUAR is clicked', () => {
    render(<PinSetupPage onComplete={vi.fn()} />);
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    expect(screen.getByText(/Confirma tu PIN/i)).toBeTruthy();
  });

  it('confirm step resets to empty pin pad', () => {
    render(<PinSetupPage onComplete={vi.fn()} />);
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    // Dots should all be empty in confirm step
    const status = screen.getByRole('status', { name: /PIN/i });
    const dots = status.querySelectorAll('[data-filled="true"]');
    expect(dots).toHaveLength(0);
  });

  it('shows mismatch error and returns to enter step', async () => {
    render(<PinSetupPage onComplete={vi.fn()} />);
    // Enter PIN 1234
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    // Confirm with different PIN 5678
    clickDigits('5678');
    fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByText(/Los PINs no coinciden/)).toBeTruthy();
    // Should be back on enter step
    expect(screen.getByText(/Crea tu PIN/i)).toBeTruthy();
  });

  it('calls setupPin and onComplete on matching PINs', async () => {
    const onComplete = vi.fn();
    render(<PinSetupPage onComplete={onComplete} />);
    // Enter PIN
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    // Confirm same PIN
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR/i }));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce();
    });
    expect(useLock.getState().setupPin).toHaveBeenCalledWith('1234');
  });

  it('shows deriving state during setupPin', async () => {
    let resolveSetup!: () => void;
    const slowSetup = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveSetup = res;
        }),
    );
    useLock.setState({ setupPin: slowSetup as LockState['setupPin'] });

    render(<PinSetupPage onComplete={vi.fn()} />);
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR/i }));
    await waitFor(() => {
      expect(screen.getByText(/DERIVANDO CLAVE/)).toBeTruthy();
    });
    resolveSetup();
  });

  it('renders back button when onBack is provided on enter step', () => {
    const onBack = vi.fn();
    render(<PinSetupPage onComplete={vi.fn()} onBack={onBack} />);
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeTruthy();
  });
});

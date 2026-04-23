import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LockState } from '@/stores/lock';
import { useLock } from '@/stores/lock';
import { OnboardingFlow } from './OnboardingFlow';

// Mock getBiometryStatus to avoid async fetch in tests
vi.mock('@/lib/crypto', () => ({
  getBiometryStatus: vi.fn().mockResolvedValue({ isAvailable: false, reason: 'deferred-v03' }),
}));

// Mock setupPin to avoid PBKDF2
beforeEach(() => {
  useLock.setState({
    setupPin: vi.fn().mockResolvedValue(undefined) as LockState['setupPin'],
    status: 'welcome',
    master: null,
    failedAttempts: 0,
    lockedOutUntil: null,
  });
});

function clickDigits(digits: string) {
  for (const d of digits) {
    fireEvent.click(screen.getByRole('button', { name: d === '0' ? '0' : d }));
  }
}

describe('OnboardingFlow', () => {
  it('starts on welcome screen', () => {
    render(<OnboardingFlow onDone={vi.fn()} />);
    expect(screen.getByText('Tus finanzas.')).toBeTruthy();
  });

  it('advances to pin-setup after clicking COMENZAR', () => {
    render(<OnboardingFlow onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /COMENZAR/i }));
    expect(screen.getByText(/Crea tu PIN/i)).toBeTruthy();
  });

  it('back from pin-setup returns to welcome', () => {
    render(<OnboardingFlow onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /COMENZAR/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByText('Tus finanzas.')).toBeTruthy();
  });

  it('advances to biometrics after pin setup completes', async () => {
    render(<OnboardingFlow onDone={vi.fn()} />);
    // Navigate to pin-setup
    fireEvent.click(screen.getByRole('button', { name: /COMENZAR/i }));
    // Enter PIN
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    // Confirm PIN
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR/i }));
    // Should reach biometrics
    await waitFor(() => {
      expect(screen.getByText('Autenticacion biometrica')).toBeTruthy();
    });
  });

  it('advances to first-import after biometrics continue', async () => {
    render(<OnboardingFlow onDone={vi.fn()} />);
    // Go to pin-setup
    fireEvent.click(screen.getByRole('button', { name: /COMENZAR/i }));
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR/i }));
    await waitFor(() => {
      expect(screen.getByText('Autenticacion biometrica')).toBeTruthy();
    });
    // Continue through biometrics
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    expect(screen.getByText('¿Como quieres empezar?')).toBeTruthy();
  });

  it('calls onDone when skip is chosen on first-import', async () => {
    const onDone = vi.fn();
    render(<OnboardingFlow onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /COMENZAR/i }));
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR/i }));
    await waitFor(() => screen.getByText('Autenticacion biometrica'));
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Saltar por ahora' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('calls onDone when complete is chosen on first-import', async () => {
    const onDone = vi.fn();
    render(<OnboardingFlow onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /COMENZAR/i }));
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    clickDigits('1234');
    fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR/i }));
    await waitFor(() => screen.getByText('Autenticacion biometrica'));
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV (recomendado)' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('passes onRestore to WelcomePage', () => {
    const onRestore = vi.fn();
    render(<OnboardingFlow onDone={vi.fn()} onRestore={onRestore} />);
    expect(screen.getByText(/Restaurar/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Restaurar/));
    expect(onRestore).toHaveBeenCalledOnce();
  });
});

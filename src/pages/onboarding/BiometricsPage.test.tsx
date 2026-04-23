import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BiometricsPage } from './BiometricsPage';

// getBiometryStatus always returns { isAvailable: false } in v0.2, but mock
// to avoid any I/O side effects and keep tests synchronous.
vi.mock('@/lib/crypto', () => ({
  getBiometryStatus: vi.fn().mockResolvedValue({ isAvailable: false, reason: 'deferred-v03' }),
}));

describe('BiometricsPage', () => {
  it('renders page title', () => {
    render(<BiometricsPage onContinue={vi.fn()} />);
    expect(screen.getByText('Autenticacion biometrica')).toBeTruthy();
  });

  it('shows unavailable banner after status resolves', async () => {
    render(<BiometricsPage onContinue={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Estado biometria' })).toBeTruthy();
    });
    expect(screen.getByText(/Biometria no disponible en v0\.2/)).toBeTruthy();
    expect(screen.getByText('NOT AVAILABLE')).toBeTruthy();
  });

  it('always shows CONTINUAR button', () => {
    render(<BiometricsPage onContinue={vi.fn()} />);
    expect(screen.getByRole('button', { name: /CONTINUAR/i })).toBeTruthy();
  });

  it('calls onContinue when button is clicked', () => {
    const onContinue = vi.fn();
    render(<BiometricsPage onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('does not show activate fingerprint button', () => {
    render(<BiometricsPage onContinue={vi.fn()} />);
    expect(screen.queryByText(/Activar/i)).toBeNull();
    expect(screen.queryByText(/huella/i)).toBeNull();
  });
});

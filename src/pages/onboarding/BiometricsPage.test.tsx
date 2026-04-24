import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BiometricsPage } from './BiometricsPage';

const getBiometryStatusMock = vi.fn();
const enableBiometryMock = vi.fn();

vi.mock('@/lib/crypto', () => ({
  getBiometryStatus: (...args: unknown[]) => getBiometryStatusMock(...args),
  enableBiometry: (...args: unknown[]) => enableBiometryMock(...args),
}));

beforeEach(() => {
  getBiometryStatusMock.mockReset();
  enableBiometryMock.mockReset();
});

describe('BiometricsPage', () => {
  it('renders the page title', () => {
    getBiometryStatusMock.mockResolvedValue({
      isAvailable: false,
      hasSavedPin: false,
      reason: 'not-supported',
    });
    render(<BiometricsPage onContinue={vi.fn()} />);
    expect(screen.getByText(/Autenticación biométrica/i)).toBeInTheDocument();
  });

  it('shows NOT AVAILABLE badge + reason label when unavailable', async () => {
    getBiometryStatusMock.mockResolvedValue({
      isAvailable: false,
      hasSavedPin: false,
      reason: 'not-supported',
    });
    render(<BiometricsPage onContinue={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('biometry-status')).toBeInTheDocument();
    });
    expect(screen.getByText('NOT AVAILABLE')).toBeInTheDocument();
    expect(screen.getByText(/soporte biométrico/i)).toBeInTheDocument();
  });

  it('shows ACTIVAR_BIOMETRIA when plugin is available and no PIN is saved yet', async () => {
    getBiometryStatusMock.mockResolvedValue({
      isAvailable: true,
      hasSavedPin: false,
      reason: 'not-enabled',
      kind: 'fingerprint',
    });
    render(<BiometricsPage onContinue={vi.fn()} pin="123456" />);
    await waitFor(() => {
      expect(screen.getByTestId('biometry-enable')).toBeInTheDocument();
    });
  });

  it('calls enableBiometry with the injected PIN and advances on success', async () => {
    getBiometryStatusMock.mockResolvedValue({
      isAvailable: true,
      hasSavedPin: false,
      reason: 'not-enabled',
    });
    enableBiometryMock.mockResolvedValue(true);
    const onContinue = vi.fn();
    render(<BiometricsPage onContinue={onContinue} pin="123456" />);
    await waitFor(() => {
      expect(screen.getByTestId('biometry-enable')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('biometry-enable'));
    await waitFor(() => expect(enableBiometryMock).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(onContinue).toHaveBeenCalled());
  });

  it('offers a SKIP button that triggers onContinue without enabling biometry', async () => {
    getBiometryStatusMock.mockResolvedValue({
      isAvailable: false,
      hasSavedPin: false,
      reason: 'not-supported',
    });
    const onContinue = vi.fn();
    render(<BiometricsPage onContinue={onContinue} />);
    await waitFor(() => {
      expect(screen.getByTestId('biometry-status')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /SALTAR|CONTINUAR/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});

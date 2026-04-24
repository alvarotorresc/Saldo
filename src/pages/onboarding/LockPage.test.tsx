import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LockState } from '@/stores/lock';
import { useLock, LOCKOUT_THRESHOLD } from '@/stores/lock';
import { LockPage } from './LockPage';

const { mockGetBiometryStatus } = vi.hoisted(() => ({
  mockGetBiometryStatus: vi.fn(),
}));

vi.mock('@/lib/crypto', () => ({
  getBiometryStatus: mockGetBiometryStatus,
}));

beforeEach(() => {
  // Default: biometry not available — keeps existing tests unaffected
  mockGetBiometryStatus.mockResolvedValue({
    isAvailable: false,
    hasSavedPin: false,
    reason: 'not-supported',
  });

  useLock.setState({
    status: 'locked',
    master: null,
    failedAttempts: 0,
    lockedOutUntil: null,
    unlock: vi.fn().mockResolvedValue(false) as LockState['unlock'],
    lock: vi.fn() as LockState['lock'],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function clickDigits(digits: string) {
  for (const d of digits) {
    fireEvent.click(screen.getByRole('button', { name: d === '0' ? '0' : d }));
  }
}

describe('LockPage', () => {
  it('renders SALDO header', () => {
    render(<LockPage />);
    expect(screen.getByText('▌ SALDO')).toBeTruthy();
  });

  it('renders current time', () => {
    render(<LockPage />);
    expect(screen.getByLabelText('Hora actual')).toBeTruthy();
  });

  it('dots reflect current PIN entry length', () => {
    render(<LockPage />);
    const status = screen.getByRole('status');
    // Initially all empty
    expect(status.querySelectorAll('[data-filled="true"]')).toHaveLength(0);

    clickDigits('12');
    expect(status.querySelectorAll('[data-filled="true"]')).toHaveLength(2);
  });

  it('auto-calls unlock when 4 digits entered', async () => {
    const unlock = vi.fn().mockResolvedValue(false) as LockState['unlock'];
    useLock.setState({ unlock });

    render(<LockPage />);
    clickDigits('1234');

    await waitFor(() => {
      expect(unlock).toHaveBeenCalledWith('1234');
    });
  });

  it('clears pin after wrong PIN attempt', async () => {
    const unlock = vi.fn().mockResolvedValue(false) as LockState['unlock'];
    useLock.setState({ unlock });

    render(<LockPage />);
    clickDigits('1234');

    await waitFor(() => expect(unlock).toHaveBeenCalled());

    // Advance real time past the 300ms shake
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    const status = screen.getByRole('status');
    expect(status.querySelectorAll('[data-filled="true"]')).toHaveLength(0);
  });

  it('shows lockout banner when lockedOutUntil is set', async () => {
    const lockedOutUntil = Date.now() + 30_000;
    useLock.setState({
      failedAttempts: LOCKOUT_THRESHOLD,
      lockedOutUntil,
    });

    render(<LockPage />);
    // Countdown is set via useEffect after an interval fires
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/BLOQUEADO/)).toBeTruthy();
  });

  it('shows failed attempts warning when attempts < threshold', () => {
    useLock.setState({
      failedAttempts: 1,
      lockedOutUntil: null,
    });
    render(<LockPage />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/PIN incorrecto/)).toBeTruthy();
  });

  it('does not call unlock when locked out', async () => {
    const lockedOutUntil = Date.now() + 30_000;
    const unlock = vi.fn().mockResolvedValue(false) as LockState['unlock'];
    useLock.setState({
      failedAttempts: LOCKOUT_THRESHOLD,
      lockedOutUntil,
      unlock,
    });

    render(<LockPage />);
    // Wait for lockout state to be reflected in component
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    // Try to input digits — onChange is a no-op when locked out
    clickDigits('1234');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(unlock).not.toHaveBeenCalled();
  });

  it('PinPad is type=button for all digit buttons', () => {
    render(<LockPage />);
    const oneBtn = screen.getByRole('button', { name: '1' });
    expect(oneBtn).toHaveAttribute('type', 'button');
  });
});

describe('LockPage — biometry auto-trigger', () => {
  beforeEach(() => {
    // Provide unlockWithBiometry on the store for these tests
    useLock.setState({
      unlockWithBiometry: vi.fn().mockResolvedValue(true) as LockState['unlockWithBiometry'],
    });
  });

  it('calls unlockWithBiometry on mount when bio isAvailable && hasSavedPin && pin empty', async () => {
    mockGetBiometryStatus.mockResolvedValue({ isAvailable: true, hasSavedPin: true });
    const { unlockWithBiometry } = useLock.getState();

    render(<LockPage />);

    await waitFor(() => {
      expect(unlockWithBiometry).toHaveBeenCalled();
    });
  });

  it('does NOT auto-trigger when hasSavedPin=false', async () => {
    mockGetBiometryStatus.mockResolvedValue({
      isAvailable: true,
      hasSavedPin: false,
      reason: 'not-enabled',
    });
    const { unlockWithBiometry } = useLock.getState();

    render(<LockPage />);

    // Wait long enough for getBiometryStatus to resolve and any effect to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(unlockWithBiometry).not.toHaveBeenCalled();
  });

  it('does NOT auto-trigger when user has already typed some digits', async () => {
    // Use a deferred promise so we control when bio status resolves
    let resolveBio!: (v: { isAvailable: boolean; hasSavedPin: boolean }) => void;
    const deferred = new Promise<{ isAvailable: boolean; hasSavedPin: boolean }>(
      (resolve) => (resolveBio = resolve),
    );
    mockGetBiometryStatus.mockReturnValue(deferred);
    const { unlockWithBiometry } = useLock.getState();

    render(<LockPage />);

    // User types a digit before bio resolves
    fireEvent.click(screen.getByRole('button', { name: '1' }));

    // Now resolve bio with available+saved — pin is '1' so auto-trigger must NOT fire
    await act(async () => {
      resolveBio({ isAvailable: true, hasSavedPin: true });
      await deferred;
    });

    expect(unlockWithBiometry).not.toHaveBeenCalled();
  });

  it('shakes when auto-biometry fails', async () => {
    useLock.setState({
      unlockWithBiometry: vi.fn().mockResolvedValue(false) as LockState['unlockWithBiometry'],
    });
    mockGetBiometryStatus.mockResolvedValue({ isAvailable: true, hasSavedPin: true });

    render(<LockPage />);

    // The data-shaking div wraps PinPad; role="status" is a grandchild:
    //   div[data-shaking] > div.flex-col (PinPad root) > div[role="status"]
    const statusEl = screen.getByRole('status');
    const shakingWrapper = statusEl.parentElement?.parentElement;
    expect(shakingWrapper).toBeTruthy();

    // Wait for getBiometryStatus to resolve, tryBiometry to run, and shaking to be set
    await waitFor(() => {
      expect(shakingWrapper).toHaveAttribute('data-shaking', 'true');
    });

    // Wait for the 300ms shake timeout to clear
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(shakingWrapper).toHaveAttribute('data-shaking', 'false');
  });
});

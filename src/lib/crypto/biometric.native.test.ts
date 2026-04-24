import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

// vi.hoisted() is required in Vitest — vi.mock() is hoisted above ALL top-level
// declarations, so plain `const mockFn = vi.fn()` would cause a ReferenceError
// when the factory runs.
const {
  mockVerifyIdentity,
  mockIsAvailable,
  mockIsCredentialsSaved,
  mockSetCredentials,
  mockGetCredentials,
  mockDeleteCredentials,
} = vi.hoisted(() => ({
  mockVerifyIdentity: vi.fn(),
  mockIsAvailable: vi.fn(),
  mockIsCredentialsSaved: vi.fn(),
  mockSetCredentials: vi.fn(),
  mockGetCredentials: vi.fn(),
  mockDeleteCredentials: vi.fn(),
}));

vi.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: {
    verifyIdentity: mockVerifyIdentity,
    isAvailable: mockIsAvailable,
    isCredentialsSaved: mockIsCredentialsSaved,
    setCredentials: mockSetCredentials,
    getCredentials: mockGetCredentials,
    deleteCredentials: mockDeleteCredentials,
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true, // force native path for all tests in this file
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBiometryStatus (native path)', () => {
  it('should return not-enrolled when device is secure but biometry not available', async () => {
    const { getBiometryStatus } = await import('./biometric');

    mockIsAvailable.mockResolvedValue({
      isAvailable: false,
      deviceIsSecure: true,
      biometryType: 0,
    });

    // Arrange/Act
    const status = await getBiometryStatus();

    // Assert
    expect(status.isAvailable).toBe(false);
    expect(status.hasSavedPin).toBe(false);
    expect(status.reason).toBe('not-enrolled');
  });

  it('should return not-supported when device is not secure and biometry not available', async () => {
    const { getBiometryStatus } = await import('./biometric');

    mockIsAvailable.mockResolvedValue({
      isAvailable: false,
      deviceIsSecure: false,
      biometryType: 0,
    });

    const status = await getBiometryStatus();

    expect(status.isAvailable).toBe(false);
    expect(status.hasSavedPin).toBe(false);
    expect(status.reason).toBe('not-supported');
  });

  it('should return available with saved pin when credential exists (TOUCH_ID)', async () => {
    const { getBiometryStatus } = await import('./biometric');

    mockIsAvailable.mockResolvedValue({ isAvailable: true, deviceIsSecure: true, biometryType: 1 });
    mockIsCredentialsSaved.mockResolvedValue({ isSaved: true });

    const status = await getBiometryStatus();

    expect(status.isAvailable).toBe(true);
    expect(status.hasSavedPin).toBe(true);
    expect(status.kind).toBe('fingerprint');
    expect(status.reason).toBeUndefined();
  });

  it('should return available without saved pin when no credential exists (FACE_ID)', async () => {
    const { getBiometryStatus } = await import('./biometric');

    mockIsAvailable.mockResolvedValue({ isAvailable: true, deviceIsSecure: true, biometryType: 2 });
    mockIsCredentialsSaved.mockResolvedValue({ isSaved: false });

    const status = await getBiometryStatus();

    expect(status.isAvailable).toBe(true);
    expect(status.hasSavedPin).toBe(false);
    expect(status.kind).toBe('face');
    expect(status.reason).toBe('not-enabled');
  });

  it('should return hasSavedPin false without throwing when isCredentialsSaved rejects', async () => {
    const { getBiometryStatus } = await import('./biometric');

    mockIsAvailable.mockResolvedValue({ isAvailable: true, deviceIsSecure: true, biometryType: 1 });
    mockIsCredentialsSaved.mockRejectedValue(new Error('keystore unavailable'));

    const status = await getBiometryStatus();

    expect(status.isAvailable).toBe(true);
    expect(status.hasSavedPin).toBe(false);
    expect(status.reason).toBe('not-enabled');
  });

  it('should return not-supported without throwing when isAvailable rejects', async () => {
    const { getBiometryStatus } = await import('./biometric');

    mockIsAvailable.mockRejectedValue(new Error('bridge error'));

    const status = await getBiometryStatus();

    expect(status.isAvailable).toBe(false);
    expect(status.hasSavedPin).toBe(false);
    expect(status.reason).toBe('not-supported');
  });

  it.each([
    [1, 'fingerprint'],
    [3, 'fingerprint'],
    [2, 'face'],
    [4, 'face'],
    [5, 'iris'],
    [6, 'multiple'],
    [7, 'device-credential'],
    [0, undefined],
  ] as const)('should map biometryType %i to kind %s', async (biometryType, expectedKind) => {
    const { getBiometryStatus } = await import('./biometric');

    mockIsAvailable.mockResolvedValue({ isAvailable: true, deviceIsSecure: true, biometryType });
    mockIsCredentialsSaved.mockResolvedValue({ isSaved: true });

    const status = await getBiometryStatus();

    expect(status.kind).toBe(expectedKind);
  });
});

describe('enableBiometry (native path)', () => {
  it('should return true and call setCredentials when verifyIdentity succeeds', async () => {
    const { enableBiometry } = await import('./biometric');

    mockVerifyIdentity.mockResolvedValue(undefined);
    mockSetCredentials.mockResolvedValue(undefined);

    // Act
    const result = await enableBiometry('1234');

    // Assert
    expect(result).toBe(true);
    expect(mockSetCredentials).toHaveBeenCalledWith({
      username: 'saldo-pin',
      password: '1234',
      server: 'saldo@local',
    });
  });

  it('should return false and not call setCredentials when verifyIdentity rejects', async () => {
    const { enableBiometry } = await import('./biometric');

    mockVerifyIdentity.mockRejectedValue(new Error('user cancelled'));

    const result = await enableBiometry('1234');

    expect(result).toBe(false);
    expect(mockSetCredentials).not.toHaveBeenCalled();
  });

  it('should return false when setCredentials rejects', async () => {
    const { enableBiometry } = await import('./biometric');

    mockVerifyIdentity.mockResolvedValue(undefined);
    mockSetCredentials.mockRejectedValue(new Error('keystore write failed'));

    const result = await enableBiometry('1234');

    expect(result).toBe(false);
  });
});

describe('authenticateBiometry (native path)', () => {
  it('should return the stored password when verifyIdentity and getCredentials succeed', async () => {
    const { authenticateBiometry } = await import('./biometric');

    mockVerifyIdentity.mockResolvedValue(undefined);
    mockGetCredentials.mockResolvedValue({ password: 'secret-pin', username: 'saldo-pin' });

    const result = await authenticateBiometry();

    expect(result).toBe('secret-pin');
  });

  it('should return false when verifyIdentity rejects', async () => {
    const { authenticateBiometry } = await import('./biometric');

    mockVerifyIdentity.mockRejectedValue(new Error('auth failed'));

    const result = await authenticateBiometry();

    expect(result).toBe(false);
  });

  it('should return false when getCredentials rejects', async () => {
    const { authenticateBiometry } = await import('./biometric');

    mockVerifyIdentity.mockResolvedValue(undefined);
    mockGetCredentials.mockRejectedValue(new Error('no credentials'));

    const result = await authenticateBiometry();

    expect(result).toBe(false);
  });
});

describe('disableBiometry (native path)', () => {
  it('should call deleteCredentials once when invoked', async () => {
    const { disableBiometry } = await import('./biometric');

    mockDeleteCredentials.mockResolvedValue(undefined);

    await disableBiometry();

    expect(mockDeleteCredentials).toHaveBeenCalledOnce();
    expect(mockDeleteCredentials).toHaveBeenCalledWith({ server: 'saldo@local' });
  });

  it('should not throw when deleteCredentials rejects', async () => {
    const { disableBiometry } = await import('./biometric');

    mockDeleteCredentials.mockRejectedValue(new Error('nothing to delete'));

    await expect(disableBiometry()).resolves.toBeUndefined();
  });
});

/**
 * Biometric auth backed by @capgo/capacitor-native-biometric v8 (post-CVE).
 *
 * Flow:
 *   enableBiometry(pin)   → verifyIdentity() then setCredentials() storing the
 *                           PIN in the system keychain/keystore.
 *   authenticateBiometry  → verifyIdentity() + getCredentials() returns the
 *                           stored PIN, which the lock store feeds to
 *                           unlock(pin) exactly as if the user typed it.
 *   disableBiometry()     → deleteCredentials().
 *   getBiometryStatus()   → isAvailable() + isCredentialsSaved().
 *
 * On the web (no Capacitor native bridge) `isAvailable` rejects; we catch and
 * report `not-supported` so Onboarding and Settings degrade gracefully to
 * PIN-only.
 */
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

const SERVER = 'saldo@local';
const USERNAME = 'saldo-pin';

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export interface BiometryStatus {
  isAvailable: boolean;
  hasSavedPin: boolean;
  reason?: 'not-supported' | 'not-enrolled' | 'not-enabled' | 'error';
  kind?: 'fingerprint' | 'face' | 'iris' | 'device-credential' | 'multiple';
}

function mapBiometryKind(type: number): BiometryStatus['kind'] {
  // BiometryType enum: NONE=0 TOUCH_ID=1 FACE_ID=2 FINGERPRINT=3
  // FACE_AUTHENTICATION=4 IRIS_AUTHENTICATION=5 MULTIPLE=6 DEVICE_CREDENTIAL=7
  switch (type) {
    case 1:
    case 3:
      return 'fingerprint';
    case 2:
    case 4:
      return 'face';
    case 5:
      return 'iris';
    case 6:
      return 'multiple';
    case 7:
      return 'device-credential';
    default:
      return undefined;
  }
}

export async function getBiometryStatus(): Promise<BiometryStatus> {
  // Biometry is a native-only feature. The @capgo web shim exposes a no-op
  // that stores the PIN in a JS Map — an XSS payload or hostile extension
  // could extract it without any fingerprint prompt. Gate the whole surface
  // on Capacitor.isNativePlatform() so web users never see a toggle that
  // silently weakens their security.
  if (!isNative()) {
    return { isAvailable: false, hasSavedPin: false, reason: 'not-supported' };
  }
  try {
    const res = await NativeBiometric.isAvailable({ useFallback: true });
    if (!res.isAvailable) {
      return {
        isAvailable: false,
        hasSavedPin: false,
        reason: res.deviceIsSecure ? 'not-enrolled' : 'not-supported',
      };
    }
    let hasSavedPin = false;
    try {
      const saved = await NativeBiometric.isCredentialsSaved({ server: SERVER });
      hasSavedPin = !!saved.isSaved;
    } catch {
      hasSavedPin = false;
    }
    return {
      isAvailable: true,
      hasSavedPin,
      kind: mapBiometryKind(res.biometryType),
      reason: hasSavedPin ? undefined : 'not-enabled',
    };
  } catch {
    return { isAvailable: false, hasSavedPin: false, reason: 'not-supported' };
  }
}

export async function enableBiometry(pin: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Activar desbloqueo biométrico',
      title: 'Saldo',
      subtitle: 'Guardar PIN cifrado en el keystore del sistema',
    });
    await NativeBiometric.setCredentials({
      username: USERNAME,
      password: pin,
      server: SERVER,
    });
    return true;
  } catch {
    return false;
  }
}

export async function authenticateBiometry(): Promise<string | false> {
  if (!isNative()) return false;
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Desbloquear Saldo',
      title: 'Saldo',
      subtitle: 'Usa tu huella o rostro',
    });
    const creds = await NativeBiometric.getCredentials({ server: SERVER });
    return creds.password;
  } catch {
    return false;
  }
}

export async function disableBiometry(): Promise<void> {
  if (!isNative()) return;
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {
    // no-op — nothing to clear.
  }
}

// Biometric auth stub. The real plugin (@capacitor-community/biometric-auth)
// no existe en npm y @capgo/capacitor-native-biometric@7.x tiene un CVE de
// authentication bypass (GHSA-vx5f-vmr6-32wf). v8 es seguro pero requiere
// Capacitor core 8 — fuera de scope del sprint v0.2.
//
// En consecuencia, v0.2 ships PIN-only. Esta interfaz queda como contrato
// futuro para v0.3 cuando se upgrade Capacitor. La pantalla de bio en el
// onboarding lee isAvailable() y salta el step si false.

export interface BiometryStatus {
  isAvailable: boolean;
  reason?: 'not-supported' | 'not-enrolled' | 'deferred-v03';
}

export async function getBiometryStatus(): Promise<BiometryStatus> {
  return { isAvailable: false, reason: 'deferred-v03' };
}

export async function enableBiometry(): Promise<false> {
  return false;
}

export async function authenticateBiometry(): Promise<false> {
  return false;
}

export async function disableBiometry(): Promise<void> {
  // no-op — nothing to clear while biometry is disabled project-wide.
}

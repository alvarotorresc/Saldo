export {
  derivePinKey,
  generateMasterKey,
  randomBytes,
  KDF_SALT_BYTES,
  PBKDF2_ITERATIONS,
  PBKDF2_HASH,
  KEY_LENGTH_BITS,
} from './key';
export {
  wrapMasterKey,
  unwrapMasterKey,
  encryptPayload,
  decryptPayload,
  sha256,
  type WrappedKey,
  type EncryptedPayload,
} from './vault';
export {
  loadVault,
  saveVaultMeta,
  savePayload,
  clearVault,
  type VaultRecord,
  type VaultKey,
} from './storage';
export { bytesToBase64, base64ToBytes, bufferToBase64 } from './base64';
export {
  getBiometryStatus,
  enableBiometry,
  authenticateBiometry,
  disableBiometry,
  type BiometryStatus,
} from './biometric';

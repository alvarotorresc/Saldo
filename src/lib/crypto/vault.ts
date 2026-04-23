// AES-256-GCM payload encryption and master-key wrapping.
// All ciphertext/IVs are transported as base64 strings so they can be stored
// in @capacitor/preferences (which only accepts strings).

import { base64ToBytes, bufferToBase64, bytesToBase64 } from './base64';
import { randomBytes } from './key';

const GCM = 'AES-GCM' as const;
const IV_BYTES = 12; // 96-bit nonce — GCM standard

function requireSubtle(): SubtleCrypto {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API no disponible.');
  }
  return c.subtle;
}

export interface WrappedKey {
  wrapped: string; // base64
  iv: string; // base64 (12 bytes)
}

export interface EncryptedPayload {
  ct: string; // base64 ciphertext
  iv: string; // base64 (12 bytes)
  sha: string; // base64 SHA-256 of plaintext
}

export async function wrapMasterKey(master: CryptoKey, pinKey: CryptoKey): Promise<WrappedKey> {
  const subtle = requireSubtle();
  const iv = randomBytes(IV_BYTES);
  const wrapped = await subtle.wrapKey('raw', master, pinKey, { name: GCM, iv });
  return {
    wrapped: bufferToBase64(wrapped),
    iv: bytesToBase64(iv),
  };
}

export async function unwrapMasterKey(
  wrappedB64: string,
  ivB64: string,
  pinKey: CryptoKey,
): Promise<CryptoKey> {
  const subtle = requireSubtle();
  const wrapped = base64ToBytes(wrappedB64);
  const iv = base64ToBytes(ivB64);
  return subtle.unwrapKey(
    'raw',
    wrapped,
    pinKey,
    { name: GCM, iv },
    { name: GCM, length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const subtle = requireSubtle();
  const digest = await subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

export async function encryptPayload(
  payload: Uint8Array,
  master: CryptoKey,
): Promise<EncryptedPayload> {
  const subtle = requireSubtle();
  const iv = randomBytes(IV_BYTES);
  const shaBytes = await sha256(payload);
  const ct = await subtle.encrypt({ name: GCM, iv }, master, payload);
  return {
    ct: bufferToBase64(ct),
    iv: bytesToBase64(iv),
    sha: bytesToBase64(shaBytes),
  };
}

export async function decryptPayload(
  ct: string,
  iv: string,
  master: CryptoKey,
  expectedSha: string,
): Promise<Uint8Array> {
  const subtle = requireSubtle();
  const plain = await subtle.decrypt(
    { name: GCM, iv: base64ToBytes(iv) },
    master,
    base64ToBytes(ct),
  );
  const plainBytes = new Uint8Array(plain);
  const actualSha = bytesToBase64(await sha256(plainBytes));
  if (actualSha !== expectedSha) {
    throw new Error('Checksum SHA-256 mismatch — payload integrity failed.');
  }
  return plainBytes;
}

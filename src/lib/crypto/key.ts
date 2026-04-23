// PIN-derived key material via PBKDF2-SHA256.
// Iteration count follows OWASP 2024 recommendation for PBKDF2-SHA256 (600 000).

export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_HASH = 'SHA-256';
export const KEY_LENGTH_BITS = 256;
export const KDF_SALT_BYTES = 16;

function requireSubtle(): SubtleCrypto {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API no disponible. Requiere HTTPS o localhost en entornos web.');
  }
  return c.subtle;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/**
 * Derive an AES-GCM key from a PIN using PBKDF2-SHA256.
 * The returned key is non-extractable — the master key never leaves the subtle
 * crypto boundary in plaintext.
 */
export async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  if (typeof pin !== 'string' || pin.length === 0) {
    throw new Error('El PIN no puede estar vacio.');
  }
  if (salt.byteLength < 8) {
    throw new Error('Salt demasiado corto (min 8 bytes).');
  }
  const subtle = requireSubtle();
  const pinBytes = new TextEncoder().encode(pin);
  const baseKey = await subtle.importKey('raw', pinBytes, { name: 'PBKDF2' }, false, ['deriveKey']);
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt'],
  );
}

/**
 * Generate a fresh 256-bit AES-GCM master key. Extractable so we can wrap it
 * with the PIN-derived key and persist the wrapped form outside of Web Crypto.
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  const subtle = requireSubtle();
  return subtle.generateKey({ name: 'AES-GCM', length: KEY_LENGTH_BITS }, true, [
    'encrypt',
    'decrypt',
  ]);
}

import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';
import { derivePinKey, generateMasterKey, randomBytes, KDF_SALT_BYTES } from './key';
import { decryptPayload, encryptPayload, sha256, unwrapMasterKey, wrapMasterKey } from './vault';
import { clearVault, loadVault, savePayload, saveVaultMeta } from './storage';

const te = new TextEncoder();

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 42, 128]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
  it('handles empty input', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
    expect(base64ToBytes('')).toEqual(new Uint8Array());
  });
});

describe('randomBytes', () => {
  it('returns requested length', () => {
    expect(randomBytes(16).byteLength).toBe(16);
    expect(randomBytes(32).byteLength).toBe(32);
  });
  it('is non-trivial (not all zeros)', () => {
    const r = randomBytes(32);
    expect(r.some((b) => b !== 0)).toBe(true);
  });
});

describe('derivePinKey', () => {
  it('produces a stable key for same (pin, salt)', async () => {
    const salt = randomBytes(KDF_SALT_BYTES);
    const k1 = await derivePinKey('1234', salt);
    const k2 = await derivePinKey('1234', salt);
    // The key itself is opaque; round-trip a wrap to compare behavior.
    const master = await generateMasterKey();
    const w = await wrapMasterKey(master, k1);
    const unwrapped = await unwrapMasterKey(w.wrapped, w.iv, k2);
    expect(unwrapped).toBeDefined();
  });

  it('produces different behavior for different salts', async () => {
    const master = await generateMasterKey();
    const s1 = randomBytes(KDF_SALT_BYTES);
    const s2 = randomBytes(KDF_SALT_BYTES);
    const k1 = await derivePinKey('1234', s1);
    const k2 = await derivePinKey('1234', s2);
    const w = await wrapMasterKey(master, k1);
    await expect(unwrapMasterKey(w.wrapped, w.iv, k2)).rejects.toBeDefined();
  });

  it('rejects empty pin', async () => {
    await expect(derivePinKey('', randomBytes(KDF_SALT_BYTES))).rejects.toThrow(/PIN/);
  });

  it('rejects short salt', async () => {
    await expect(derivePinKey('1234', new Uint8Array(4))).rejects.toThrow(/Salt/);
  });
});

describe('wrap/unwrap master key', () => {
  it('round-trips successfully with correct PIN', async () => {
    const salt = randomBytes(KDF_SALT_BYTES);
    const pinKey = await derivePinKey('secret-pin', salt);
    const master = await generateMasterKey();
    const { wrapped, iv } = await wrapMasterKey(master, pinKey);
    const unwrapped = await unwrapMasterKey(wrapped, iv, pinKey);
    // The unwrapped master should be able to decrypt what master encrypted.
    const msg = te.encode('hola');
    const { ct, iv: ivCt, sha } = await encryptPayload(msg, master);
    const plain = await decryptPayload(ct, ivCt, unwrapped, sha);
    expect(new TextDecoder().decode(plain)).toBe('hola');
  });

  it('fails on wrong PIN', async () => {
    const salt = randomBytes(KDF_SALT_BYTES);
    const good = await derivePinKey('right', salt);
    const bad = await derivePinKey('wrong', salt);
    const master = await generateMasterKey();
    const { wrapped, iv } = await wrapMasterKey(master, good);
    await expect(unwrapMasterKey(wrapped, iv, bad)).rejects.toBeDefined();
  });
});

describe('encrypt/decrypt payload', () => {
  it('round-trips a variety of payload sizes', async () => {
    const master = await generateMasterKey();
    const samples = [
      te.encode(''),
      te.encode('x'),
      te.encode('a'.repeat(1000)),
      new Uint8Array([0, 255, 128, 64, 32, 16, 8, 4, 2, 1]),
    ];
    for (const payload of samples) {
      const enc = await encryptPayload(payload, master);
      const dec = await decryptPayload(enc.ct, enc.iv, master, enc.sha);
      expect(Array.from(dec)).toEqual(Array.from(payload));
    }
  });

  it('tampered ciphertext fails (AES-GCM auth tag)', async () => {
    const master = await generateMasterKey();
    const enc = await encryptPayload(te.encode('hola'), master);
    // Flip a byte in the middle of the ciphertext by rewriting base64.
    const bytes = Array.from(atob(enc.ct)).map((c) => c.charCodeAt(0));
    bytes[0] = bytes[0] ^ 0xff;
    const tamperedCt = btoa(String.fromCharCode(...bytes));
    await expect(decryptPayload(tamperedCt, enc.iv, master, enc.sha)).rejects.toBeDefined();
  });

  it('SHA mismatch is detected', async () => {
    const master = await generateMasterKey();
    const enc = await encryptPayload(te.encode('hola'), master);
    const fakeSha = bytesToBase64(await sha256(te.encode('otra cosa')));
    await expect(decryptPayload(enc.ct, enc.iv, master, fakeSha)).rejects.toThrow(/Checksum/);
  });

  it('different IVs per call (never reuses nonce)', async () => {
    const master = await generateMasterKey();
    const a = await encryptPayload(te.encode('hola'), master);
    const b = await encryptPayload(te.encode('hola'), master);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });
});

describe('storage (web fallback)', () => {
  it('round-trips vault meta and payload', async () => {
    await clearVault();
    await saveVaultMeta('w1', 'iv1', 's1');
    await savePayload('ct1', 'pv1', 'sh1');
    const v = await loadVault();
    expect(v).toEqual({
      wrappedKey: 'w1',
      wrapIv: 'iv1',
      kdfSalt: 's1',
      payloadCt: 'ct1',
      payloadIv: 'pv1',
      payloadSha: 'sh1',
    });
  });

  it('returns null when meta missing', async () => {
    await clearVault();
    expect(await loadVault()).toBeNull();
  });

  it('clearVault removes all entries', async () => {
    await saveVaultMeta('a', 'b', 'c');
    await clearVault();
    expect(await loadVault()).toBeNull();
  });
});

describe('biometric web shim (jsdom)', () => {
  it('reports isAvailable=true on the Capacitor web shim and round-trips enable→authenticate', async () => {
    const { getBiometryStatus, enableBiometry, authenticateBiometry, disableBiometry } =
      await import('./biometric');
    // Ensure clean state across test runs (shim uses in-memory Map).
    await disableBiometry();

    const status = await getBiometryStatus();
    expect(status.isAvailable).toBe(true);
    expect(status.hasSavedPin).toBe(false);

    expect(await enableBiometry('123456')).toBe(true);
    const afterEnable = await getBiometryStatus();
    expect(afterEnable.hasSavedPin).toBe(true);
    expect(await authenticateBiometry()).toBe('123456');

    await disableBiometry();
    expect(await authenticateBiometry()).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearVault } from '@/lib/crypto';
import { db } from '@/db/database';
import { resetDb } from '@/test/resetDb';
import {
  DEFAULT_AUTO_LOCK_MS,
  LOCKOUT_MS,
  LOCKOUT_THRESHOLD,
  installAutoLock,
  useLock,
} from './lock';

const PRIMARY_KEY = 'saldo.vaultPayload';
const BACKUP_KEY = 'saldo.vaultPayloadBackup';

async function resetLock(): Promise<void> {
  localStorage.clear();
  await clearVault();
  await resetDb();
  useLock.setState({
    status: 'booting',
    master: null,
    failedAttempts: 0,
    lockedOutUntil: null,
    lastActivityAt: Date.now(),
    autoLockMs: DEFAULT_AUTO_LOCK_MS,
  });
}

describe('lock store boot', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('boots to welcome when no vault exists', async () => {
    await useLock.getState().boot();
    expect(useLock.getState().status).toBe('welcome');
  });

  it('boots to locked when vault exists, master=null', async () => {
    await useLock.getState().setupPin('123456');
    expect(useLock.getState().status).toBe('unlocked');
    // simulate a hard reload — reset in-memory state but keep vault.
    useLock.setState({ status: 'booting', master: null });
    await useLock.getState().boot();
    expect(useLock.getState().status).toBe('locked');
    expect(useLock.getState().master).toBeNull();
  });

  it('hard-kill recovery: wipes Dexie plaintext when vault + snapshot + rows present', async () => {
    // Setup leaves an empty encrypted baseline + empty Dexie (wiped by
    // encryptAndWipe). Unlock restores; now we mutate Dexie without locking
    // again, simulating a hard-kill mid-session.
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    await useLock.getState().unlock('123456');
    await db.accounts.add({ name: 'dirty', bank: 'manual', currency: 'EUR', createdAt: 0 });
    expect(await db.accounts.count()).toBeGreaterThan(0);

    // Simulate hard-kill: master lost, vault still exists, snapshot still
    // exists, Dexie holds plaintext rows.
    useLock.setState({ status: 'booting', master: null });
    await useLock.getState().boot();

    expect(useLock.getState().status).toBe('locked');
    expect(await db.accounts.count()).toBe(0);
  });
});

describe('lock store setupPin', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('produces an unlocked state with a master key', async () => {
    await useLock.getState().setupPin('123456');
    const s = useLock.getState();
    expect(s.status).toBe('unlocked');
    expect(s.master).not.toBeNull();
  });

  it('rejects PIN shorter than PIN_MIN_LENGTH', async () => {
    await expect(useLock.getState().setupPin('12345')).rejects.toThrow(/PIN/);
  });

  it('writes a baseline encrypted snapshot so boot() can detect hard-kill', async () => {
    await useLock.getState().setupPin('123456');
    expect(localStorage.getItem(PRIMARY_KEY)).not.toBeNull();
  });
});

describe('lock store unlock', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('accepts correct PIN and restores master', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    const ok = await useLock.getState().unlock('123456');
    expect(ok).toBe(true);
    expect(useLock.getState().master).not.toBeNull();
    expect(useLock.getState().status).toBe('unlocked');
  });

  it('rejects wrong PIN and increments failedAttempts', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    const ok = await useLock.getState().unlock('000000');
    expect(ok).toBe(false);
    expect(useLock.getState().failedAttempts).toBe(1);
    expect(useLock.getState().status).toBe('locked');
  });

  it('triggers lockout after N consecutive failures', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      await useLock.getState().unlock('000000');
    }
    const { lockedOutUntil } = useLock.getState();
    expect(lockedOutUntil).not.toBeNull();
    expect(lockedOutUntil! - Date.now()).toBeGreaterThan(LOCKOUT_MS - 1000);
  });

  it('refuses unlock while locked out even with correct PIN', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      await useLock.getState().unlock('000000');
    }
    const ok = await useLock.getState().unlock('123456');
    expect(ok).toBe(false);
  });

  it('clears attempts on successful unlock', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    await useLock.getState().unlock('000000');
    expect(useLock.getState().failedAttempts).toBe(1);
    await useLock.getState().unlock('123456');
    expect(useLock.getState().failedAttempts).toBe(0);
  });
});

// GAP-002 — encrypt→wipe→decrypt→restore real cycle
describe('lock store — full encrypt/wipe/decrypt/restore cycle', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('lock() encrypts snapshot and wipes Dexie rows', async () => {
    await useLock.getState().setupPin('123456');
    const accountId = await db.accounts.add({
      name: 'a',
      bank: 'manual',
      currency: 'EUR',
      createdAt: 0,
    });
    await db.transactions.add({
      accountId: accountId as number,
      date: '2026-04-01',
      amount: 5,
      kind: 'expense',
      description: 'test',
      month: '2026-04',
      createdAt: 0,
    });

    await useLock.getState().lock();

    expect(useLock.getState().status).toBe('locked');
    expect(useLock.getState().master).toBeNull();
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    expect(localStorage.getItem(PRIMARY_KEY)).not.toBeNull();
  });

  it('unlock(correct PIN) decrypts and restores seeded rows', async () => {
    await useLock.getState().setupPin('123456');
    await db.accounts.add({ name: 'seed', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await useLock.getState().lock();

    const ok = await useLock.getState().unlock('123456');
    expect(ok).toBe(true);
    const rows = await db.accounts.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('seed');
  });

  it('lock() then unlock(wrong PIN) leaves the encrypted snapshot untouched', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    const before = localStorage.getItem(PRIMARY_KEY);
    await useLock.getState().unlock('999999');
    const after = localStorage.getItem(PRIMARY_KEY);
    expect(after).toBe(before);
  });

  it('lock() keeps previous payload under BACKUP_KEY (one generation)', async () => {
    await useLock.getState().setupPin('123456');
    await db.accounts.add({ name: 'gen1', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await useLock.getState().lock();
    const gen1 = localStorage.getItem(PRIMARY_KEY);
    await useLock.getState().unlock('123456');
    await db.accounts.add({ name: 'gen2', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await useLock.getState().lock();
    expect(localStorage.getItem(BACKUP_KEY)).toBe(gen1);
    expect(localStorage.getItem(PRIMARY_KEY)).not.toBe(gen1);
  });

  it('sets lastUnlockError=vault-corrupt on checksum mismatch without incrementing failedAttempts (S-MEDIO-004)', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    const raw = JSON.parse(localStorage.getItem(PRIMARY_KEY)!);
    localStorage.setItem(PRIMARY_KEY, JSON.stringify({ ...raw, sha: 'AAAA' }));
    localStorage.removeItem(BACKUP_KEY);

    const before = useLock.getState().failedAttempts;
    const ok = await useLock.getState().unlock('123456');
    expect(ok).toBe(false);
    expect(useLock.getState().failedAttempts).toBe(before);
    expect(useLock.getState().lastUnlockError).toBe('vault-corrupt');
  });

  it('sets lastUnlockError=wrong-pin on bad PIN', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    await useLock.getState().unlock('999999');
    expect(useLock.getState().lastUnlockError).toBe('wrong-pin');
  });

  it('lock() is reentrant-safe: a second concurrent call is a no-op (S-MEDIO-002)', async () => {
    await useLock.getState().setupPin('123456');
    await db.accounts.add({ name: 'x', bank: 'manual', currency: 'EUR', createdAt: 0 });
    // Fire two locks in parallel — the second must see _locking=true and bail.
    const [a, b] = await Promise.all([useLock.getState().lock(), useLock.getState().lock()]);
    void a;
    void b;
    expect(useLock.getState().status).toBe('locked');
    expect(useLock.getState().master).toBeNull();
    expect(useLock.getState()._locking).toBe(false);
  });

  it('unlock does NOT surface unlocked status on SHA mismatch', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    // tamper with the ciphertext sha to force a checksum mismatch.
    const raw = JSON.parse(localStorage.getItem(PRIMARY_KEY)!);
    localStorage.setItem(PRIMARY_KEY, JSON.stringify({ ...raw, sha: 'AAAA' }));
    localStorage.removeItem(BACKUP_KEY);
    const ok = await useLock.getState().unlock('123456');
    expect(ok).toBe(false);
    expect(useLock.getState().status).toBe('locked');
    expect(useLock.getState().master).toBeNull();
  });
});

describe('lock store lock + activity', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('lock() clears master and sets status', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    expect(useLock.getState().master).toBeNull();
    expect(useLock.getState().status).toBe('locked');
  });

  it('lock() still sets status=locked even when encryptAndWipe throws (C-BLK-004)', async () => {
    await useLock.getState().setupPin('123456');
    // break localStorage.setItem so encryptAndWipe fails. jsdom's localStorage
    // is a Storage instance — stub setItem to throw QuotaExceededError.
    const origSet = Storage.prototype.setItem;
    try {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await useLock.getState().lock();
      expect(useLock.getState().master).toBeNull();
      expect(useLock.getState().status).toBe('locked');
      consoleSpy.mockRestore();
    } finally {
      Storage.prototype.setItem = origSet;
    }
  });

  it('registerActivity bumps lastActivityAt', () => {
    useLock.setState({ lastActivityAt: 0 });
    useLock.getState().registerActivity();
    expect(useLock.getState().lastActivityAt).toBeGreaterThan(0);
  });

  it('setAutoLockMs clamps to >= 1s', () => {
    useLock.getState().setAutoLockMs(500);
    expect(useLock.getState().autoLockMs).toBe(1000);
    useLock.getState().setAutoLockMs(45_000);
    expect(useLock.getState().autoLockMs).toBe(45_000);
  });

  it('setAutoLockMs persists to db.meta and boot rehydrates it (S-ALTO-003)', async () => {
    useLock.getState().setAutoLockMs(300_000);
    // flush the fire-and-forget persist
    await new Promise((r) => setTimeout(r, 0));
    const row = await db.meta.get('autoLockMs');
    expect(row?.value).toBe('300000');

    // simulate relaunch: reset in-memory + re-boot.
    useLock.setState({ status: 'booting', autoLockMs: DEFAULT_AUTO_LOCK_MS });
    await useLock.getState().boot();
    expect(useLock.getState().autoLockMs).toBe(300_000);
  });
});

// GAP-002 — changePin coverage
describe('lock store changePin', () => {
  beforeEach(async () => {
    await resetLock();
    await useLock.getState().setupPin('111111');
  });
  afterEach(resetLock);

  it('accepts correct oldPin and updates vault so unlock(newPin) works', async () => {
    const ok = await useLock.getState().changePin('111111', '222222');
    expect(ok).toBe(true);
    await useLock.getState().lock();
    const unlocked = await useLock.getState().unlock('222222');
    expect(unlocked).toBe(true);
  });

  it('rejects when oldPin is wrong and leaves vault untouched', async () => {
    const ok = await useLock.getState().changePin('999999', '222222');
    expect(ok).toBe(false);
    await useLock.getState().lock();
    expect(await useLock.getState().unlock('111111')).toBe(true);
  });

  it('throws when newPin is too short', async () => {
    await expect(useLock.getState().changePin('111111', '12345')).rejects.toThrow(/PIN/);
  });

  it('after changePin, unlock(oldPin) returns false (security-critical)', async () => {
    await useLock.getState().changePin('111111', '222222');
    await useLock.getState().lock();
    const ok = await useLock.getState().unlock('111111');
    expect(ok).toBe(false);
  });

  it('disables biometry when re-enabling fails post-changePin (S-ALTO-001)', async () => {
    const mod = await import('@/lib/crypto');
    const statusSpy = vi
      .spyOn(mod, 'getBiometryStatus')
      .mockResolvedValue({ isAvailable: true, hasSavedPin: true, kind: 'fingerprint' });
    const enableSpy = vi.spyOn(mod, 'enableBiometry').mockResolvedValue(false);
    const disableSpy = vi.spyOn(mod, 'disableBiometry').mockResolvedValue(undefined);

    const ok = await useLock.getState().changePin('111111', '222222');
    expect(ok).toBe(true);
    expect(enableSpy).toHaveBeenCalledWith('222222');
    expect(disableSpy).toHaveBeenCalled();

    statusSpy.mockRestore();
    enableSpy.mockRestore();
    disableSpy.mockRestore();
  });

  it('after changePin, snapshot still decrypts with the (same) master key', async () => {
    // Seed, lock, change pin, lock again, unlock with new — data survives.
    await useLock.getState().lock();
    await useLock.getState().unlock('111111');
    await db.accounts.add({ name: 'persist', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await useLock.getState().changePin('111111', '222222');
    await useLock.getState().lock();
    const ok = await useLock.getState().unlock('222222');
    expect(ok).toBe(true);
    const rows = await db.accounts.toArray();
    expect(rows.some((a) => a.name === 'persist')).toBe(true);
  });
});

// GAP-002 — unlockWithBiometry
describe('lock store unlockWithBiometry', () => {
  beforeEach(resetLock);
  afterEach(async () => {
    vi.doUnmock('@/lib/crypto');
    await resetLock();
  });

  it('returns false when biometric auth fails', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    const mod = await import('@/lib/crypto');
    const spy = vi.spyOn(mod, 'authenticateBiometry').mockResolvedValue(false);
    const ok = await useLock.getState().unlockWithBiometry();
    expect(ok).toBe(false);
    spy.mockRestore();
  });

  it('unlocks when biometric yields the correct PIN', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    const mod = await import('@/lib/crypto');
    const spy = vi.spyOn(mod, 'authenticateBiometry').mockResolvedValue('123456');
    const ok = await useLock.getState().unlockWithBiometry();
    expect(ok).toBe(true);
    expect(useLock.getState().status).toBe('unlocked');
    spy.mockRestore();
  });

  it('stays locked when biometric yields a stale/wrong PIN', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    const mod = await import('@/lib/crypto');
    const spy = vi.spyOn(mod, 'authenticateBiometry').mockResolvedValue('999999');
    const ok = await useLock.getState().unlockWithBiometry();
    expect(ok).toBe(false);
    expect(useLock.getState().status).toBe('locked');
    spy.mockRestore();
  });
});

// GAP-002 — wipeVault exhaustive
describe('lock store wipeVault', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('removes vault, encrypted snapshot and backup from localStorage', async () => {
    await useLock.getState().setupPin('123456');
    await db.accounts.add({ name: 'x', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await useLock.getState().lock();
    await useLock.getState().unlock('123456');
    await useLock.getState().lock(); // creates a backup entry
    expect(localStorage.getItem(PRIMARY_KEY)).not.toBeNull();

    await useLock.getState().wipeVault();

    expect(localStorage.getItem(PRIMARY_KEY)).toBeNull();
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    expect(localStorage.getItem('saldo.vault.wrappedKey')).toBeNull();
    expect(localStorage.getItem('saldo.vault.wrapIv')).toBeNull();
    expect(localStorage.getItem('saldo.vault.kdfSalt')).toBeNull();
  });

  it('clears Dexie tables so plaintext does not survive', async () => {
    await useLock.getState().setupPin('123456');
    await db.accounts.add({ name: 'a', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await db.transactions.add({
      accountId: 1,
      date: '2026-04-01',
      amount: 1,
      kind: 'expense',
      description: 't',
      month: '2026-04',
      createdAt: 0,
    });
    await useLock.getState().wipeVault();
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it('returns the store to welcome and clears failedAttempts/lockedOutUntil', async () => {
    await useLock.getState().setupPin('123456');
    await useLock.getState().lock();
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      await useLock.getState().unlock('999999');
    }
    expect(useLock.getState().lockedOutUntil).not.toBeNull();

    await useLock.getState().wipeVault();

    expect(useLock.getState().status).toBe('welcome');
    expect(useLock.getState().failedAttempts).toBe(0);
    expect(useLock.getState().lockedOutUntil).toBeNull();
    await useLock.getState().boot();
    expect(useLock.getState().status).toBe('welcome');
  });
});

describe('installAutoLock', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('locks after inactivity exceeds autoLockMs', async () => {
    await useLock.getState().setupPin('123456');
    useLock.getState().setAutoLockMs(1_000);
    const past = Date.now() - 60_000;
    useLock.setState({ lastActivityAt: past });
    let now = past + 60_000;
    const cleanup = installAutoLock(() => now);
    await new Promise((r) => setTimeout(r, 1050));
    expect(useLock.getState().status).toBe('locked');
    cleanup();
  });

  it('does nothing when not unlocked', async () => {
    await useLock.getState().boot();
    const cleanup = installAutoLock();
    await new Promise((r) => setTimeout(r, 50));
    expect(useLock.getState().status).toBe('welcome');
    cleanup();
  });
});

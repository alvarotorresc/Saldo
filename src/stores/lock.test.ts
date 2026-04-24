import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearVault } from '@/lib/crypto';
import {
  DEFAULT_AUTO_LOCK_MS,
  LOCKOUT_MS,
  LOCKOUT_THRESHOLD,
  installAutoLock,
  useLock,
} from './lock';

async function resetLock(): Promise<void> {
  await clearVault();
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
    await useLock.getState().setupPin('12345');
    expect(useLock.getState().status).toBe('unlocked');
    // simulate a hard reload — reset in-memory state but keep vault.
    useLock.setState({ status: 'booting', master: null });
    await useLock.getState().boot();
    expect(useLock.getState().status).toBe('locked');
    expect(useLock.getState().master).toBeNull();
  });
});

describe('lock store setupPin', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('produces an unlocked state with a master key', async () => {
    await useLock.getState().setupPin('12345');
    const s = useLock.getState();
    expect(s.status).toBe('unlocked');
    expect(s.master).not.toBeNull();
  });

  it('rejects PIN shorter than 4 digits', async () => {
    await expect(useLock.getState().setupPin('12')).rejects.toThrow(/PIN/);
  });
});

describe('lock store unlock', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('accepts correct PIN and restores master', async () => {
    await useLock.getState().setupPin('12345');
    await useLock.getState().lock();
    const ok = await useLock.getState().unlock('12345');
    expect(ok).toBe(true);
    expect(useLock.getState().master).not.toBeNull();
    expect(useLock.getState().status).toBe('unlocked');
  });

  it('rejects wrong PIN and increments failedAttempts', async () => {
    await useLock.getState().setupPin('12345');
    await useLock.getState().lock();
    const ok = await useLock.getState().unlock('00000');
    expect(ok).toBe(false);
    expect(useLock.getState().failedAttempts).toBe(1);
    expect(useLock.getState().status).toBe('locked');
  });

  it('triggers lockout after N consecutive failures', async () => {
    await useLock.getState().setupPin('12345');
    await useLock.getState().lock();
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      await useLock.getState().unlock('00000');
    }
    const { lockedOutUntil } = useLock.getState();
    expect(lockedOutUntil).not.toBeNull();
    expect(lockedOutUntil! - Date.now()).toBeGreaterThan(LOCKOUT_MS - 1000);
  });

  it('refuses unlock while locked out even with correct PIN', async () => {
    await useLock.getState().setupPin('12345');
    await useLock.getState().lock();
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      await useLock.getState().unlock('00000');
    }
    const ok = await useLock.getState().unlock('12345');
    expect(ok).toBe(false);
  });

  it('clears attempts on successful unlock', async () => {
    await useLock.getState().setupPin('12345');
    await useLock.getState().lock();
    await useLock.getState().unlock('00000');
    expect(useLock.getState().failedAttempts).toBe(1);
    await useLock.getState().unlock('12345');
    expect(useLock.getState().failedAttempts).toBe(0);
  });
});

describe('lock store lock + activity', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('lock() clears master and sets status', async () => {
    await useLock.getState().setupPin('12345');
    await useLock.getState().lock();
    expect(useLock.getState().master).toBeNull();
    expect(useLock.getState().status).toBe('locked');
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
});

describe('lock store wipe', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('wipeVault removes vault and returns to welcome', async () => {
    await useLock.getState().setupPin('12345');
    await useLock.getState().wipeVault();
    expect(useLock.getState().status).toBe('welcome');
    await useLock.getState().boot();
    expect(useLock.getState().status).toBe('welcome');
  });
});

describe('installAutoLock', () => {
  beforeEach(resetLock);
  afterEach(resetLock);

  it('locks after inactivity exceeds autoLockMs', async () => {
    await useLock.getState().setupPin('12345');
    useLock.getState().setAutoLockMs(1_000);
    // Simulate past activity.
    const past = Date.now() - 60_000;
    useLock.setState({ lastActivityAt: past });
    let now = past + 60_000;
    const cleanup = installAutoLock(() => now);
    // Manually trigger the tick by advancing now — the tick runs on interval,
    // but we can also directly call lock() via the tick trigger by simulating
    // setInterval under vi. Simpler: trigger via registerActivity path.
    // We directly call the tick logic by awaiting a short delay >1s.
    await new Promise((r) => setTimeout(r, 1050));
    expect(useLock.getState().status).toBe('locked');
    cleanup();
  });

  it('does nothing when not unlocked', async () => {
    // vault absent → welcome → ticks should not crash.
    await useLock.getState().boot();
    const cleanup = installAutoLock();
    await new Promise((r) => setTimeout(r, 50));
    expect(useLock.getState().status).toBe('welcome');
    cleanup();
  });
});

import { create } from 'zustand';
import {
  clearVault,
  derivePinKey,
  generateMasterKey,
  KDF_SALT_BYTES,
  loadVault,
  randomBytes,
  saveVaultMeta,
  unwrapMasterKey,
  wrapMasterKey,
  bytesToBase64,
  base64ToBytes,
  clearEncryptedSnapshot,
  decryptAndRestore,
  encryptAndWipe,
  hasEncryptedSnapshot,
  hasPlaintextData,
  wipeTables,
  authenticateBiometry,
  disableBiometry,
  enableBiometry,
  getBiometryStatus,
} from '@/lib/crypto';
import { db } from '@/db/database';

export type LockStatus = 'booting' | 'welcome' | 'setup' | 'locked' | 'unlocked';

export const DEFAULT_AUTO_LOCK_MS = 30_000;
export const LOCKOUT_MS = 30_000;
export const LOCKOUT_THRESHOLD = 3;
export const AUTO_LOCK_META_KEY = 'autoLockMs';

async function loadAutoLockMs(): Promise<number | null> {
  try {
    const row = await db.meta.get(AUTO_LOCK_META_KEY);
    if (!row?.value) return null;
    const n = Number(row.value);
    return Number.isFinite(n) && n >= 1000 ? n : null;
  } catch {
    return null;
  }
}

async function persistAutoLockMs(ms: number): Promise<void> {
  try {
    await db.meta.put({ key: AUTO_LOCK_META_KEY, value: String(ms) });
  } catch {
    // meta table unavailable (e.g. DB closed mid-shutdown); in-memory value
    // stays correct for this session, next boot falls back to default.
  }
}

export interface LockState {
  status: LockStatus;
  master: CryptoKey | null;
  failedAttempts: number;
  lockedOutUntil: number | null;
  lastActivityAt: number;
  autoLockMs: number;
  boot(): Promise<void>;
  setupPin(pin: string): Promise<void>;
  unlock(pin: string): Promise<boolean>;
  unlockWithBiometry(): Promise<boolean>;
  lock(): Promise<void>;
  setAutoLockMs(ms: number): void;
  registerActivity(): void;
  wipeVault(): Promise<void>;
  changePin(oldPin: string, newPin: string): Promise<boolean>;
  // Test helpers — NOT for UI use.
  _setStatus(status: LockStatus): void;
}

export const useLock = create<LockState>((set, get) => ({
  status: 'booting',
  master: null,
  failedAttempts: 0,
  lockedOutUntil: null,
  lastActivityAt: Date.now(),
  autoLockMs: DEFAULT_AUTO_LOCK_MS,

  async boot() {
    // Hydrate autoLockMs from db.meta (plaintext setting, not in the encrypted
    // snapshot). Without this, Settings "lies": the user picks 5m, reloads and
    // sees 30s again.
    const persistedAutoLock = await loadAutoLockMs();
    if (persistedAutoLock !== null) {
      set({ autoLockMs: persistedAutoLock });
    }
    const vault = await loadVault();
    if (!vault) {
      set({ status: 'welcome' });
      return;
    }
    // Hard-kill recovery: if there's a vault but Dexie still holds plaintext
    // rows, the process died mid-session without a clean lock(). Wipe the
    // plaintext so an attacker with physical access cannot read it through
    // DevTools/IndexedDB viewer. The user will lose uncommitted session data
    // (only what was written since the last lock) but the encrypted snapshot
    // restored on unlock preserves everything up to the previous lock.
    try {
      if (hasEncryptedSnapshot() && (await hasPlaintextData())) {
        await wipeTables();
      }
    } catch (e) {
      console.error('boot: hard-kill recovery failed', e);
    }
    // Vault exists: always require unlock on every boot, even if the tab was
    // in-memory before (hard reload must clear master).
    set({ status: 'locked', master: null });
  },

  async setupPin(pin: string) {
    if (pin.length < 4) throw new Error('PIN minimo 4 digitos.');
    const salt = randomBytes(KDF_SALT_BYTES);
    const pinKey = await derivePinKey(pin, salt);
    const master = await generateMasterKey();
    const { wrapped, iv } = await wrapMasterKey(master, pinKey);
    await saveVaultMeta(wrapped, iv, bytesToBase64(salt));
    // Establish a baseline encrypted snapshot so hasEncryptedSnapshot() is true
    // from the moment setup completes. Without this, a hard-kill between
    // setupPin() and the first lock() leaves the vault without any encrypted
    // state, which boot() cannot distinguish from "fresh install".
    try {
      await encryptAndWipe(master);
    } catch (e) {
      // Web-only tests without localStorage or IndexedDB fall back to plain
      // in-memory state. We still set the master so the UI can progress.
      console.warn('setupPin: baseline encryptAndWipe skipped', e);
    }
    set({ master, status: 'unlocked', failedAttempts: 0, lastActivityAt: Date.now() });
  },

  async unlock(pin: string) {
    const now = Date.now();
    const { lockedOutUntil } = get();
    if (lockedOutUntil && now < lockedOutUntil) {
      return false;
    }
    const vault = await loadVault();
    if (!vault) throw new Error('No hay vault. Completa el setup primero.');
    let pinKey: CryptoKey;
    try {
      pinKey = await derivePinKey(pin, base64ToBytes(vault.kdfSalt));
    } catch {
      return false;
    }
    try {
      const master = await unwrapMasterKey(vault.wrappedKey, vault.wrapIv, pinKey);
      // If we have a previously-encrypted snapshot, decrypt and restore Dexie
      // before surfacing the unlocked state to the UI. First-setup unlocks
      // leave Dexie untouched because no snapshot exists yet.
      try {
        await decryptAndRestore(master);
      } catch (e) {
        // Corrupt or mismatched payload: abort the unlock to avoid exposing
        // stale/plaintext tables. Signals to the UI that the vault is bad.
        console.error('decryptAndRestore failed', e);
        return false;
      }
      set({
        master,
        status: 'unlocked',
        failedAttempts: 0,
        lockedOutUntil: null,
        lastActivityAt: Date.now(),
      });
      return true;
    } catch {
      const nextFailed = get().failedAttempts + 1;
      const nextLockout = nextFailed >= LOCKOUT_THRESHOLD ? Date.now() + LOCKOUT_MS : null;
      set({
        failedAttempts: nextFailed,
        lockedOutUntil: nextLockout,
      });
      return false;
    }
  },

  async lock() {
    const { master } = get();
    if (master) {
      try {
        await encryptAndWipe(master);
      } catch (e) {
        // localStorage unavailable or Dexie broken: surface the failure but
        // still drop the master from memory. The UI promised to lock; keeping
        // the master alive would be a lie. We accept that plaintext may remain
        // in Dexie (unavoidable without localStorage) and rely on boot()'s
        // hard-kill recovery to clear it on next launch.
        console.error('encryptAndWipe failed; dropping master anyway', e);
      }
    }
    set({ master: null, status: 'locked' });
  },

  setAutoLockMs(ms: number) {
    const next = Math.max(1000, ms);
    set({ autoLockMs: next });
    void persistAutoLockMs(next);
  },

  registerActivity() {
    set({ lastActivityAt: Date.now() });
  },

  async unlockWithBiometry() {
    const pin = await authenticateBiometry();
    if (!pin) return false;
    return get().unlock(pin);
  },

  async wipeVault() {
    // Full destructive wipe: Dexie plaintext, encrypted snapshot, crypto
    // metadata, biometric credential. Order matters — we clear encrypted
    // artefacts last so any partial failure still leaves us without readable
    // data. The transaction covers every known table so no caller needs to
    // add their own wipe list (the cause of C-BLK-006).
    try {
      await wipeTables();
    } catch (e) {
      console.error('wipeVault: wipeTables failed', e);
    }
    // Settings in db.meta are kept plaintext (not in the encrypted snapshot)
    // so they survive lock/unlock; wipeVault is the only place that should
    // clear them.
    try {
      await db.meta.clear();
    } catch (e) {
      console.error('wipeVault: meta.clear failed', e);
    }
    try {
      await disableBiometry();
    } catch (e) {
      console.error('wipeVault: disableBiometry failed', e);
    }
    clearEncryptedSnapshot();
    await clearVault();
    set({
      master: null,
      status: 'welcome',
      failedAttempts: 0,
      lockedOutUntil: null,
    });
  },

  async changePin(oldPin: string, newPin: string) {
    if (newPin.length < 4) throw new Error('PIN minimo 4 digitos.');
    const vault = await loadVault();
    if (!vault) throw new Error('No hay vault.');
    let oldPinKey: CryptoKey;
    let master: CryptoKey;
    try {
      oldPinKey = await derivePinKey(oldPin, base64ToBytes(vault.kdfSalt));
      master = await unwrapMasterKey(vault.wrappedKey, vault.wrapIv, oldPinKey);
    } catch {
      return false;
    }
    const newSalt = randomBytes(KDF_SALT_BYTES);
    const newPinKey = await derivePinKey(newPin, newSalt);
    const { wrapped, iv } = await wrapMasterKey(master, newPinKey);
    await saveVaultMeta(wrapped, iv, bytesToBase64(newSalt));
    // Keep the biometric keystore in sync. Without this, users with biometry
    // enabled silently lock themselves out on next unlockWithBiometry because
    // getCredentials returns the old PIN.
    try {
      const bio = await getBiometryStatus();
      if (bio.hasSavedPin) {
        await enableBiometry(newPin);
      }
    } catch (e) {
      console.warn('changePin: biometry keystore update skipped', e);
    }
    set({ master, failedAttempts: 0, lockedOutUntil: null });
    return true;
  },

  _setStatus(status: LockStatus) {
    set({ status });
  },
}));

/**
 * Install auto-lock timer + visibilitychange listener. Returns a cleanup fn.
 * Call once from the app shell (React effect in App.tsx).
 */
export function installAutoLock(nowFn: () => number = Date.now): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const tick = () => {
    const s = useLock.getState();
    if (s.status !== 'unlocked') return;
    if (nowFn() - s.lastActivityAt >= s.autoLockMs) {
      void s.lock();
    }
  };
  const onVisibility = () => {
    const s = useLock.getState();
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      if (s.status === 'unlocked') void s.lock();
    }
  };
  const onActivity = () => {
    const s = useLock.getState();
    if (s.status === 'unlocked') s.registerActivity();
  };

  timer = setInterval(tick, 1000);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
  }
  return () => {
    if (timer) clearInterval(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    }
  };
}

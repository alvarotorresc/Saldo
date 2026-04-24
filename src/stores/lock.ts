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
} from '@/lib/crypto';

export type LockStatus = 'booting' | 'welcome' | 'setup' | 'locked' | 'unlocked';

export const DEFAULT_AUTO_LOCK_MS = 30_000;
export const LOCKOUT_MS = 30_000;
export const LOCKOUT_THRESHOLD = 3;

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
  lock(): void;
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
    const vault = await loadVault();
    if (!vault) {
      set({ status: 'welcome' });
      return;
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

  lock() {
    set({ master: null, status: 'locked' });
  },

  setAutoLockMs(ms: number) {
    set({ autoLockMs: Math.max(1000, ms) });
  },

  registerActivity() {
    set({ lastActivityAt: Date.now() });
  },

  async wipeVault() {
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
      s.lock();
    }
  };
  const onVisibility = () => {
    const s = useLock.getState();
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      if (s.status === 'unlocked') s.lock();
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

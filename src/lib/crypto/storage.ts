// Persistence layer for crypto vault metadata (wrapped master key, salt, IVs,
// checksum). On native platforms uses @capacitor/preferences; in web falls
// back to localStorage so dev + jsdom tests work without native bridge.

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export interface VaultRecord {
  wrappedKey: string;
  wrapIv: string;
  kdfSalt: string;
  payloadCt?: string;
  payloadIv?: string;
  payloadSha?: string;
}

export type VaultKey = keyof VaultRecord;

const PREFIX = 'saldo.vault.';

function useCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function nativeGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value ?? null;
}

async function nativeSet(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value });
}

async function nativeRemove(key: string): Promise<void> {
  await Preferences.remove({ key });
}

function webGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

function webSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
}

function webRemove(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

async function get(key: VaultKey): Promise<string | null> {
  const fullKey = PREFIX + key;
  return useCapacitor() ? nativeGet(fullKey) : webGet(fullKey);
}

async function set(key: VaultKey, value: string): Promise<void> {
  const fullKey = PREFIX + key;
  if (useCapacitor()) return nativeSet(fullKey, value);
  webSet(fullKey, value);
}

async function remove(key: VaultKey): Promise<void> {
  const fullKey = PREFIX + key;
  if (useCapacitor()) return nativeRemove(fullKey);
  webRemove(fullKey);
}

export async function loadVault(): Promise<VaultRecord | null> {
  const wrappedKey = await get('wrappedKey');
  const wrapIv = await get('wrapIv');
  const kdfSalt = await get('kdfSalt');
  if (!wrappedKey || !wrapIv || !kdfSalt) return null;
  const payloadCt = (await get('payloadCt')) ?? undefined;
  const payloadIv = (await get('payloadIv')) ?? undefined;
  const payloadSha = (await get('payloadSha')) ?? undefined;
  return { wrappedKey, wrapIv, kdfSalt, payloadCt, payloadIv, payloadSha };
}

export async function saveVaultMeta(
  wrappedKey: string,
  wrapIv: string,
  kdfSalt: string,
): Promise<void> {
  await set('wrappedKey', wrappedKey);
  await set('wrapIv', wrapIv);
  await set('kdfSalt', kdfSalt);
}

export async function savePayload(
  payloadCt: string,
  payloadIv: string,
  payloadSha: string,
): Promise<void> {
  await set('payloadCt', payloadCt);
  await set('payloadIv', payloadIv);
  await set('payloadSha', payloadSha);
}

export async function clearVault(): Promise<void> {
  const keys: VaultKey[] = [
    'wrappedKey',
    'wrapIv',
    'kdfSalt',
    'payloadCt',
    'payloadIv',
    'payloadSha',
  ];
  for (const k of keys) await remove(k);
}

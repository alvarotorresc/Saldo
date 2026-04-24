# Security Review v0.2.0 — Post-fixes

- Fecha: 2026-04-24
- Auditor: security-agent
- Branch: feat/redesign-v2-f15-reviews
- Commit HEAD: `83114034a009b9ef3ae910ce5e2c1bf4e94fbaa4`
- Alcance: verificación de los 6 ALTOs y 4 MEDIOs del `security-review.md` original + búsqueda de regresiones en el código modificado.

---

## Veredicto ejecutivo

**APROBADO CON CONDICIÓN — ALTO-001 PARCIAL bloquea bio-users en cambio de PIN.**

5 de los 6 ALTOs están completamente cerrados. ALTO-001 está parcialmente implementado: el re-enable del keystore biométrico se llama pero no se maneja el retorno `false` (path de usuario que cancela el prompt), dejando el keystore con el PIN anterior y exponiendo el lockout silencioso que el fix original debía prevenir. El código para cerrar ALTO-001 completamente es una línea de `disableBiometry()` — se recomienda añadirla antes del tag.

Los 4 MEDIOs: MEDIO-001, MEDIO-002, MEDIO-003 cerrados. MEDIO-004 parcialmente cerrado (lógica del store correcta, UI no diferencia el error).

No se encontraron regresiones de seguridad en el código nuevo.

---

## Estado de hallazgos del review anterior

### ALTOs

#### [S-ALTO-001] `changePin` actualiza el keystore biométrico — PARCIAL

`lock.ts:293-301`. Tras el re-wrap exitoso, `changePin` lee `getBiometryStatus()` y si `hasSavedPin` llama `enableBiometry(newPin)`. El bloque `try/catch` evita que un fallo del keystore revierta el cambio de PIN del vault.

**Incompleto:** `enableBiometry` retorna `boolean`, no lanza. El código no comprueba el valor de retorno. Si el usuario cancela el prompt biométrico (`verifyIdentity` rejected → `enableBiometry` returns `false`) el keystore queda intacto con el PIN anterior. `hasSavedPin` sigue siendo `true`. Próximo boot → `LockPage` auto-dispara `unlockWithBiometry()` → keystore devuelve PIN viejo → `unlock(oldPin)` falla → `failedAttempts++`. Tres intentos biométricos → lockout 30s, ciclo repetible. Es exactamente el escenario que ALTO-001 debía cerrar.

El fix de una línea del review original no está:

```ts
const reEnabled = await enableBiometry(newPin);
if (!reEnabled) {
  await disableBiometry();  // ← ausente
}
```

**Impacto real:** El cancel biométrico es un path de usuario normal (un tap en "cancelar"). No es un edge case raro.

**Acción antes del tag:** Añadir la comprobación `if (!reEnabled) await disableBiometry()` en `lock.ts:297-298`.

#### [S-ALTO-002] Biometría web gateada en `isNative()` — RESUELTO

`biometric.ts:23-29, 65-67, 96, 115, 130`. La función `isNative()` llama `Capacitor.isNativePlatform()` con try/catch. Todas las funciones exportadas (`getBiometryStatus`, `enableBiometry`, `authenticateBiometry`, `disableBiometry`) retornan early con valores seguros (`{isAvailable: false, hasSavedPin: false, reason: 'not-supported'}`, `false`, `void`) en contexto no-nativo. El shim web del plugin ya no es alcanzable desde ningún path de producto.

#### [S-ALTO-003] `autoLockMs` persiste entre reinicios — RESUELTO

`lock.ts:32-55, 89-96, 223-227`. Constante `AUTO_LOCK_META_KEY`, helpers `loadAutoLockMs` / `persistAutoLockMs` lean/escriben en `db.meta`. `boot()` hidrata antes de leer el vault (`lock.ts:93-96`). `setAutoLockMs` persiste con `void persistAutoLockMs(next)` en `lock.ts:226`. El ciclo completo (write → reload → read) es correcto.

#### [S-ALTO-004] Android: `allowBackup=false` + `FLAG_SECURE` + `dataExtractionRules` — RESUELTO

- `AndroidManifest.xml:5-6`: `android:allowBackup="false"` y `android:dataExtractionRules="@xml/data_extraction_rules"`. Adicionalmente `android:fullBackupContent="false"` como cobertura legacy.
- `data_extraction_rules.xml`: excluye `root`, `database`, `sharedpref`, `file`, `external` tanto en `cloud-backup` como en `device-transfer`. Cobertura más amplia que el fix mínimo del review original (que solo excluía `sharedpref`).
- `MainActivity.java:17-20`: `FLAG_SECURE` en `onCreate` antes de `super.onCreate`, lo cual es el orden correcto para que aplique al primer frame.

#### [S-ALTO-005] `wipeVault()` limpia Dexie — RESUELTO

`lock.ts:239-271`. `wipeVault` llama `wipeTables()` (transaction `rw` sobre las 12 tablas definidas en `ALL_TABLE_NAMES` en `atRest.ts:26-40`), luego `db.meta.clear()` explícito (meta vive fuera de `ALL_TABLE_NAMES` por diseño, wipeVault es el único punto que debe borrarlo), luego `disableBiometry()`, luego `clearEncryptedSnapshot()` y `clearVault()`. `SettingsPage.doWipe` (`settings.tsx:67-77`) ya no duplica lógica de Dexie: solo llama `wipeVault()`.

`txTombstones` está en `ALL_TABLE_NAMES` (`atRest.ts:38`), cerrando también el C-BLK-006 del code-review.

#### [S-ALTO-006] Baseline `encryptAndWipe` tras `setupPin` + wipe de residuo en `boot()` — RESUELTO

`lock.ts:129-140` (setupPin): llama `encryptAndWipe(master)` al final, antes del `set(...)`. Establece el snapshot cifrado desde el primer momento, de modo que `hasEncryptedSnapshot()` retorna `true` inmediatamente tras el setup.

`lock.ts:108-113` (boot): condición `hasEncryptedSnapshot() && hasPlaintextData()` → `wipeTables()`. Cubre el hard-kill entre setup y primer lock: si hay snapshot (puesto por el propio setupPin) y hay plaintext en Dexie, se wipe. Correcto.

El comentario mentiroso de `atRest.ts:10-15` fue reescrito: describe el flujo real (hasPlaintextData + boot + hard-kill recovery), no el inexistente flag `plaintextHydrated`.

### MEDIOs

#### [S-MEDIO-001] PIN mínimo 6 dígitos — RESUELTO

`lock.ts:33`: `PIN_MIN_LENGTH = 6`. Validación en `setupPin` (`lock.ts:121`) y `changePin` (`lock.ts:274`). `SettingsPage.tsx` importa y usa `PIN_MIN_LENGTH` en todas las comprobaciones de UI (`settings.tsx:348, 379-381, 410, 497`).

Nota: `LockPage.tsx:117` conserva `pin.length >= 4 && pin.length <= 6` para el auto-submit del PIN de desbloqueo. Esto es correcto en el sentido de que un usuario con un vault creado en v0.1 con PIN de 4 dígitos puede seguir desbloqueando; la restricción de 6 aplica solo a setup y changePin. Es un tradeoff documentado; no es un gap de seguridad activo porque el store rechaza el vault setup/cambio con PIN < 6.

#### [S-MEDIO-002] `_locking` flag en `lock()` — RESUELTO

`lock.ts:65, 87, 195-221`. El campo `_locking: boolean` está en el estado y en la interfaz `LockState`. `lock()` retorna inmediatamente si `_locking` es `true` (`lock.ts:201`), y el bloque `try/finally` garantiza que `_locking` siempre se resetea a `false` incluso si `encryptAndWipe` lanza. La race condition de backup rotation está eliminada.

#### [S-MEDIO-003] `decryptAndRestore` intenta `BACKUP_KEY` si el primario falla — RESUELTO

`atRest.ts:145-195`. Función privada `decryptFromKey` extraída. `decryptAndRestore` intenta `SNAPSHOT_KEY` primero; si el resultado es `null` o lanza, intenta `BACKUP_KEY`. Solo propaga el error original si ambos fallan. El comentario del módulo (`atRest.ts:10-16`) ahora describe esta lógica correctamente.

#### [S-MEDIO-004] `unlock` diferencia `vault-corrupt` de `wrong-pin` — PARCIAL

`lock.ts:35, 64, 86, 173-182`. `UnlockError = 'wrong-pin' | 'vault-corrupt' | 'locked-out'` exportado. El `unwrapMasterKey` fallido impacta `failedAttempts` (PIN genuinamente incorrecto). El `decryptAndRestore` fallido sets `lastUnlockError: 'vault-corrupt'` sin tocar `failedAttempts` (`lock.ts:181`). La lógica del store es correcta.

**Incompleto:** `LockPage.tsx` no consume `lastUnlockError`. Ambos casos (PIN incorrecto y vault corrupto) producen shake + reset, sin mensaje diferenciado. El usuario con vault corrupto sigue sin saber que el problema no es su PIN.

El fix de UI (leer `lastUnlockError` y mostrar "VAULT_CORRUPT") no estaba en P0 del plan consolidado. Se documenta en residuo de v0.2.1. No bloquea el tag.

---

## Hallazgos nuevos

Ninguno adicional a los PARCIALES documentados en ALTO-001 y MEDIO-004.

---

## Regresiones: análisis del código nuevo

### `src/stores/lock.ts`

- `boot()` lee `db.meta` antes de `loadVault()`. Si la base de datos no está disponible, `loadAutoLockMs` devuelve `null` (catch silencioso, `lock.ts:43`) y boot continúa sin efecto. No hay leak de estado.
- `setupPin` llama `encryptAndWipe(master)` antes del `set(...)`. Si `encryptAndWipe` lanza, el catch en `lock.ts:135-139` hace `console.warn` y continúa. El vault ya fue guardado en `saveVaultMeta` en la línea anterior. La consecuencia es que no hay snapshot pero sí hay vault: `boot()` detectará `hasEncryptedSnapshot() === false` y no wipeará Dexie en el hard-kill path. El plaintext-residue para este edge case sigue siendo posible en entorno web sin localStorage, pero el modelo de amenaza lo excluye (web no es un target de producción en v0.2).
- `_locking` flag es un campo de estado Zustand. En StrictMode React puede provocar doble-render; el check `if (get()._locking) return` es idempotente. Sin riesgo.
- `wipeVault` borra `db.meta.clear()` de forma separada. Correcto: `wipeTables` cubre las 12 tablas de datos; `meta` no está en `ALL_TABLE_NAMES` para que el lock/unlock cycle no la borre (contiene `autoLockMs`). Solo el wipe total la borra.

### `src/lib/crypto/biometric.ts`

- Gate `isNative()` en todas las funciones públicas. No hay path que llegue al shim web. Sin riesgo.
- `getBiometryStatus` en nativo: si `isAvailable` retorna `{isAvailable: false}`, se devuelve correctamente sin intentar `isCredentialsSaved`. Sin riesgo.

### `src/lib/crypto/atRest.ts`

- `hasPlaintextData` itera `ALL_TABLE_NAMES` que incluye `recurring` y `txTombstones`. Sin escape de tablas.
- `wipeTables` usa `Promise.all` dentro de una transaction `rw`. Si Dexie no está disponible, lanza y el caller captura. Sin riesgo de wipe parcial (transacción).
- `decryptAndRestore` fallback: si `decryptFromKey(SNAPSHOT_KEY)` lanza, el error se guarda en `primaryError`. Si `decryptFromKey(BACKUP_KEY)` también falla, se lanza `primaryError` (el del snapshot principal). El caller en `lock.ts:178-183` captura y sets `vault-corrupt`. Correcto.
- `restoreSnapshot` limpia todas las tablas antes de `bulkAdd` (`atRest.ts:107`). Idempotente y seguro ante restore parcial previo.

### `src/pages/SettingsPage.tsx`

- `doWipe` ya no duplica lógica de Dexie: solo llama `wipeVault()`. El código que antes limpiaba Dexie manualmente en el componente fue eliminado. Correcto.
- `BiometryEnableSheet` verifica el PIN con `unlock(pin)` antes de llamar `enableBiometry`. Esta verificación re-usa el store y consume `failedAttempts` igual que un unlock real. Si el usuario introduce el PIN incorrecto repetidamente en este sheet, puede llegar al lockout. Es un trade-off documentado del diseño: el PIN real del vault se comprueba antes de guardarlo en el keystore, lo cual es más seguro que guardarlo directamente.
- Biometry row tiene `onClick` activo y condicional (`onClick={bioStatus?.isAvailable ? () => void onBiometryToggle() : undefined}`). No hay botón sin handler. Correcto.

### `android/app/src/main/AndroidManifest.xml`

- `allowBackup="false"` + `fullBackupContent="false"` + `dataExtractionRules="@xml/data_extraction_rules"`: triple cobertura (Android < 12, Android 12+, y legacy). Excelente.

### `android/app/src/main/java/app/saldo/MainActivity.java`

- `FLAG_SECURE` antes de `super.onCreate()`: orden correcto para que el flag aplique al primer frame renderizado. Si se pusiese después de `super.onCreate`, podría haber una ventana breve de captura.

### `android/app/src/main/res/xml/data_extraction_rules.xml`

- Excluye todos los dominios (`root`, `database`, `sharedpref`, `file`, `external`) en `cloud-backup` y `device-transfer`. Más restrictivo que el mínimo del fix original (que solo excluía `sharedpref`). Correcto.

---

## Residuo aceptado para v0.2.0 (diferido a v0.2.1 / v0.3)

Los siguientes ítems no bloquean el tag (P2 o diferidos explícitamente):

1. **ALTO-001 (fix completo)**: añadir `if (!reEnabled) await disableBiometry()` en `lock.ts:297`. Una línea. Recomendado antes del tag pero aceptable diferir a v0.2.1 si el criterio de "solo usuarios con biometry activa + que cancelen el prompt al cambiar PIN" se considera suficientemente estrecho.
2. **MEDIO-004 (UI)**: `LockPage` mostrar banner distinto si `lastUnlockError === 'vault-corrupt'`. Fix en v0.2.1.
3. **Lockout brute-force por biometría vía stale PIN**: consecuencia directa del ALTO-001 parcial. Se resuelve con el mismo fix.
4. **Argon2id-WASM** como reemplazo de PBKDF2. GPU crack de PIN 6 dígitos en ~5-15 min con vault exfiltrado. Mitigado por `allowBackup=false`; requiere acceso físico al filesystem.
5. **Export cifrado con passphrase** separada del PIN (toggle en F8).
6. **Persistir `failedAttempts` y `lockedOutUntil` entre reloads.** Hard-kill y reabrir resetea el lockout.
7. **Root / jailbreak detection.** Explícitamente fuera del threat model.
8. **`console.error` logs** en `lock.ts` y `atRest.ts` podrían incluir stacks con base64. Filtrar si Sentry se integra.

---

## Cosas que siguen bien

- `isNative()` guard es robusto: try/catch que retorna `false` en cualquier entorno sin Capacitor.
- `_locking` flag implementado con `try/finally`, garantizando reset incluso en error.
- `wipeTables` usa una sola transacción Dexie para las 12 tablas: atómico.
- `FLAG_SECURE` antes de `super.onCreate()`: orden correcto.
- `data_extraction_rules.xml` cubre todos los dominios Android, incluyendo `database` (para IndexedDB del WebView) y `root`.
- `decryptAndRestore` fallback es transparente al usuario: intenta backup sin exponer la decisión en la UI.
- `autoLockMs` hidrata en `boot()` antes de `loadVault()`: el ajuste del usuario está disponible desde el primer ciclo.
- `SettingsPage.doWipe` delegado completamente a `wipeVault()`: single source of truth para la semántica de "borrar todo".
- `npm audit` a verificar en el tag; deps no modificadas en esta iteración.

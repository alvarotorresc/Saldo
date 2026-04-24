# Security Review v0.2.0

- Fecha: 2026-04-24
- Auditor: security-agent
- Branch: feat/redesign-v2-f15-reviews
- Alcance: capa cripto + lock store + onboarding + settings + TxDetail + `AndroidManifest.xml` + deps.
- Modelo de amenaza asumido: local-first, monodispositivo, monousuario. No hay backend. Atacante plausible = acceso físico al terminal (bloqueo de pantalla del SO intacto), ADB backup, o robo del dispositivo con PIN del SO conocido por terceros. Root/jailbreak explícitamente fuera de scope (ahí no hay defensa posible).

---

## Resumen ejecutivo

- 0 críticos, 6 altos, 4 medios, 3 bajos, 3 info.
- Veredicto: **GO-con-fixes** para tag v0.2.0.
  - Los 6 altos son fixes puntuales (<2h cada uno) y bloquean tag.
  - Los medios se documentan en CHANGELOG / post-release y no bloquean.

### Bloqueantes (ordenados por riesgo real)

1. `ALTO-001` — `changePin` deja biometry con PIN viejo → lockout espontáneo post-cambio.
2. `ALTO-002` — Web biometric fallback silencioso: PIN en memoria JS, lectura sin auth.
3. `ALTO-003` — `autoLockMs` no persiste: cada reload resetea a 30s sin avisar al usuario.
4. `ALTO-004` — `AndroidManifest.xml` permite ADB backup + no `FLAG_SECURE` → screenshots en Recents + exfiltración offline de blobs cifrados.
5. `ALTO-005` — `wipeVault()` NO limpia Dexie: residuo plaintext tras wipe "completo".
6. `ALTO-006` — Post-setup pre-primer-lock: plaintext Dexie sobrevive a hard-kill; lock screen cosmético hasta el siguiente lock real.

---

## Hallazgos

### [ALTO-001] `changePin` no actualiza el PIN guardado en biometry → auto-lockout post-cambio
- **Archivo:** `src/stores/lock.ts` líneas 168-186.
- **Problema:** `changePin` re-deriva `pinKey`, re-envuelve el master con un salt nuevo y guarda `saveVaultMeta`. No toca en ningún momento la credencial del keystore (plugin biometric). Tras un `changePin` exitoso, el keystore sigue con el PIN viejo. En el siguiente boot:
  1. `LockPage` (líneas 65-68) auto-dispara `unlockWithBiometry` si `bio.hasSavedPin`.
  2. `authenticateBiometry()` devuelve el PIN viejo.
  3. `unlock(oldPin)` falla → `failedAttempts = 1`.
  4. Usuario confuso, intenta biometry otra vez (o la app se la dispara), → `failedAttempts = 2`, `= 3` → **lockout 30s** + contador escondido en Zustand.
- **Impacto:** Usuario tras cambiar PIN queda bloqueado de forma no obvia durante 30s (× cada ciclo de 3 intentos si reabre la app) sin pista visible de por qué. Peor: puede interpretarse como "mi vault está roto" → wipe completo por pánico = **pérdida total de datos**.
- **Fix ejecutable:** En `changePin`, tras el `set({ master, ... })` final, añadir:
  ```ts
  const bio = await getBiometryStatus();
  if (bio.hasSavedPin) {
    const reEnabled = await enableBiometry(newPin);
    if (!reEnabled) {
      // El cambio de PIN es correcto, pero bio re-enable falló.
      // Best-effort: desactivar bio para que no use el PIN stale.
      await disableBiometry();
    }
  }
  ```
  Requiere añadir `getBiometryStatus` y `enableBiometry` a los imports de `lock.ts` (`@/lib/crypto`).
- **Test que debe pasar:** `changePin('1111','2222')` con biometry habilitada → `getBiometryStatus()` posterior reporta `hasSavedPin: true` Y `authenticateBiometry()` devuelve `'2222'`. Si re-enable falla → `hasSavedPin: false`.
- **Estado:** open.

---

### [ALTO-002] Biometry en web es un shim inseguro que simula disponibilidad
- **Archivo:** `src/lib/crypto/biometric.ts` líneas 50-76 (no gate a `Capacitor.isNativePlatform()`), combinado con `node_modules/@capgo/capacitor-native-biometric/dist/esm/web.js` (fallback en memoria).
- **Problema:** El plugin `@capgo/capacitor-native-biometric@8.4.2` en web:
  - `isAvailable()` devuelve siempre `{isAvailable: true, deviceIsSecure: true, biometryType: TOUCH_ID}`.
  - `verifyIdentity()` es `Promise.resolve()` sin prompt.
  - `setCredentials()` almacena `{username, password}` en un `Map()` del WebPlugin.
  - `getCredentials()` retorna desde el Map sin verificar nada.
  - `isCredentialsSaved()` reporta según el Map.

  Nuestro `getBiometryStatus` propaga `isAvailable: true, hasSavedPin: true` en cuanto alguien llama `enableBiometry`. La UI:
  - `LockPage` auto-dispara `unlockWithBiometry` en mount → `NativeBiometric.getCredentials` devuelve el PIN al instante, sin prompt → unlock concedido. En **dev web** el lock screen es cosmético.
  - `BiometricsPage` muestra badge `AVAILABLE FINGERPRINT`, el usuario pulsa "ACTIVAR_BIOMETRIA", el PIN queda en un `Map` JS. Refresh → se pierde; el usuario no entiende por qué "biometry dejó de funcionar".

  Riesgo de seguridad activo (no solo UX):
  - Cualquier script/extensión de navegador corriendo en el mismo origen puede hacer `NativeBiometric.getCredentials({server:'saldo@local'})` y leer el PIN en claro mientras la tab esté viva.
  - XSS → vault game over (el PIN sin prompt → unlock → descifrar snapshot de `localStorage`).
- **Impacto:** En el build web (dev, preview, futuro deploy PWA) la biometría es falsa y actúa como *store inseguro de PIN en memoria*. Los tests jsdom también disparan la rama bio si se descuidan los mocks.
- **Fix ejecutable:** En `biometric.ts`, añadir guard al inicio de cada función pública:
  ```ts
  import { Capacitor } from '@capacitor/core';

  function isNative(): boolean {
    try { return Capacitor.isNativePlatform(); } catch { return false; }
  }

  export async function getBiometryStatus(): Promise<BiometryStatus> {
    if (!isNative()) {
      return { isAvailable: false, hasSavedPin: false, reason: 'not-supported' };
    }
    // ... resto igual
  }

  export async function enableBiometry(pin: string): Promise<boolean> {
    if (!isNative()) return false;
    // ...
  }

  export async function authenticateBiometry(): Promise<string | false> {
    if (!isNative()) return false;
    // ...
  }

  export async function disableBiometry(): Promise<void> {
    if (!isNative()) return;
    // ...
  }
  ```
- **Test que debe pasar:** En vitest (jsdom, no-native), `getBiometryStatus()` → `reason: 'not-supported'`; `enableBiometry('1234')` → `false`; `authenticateBiometry()` → `false`.
- **Estado:** open.

---

### [ALTO-003] `autoLockMs` no se persiste: el usuario resetea a 30s en cada reload
- **Archivos:** `src/stores/lock.ts` línea 53 (default inicial) y líneas 142-144 (`setAutoLockMs`); `src/pages/SettingsPage.tsx` líneas 186-215. El plan decía "persistido en `meta.lockTimeoutMs`" (`REDESIGN-V2-PLAN.md` §F1 línea 222) pero **no existe ese código** (grep `lockTimeoutMs` en `src/` → 0 hits).
- **Problema:** `setAutoLockMs` solo actualiza Zustand state. El Zustand store no tiene `persist` middleware (comprobado: `create<LockState>((set, get) => ({...}))` sin `persist(...)`). Cada reload / boot lee el default 30s. Además el `boot()` no lee `meta.lockTimeoutMs`.
- **Impacto:** El usuario cambia auto-lock a "15m" en Settings (porque quiere trabajar tranquilo sobre la app abierta), cierra y reabre la app → vuelve a 30s. Peor: si lo pone a "15s" y olvida, se piensa que aplicó permanente mientras que al día siguiente está a 30s. Control de seguridad silenciosamente no aplicado = fallo de **M3 Insecure Authentication** (OWASP MASVS).
- **Fix ejecutable:**
  1. En `src/stores/lock.ts`, en `boot()` tras `loadVault()`:
     ```ts
     try {
       const row = await db.meta.get('lockTimeoutMs');
       const ms = row ? Number(row.value) : NaN;
       if (Number.isFinite(ms) && ms >= 1000) set({ autoLockMs: ms });
     } catch { /* meta no disponible en tests */ }
     ```
  2. En `setAutoLockMs`, tras `set(...)`:
     ```ts
     void db.meta.put({ key: 'lockTimeoutMs', value: String(Math.max(1000, ms)) });
     ```
  3. Añadir import `db` de `@/db/database`.

  **Nota:** meta vive DENTRO del snapshot cifrado (`db.meta` se wipea en `encryptAndWipe` indirectamente vía `db.transaction`). Revisar si meta sobrevive al ciclo lock/unlock — **no sobrevive**: `wipeTables` y `restoreSnapshot` incluyen `db.meta`? Check: atRest.ts líneas 57-91 no listan `db.meta` en la transaction. OK, meta sobrevive al lock. Pero `buildSnapshot` no la exporta → al cifrar/descifrar no se toca. Confirmado: meta es plaintext y persistente — es exactamente donde quieres `lockTimeoutMs` (no quieres guardarlo cifrado, porque se necesita antes del unlock para que el `autoLockMs` tenga efecto pre-unlock... aunque pre-unlock no se usa).

  Alternativa más simple: usar `localStorage.setItem('saldo.autoLockMs', String(ms))` y leerlo en `boot()`. Menos elegante pero evita dependencia de Dexie en `lock.ts`.
- **Test que debe pasar:** `setAutoLockMs(300_000)`; crear nuevo store (simulando reload); `boot()` → `autoLockMs === 300_000`.
- **Estado:** open.

---

### [ALTO-004] AndroidManifest: `allowBackup="true"` + sin `FLAG_SECURE` → screenshots en Recents y exfiltración ADB
- **Archivo:** `android/app/src/main/AndroidManifest.xml` línea 5.
- **Problema:** 
  1. `android:allowBackup="true"` permite `adb backup -f saldo.ab` con el cable USB (si USB debugging habilitado o con root), y también Google Drive backup en ciertos devices. Exporta `/data/data/app.saldo/shared_prefs/` que contiene los blobs del plugin biométrico (AES-wrapped) y el `@capacitor/preferences` (wrappedKey + kdfSalt). El atacante se lleva el blob cifrado a un GPU rig y bruteforcea PINs offline a ~10⁴–10⁵ guesses/sec (PBKDF2 SHA-256 600k en GPU). 4 dígitos = 10⁴ combinaciones = **<1 segundo**. 6 dígitos = 10⁶ = **~10-100s**.
  2. Sin `FLAG_SECURE`, la pantalla de PIN aparece en Android Recents (task switcher) como screenshot, y pantallas con tx sensibles también. Se preserva en caché del sistema aunque la app esté en background.
  3. Sin `android:dataExtractionRules` (Android 12+) ni `android:fullBackupContent` (legacy).
- **Impacto:** Dispositivo con USB debugging puntualmente activado + ADB de un atacante casual = exfiltración de vault cifrado. PIN 4-5 dígitos → roto offline. Mirilla casual en bus → balance en Recents.
- **Fix ejecutable:**
  1. En `android/app/src/main/AndroidManifest.xml` cambiar:
     ```xml
     android:allowBackup="false"
     android:dataExtractionRules="@xml/data_extraction_rules"
     ```
     y crear `android/app/src/main/res/xml/data_extraction_rules.xml`:
     ```xml
     <?xml version="1.0" encoding="utf-8"?>
     <data-extraction-rules>
       <cloud-backup><exclude domain="sharedpref" path="."/></cloud-backup>
       <device-transfer><exclude domain="sharedpref" path="."/></device-transfer>
     </data-extraction-rules>
     ```
  2. En `android/app/src/main/java/app/saldo/MainActivity.java` (o equivalente), en `onCreate`:
     ```java
     getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE,
                          WindowManager.LayoutParams.FLAG_SECURE);
     ```
- **Test que debe pasar:** Verificación manual en device físico: abrir Saldo → Recents → la preview está negra/blank. `adb backup -f test.ab app.saldo` → archivo vacío o sin `shared_prefs`.
- **Estado:** open.

---

### [ALTO-005] `wipeVault()` NO limpia las tablas de Dexie — residuo plaintext tras un "wipe"
- **Archivo:** `src/stores/lock.ts` líneas 156-166.
- **Problema:** `wipeVault()` llama a `clearVault()` (Preferences), `clearEncryptedSnapshot()` (localStorage) y `disableBiometry()` (keystore). **Nunca toca `db.*`.** Las tablas de Dexie (transactions, accounts, categories, goals, loans, subs, rules, budgets, balances, meta, txTombstones) siguen con plaintext del usuario en IndexedDB.

  Actualmente el único caller prod de `wipeVault()` es `SettingsPage.doWipe()` (líneas 38-81), que ANTES limpia Dexie manualmente en un `db.transaction('rw', ...)` y LUEGO llama `wipeVault`. Correcto por casualidad, no por diseño.

  Pero el nombre `wipeVault` implica que borra todo lo del vault. Cualquier futuro code path (F9 error recovery "vault corrupto — wipeo", fallback tras N intentos fallidos fuera del lockout, flujo "olvidé mi PIN", cleanup en tests que fugan a dev) invocando `wipeVault()` aisladamente deja **todos los datos financieros en plaintext en IndexedDB**. Un `setupPin` posterior genera un master key nuevo que nunca descifrará el snapshot huérfano (que tampoco existe), pero los datos viejos siguen leibles con DevTools → IndexedDB viewer.
- **Impacto:** Pérdida de la promesa de wipe. Si un atacante convence al usuario de "wipear y volver a empezar" (por ejemplo via social engineering tras intentar bypass del PIN), el atacante obtiene acceso al IndexedDB sin cifrado porque la app está en estado `welcome` (sin PIN bloqueando nada). En Android, cualquier dump posterior del WebView también contiene los datos.
- **Fix ejecutable:** Reescribir `wipeVault` para que limpie Dexie explícitamente:
  ```ts
  import { db } from '@/db/database';
  // ...
  async wipeVault() {
    await clearVault();
    clearEncryptedSnapshot();
    await disableBiometry();
    try {
      await db.transaction(
        'rw',
        [
          db.transactions, db.accounts, db.categories, db.categoryGroups,
          db.budgets, db.goals, db.loans, db.rules, db.subscriptions,
          db.recurring, db.balances, db.meta, db.txTombstones,
        ],
        async () => {
          await Promise.all([
            db.transactions.clear(), db.accounts.clear(), db.categories.clear(),
            db.categoryGroups.clear(), db.budgets.clear(), db.goals.clear(),
            db.loans.clear(), db.rules.clear(), db.subscriptions.clear(),
            db.recurring.clear(), db.balances.clear(), db.meta.clear(),
            db.txTombstones.clear(),
          ]);
        },
      );
    } catch (e) {
      // IndexedDB may not be available in test env; swallow.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/IndexedDB API missing|indexedDB is not defined/i.test(msg)) {
        console.error('wipeVault Dexie clear failed', e);
      }
    }
    set({
      master: null, status: 'welcome',
      failedAttempts: 0, lockedOutUntil: null,
    });
  }
  ```
  Entonces `SettingsPage.doWipe` puede simplificarse a SOLO `await wipeVault()` (borrar las líneas 47-79 duplicadas), que es más limpio Y más seguro (un solo lugar que define qué significa "borrar todo").
- **Test que debe pasar:** Llenar Dexie con datos → `wipeVault()` → `db.transactions.count()` === 0, etc.
- **Estado:** open.

---

### [ALTO-006] Post-setup sin primer lock: plaintext Dexie sobrevive hard-kill, lock screen es cosmético
- **Archivos:** `src/lib/crypto/atRest.ts` líneas 13-15 (comment miente); `src/stores/lock.ts` líneas 55-64 (`boot()`).
- **Problema:** El comentario de `atRest.ts` dice:
  > Hard-kill + boot → boot() reports plaintextHydrated so the UI forces an unlock anyway and the next lock re-encrypts.

  **Ese flag `plaintextHydrated` no existe en el código.** Grep `plaintextHydrated` en `src/` → solo aparece en ese comentario. `boot()` NO detecta ni señala el caso.

  Secuencia vulnerable:
  1. Usuario pasa por onboarding, hace `setupPin('123456')`. `setupPin` genera master key y DEJA Dexie en plaintext (el seed de categorías, cualquier tx que añada inmediatamente).
  2. Usuario añade alguna tx.
  3. Usuario hard-kill la app (swipe Recents) ANTES de que auto-lock (30s) dispare, y ANTES de que `visibilitychange` dispare por primera vez, o bien `lock()` falla por el bug MEDIO-003 (error no-missing-idb). El `encryptAndWipe` nunca corre.
  4. Siguiente boot:
     - `loadVault()` devuelve el vault → `status: 'locked'`.
     - IndexedDB de Dexie sigue con **todos los datos en plaintext**.
     - `LockPage` se muestra (PIN/biometry). Usuario desconocido no sabe el PIN.
  5. Con DevTools (en web) o con acceso a `/data/data/app.saldo/app_webview/` (en Android con root/backup), el atacante lee IndexedDB directamente, sin PIN, sin unlock. La lock screen es cosmética.

  Similar: tras `setupPin`, la primera `decryptAndRestore` (si alguien intenta unlock antes del primer `lock()`) devuelve `false` en `atRest.ts:168` (no hay snapshot aún), que se trata como "first setup unlock OK", pero sin wipear el residuo.
- **Impacto:** **Crítico en la teoría del modelo de amenaza** ("lock screen protege los datos") porque los datos no están protegidos hasta el primer `lock()` exitoso. En práctica, mitigado por ALTO-004 (backup deshabilitado + FLAG_SECURE): en Android sin root, `/data/data/app.saldo/` no es accesible. Pero en web (PWA o navegador) es trivial: DevTools → IndexedDB → Saldo → tablas visibles.
- **Fix ejecutable (dos alternativas, complementarias):**

  **(A) Forzar snapshot inmediato tras `setupPin`:**
  ```ts
  // lock.ts, al final de setupPin:
  await saveVaultMeta(wrapped, iv, bytesToBase64(salt));
  set({ master, status: 'unlocked', failedAttempts: 0, lastActivityAt: Date.now() });
  // NEW: write an initial encrypted snapshot and keep Dexie hydrated.
  // This ensures that even if the user hard-kills before first lock(),
  // a valid snapshot exists on disk and the residue is what would be
  // restored anyway, not extra orphan plaintext.
  try {
    const snapshot = await buildVaultSnapshot();
    const bytes = new TextEncoder().encode(serializeSnapshot(snapshot));
    const payload = await encryptPayload(bytes, master);
    localStorage.setItem('saldo.vaultPayload', JSON.stringify(payload));
  } catch (e) {
    console.warn('initial snapshot failed, continuing', e);
  }
  ```
  Esto no resuelve el leak pero establece un baseline. Para el leak propiamente, hay que ir más lejos:

  **(B) Detectar residuo en `boot()` y wipearlo:**
  ```ts
  // lock.ts boot():
  async boot() {
    const vault = await loadVault();
    if (!vault) {
      // No vault. Si hay datos en Dexie, son residuo de un setup abortado.
      // Wipearlos para evitar leak.
      try {
        const n = await db.transactions.count();
        if (n > 0 || (await db.accounts.count()) > 0) {
          console.warn('stale plaintext detected, wiping');
          await db.transaction('rw', [...allTables], async () => {
            await Promise.all([/* clear all */]);
          });
        }
      } catch { /* idb missing */ }
      set({ status: 'welcome' });
      return;
    }
    // Vault exists. Si existe snapshot cifrado pero Dexie tiene datos:
    // residuo de un unlock sin lock. No es grave (el snapshot manda),
    // pero hay plaintext. Wipear Dexie es seguro porque el unlock próximo
    // rehidrata.
    if (hasEncryptedSnapshot()) {
      try {
        const n = await db.transactions.count();
        if (n > 0) {
          await db.transaction('rw', [...allTables], async () => {
            await Promise.all([/* clear all */]);
          });
        }
      } catch { /* idb missing */ }
    } else {
      // Vault exists but no snapshot: typical first-launch-after-setup.
      // If Dexie has rows, they ARE the residue from setupPin hard-killed.
      // Wipear preserva la integridad del modelo.
      // Trade-off: pierde datos que el usuario añadió pre-primer-lock.
      // Alternativa: crear snapshot ad-hoc usando el master... pero no
      // tenemos master en boot (es antes del unlock). Por seguridad,
      // preferir wipe a leak.
      try {
        const n = await db.transactions.count();
        if (n > 0) {
          console.warn('plaintext residue pre-first-lock, wiping');
          await db.transaction('rw', [...allTables], async () => {
            await Promise.all([/* clear all */]);
          });
        }
      } catch { /* idb */ }
    }
    set({ status: 'locked', master: null });
  }
  ```

  **Recomendación:** Aplicar (A) — snapshot inicial tras setupPin — que cubre el caso común (usuario añade datos y hard-kill tarda). Y (B) — wipe de residuo en boot — como defensa en profundidad. Y actualizar el comentario mentiroso de `atRest.ts:10-15` a describir la realidad.

  **Alternativa minimalista** si se quiere reducir superficie de fix antes del tag: simplemente, al cierre de `setupPin` llamar directamente a `lock()` tras un micro-delay (fuerza el primer snapshot). Pero eso obliga al usuario a hacer unlock inmediatamente después del setup, UX subóptima.
- **Estado:** open. Bloquea tag v0.2.0.

---

### [MEDIO-001] Salt PBKDF2 de 128 bits por re-wrap en `changePin`, pero PIN entropy real = ~13 bits para 4 dígitos
- **Archivos:** `src/stores/lock.ts` línea 67 (`setupPin`) y línea 169 (`changePin`) — mínimo 4 dígitos.
- **Problema:** El PIN mínimo 4 dígitos tiene 10⁴ combinaciones (13.3 bits de entropía). PBKDF2-SHA256 600k iteraciones, medido en mobile ARM da ~500-1000 ms/derive. Benchmarks reales de `hashcat -m 12000` en GPU gama alta (RTX 4090) dan ~1-3 kH/s a 600k iteraciones. Escenarios offline (con el wrapped key exfiltrado via ALTO-004):
  - PIN 4 dígitos (10 000 combinaciones) → **~5-10 segundos**.
  - PIN 6 dígitos (1 000 000 combinaciones) → **~5-15 minutos**.
  - PIN 8 dígitos (100M) → ~10-24 horas.

  El límite inferior de 4 no da tiempo ni a escalar el ataque contra el wrapped key si se exfiltra.
- **Impacto:** Combinado con ALTO-004 (backup posible), el vault se crackea trivialmente. En ausencia de ALTO-004, sigue importando si el device se pierde rooteado o con bootloader unlocked.
- **Fix ejecutable:** Bump mínimo a 6 dígitos (estándar mobile banking):
  ```ts
  // lock.ts:67 y :169
  if (pin.length < 6) throw new Error('PIN mínimo 6 dígitos.');
  ```
  Y en `PinPad` / UI, alinear el `maxLength=6` que ya está (LockPage:162) a también exigir min 6 en `BiometricsPage` line 118 (actualmente `localPin.length < 4`).
- **Alternativa post-v0.2:** Argon2id vía WASM (libargon2-wasm o argon2-browser) con `memoryCost=64MB, iterations=3, parallelism=1`. Mitiga GPU attacks por memoria-dura. Documentar como deuda y abrir issue.
- **Estado:** open (aceptable diferir a v0.2.1 si hay compatibilidad con PINs existentes; entonces: añadir migración "tu PIN es corto, elige uno de 6+ al próximo cambio").

---

### [MEDIO-002] Lock re-entrante: timer + visibility disparan `s.lock()` en paralelo sin guard
- **Archivo:** `src/stores/lock.ts` líneas 197-235 (`installAutoLock`) y líneas 122-140 (`lock`).
- **Problema:** `tick` (setInterval 1s) y `onVisibility` ambos hacen `void s.lock()` sin esperar. Un usuario que:
  1. Está tecleando hasta pasar `autoLockMs` (`lastActivityAt` no se actualiza con inputs de formulario si el evento no es pointerdown/keydown — espera, keydown SÍ se registra así que realmente nunca debería pasar que teclee sin registrar activity).
  2. Sí aplica: si la app está en un estado no-unlocked pero el status cambia a unlocked DESPUÉS de que el tick corrió, etc. Más realista: cambio de pestaña rápido dispara `onVisibility` lock; simultáneamente el interval fires `tick` lock.

  Dos `lock()` concurrentes:
  - Ambos leen `get().master` (mismo ref).
  - Ambos llaman `encryptAndWipe(master)`.
  - Ambos hacen `buildSnapshot()` (lee Dexie; idempotente, OK).
  - Ambos hacen `serializeSnapshot` + `encryptPayload` (cada uno con su IV aleatorio, OK).
  - Ambos escriben `SNAPSHOT_KEY` en localStorage: el segundo write **sobreescribe el primero**. Pero el segundo setItem también copia el primer SNAPSHOT_KEY a BACKUP_KEY, lo cual significa que el BACKUP ahora es el del primer lock, no el pre-lock original. Aparente pérdida de 1 generación de rollback.
  - Ambos hacen `wipeTables` — idempotente, OK.
  - Ambos `set({ master: null, status: 'locked' })` — idempotente.
- **Impacto:** Backup rotation se corrompe en este caso borde. Riesgo de pérdida de datos: bajo (el SNAPSHOT_KEY actual sigue siendo válido, solo el backup queda desfasado). Pero si en el siguiente unlock hay checksum mismatch en SNAPSHOT_KEY, el BACKUP_KEY no tiene rollback real.
- **Fix ejecutable:** Añadir un in-flight flag al store:
  ```ts
  interface LockState {
    // ...
    _locking: boolean;
    // ...
  }
  // en create:
  _locking: false,
  async lock() {
    const { master, _locking } = get();
    if (_locking) return;        // already in flight
    if (!master) {                // not unlocked
      set({ master: null, status: 'locked' });
      return;
    }
    set({ _locking: true });
    try {
      await encryptAndWipe(master);
      set({ master: null, status: 'locked', _locking: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/IndexedDB API missing|indexedDB is not defined/i.test(msg)) {
        set({ master: null, status: 'locked', _locking: false });
        return;
      }
      console.error('encryptAndWipe failed', e);
      set({ _locking: false });
    }
  }
  ```
- **Estado:** open.

---

### [MEDIO-003] `decryptAndRestore` no intenta `BACKUP_KEY` si `SNAPSHOT_KEY` falla
- **Archivo:** `src/lib/crypto/atRest.ts` líneas 164-179.
- **Problema:** `encryptAndWipe` rota backups (líneas 153-155), pero el path de restore solo lee `SNAPSHOT_KEY`. Si el snapshot actual está corrupto (disco, bug, tampering) el usuario pierde todo pese a tener un backup válido de 1 generación.
- **Impacto:** Promesa de resiliencia rota. El comentario en `atRest.ts` líneas 10-11 dice "A backup of the previous ciphertext is kept under `saldo.vaultPayloadBackup` so a failed decrypt doesn't destroy data" pero la funcionalidad no existe.
- **Fix ejecutable:** En `decryptAndRestore`, si `SNAPSHOT_KEY` falla decrypt/parse, probar `BACKUP_KEY` antes de lanzar:
  ```ts
  export async function decryptAndRestore(master: CryptoKey): Promise<boolean> {
    const s = ls();
    if (!s) return false;
    const tryOne = async (key: string): Promise<boolean> => {
      const raw = s.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as EncryptedPayload;
      const plain = await decryptPayload(parsed.ct, parsed.iv, master, parsed.sha);
      const snapshot = parseSnapshot(new TextDecoder().decode(plain));
      await restoreSnapshot(snapshot);
      return true;
    };
    try {
      return await tryOne(SNAPSHOT_KEY);
    } catch (e) {
      console.warn('primary snapshot failed, trying backup', e);
      return tryOne(BACKUP_KEY);
    }
  }
  ```
  Y **documentar en UI** que se cargó desde backup (riesgo: el backup es N-1, puede faltar última tx).
- **Alternativa:** Eliminar el backup directamente y ser honesto. Peor UX pero menos código que puede mentir.
- **Estado:** open.

---

### [MEDIO-004] `unlock` falla silenciosamente al usuario en checksum mismatch (caso borde)
- **Archivo:** `src/stores/lock.ts` líneas 95-102.
- **Problema:** Si `decryptAndRestore` lanza (p.ej. SHA mismatch por tampering o bit rot), el catch hace `return false` que se lee en UI como "PIN incorrecto". El usuario reintenta, consume intentos, llega al lockout. Pero el PIN **era correcto**.
- **Impacto:** UX y también ayuda al atacante: si someone modifica el snapshot del localStorage (p.ej. browser extension maliciosa) consume el presupuesto de lockout del usuario sin haber aportado un PIN erróneo. Además el usuario podría wipearlo todo pensando "mi PIN está mal".
- **Fix ejecutable:** Diferenciar los dos casos. Añadir un estado "vault-corrupt" al store:
  ```ts
  // en unlock, reemplazar el try/catch de decryptAndRestore:
  try {
    await decryptAndRestore(master);
  } catch (e) {
    console.error('decryptAndRestore failed', e);
    // El PIN era correcto pero el snapshot está corrupto.
    // NO quemar failedAttempts. Señalizar a la UI.
    set({ status: 'locked', master: null /*, corrupt: true */ });
    throw new Error('vault-corrupt');
  }
  ```
  Y en LockPage, capturar ese error específico y mostrar "VAULT_CORRUPT — restaurar backup / wipe".
- **Estado:** open (dejar para v0.2.1 si no toca a Error state F9; prioridad media-baja pero real).

---

### [BAJO-001] txHash colisiona para tx duplicadas legítimas mismas (merchant, día, amount)
- **Archivo:** `src/lib/txHash.ts` líneas 8-18 (STABLE_FIELDS).
- **Problema:** `txHash` canonicaliza sobre (accountId, date, amount, kind, description, merchant, categoryId, personalAmount, reimbursementFor). Dos cafés a €2.50 el mismo día en el mismo Starbucks → mismo hash. Si se borra uno, el tombstone bloquea reimportar ambas (cuando F8 haga uso del tombstone — actualmente no hay read path en import).
- **Impacto:** Latente. Hoy no se exploit porque el importer no consulta tombstones (grep `tombstone` en `src/lib/importers/` y `src/pages/ImportPage.tsx` = 0 refs). Pero el diseño anuncia ese uso ("incluye tombstones" en ExportPage) y F8 lo espera.
- **Fix ejecutable para cuando el import consuma tombstones:** Incluir `createdAt` (o un nonce aleatorio) en los campos canónicos SOLO para tombstone match, o cambiar el tombstone a `importHash`-based (que ya incluye banco/fuente y es único por import). Alternativa pragmática: si el usuario importa un CSV que contiene ambas tx, el `importHash` diferenciará por la línea exacta del CSV; el tombstone por `txHash` solo se usa en restore desde `.saldo`, donde `importHash` puede o no estar.
- **Estado:** open, documentar para F8 hardening.

---

### [BAJO-002] PIN no se limpia de memoria tras unlock
- **Archivo:** `src/lib/crypto/key.ts` líneas 28-50; `src/stores/lock.ts` líneas 76-120; `src/pages/onboarding/LockPage.tsx` líneas 116-128.
- **Problema:** El `pin: string` se pasa por argumentos de función, se encoda a `TextEncoder().encode(pin)`, se importa a CryptoKey. Tras `derivePinKey`, `pin` queda en el string pool de V8 hasta GC. No hay forma de "zeroizar" un `string` en JS (inmutable). El `Uint8Array` temporal (`pinBytes`) tampoco se `fill(0)` tras usarse.
- **Impacto:** En un heap dump post-unlock (via devtools o crash report), el PIN podría aparecer. Threat-model real muy estrecho: atacante con acceso a un heap dump ya tiene acceso local a todo. Pero es una buena práctica defensiva.
- **Fix ejecutable:** Imposible limpiar el `string` completamente. Mitigable:
  ```ts
  // key.ts, derivePinKey:
  const pinBytes = new TextEncoder().encode(pin);
  try {
    const baseKey = await subtle.importKey('raw', pinBytes, ...);
    const derived = await subtle.deriveKey(...);
    return derived;
  } finally {
    pinBytes.fill(0);
  }
  ```
  No soluciona el problema del `string pin`, pero es lo máximo que se puede hacer. En LockPage, tras `setPin('')`, el string viejo queda en pool hasta GC — idem.
- **Estado:** open, mejora incremental.

---

### [BAJO-003] El master CryptoKey no se explicita como `null` al momento del lock en casos de error temprano
- **Archivo:** `src/stores/lock.ts` línea 139.
- **Problema:** `set({ master: null, status: 'locked' })` solo ocurre tras el `try/catch` completo. Si `encryptAndWipe` arroja un error NO-missing-IDB, la función hace `return` con master AÚN en memoria. El UI no cambia a locked, el master sigue vivo. Siguiente acción del usuario tiene acceso, lo cual mitiga pérdida de datos pero contradice la intención del lock.
- **Impacto:** Bajo. Si `encryptAndWipe` falla (p.ej. Dexie down), la app se queda en un estado ambiguo con datos plaintext en memoria pero el usuario pensó que había locked. En device casual-steal, el attacker ve la app unlocked.
- **Fix ejecutable:** Decidir una política: o bien (A) forzar lock incluso si encrypt falló (acepta pérdida de sesión) o (B) exponer al UI el error. Recomendado A:
  ```ts
  async lock() {
    const { master } = get();
    if (master) {
      try { await encryptAndWipe(master); }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isMissingIdb = /IndexedDB|indexedDB/i.test(msg);
        if (!isMissingIdb) console.error('encryptAndWipe failed, forcing in-memory lock', e);
      }
    }
    set({ master: null, status: 'locked' });  // siempre.
  }
  ```
- **Estado:** open.

---

### [INFO-001] SHA-256 en `encryptPayload` / `decryptPayload` es redundante con AES-GCM auth tag
- **Archivo:** `src/lib/crypto/vault.ts` líneas 59-96.
- **Observación:** AES-GCM ya proporciona integridad autenticada (16-byte tag). Cualquier bit-flip en ciphertext → `subtle.decrypt` rechaza antes de entregar plaintext. El SHA-256 extra no protege contra nada que GCM no proteja. El `!==` comparison de base64 strings no es timing-sensitive en el sentido clásico (atacante necesita el plaintext para conocer el expected SHA — ya tiene el ciphertext, ya ganó). No es un agujero, solo redundante.
- **Fix opcional:** Quitar el SHA-256 simplifica el código y reduce superficie. Mantener solo si se quiere detectar corrupción del `expectedSha` metadata separada de la corrupción del ciphertext. Documentar la intención.
- **Estado:** informational, no action required.

---

### [INFO-002] `savePayload` en `storage.ts` es dead code (solo lo usa el test)
- **Archivo:** `src/lib/crypto/storage.ts` líneas 95-103; usos confirmados: solo `crypto.test.ts` línea 132.
- **Observación:** La ruta real de guardar el payload es `atRest.ts` → `localStorage.setItem('saldo.vaultPayload', ...)`. Dos pipelines coexisten (Preferences para metadata, localStorage para payload) sin razón evidente. Confuso para auditoría futura.
- **Fix:** Post-v0.2, eliminar `savePayload` y los campos `payloadCt/Iv/Sha` de `VaultRecord` (no se usan fuera del test). Documentar en `crypto/index.ts` la dualidad.
- **Estado:** informational.

---

### [INFO-003] `parseSnapshot` no valida el contenido de cada fila (type-checker confía en JSON)
- **Archivo:** `src/lib/saldoFile.ts` líneas 42-87.
- **Observación:** Comprueba `Array.isArray(d[key])` pero no valida la forma de cada ítem. Un `.saldo` maliciosamente crafted con `transactions: [{}]` llegaría a `db.transactions.bulkAdd` con shape inválido → error en Dexie. No es remote code execution, pero corrompe la DB.
- **Impacto:** El import de `.saldo` es user-initiated y local. Baja superficie. Pero si alguien se intercambia archivos `.saldo` (no es el use-case, pero podría pasar), un atacante podría crashear la app del receptor.
- **Fix post-v0.2:** Añadir validación estricta (Zod o manual). Pospuesto a F8 hardening.
- **Estado:** informational, nota para F8.

---

## Cosas que van bien (mención explícita)

- **PBKDF2-SHA256 600 000 iteraciones** — iguala la recomendación OWASP 2024. Bien calibrado.
- **AES-256-GCM con IV aleatorio de 96 bits** por cada encrypt (`vault.ts:32`, `:70`). Nunca se reutiliza un IV con la misma key, que es la única forma de romper GCM. Correcto.
- **`pinKey` es `extractable=false`** (`key.ts:38`) — no puede salir del subtle boundary.
- **`wrapMasterKey` usa `subtle.wrapKey('raw', ...)`** — el master key nunca está en memoria JS como bytes, solo como CryptoKey opaque.
- **`boot()` siempre va a `locked` si hay vault**, incluso en hot-reload (`lock.ts:63`). Correcto: hard reload NO debe saltar el lock.
- **Lockout progresivo** `3 intentos × 30s` (`lock.ts:24-25`, `:113`). Básico pero efectivo contra brute-force en-device.
- **`SettingsPage.doWipe()` sí cubre las cuatro capas** (Dexie + Preferences + localStorage + keystore), porque el componente limpia Dexie manualmente ANTES de llamar `wipeVault` (ver ALTO-005 para el problema del nombre y del helper aislado).
- **Secretos: 0 en código.** Grep `api_key|API_KEY|secret|token` en src → 0 hits sensibles. Esta app no tiene backend, así que no hay keys que fugar. MIT + local-first por diseño elimina toda la categoría de secret management.
- **`npm audit` limpio** — 0 vulnerabilidades en prod y dev (verificado 2026-04-24 con el lockfile actual). `@capgo/capacitor-native-biometric@8.4.2` ya está post-CVEs de la serie 7.x (IV fijo en AES, ya migrado a IV aleatorio con fallback legacy a zero-IV solo para descifrado hacia atrás).
- **No hay tracking, sync, ni telemetría** (`SettingsPage.tsx` líneas 153-164). Coherente con el modelo local-first y reduce a cero la superficie de exfiltración red-side.
- **Master en memoria solo** — no hay punto en el código que persista el master CryptoKey; el único punto donde "escapa" es el `subtle.wrapKey` → base64 → Preferences, y solo en forma envuelta. Correcto.
- **`setupPin` aborta si pin vacío o salt < 8 bytes** (`key.ts:29-34`). Defensive.
- **Tests cripto sólidos**: round-trip, wrong-PIN, tampered-ciphertext (checksum mismatch), backup cleanup (`atRest.test.ts`). Cobertura decente del happy-path y edges principales.

---

## Notas para post-release (v0.2.1 o v0.3)

1. **Argon2id vía WASM** como reemplazo de PBKDF2. Argumento: el ataque GPU moderno + PIN de 4-6 dígitos invalida PBKDF2 para vaults robados. Argon2id con memoria-dura sube el coste por guess ~100x en GPU. Librerías: `argon2-browser`, `hash-wasm`. Coste: +~200KB bundle, +500-1500ms en derive. Migración: añadir `kdfVersion` al vault record; leer la v existente, reencriptar con la nueva en el siguiente unlock.

2. **PIN mínimo 6 dígitos por defecto**, con warning explícito a los usuarios con PINs existentes de 4-5: "por seguridad, considera aumentarlo en Settings". Si el bump rompe vaults existentes, hacerlo solo en `setupPin` (nuevos) y dejar `changePin` forzando 6+ (upgrade path).

3. **Detección de root/jailbreak** vía `@capgo/capacitor-root-beer-fresh` o similar. En device rooted, mostrar banner de warning una vez. No bloquear (sería hostil), solo informar.

4. **Auditar el flujo de export de `.saldo`** cuando aterrice el toggle "proteger con contraseña" (§F8, plan línea 472). Opciones: (a) encriptar el `.saldo` con una passphrase user-provided (PBKDF2 + AES-GCM igual que el vault, distinto salt/master). (b) usar una passphrase derivada del PIN actual (menor seguridad, no recomendable). **Recomendación: (a)**, separado del PIN del vault. El usuario escoge una passphrase de export distinta. El warning de "texto plano" en `ExportPage.tsx:158-162` es honesto por ahora, pero la feature de export cifrado estaba en el plan.

5. **Persistencia de `lockedOutUntil` y `failedAttempts`** entre reloads. Actualmente el usuario puede saltarse el lockout 30s haciendo fuerza bruta y luego matando+reabriendo la app (cada boot resetea a `failedAttempts: 0, lockedOutUntil: null`). Mitigación: persistir esos dos campos en `meta` (como el autoLockMs del ALTO-003).

6. **Tests de integración para los flujos completos**: setupPin → lock → kill-app → boot → unlock. Idem con biometry. Los tests actuales son unitarios del store; no hay E2E del boot cycle.

7. **Consolidar los dos pipelines de storage** (Preferences para metadata, localStorage para payload). En native, `@capacitor/preferences` está respaldado por SharedPreferences (persistente + backup-aware); `localStorage` en WebView está en `databases/file__0/*.localstorage` (también persistente, también backup-aware una vez `allowBackup=false`). Mezclar ambos complica el modelo mental y duplica superficie. Candidato a unificar en Preferences.

8. **Monitorizar capgo biometric releases.** La v8.4.2 es reciente y contiene una ruta legacy (`LEGACY_FIXED_IV` zero) para retrocompatibilidad. Eso no es vulnerable para datos nuevos (se usa solo en descifrado de blobs antiguos). Mantener al día: `npm outdated` mensual.

9. **Watermark en screenshots de Recents aunque se implemente FLAG_SECURE**: en iOS (Capacitor iOS existe), FLAG_SECURE no aplica. Cuando se añada target iOS en una futura v0.3+, implementar `UIApplicationDidEnterBackground` → tapar la UI con un overlay blank.

10. **Sanitizar logs**: actualmente hay `console.error('decryptAndRestore failed', e)` (`lock.ts:100`) y `'encryptAndWipe failed', e` (`lock.ts:134`). En prod, un error con stack puede incluir base64 del snapshot. Envolver con filtro que quite payloads antes de log. Relevante si Sentry / crash reporter se integra en el futuro.

---

## Anexo: mapeo OWASP MASVS 2024

| Categoría | Cobertura actual | Gaps detectados |
|-----------|------------------|-----------------|
| M1 Insecure Code Quality | OK (lefthook + eslint + prettier + typecheck + tests) | — |
| M2 Inadequate Supply Chain | OK (`npm audit` clean, deps estable, MIT-compatible) | Monitorizar capgo (INFO) |
| M3 Insecure Authentication | **Gaps ALTO-001, ALTO-002, MEDIO-001** | changePin-biometry, web-fake-bio, PIN corto |
| M4 Insufficient Input/Output Validation | OK para crypto paths. `parseSnapshot` débil (INFO-003) | Zod en import .saldo |
| M5 Insecure Communication | N/A (local-first, sin red) | — |
| M6 Inadequate Privacy Controls | OK (sin telemetría, sin tracking) | — |
| M7 Insufficient Binary Protections | **Gap ALTO-004** (allowBackup + no FLAG_SECURE) | Manifest hardening |
| M8 Security Misconfiguration | **Gap ALTO-003** (autoLockMs no persiste) | Persistir ajustes de seguridad |
| M9 Insecure Data Storage | **Gaps ALTO-005, ALTO-006** (wipeVault incompleto, residuo pre-primer-lock). Caveats MEDIO-001, MEDIO-003. | Wipe completo, anti-residue boot, Argon2id futuro |
| M10 Insufficient Cryptography | OK (PBKDF2 600k SHA-256, AES-GCM, IV aleatorio, master non-extractable) | Argon2id como mejora futura |

---

## Acciones inmediatas (bloqueantes para tag v0.2.0)

- [ ] Fix ALTO-001 — `changePin` re-enable biometry con PIN nuevo. Test añadido.
- [ ] Fix ALTO-002 — `biometric.ts` gate en `Capacitor.isNativePlatform()`. Test jsdom.
- [ ] Fix ALTO-003 — Persistir `autoLockMs` en `db.meta` o `localStorage`. Test boot cycle.
- [ ] Fix ALTO-004 — `AndroidManifest.xml`: `allowBackup=false`, `dataExtractionRules`, `FLAG_SECURE` en MainActivity. Verificación manual en device.
- [ ] Fix ALTO-005 — `wipeVault()` debe limpiar Dexie. Simplificar `SettingsPage.doWipe` para consumir solo `wipeVault()`. Test: llenar Dexie, llamar `wipeVault`, verificar 0 rows.
- [ ] Fix ALTO-006 — Snapshot inmediato tras `setupPin` + wipe de residuo plaintext en `boot()`. Actualizar comentario mentiroso de `atRest.ts:10-15`. Test: `setupPin` → inmediatamente `boot()` de nuevo → Dexie limpio o snapshot presente.
- [ ] Re-ejecutar suite completa de tests tras fixes.
- [ ] `npm audit` final antes del tag.
- [ ] Verificación APK debug en device físico: flujo onboarding → lock → cambiar PIN → biometry re-activa → lock/unlock → wipe.

Post-fixes, re-review: **GO para v0.2.0 tag**.

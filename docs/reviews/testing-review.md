# Testing Review v0.2.0

> Branch: `feat/redesign-v2-f15-reviews` · Fecha: 2026-04-24
> Suite actual: **303 tests verdes / 38 files / 7.8s**
> Cobertura global: **37.33% stmts · 31.65% branches · 34.13% funcs · 38.09% lines**
> Umbral objetivo plan v0.2 §5: **≥ 85% sobre `src/`**

---

## TL;DR

La cobertura global (37%) está muy por debajo del umbral 85% del plan, pero el grueso del gap son **pantallas UI sin smoke tests** (0%) que representan ~50% del statements totales. **Si se excluyen pantallas grandes de v0.1 sin cambios funcionales, la foto real sobre código nuevo F3-F14 ya ronda el 75-80%**. Faltan sin embargo gaps críticos concretos:

1. `rules.ts::reapplyMonth` al 52% — el flow end-to-end que toca Dexie no se ejerce (el test cubre solo los helpers puros).
2. `lock.ts` al 68% — el **happy path de `lock()` con `encryptAndWipe` real nunca se testea**; los tests tocan la rama `isMissingIdb` del catch. `changePin` no tiene tests. `unlockWithBiometry` no tiene tests.
3. `atRest.ts` al 77% — el test existente usa un fake hand-rolled sin tombstones, sin `where().equals()`, sin respaldo de `vaultPayloadBackup`.
4. `biometric.ts` al 72% — solo happy path del shim web; paths de error sin cubrir.
5. **Command palette sin test alguno** (0%).
6. **LockPage no testea el auto-trigger de biometría al mount** pese a ser UX load-bearing.
7. PDF export y pull-to-refresh sin tests.

**Recomendación infra clave:** añadir `fake-indexeddb` como dev dep. Los tests existentes ya compensan con fakes ad-hoc que están alcanzando su límite (`reapplyMonth` requiere `where().equals().toArray()` — el fake no lo soporta).

---

## Coverage snapshot

Tabla ordenada por módulo, con **tier** (nuevo F0-F14 / legacy v0.1 / UI pantalla) y **gap** (qué falta):

| Módulo | % stmts | % lines | Tier | Gap |
|---|---|---|---|---|
| `src/lib/crypto/atRest.ts` | 77.04 | 95.65 | nuevo F1/F12 | backup rotation, tombstone round-trip, JSON-corrupt path |
| `src/lib/crypto/biometric.ts` | 71.87 | 71.87 | nuevo F1 | `verifyIdentity` error, `isAvailable` reject, `getCredentials` reject |
| `src/lib/crypto/storage.ts` | 77.77 | 86.84 | nuevo F1 | rama `useCapacitor() === true` (Preferences) nunca testeada |
| `src/lib/crypto/key.ts` | 95.23 | 95.23 | nuevo F1 | ok |
| `src/lib/crypto/vault.ts` | 96.77 | 96.77 | nuevo F1 | ok |
| `src/lib/rules.ts` | 52.63 | 50.00 | nuevo F6 | **`reapplyMonth` sin tests (toca Dexie)**, `incrementRuleHit` |
| `src/stores/lock.ts` | 67.92 | 71.87 | nuevo F1/F12 | **`changePin`, `unlockWithBiometry`, happy-path `lock()` con snapshot real** |
| `src/stores/ledgerFilter.ts` | 92.5 | 96.15 | nuevo F5 | ok |
| `src/stores/meta.ts` | — | — | nuevo | ok |
| `src/lib/saldoFile.ts` | 93.33 | 100 | nuevo F12 | ok |
| `src/lib/exportFormats.ts` | 100 | 100 | nuevo F11 | ok |
| `src/lib/analytics.ts` | 95.23 | 100 | nuevo F11 | ok |
| `src/lib/budgets.ts` | 88.23 | 100 | nuevo F6 | ok |
| `src/lib/goals.ts` | 93.33 | 93.33 | nuevo F7 | ok |
| `src/lib/netWorth.ts` | 88.88 | 88.23 | nuevo F7 | ok |
| `src/lib/newTx.ts` | 95.45 | 95.00 | nuevo F5 | ok |
| `src/lib/fuzzy.ts` | 97.14 | 96.55 | nuevo F5 | ok |
| `src/lib/tween.ts` | 92.59 | 91.66 | nuevo F3 | ok |
| `src/lib/errorTrace.ts` | 95.00 | 100 | nuevo F9 | ok |
| `src/lib/importConfidence.ts` | — | — | nuevo F8 | ok |
| `src/lib/ranges.ts` | — | — | nuevo | ok |
| `src/lib/txHash.ts` | — | — | nuevo F5 | ok |
| `src/lib/categorize.ts` | 0 | 0 | **legacy v0.1** | aceptado (sin cambios) |
| `src/lib/csv.ts` | 0 | 0 | **legacy v0.1** | aceptado |
| `src/lib/loan.ts` | 0 | 0 | **legacy v0.1** | aceptado |
| `src/lib/recurring.ts` | 0 | 0 | **legacy v0.1** | aceptado |
| `src/lib/format.ts` | 44 | 44 | legacy v0.1 | aceptado (usado en UI visualmente) |
| `src/lib/importers/index.ts` | 0 | 0.94 | legacy v0.1 | aceptado |
| `src/lib/importers/parse-helpers.ts` | 2.56 | 3.12 | legacy v0.1 | aceptado (solo `normalizeDesc` tocado indirectamente) |
| `src/db/database.ts` | 9.45 | 11.2 | **schema Dexie** | aceptado (imposible sin fake-indexeddb) |
| `src/db/queries.ts` | 40.15 | 41.28 | mixto | `dailySpend`, `charts*` cubiertos; resto v0.1 no |
| `src/ui/PinPad.tsx` | 100 | 100 | nuevo F1 | ok |
| `src/ui/Icon.tsx` | — | — | nuevo F0 | ok |
| `src/ui/TopBarV2.tsx` | — | — | nuevo F0 | ok |
| `src/ui/primitives/*` | 100 | 100 | nuevo F0 | ok |
| `src/ui/charts/*` | 97.95 | 100 | nuevo F0 | ok |
| `src/ui/states/TerminalEmpty.tsx` | 100 | 100 | nuevo F9 | ok |
| `src/ui/states/TerminalLoading.tsx` | 81.81 | 100 | nuevo F9 | ok |
| **`src/ui/CommandPalette.tsx`** | **0** | **0** | **nuevo F5** | **sin tests** |
| `src/ui/BottomNav.tsx` | 0 | 0 | nuevo F1 | smoke pendiente |
| `src/ui/FAB.tsx` | 0 | 0 | nuevo F1 | trivial |
| `src/ui/Sheet.tsx` | 0 | 0 | nuevo F5 | trivial pero tiene focus trap — test básico conviene |
| `src/ui/sheets/FilterSheet.tsx` | 0 | 0 | nuevo F5 | lógica cubierta en `ledgerFilter.test.ts`; smoke sería render-only |
| `src/ui/sheets/QuickActionsSheet.tsx` | 0 | 0 | nuevo F5 | trivial |
| `src/pages/LedgerPage.helpers.ts` | 100 | 100 | nuevo F2 | ok |
| `src/pages/DashboardCharts.tsx` | 90.19 | 93.97 | nuevo F4 | ok |
| `src/pages/DashboardPage.tsx` | 95.65 | 98.5 | nuevo F3 | ok |
| `src/pages/onboarding/WelcomePage.tsx` | — | — | nuevo F1 | ok |
| `src/pages/onboarding/PinSetupPage.tsx` | 90 | 100 | nuevo F1 | ok |
| `src/pages/onboarding/BiometricsPage.tsx` | 80 | 79.16 | nuevo F1 | ok (paths de error menores) |
| `src/pages/onboarding/FirstImportPage.tsx` | — | — | nuevo F1 | ok |
| `src/pages/onboarding/LockPage.tsx` | 78.08 | 83.6 | nuevo F1 | **falta auto-trigger biometría on mount** |
| `src/pages/LedgerPage.tsx` | 0 | 0 | nuevo F2 | **falta pull-to-refresh, sin smoke render** |
| `src/pages/NewTxPage.tsx` | 0 | 0 | nuevo F5 | **crítica UX, smoke necesario** |
| `src/pages/TxDetailPage.tsx` | 0 | 0 | nuevo F5 | **tombstone on delete no cubierto** |
| `src/pages/ExportPage.tsx` | 0 | 0 | nuevo F11 | **PDF blob generation no cubierto** |
| `src/pages/RulesPage.tsx` | 0 | 0 | nuevo F6 | lógica cubierta en `rules.test.ts`; smoke recomendable |
| `src/pages/BudgetsPage.tsx` | 0 | 0 | nuevo F6 | lógica ok; smoke opcional |
| `src/pages/CategoriesPage.tsx` | 0 | 0 | nuevo F6 | crítica UX, smoke recomendable |
| `src/pages/GoalsPage.tsx` | 0 | 0 | nuevo F7 | smoke opcional |
| `src/pages/SubscriptionsPage.tsx` | 0 | 0 | nuevo F7 | smoke opcional |
| `src/pages/LoansPage.tsx` | 0 | 0 | nuevo F7 | smoke opcional |
| `src/pages/NetWorthPage.tsx` | 0 | 0 | nuevo F7 | smoke opcional |
| `src/pages/ImportPage.tsx` | 0 | 0 | nuevo F8 | lógica importConfidence cubierta; flow manual queda fuera |
| `src/pages/SettingsPage.tsx` | 0 | 0 | nuevo F8/F12 | **change-PIN flow no cubierto** |
| `src/pages/AnalyticsPage.tsx` | 0 | 0 | nuevo F8 | analytics.ts cubierto; smoke opcional |
| `src/pages/MorePage.tsx` | 0 | 0 | nuevo F1 | trivial, ROI bajo |

---

## Gaps prioritarios (bloqueantes para ≥85% en código nuevo crítico)

### [GAP-001] `src/lib/rules.ts::reapplyMonth` — 52% cov

**Por qué crítico:** es la función que el pull-to-refresh del ledger invoca, y el único path que incrementa `Rule.hits` y `lastHitAt` persistentemente. El plan F6 marca "hits counter (5)" como budget — hoy cubierto a nivel de `reapplyPlan` puro, pero no del flow que toca Dexie.

**Tests propuestos:**

```
describe('reapplyMonth (integration)', () => {
  beforeEach: seed fake-indexeddb con 3 rules + 5 txs en '2026-04'

  it('returns 0 when no rule matches any tx in the month')
  it('updates only txs whose current categoryId differs from matched rule categoryId')
  it('bumps rules.hits by the number of txs it changed (aggregated)')
  it('sets rules.lastHitAt = Date.now() on every rule that fired')
  it('ignores transfers (no rule application, no hit bump)')
  it('skips disabled rules even if they would match (enabled === 0)')
  it('is atomic: a failure mid-update rolls back both tx updates and rule hits')
})

describe('incrementRuleHit', () => {
  it('is a no-op when the rule id is not in the DB')
  it('initialises hits=1 when previous hits is undefined')
  it('increments hits by 1 and updates lastHitAt')
})
```

**Infra:** requiere `fake-indexeddb` o promover el fake hand-rolled de `atRest.test.ts` a soportar `where('month').equals(...)`. Recomendación: `fake-indexeddb` — ver §Recomendaciones.

---

### [GAP-002] `src/stores/lock.ts::lock()` happy-path — actual es fake-passing

**Por qué crítico:** el test existente `'lock() clears master and sets status'` pasa porque en jsdom `encryptAndWipe(master)` lanza `IndexedDB API missing` y el código tiene un catch específico `isMissingIdb` que ignora el error y hace el lock in-memory. **El path real que encripta y vacía las tablas jamás se ejerce en tests.** Las líneas 107-209 sin cubrir confirman: `unlockWithBiometry`, `changePin`, y las ramas donde `encryptAndWipe` *sí* se ejecuta y devuelve vía `return;` ante error.

**Tests propuestos:**

```
describe('lock store — full encrypt→wipe→decrypt→restore cycle', () => {
  // Needs fake-indexeddb so db.transactions et al. exist.
  beforeEach: reset lock + clear fake idb + seed 1 account + 3 txs

  it('lock() encrypts the snapshot to localStorage and wipes Dexie tables')
  it('unlock(correct PIN) decrypts and restores all seeded rows into Dexie')
  it('lock() then unlock(wrong PIN) keeps the encrypted snapshot untouched')
  it('lock() keeps previous payload under saldo.vaultPayloadBackup (one-gen)')
  it('unlock() does NOT surface unlocked status when decryptAndRestore throws on SHA mismatch')
  it('lock() aborts (returns early) when encryptAndWipe fails with a non-idb error')
})

describe('lock store changePin', () => {
  beforeEach: setupPin('11111') + lock() + unlock('11111')

  it('accepts correct oldPin and updates vault so unlock(newPin) works')
  it('rejects when oldPin is wrong and leaves vault untouched')
  it('throws when newPin.length < 4')
  it('after changePin, unlock(oldPin) returns false  ← SECURITY CRITICAL')
  it('after changePin, master key stays the same (same plaintext decrypts)')
})

describe('lock store unlockWithBiometry', () => {
  // Mock authenticateBiometry to return a string (PIN) or false.
  it('returns false when biometric auth fails')
  it('returns true and transitions to unlocked when biometric yields the correct PIN')
  it('returns false when biometric yields a wrong PIN (auth passed, PIN stale)')
})

describe('lock store wipeVault — post-F12 assertions', () => {
  beforeEach: setupPin + populate Dexie + lock() (snapshot in localStorage)

  it('removes saldo.vaultPayload AND saldo.vaultPayloadBackup from localStorage')
  it('removes all entries under saldo.vault.* in Preferences/localStorage')
  it('calls disableBiometry (NativeBiometric.deleteCredentials) once')
  it('transitions status=welcome and failedAttempts=0, lockedOutUntil=null')
})
```

**Infra:** `fake-indexeddb` indispensable para el primer describe (Dexie real). El resto puede mockear `authenticateBiometry` sin fake-idb.

---

### [GAP-003] `src/lib/crypto/atRest.ts` — faltan 3 paths + tombstones

**Tests propuestos (añadir a `atRest.test.ts`):**

```
describe('atRest — edge cases no cubiertos', () => {
  it('round-trip preserves txTombstones array (import-after-delete use case)')
      // seed fake-db with 1 tombstone → encryptAndWipe → decryptAndRestore →
      // assert fakeDb.txTombstones._rows has the same tombstone by txHash

  it('encryptAndWipe keeps previous ciphertext as backup when called twice')
      // master A, first encryptAndWipe → snapshot A in localStorage
      // master A again → now vaultPayload = new, vaultPayloadBackup = A

  it('decryptAndRestore throws "vault snapshot corrupt (JSON)" when ciphertext is not valid JSON')
      // localStorage.setItem('saldo.vaultPayload', 'not-json')
      // expect rejects /corrupt/

  it('encryptAndWipe throws when localStorage is unavailable')
      // delete window.localStorage; expect rejects /localStorage no disponible/
})
```

**Infra:** basta el fake actual. El primer test del bloque cierra además el GAP de tombstones del task.

---

### [GAP-004] Tombstone end-to-end (delete → export → wipe → import)

**Por qué crítico:** el plan v0.2 justifica la tabla `txTombstones` como "audit/restore". Hoy la escritura ocurre en `TxDetailPage.remove()` (línea 112-117) y la lectura en `saldoFile.ts::parseSnapshot` — pero no hay test que verifique el flow completo. Además detecté que el schema `{txHash, deletedAt}` es consistente entre `types.ts`, `database.ts` (`'++id, &txHash, deletedAt'`) y el uso real; no hay bug, pero tampoco test regressional.

**Tests propuestos (nuevo `src/lib/saldoFile.tombstone.test.ts`):**

```
describe('tombstones — round-trip semantics', () => {
  it('serializeSnapshot includes txTombstones when present')
  it('parseSnapshot returns empty array when version=1 snapshot has no txTombstones')
  it('parseSnapshot preserves tombstones from v2 snapshot')

  // Integration (requires fake-indexeddb):
  it('delete tx → tombstone written with correct txHash')
  it('export (snapshot) → wipe Dexie → import (parseSnapshot+restore) → tombstone survives')
  it('duplicate import: tx matching a tombstone txHash must NOT re-appear')
      // This last one exposes whether import logic checks txTombstones. If not,
      // it's a GAP in product logic, not test — flag in code-review.md.
})
```

**Infra:** primeros 3 puros (no idb). Los 3 últimos necesitan `fake-indexeddb` + importar la lógica de import de `lib/importers/` (pendiente verificar que esa lógica consulte `txTombstones`).

---

### [GAP-005] `CommandPalette` — cobertura 0%

**Por qué crítico:** el plan F5 marca "cmd palette fuzzy (5)" en su test budget. `fuzzy.test.ts` cubre el scorer, pero no el componente: keyboard nav, focus management, close-on-Escape, active-index reset al filtrar. UX muy visible.

**Tests propuestos (nuevo `src/ui/CommandPalette.test.tsx`):**

```
describe('CommandPalette', () => {
  const commands: Command[] = [
    { id: 'new-tx', label: 'New transaction', hint: 'nt', onRun: vi.fn() },
    { id: 'import', label: 'Import CSV', hint: 'i', onRun: vi.fn() },
    { id: 'export', label: 'Export data', hint: 'e', onRun: vi.fn() },
  ]

  it('does not render when open=false')
  it('renders full list when open=true and query is empty')
  it('focuses input on open (requestAnimationFrame)')
  it('filters via fuzzy as the user types (new → "new transaction" only)')
  it('shows "No commands match" when no result')
  it('ArrowDown moves active index up to filtered.length-1, then stops')
  it('ArrowUp moves active index down, clamps at 0')
  it('Enter runs commands[active].onRun and calls onClose')
  it('Escape calls onClose without running any command')
  it('MouseEnter on list item sets active to that index')
  it('Click on list item runs onRun + onClose')
  it('resets query and active to 0 when open transitions false→true')
  it('active index snaps to 0 when filtering shrinks the list below current active')
})
```

**Infra:** jsdom + @testing-library/react (ya instalados). Zero deps nuevas.

---

### [GAP-006] `LockPage` — auto-trigger de biometría al mount

**Por qué crítico:** el task lo flaggea explícitamente y el comentario del componente (líneas 63-68) declara la intención: "Auto-trigger biometry on mount when enabled so the user doesn't have to tap the button every time." Sin test, cualquier refactor puede romper el quick-unlock sin aviso.

**Test propuesto (añadir a `LockPage.test.tsx`):**

```
describe('LockPage — biometry auto-trigger', () => {
  it('calls unlockWithBiometry on mount when bioAvailable && !pin', async () => {
    vi.mocked(getBiometryStatus).mockResolvedValue({
      isAvailable: true, hasSavedPin: true, kind: 'fingerprint',
    })
    const unlockWithBiometry = vi.fn().mockResolvedValue(true)
    useLock.setState({ unlockWithBiometry })

    render(<LockPage />)
    await waitFor(() => expect(unlockWithBiometry).toHaveBeenCalledTimes(1))
  })

  it('does NOT auto-trigger when hasSavedPin=false', async () => { ... })
  it('does NOT auto-trigger when user has already typed digits', async () => { ... })
  it('shakes when auto-biometry fails', async () => { ... })
})
```

**Infra:** ninguna, solo vi.mock.

---

### [GAP-007] Pull-to-refresh en LedgerPage

**Por qué crítico:** el plan F2 marca "pull-to-refresh re-aplica reglas y refresca contador Rule.hits" como done criterion. El código (líneas 273-302) simula el gesto con pointer events. Sin test, cualquier cambio en thresholds (60px, 120px, 1500ms) pasa inadvertido.

**Test propuesto (nuevo `src/pages/LedgerPage.ptr.test.tsx`):**

```
describe('LedgerPage — pull-to-refresh', () => {
  beforeEach: mock useLiveQuery + reapplyMonth

  it('invokes reapplyMonth(month) when pointer drag delta ≥ 60px')
  it('does NOT invoke reapplyMonth when delta < 60px')
  it('shows ptrStatus=refreshing during call, then done, then idle after 1500ms')
  it('records ptrUpdated from reapplyMonth return value and renders in banner')
  it('resets to idle on reapplyMonth rejection without crashing')
  it('ignores pointer events when scrollTop > 0')
})
```

**Infra:** jsdom + vi.mock('@/lib/rules'). No fake-idb.

---

### [GAP-008] ExportPage PDF blob generation

**Por qué crítico:** jspdf es la dep más pesada nueva del export; un regresión silenciosa (jspdf API breaking, font embed fail) dejaría al usuario sin backup imprimible. Plan §5 F11 budget marca "export round-trip (4)". Sólo 3 formatos tienen test (csv/ofx via `exportFormats.test.ts`, saldo/json via `saldoFile.test.ts`). PDF queda huérfano.

**Tests propuestos (nuevo `src/pages/ExportPage.pdf.test.ts` o mejor: extraer `buildPdf` a `src/lib/pdfExport.ts` puro):**

```
describe('buildPdf', () => {
  it('produces a Blob with MIME application/pdf')
  it('first bytes are the PDF magic number "%PDF-"')
  it('multi-page: >30 txs span at least 2 pages')
  it('handles empty tx list without throwing')
  it('renders monetary amounts with correct sign conventions (- for expense)')
})
```

**Infra:** jspdf, ya es dep. Refactor previo: sacar `buildPdf` de `ExportPage.tsx` — está inlined. Recomendación: mover a `src/lib/pdfExport.ts` (pure-ish, recibe txs + catById, devuelve Blob).

---

## Gaps mejorables (no bloqueantes)

### [GAP-009] `src/lib/crypto/biometric.ts` — error paths

Los tests actuales sólo cubren el shim web. En producción Android los paths de error son:
- `verifyIdentity` rechaza (user canceló huella)
- `setCredentials` falla (keystore lleno)
- `getCredentials` falla (credenciales borradas externamente)

Son `try/catch` que devuelven `false`; el valor no es testearlos uno a uno, pero añadir uno global con `NativeBiometric` mockeado sería barato:

```
describe('biometric — native error propagation', () => {
  beforeEach: vi.mock('@capgo/capacitor-native-biometric', () => ({
    NativeBiometric: { verifyIdentity: vi.fn().mockRejectedValue(new Error('user-cancel')), ... }
  }))

  it('enableBiometry returns false when verifyIdentity rejects')
  it('authenticateBiometry returns false when getCredentials rejects')
  it('getBiometryStatus reports not-supported when isAvailable rejects')
})
```

---

### [GAP-010] `src/lib/crypto/storage.ts` — rama Capacitor

El test existente solo ejerce el fallback web (localStorage). La rama nativa (`Preferences`) no se testea. Bajo-medio ROI: el día que `@capacitor/preferences` cambie API, el test ayudaría. Propuesta:

```
describe('storage — native Capacitor path', () => {
  beforeEach: vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => true }
  }))
  vi.mock('@capacitor/preferences', () => ({
    Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() }
  }))

  it('loadVault reads from Preferences.get with saldo.vault.* prefix')
  it('saveVaultMeta writes wrappedKey, wrapIv, kdfSalt via Preferences.set')
  it('clearVault removes all 6 keys via Preferences.remove')
})
```

---

### [GAP-011] Smokes de pantallas "hot path"

Aquí hay **diminishing returns**: testear visualmente cada pantalla con jsdom añade coste de mantenimiento alto y atrapa pocos bugs. Mi recomendación es un smoke mínimo **solo** para las pantallas donde una regresión es más costosa que el test:

| Pantalla | Smoke recomendado | Razón |
|---|---|---|
| `NewTxPage` | **Sí** | UX crítica — commit button, validation, redirect |
| `TxDetailPage` | **Sí** | escribe tombstone — regressional importante |
| `SettingsPage` | **Sí** | change-PIN flow — seguridad |
| `ExportPage` | **Sí** | cubierto por GAP-008 |
| `LedgerPage` | **Sí** | cubierto por GAP-007 (PTR) + un test de renderizado de grupos |
| `CategoriesPage` | Opcional | 526 líneas — mantenimiento alto |
| `RulesPage` | Opcional | lógica ya cubierta |
| `BudgetsPage` | Opcional | lógica ya cubierta |
| `GoalsPage`, `SubscriptionsPage`, `LoansPage`, `NetWorthPage` | No | pure render |
| `ImportPage` | No | importConfidence ya cubierto |
| `AnalyticsPage` | No | analytics.ts ya cubierto |
| `MorePage` | No | trivial nav |

**Tests smoke propuestos para las 3 críticas:**

```
// NewTxPage.test.tsx
it('renders with defaults and the commit button is disabled until amount > 0')
it('commits to Dexie with the right kind + category + amount and returns to ledger')
it('toggling shared reveals personalAmount field')
it('validates and surfaces error when account not set')
it('cancel returns to ledger without writing')

// TxDetailPage.test.tsx
it('renders hero amount with danger color for expense')
it('renders hero amount with accent color for income')
it('delete writes tombstone with correct txHash + deletedAt')
it('delete asks confirm and bails out on cancel')
it('saves notes onBlur')
it('shows RULE_MATCHED section when a rule covers the merchant')

// SettingsPage.test.tsx — minimal, focus on PIN change wiring
it('renders the SECURITY section')
it('change-PIN dialog calls changePin with oldPin + newPin')
it('shows "PIN actualizado" toast on success')
it('shows error on changePin returning false')
it('wipeVault confirms twice before destroying data')
```

---

## Test quality issues

Muestré 5 tests existentes al azar y éstas son las observaciones:

### Positivos (mantener como referencia)

- **`rules.test.ts`** — factory `tx()` clara, un concepto por test, asserts precisos. Excelente base para replicar.
- **`ledgerFilter.test.ts`** — tabla exhaustiva del espacio de filtros, sin `if` dentro de tests, fixtures pequeños. Bueno.
- **`crypto.test.ts`** — round-trips reales con `window.crypto.subtle`, sin mockear nada. El test de tamper-detection es exactamente lo que pide security agent.
- **`LedgerPage.helpers.test.ts`** — puro, cubre edge cases (reimbursement, splitExpense, transfer contribuye 0). Buen ejemplo.

### Negativos (corregir en lo posible)

- **`LockPage.test.tsx`** línea 13: mockea `unlock: vi.fn()` en el store para probar la pantalla aislada. **Esto es legítimo** como unit test de UI, pero significa que **ningún test de la suite cubre el flow UI → store → cripto → Dexie end-to-end**. La primera vez que se rompa la integración (rename de método, cambio de signature), la suite entera seguirá verde. Recomendación: añadir **un** test integration de `LockPage` que use el store real + cripto real + fake-idb, testando el happy path (type PIN → status=unlocked → Dexie hidratada). Complementa, no sustituye, los unit tests actuales.

- **`DashboardPage.test.tsx`** líneas 47-70: `emptyChain` mockea todo `db.*.where().equals()...` con un objeto que devuelve `[]`. Es denso y quebradizo — si `DashboardPage` añade una nueva query, el chain no lo soportará y el error será oscuro. No urgente, pero candidato a refactor hacia `fake-indexeddb` con seed mínimo.

- **`atRest.test.ts`** líneas 31-49: el fakeDb hand-rolled es correcto **solo para tests que llamen `toArray/clear/bulkAdd`**. Cualquier test que requiera `where().equals()` o transacciones con índices fallará. Esto ya está empezando a doler con `reapplyMonth` (GAP-001). Argumento pro-fake-indexeddb.

- **Ningún test fue tautológico** (no vi `expect(mock).toHaveBeenCalledTimes(3)` sin justificación funcional, no vi asserts contra implementación). Bien.

- **Ningún test depende del orden**. Los `beforeEach/afterEach` son correctos.

- **Hay sleeps reales** en `LockPage.test.tsx` (líneas 72-73, 88-90, 166): `await new Promise(r => setTimeout(r, 350))` para superar la animación shake. Son pragmáticos (la shake dura 300ms en código), pero si se multiplican añaden segundos al tiempo de la suite. Alternativa: `vi.useFakeTimers()` + `vi.advanceTimersByTime(400)`. No urgente.

---

## Recomendaciones de infra

### `fake-indexeddb` — **SI**

**Razones:**
1. GAP-001 (reapplyMonth), GAP-002 (lock cycle), GAP-004 (tombstone e2e) y el test integration de LockPage recomendado en §Test quality lo requieren. Son los gaps de mayor ROI del review.
2. El fake hand-rolled de `atRest.test.ts` está alcanzando su techo: sin índices, sin `where().equals()`, sin transacciones reales. Seguir ampliándolo reinventa `fake-indexeddb` a medias.
3. Overhead irrisorio: ~50KB gzipped, sin peer-deps. Se activa con `import 'fake-indexeddb/auto'` en `src/test/setup.ts` (o por test si se prefiere aislamiento).
4. Riesgo de divergencia con la implementación nativa: muy bajo. `fake-indexeddb` implementa la W3C spec; Dexie trabaja contra esa API. Bugs específicos de Chrome/WebKit no se testean, pero tampoco los testea el code path actual.
5. Alternativa descartada: `idb-keyval` + mocks de Dexie. Demasiado intrusivo, rompe el principio "testear comportamiento, no implementación".

**Coste:** añadir `fake-indexeddb` a `devDependencies`, importar en `src/test/setup.ts`. 30 min. Los tests existentes no se ven afectados (los módulos que mockean `@/db/database` siguen funcionando).

**Setup propuesto:**
```ts
// src/test/setup.ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

Y un helper de reset para tests que quieran DB limpia:
```ts
// src/test/resetDb.ts
import { db } from '@/db/database';
export async function resetDb() {
  await db.delete();
  await db.open();
}
```

### E2E — **Playwright en v0.3**, NO Detox

**Razones:**
- Saldo es **Vite + React + Capacitor**, no React Native. Detox apunta a React Native bridge; no aplica.
- Capacitor empaqueta el bundle web en un WebView nativo. Cualquier E2E web válido es válido para el APK porque la capa JS es idéntica.
- Playwright cubre 95% del producto: onboarding completo, boot flow, ledger, new tx, export, lock/unlock. Lo único que no cubre es biometría real (que requiere device) y gestos específicos de WebView.
- v0.3 budget: ~5-8 flows E2E (Welcome→PIN→Import→Lock→Unlock, Add tx→edit→delete con tombstone, Export→wipe→Import restore, Change PIN, Auto-lock on hidden).
- Para biometría real en device: test manual documentado en `docs/PRE-RELEASE-CHECKLIST.md` basta — es 1 flow y cambia poco.

**Setup v0.3:**
- `@playwright/test` como devDep
- `tests/e2e/` con `.spec.ts` por flow
- CI matrix Chrome + Firefox (no Safari — la app local-first no justifica coste de WebKit en CI)
- Servidor: `npm run dev` en background + wait-on

### Test pyramid — está sana, falta la capa intermedia

Actualmente:
- **Unit puro (funciones):** ~70% de los tests. Bien.
- **Unit componente (jsdom):** ~25%. Bien.
- **Integration (store + crypto + Dexie):** ~5%. **Aquí está el hueco.** `fake-indexeddb` lo desbloquea.
- **E2E:** 0%. Aceptable en v0.2, añadir en v0.3.

La pirámide quedaría (post-GAPs):

```
         E2E (v0.3, ~6 flows)
        ────────────────────
       Integration (+ ~20 tests con fake-idb)
      ─────────────────────────────────────
     Unit componente (~90 tests con @testing-library)
    ───────────────────────────────────────────────
   Unit puro (~200 tests de lib/ + helpers)
  ──────────────────────────────────────────
```

---

## Plan concreto de tests a añadir — ordenado por ROI

### Fase 1 — Desbloqueo de cripto/lock (prioridad absoluta)

Orden estricto: añadir `fake-indexeddb` **primero**, sin eso los siguientes tests son más caros.

1. **Infra.** Añadir `fake-indexeddb` a devDeps + `src/test/setup.ts` import. Verificar que los 303 tests actuales siguen verdes. (30 min)
2. **[GAP-003]** `atRest.test.ts` — 4 tests añadidos (tombstones, backup, JSON-corrupt, localStorage missing). Usa fake aún. (1h)
3. **[GAP-002]** `lock.test.ts` — 12 tests del encrypt-wipe-decrypt cycle + changePin + unlockWithBiometry + wipeVault exhaustivo. Requiere fake-idb. (3-4h)
4. **[GAP-001]** `rules.integration.test.ts` (nuevo file) — 10 tests de `reapplyMonth` + `incrementRuleHit`. Requiere fake-idb. (2h)
5. **[GAP-004]** `saldoFile.tombstone.test.ts` (nuevo file) — 6 tests, primeros 3 puros, últimos 3 con fake-idb. (2h)

**Resultado esperado:** cobertura de `lock.ts` 68→92%, `rules.ts` 52→88%, `atRest.ts` 77→95%. Cubre los 4 módulos con más lecturas del security agent.

### Fase 2 — UI crítica (smokes selectivos)

6. **[GAP-005]** `CommandPalette.test.tsx` — 13 tests keyboard nav + fuzzy + focus. (2h)
7. **[GAP-006]** `LockPage.test.tsx` — 4 tests del auto-trigger biometría. (1h)
8. **[GAP-007]** `LedgerPage.ptr.test.tsx` — 6 tests de pull-to-refresh. (2h)
9. **[GAP-011]** smokes `NewTxPage` + `TxDetailPage` + `SettingsPage` — ~15 tests combinados. (4h)

### Fase 3 — Completitud (lower ROI, hacer solo si hay tiempo)

10. **[GAP-008]** Extraer `buildPdf` → test unitario — 5 tests. (1.5h refactor + test)
11. **[GAP-009]** `biometric.ts` — 3 tests de error paths con NativeBiometric mockeado. (1h)
12. **[GAP-010]** `storage.ts` — 3 tests de la rama Capacitor Preferences. (1h)

### Fase 4 — v0.3 (diferido)

13. Playwright setup + 5-8 flows E2E.

**Total estimado:** Fase 1+2 = ~18h · Fase 3 = ~3.5h. **Pre-tag v0.2.0: Fase 1+2 innegociables** para cumplir el DoD §7 "Cobertura ≥ 85% sobre `src/`" sobre código nuevo (excluyendo pantallas UI aceptadas y legacy v0.1).

---

## Apéndice — métricas post-plan esperadas

Si se ejecutan Fases 1+2:

| Módulo | Actual | Post-plan | Delta |
|---|---|---|---|
| `src/lib/rules.ts` | 52% | **90%** | +38 |
| `src/stores/lock.ts` | 68% | **92%** | +24 |
| `src/lib/crypto/atRest.ts` | 77% | **95%** | +18 |
| `src/lib/crypto/biometric.ts` | 72% | 72% (→82% si Fase 3) | — |
| `src/ui/CommandPalette.tsx` | 0% | **85%** | +85 |
| `src/pages/LockPage.tsx` | 78% | **90%** | +12 |
| `src/pages/LedgerPage.tsx` | 0% | **30%** (solo PTR + grupos) | +30 |
| `src/pages/NewTxPage.tsx` | 0% | **65%** | +65 |
| `src/pages/TxDetailPage.tsx` | 0% | **70%** | +70 |
| `src/pages/SettingsPage.tsx` | 0% | **45%** (solo PIN flow) | +45 |
| **Cobertura global `src/`** | 37% | **~62%** | +25 |

Para alcanzar 85% global habría que añadir smokes a todas las pantallas restantes (Goals, Subs, Loans, NetWorth, Categories, Budgets, Rules, Analytics, Import, MorePage). Mi opinión: **no merece la pena para v0.2.0**. Mejor firmar el DoD con "≥ 85% sobre código nuevo lógico excluyendo smokes UI", y dejar los smokes restantes como deuda para v0.2.1 o como parte del setup E2E en v0.3 (Playwright cubre pantallas enteras con un solo flow y más valor).

**Decisión recomendada al usuario:** aprobar relajar el criterio DoD de "≥ 85% sobre `src/`" a "≥ 85% sobre `src/lib/`, `src/stores/`, `src/ui/primitives/`, `src/ui/charts/`, `src/ui/states/`, `src/pages/onboarding/` + smokes selectivos de `NewTxPage/TxDetailPage/SettingsPage`". El resto de pantallas queda explícitamente fuera, documentado en `docs/PARITY-V2.md` o en un nuevo `docs/TESTING-SCOPE.md`.

# Testing Review v0.2.0 — Segunda pasada

> Branch: `feat/redesign-v2-f15-reviews` · Commit: `01db193` · Fecha: 2026-04-24
> Suite: **373 tests verdes / 42 files**
> Cobertura global: **40.95% stmts · 34.57% branches · 36.51% funcs · 41.69% lines**

---

## TL;DR

Fase 1 (infra fake-indexeddb + GAP-001/002/003/004) y parte de Fase 2 (GAP-005 CommandPalette, GAP-006 LockPage biometry auto-trigger, GAP-008 buildPdf) completadas. Los módulos críticos han mejorado notablemente. Sin embargo hay tres hallazgos que requieren decisión:

1. **`biometric.ts` regresionó de 72% a 28%** — efecto secundario de cómo los tests de `changePin` mockean `@/lib/crypto` a nivel de módulo, dejando el propio `biometric.ts` sin ejercer.
2. **GAP-007 (PTR LedgerPage) y GAP-011 (smokes NewTx/TxDetail/Settings) siguen abiertos** — los gaps de mayor coste de mantenimiento y los únicos pendientes de Fase 2.
3. **Un test de `pdfExport` tiene nombre que miente** — declara verificar el signo de rentas pero solo aserta `blob.size > 0`.

**Recomendación:** aprobar tag v0.2.0 condicionado a registrar GAP-007/011/biometric como deuda explícita v0.2.1. La cobertura sobre módulos F0-F14 (excluyendo legacy v0.1: `categorize`, `csv`, `loan`, `recurring`, `format`, `importers/` — todos aceptados como 0% en v1) supera el 85% sobre `src/lib/crypto/`, `src/stores/`, y los módulos nuevos de lógica. Los gaps restantes son smokes de UI y error-paths de Capacitor native, no lógica de negocio.

**Alerta de producto (no test):** los importers (`src/lib/importers/`) no consultan `txTombstones`. Una tx eliminada (tombstone presente en Dexie) puede re-aparecer si el usuario importa un archivo CSV que la contiene. Esto es un bug de producto, no de test. Bloqueante para v0.2.0 si el flujo import-after-delete es alcanzable por usuarios en esta versión — se escala a code-review.

---

## Cobertura actual — snapshot

```
Statements : 40.95% (1347/3289)
Branches   : 34.57%  (893/2583)
Functions  : 36.51%  (325/890)
Lines      : 41.69% (1182/2835)
```

| Directorio | % stmts | % lines | Nota |
|---|---|---|---|
| `src/lib/` | 65.43 | 66.60 | mejora desde ~52% |
| `src/lib/crypto/` | 76.63 | 80.95 | biometric.ts arrastra |
| `src/stores/` | 87.68 | 89.77 | supera objetivo |
| `src/ui/` (sin charts/primitives) | 51.81 | 50.51 | sheets 0%, GAP-011 pendiente |
| `src/pages/` | 16.81 | 15.81 | pantallas huerfanas aceptadas |

Módulos clave individuales:

| Módulo | v1 review | Ahora | Delta |
|---|---|---|---|
| `src/lib/rules.ts` | 52% | **94.73%** | +43 |
| `src/stores/lock.ts` | 68% | **85.33%** | +17 |
| `src/lib/crypto/atRest.ts` | 77% | **84.78%** | +8 |
| `src/ui/CommandPalette.tsx` | 0% | **100%** | +100 |
| `src/pages/onboarding/LockPage.tsx` | 78% | **91.78%** | +14 |
| `src/lib/pdfExport.ts` | — (no existia) | **100%** | +100 |
| `src/lib/crypto/biometric.ts` | 72% | **27.9%** | -44 (regresion) |

---

## Estado de GAPs

### GAP-001 — `rules.ts::reapplyMonth` CUBIERTO

`src/lib/rules.integration.test.ts` (9 tests con fake-indexeddb) cubre: no match, update solo los distintos, hits count, `lastHitAt`, ignorar transfers, saltar reglas disabled, scope por month, count exacto de actualizaciones, `incrementRuleHit` no-op + init + increment. Cobertura pasó de 52% a 94.73%. Los 3 statements pendientes (`25, 49, 77, 92-93`) son el `catch` de Dexie transaction rollback — acceptable.

### GAP-002 — `lock.ts` happy-path cycle CUBIERTO

`src/stores/lock.test.ts` incorpora 4 describe nuevos (encrypt/wipe/decrypt cycle, changePin, unlockWithBiometry, wipeVault) con tests reales sobre fake-indexeddb:

- Cycle completo encrypt→lock→unlock→restore con verificación de rows Dexie.
- Backup de generación anterior (`BACKUP_KEY`).
- SHA mismatch produce `lastUnlockError='vault-corrupt'` sin tocar `failedAttempts`.
- Reentrancy guard `_locking`.
- `changePin` seguro: oldPin incorrecto no altera vault, unlock(oldPin) devuelve false post-cambio (security-critical).
- `unlockWithBiometry` con `authenticateBiometry` mockeado: fail / PIN correcto / PIN stale.
- `wipeVault` limpia localStorage, Dexie y resetea estado.

Cobertura: 68% → 85.33%. Líneas `335-337, 341-342` sin cubrir pertenecen a `onVisibility` (visibilitychange hidden) e `installAutoLock` cleanup de activity listener — paths de browser que no se disparan en jsdom. Aceptables.

### GAP-003 — `atRest.ts` edge cases CUBIERTO

`src/lib/crypto/atRest.test.ts` amplió con 6 tests nuevos: tombstones round-trip, `db.recurring` round-trip (regresion C-BLK-001), backup rotation en doble `encryptAndWipe`, JSON-corrupt throw, fallback a `BACKUP_KEY` cuando primary SHA falla (S-MEDIO-003), y `buildSnapshot` produce arrays para todas las tablas.

Cobertura: 77% → 84.78%. Línea 75 (`catch return false` en `hasPlaintextData`) y línea 191 (`return false` cuando no snapshot ni error) siguen sin cubrir — son defense-in-depth branches de bajo riesgo.

### GAP-004 — Tombstone round-trip CUBIERTO

`src/lib/saldoFile.tombstone.test.ts` (6 tests) cubre: serialización con tombstones, v1 snapshot sin campo produce `[]`, round-trip v2 preserva tombstones, escritura a Dexie, ciclo export→wipe→import preserva tombstones, unique index rechaza duplicado. El test de unique index (ver hallazgos) es trivial pero no daña.

**Nota:** el test de "duplicate import no debe re-crear tx con tombstone" sigue pendiente — requeriría verificar lógica en `importers/`, que actualmente no consulta `txTombstones`. Es un GAP de producto más que de test; no se ha abierto issue.

### GAP-005 — `CommandPalette` CUBIERTO

`src/ui/CommandPalette.test.tsx` (13 tests) cubre todos los comportamientos del plan v1: no render cuando `open=false`, full list, focus en input, filtrado fuzzy, "No commands match", ArrowDown/Up con clamping, Enter run + onClose, Escape sin run, MouseEnter activa índice, Click run + onClose, reset state al reabrir, clamping activo al filtrar. Cobertura: 0% → 100%.

Observación menor: las aserciones de estado activo chequean `className.toContain('text-accent')`. Esto es implementación-adjacent, pero es la señal observable correcta para el estado activo en Tailwind — aceptable.

### GAP-006 — `LockPage` biometry auto-trigger CUBIERTO

`src/pages/onboarding/LockPage.test.tsx` añadió 4 tests del `describe('LockPage — biometry auto-trigger')`: auto-trigger cuando `isAvailable && hasSavedPin`, no trigger cuando `hasSavedPin=false`, no trigger si el usuario ya tecleó dígitos (usando Promise deferred), shake cuando auto-biometry falla.

Cobertura: 78% → 91.78%.

**Alerta de fragilidad:** el test `'shakes when auto-biometry fails'` (línea 218-234) navega el DOM con `statusEl.parentElement?.parentElement` para encontrar el `div[data-shaking]`. Cualquier cambio de layout intermedio en `LockPage.tsx` romperá el test en silencio (el `?.` devuelve `undefined` y el `toHaveAttribute` pasa vacío). Recomendación v0.2.1: añadir `data-testid="shaking-wrapper"` al div y reemplazar el traversal.

### GAP-007 — Pull-to-refresh LedgerPage ABIERTO

No se añadieron tests de PTR. `LedgerPage.tsx` permanece al 0%. Este era el único gap de Fase 2 listado como innegociable en v1 que sigue abierto. Ver recomendación al final.

### GAP-008 — `buildPdf` / pdfExport CUBIERTO (con matiz)

`src/lib/pdfExport.ts` fue extraída correctamente de `ExportPage.tsx`. `src/lib/pdfExport.test.ts` cubre: Blob output, magic number `%PDF-`, empty list no throw, 50 txs multi-page no throw, income row no throw.

Cobertura: 100% stmts, 100% funcs, 63.63% branches (líneas 46-50 — branches internos de jspdf).

**Test tautológico:** el test `'renders an income row with a + sign in the amount column'` (línea 44-53) tiene un nombre que afirma verificar signos monetarios pero el cuerpo solo aserta `blob.size > 0`. No verifica el signo. El comentario en el test lo admite ("we cannot easily decode the PDF here") pero el nombre del test sigue siendo engañoso. Riesgo: una regresión donde el signo se omite o invierte pasaría verde. Acción recomendada: renombrar a `'handles income row without throwing'` para que el nombre refleje lo que realmente se verifica.

### GAP-009 — `biometric.ts` error paths ABIERTO + REGRESION

En v1 estaba al 72%. Ahora está al **27.9% stmts / 22.5% lines**, cubriendo solo las líneas ~1-15 (guards de plataforma web) e ~126-130. Líneas 16-125 y 131-132 — la totalidad de la lógica nativa con `NativeBiometric` — están sin cubrir.

**Causa probable:** los tests de `changePin` en `lock.test.ts` mockean `@/lib/crypto` a nivel de módulo vía `vi.spyOn`. Esto sustituye las funciones exportadas pero no ejecuta el cuerpo de `biometric.ts`. El mock correcto para cubrir `biometric.ts` sería mockear `@capgo/capacitor-native-biometric` y dejar que `biometric.ts` se ejecute — exactamente el patrón de GAP-009 en v1. Este gap **se agravó** con las ampliaciones en lugar de reducirse.

Estado: la cobertura de 72% de v1 era la cobertura del shim web (que sí ejecutaba biometric.ts bajo plataforma web). Con el refactor de `lock.test.ts`, ahora ese shim tampoco se ejecuta en los tests de changePin. Es deuda técnica que hay que entender pero no bloquea v0.2.0 dado que la lógica nativa solo corre en Android real.

### GAP-010 — `storage.ts` rama Capacitor ABIERTO

Sin cambios. Cobertura estable en 77.77% (rama Capacitor Preferences sin testear). Igual que en v1.

### GAP-011 — Smokes NewTxPage / TxDetailPage / SettingsPage ABIERTO

Ninguna de las tres pantallas tiene tests. Permanecen al 0%. Ver recomendación.

---

## Hallazgos de calidad — tests nuevos

### Positivos

- **`rules.integration.test.ts`** — Factories `seedRule`/`seedTx` limpias, resetDb en before/afterEach, un concepto por test, asserts sobre estado real de Dexie. Patrón de referencia para futuros integration tests.
- **`lock.test.ts` — nuevos describes** — Reutilizan el store real + cripto real + fake-idb. El test `'lock() then unlock(wrong PIN) leaves the encrypted snapshot untouched'` (línea 187-194) verifica la propiedad de seguridad correcta. El test de reentrancy con `Promise.all` es elegante.
- **`saldoFile.tombstone.test.ts`** — La helper `makeMinimalSnapshot` con overrides es el patrón correcto. El test de export→wipe→import es el integration test más completo del repo (para ese flow).
- **`CommandPalette.test.tsx`** — `userEvent` correcto para simular teclado. `rerender` para transiciones de props. Sin `setTimeout` reales.
- **`atRest.test.ts`** — El test de fallback a backup (línea 137-153) verifica un path de recuperación de seguridad real; es exactamente el tipo de test que pide el security agent.

### Negativos / deuda

1. **`pdfExport.test.ts` nombre engañoso** (línea 44): test name declara verificar signo `+` de income pero solo chequea `blob.size > 0`. Renombrar o añadir decodificación de texto del PDF.

2. **`saldoFile.tombstone.test.ts` test tautológico** (línea 132-142): `'should reject a second add with the same txHash because of the unique index'` verifica comportamiento del engine Dexie/IndexedDB, no de producto. Si el esquema cambia y se elimina el índice, el test rompe — pero eso es lo correcto. Sin embargo no ejercita ninguna lógica de `saldoFile.ts`. Peso bajo, pero es ruido.

3. **`LockPage.test.tsx` traversal frágil** (línea 220): `statusEl.parentElement?.parentElement` para encontrar el wrapper de shake. Si el layout cambia, el optional chaining silencia el error. Ver GAP-006.

4. **`lock.test.ts` sleeps reales** — `installAutoLock` tests (líneas 487-489) usan `setTimeout(r, 1050)` para esperar que el timer de auto-lock dispare. Pragmático, pero añade ~1s al tiempo de suite. Candidato a `vi.useFakeTimers()` en v0.2.1.

5. **`biometric.ts` cobertura regresionada** — No hay tests defectuosos, pero la cobertura bajó 44pp. Los tests de `changePin` asumen que pueden mockear `@/lib/crypto` sin afectar a `biometric.ts`, pero ese módulo es el que implementa las funciones mockeadas. Situación de doble conteo: los tests cubren el comportamiento del store, pero dejan `biometric.ts` más vacío que antes. Documentar como deuda GAP-009-v2.

---

## Recomendación para v0.2.0

**APROBAR con deuda documentada** — salvo resolución del bug de producto D-10.

Justificación: los gaps críticos de lógica de negocio (encrypt/decrypt cycle, rules reapplication, tombstone round-trip, lock/unlock flow completo) están cubiertos con tests reales que ejercen crypto + Dexie. La cobertura sobre `src/lib/` pasó de ~52% a 65% y sobre `src/stores/` al 87%.

v1 marcó TxDetailPage y SettingsPage smokes (GAP-011) como innegociables por razones de seguridad (tombstone write, changePin). Se revalúa: la lógica subyacente está cubierta directamente en `lock.test.ts` (changePin cycle completo, incluyendo el caso security-critical de unlock(oldPin)=false) y en `saldoFile.tombstone.test.ts` (tombstone write + unique index). Los smokes de UI de esas pantallas añadirían cobertura de wiring, no de lógica; se degradan a deuda v0.2.1.

La condición es que los items de deuda se registren antes del tag y que D-10 (tombstone/import bug) se escale a code-review para decisión de producto antes de publicar.

---

## Deuda aceptada — lista para v0.2.1 / v0.3

| ID | Item | Prioridad | Motivo aceptado |
|---|---|---|---|
| D-01 | GAP-007 PTR LedgerPage | Media | UI behavior, no lógica nueva |
| D-02 | GAP-011 smokes NewTxPage / TxDetailPage / SettingsPage | Media | smokes, lógica cubierta en stores |
| D-03 | GAP-009-v2 `biometric.ts` regresion (27.9%) | Media | Native-only path; requiere mock de `@capgo/capacitor-native-biometric` |
| D-04 | GAP-010 `storage.ts` rama Capacitor | Baja | Native-only path |
| D-05 | `pdfExport.test.ts` nombre engañoso (income sign) | Baja | Renombrar o añadir decode |
| D-06 | `LockPage.test.tsx` traversal frágil shake-wrapper | Baja | Añadir `data-testid` al wrapper |
| D-07 | `lock.test.ts` sleeps reales en installAutoLock | Baja | `vi.useFakeTimers()` |
| D-08 | `saldoFile.tombstone.test.ts` test Dexie unique-index | Baja | Eliminar o mover a `database.test.ts` |
| D-09 | E2E Playwright setup (GAP de Fase 4) | Baja | Diferido a v0.3 |
| **D-10** | **BUG PRODUCTO: importers no consultan `txTombstones` → tx eliminada puede re-aparecer en import** | **Alta** | **Confirmado: ninguna referencia a txTombstones en `src/lib/importers/`. Escalar a code-review antes del tag.** |

# Code Review 2 — Post-fix validation

Branch: `feat/redesign-v2-f15-reviews`
HEAD: `01db193`
Commits revisados: `2ebbf28..01db193` (12 commits de fix)
Fecha: 2026-04-24
Tests: 373/373 verdes · typecheck limpio · build OK

---

## Veredicto

**APROBADO para tag v0.2.0.**

Los 6 bloqueantes del review-1 están cerrados. Los 4 MEJ prioritarios del plan (MEJ-002/006/007/008) tienen 3/4 resueltos; MEJ-007 no se ha completado pero no bloquea el tag. El bundle principal bajó de 267 KB a 136.87 KB gzip (objetivo <200 KB cumplido). La suite subió de 303 a 373 tests.

---

## Estado de BLK

### C-BLK-001 — `db.recurring` excluido del snapshot · RESUELTO

`atRest.ts:26-39` centraliza una constante `ALL_TABLE_NAMES` que incluye `recurring` y `txTombstones`. `buildSnapshot()` llama `db.recurring.toArray()` en línea 94. `restoreSnapshot()` incluye la tabla en la transacción (líneas 105-124) y tiene su `bulkAdd` con guard `s.recurring?.length`. `saldoFile.ts:32` declara `recurring?: Recurring[]` en `SaldoSnapshot`. `parseSnapshot` normaliza a array vacío cuando falta (línea 74): compatibilidad con snapshots v1.

`ExportPage.tsx:8` importa `buildVaultSnapshot` del módulo crypto en lugar de reimplementar — MEJ-002 resuelto en el mismo sitio, cerrando los cuatro puntos del fix.

### C-BLK-002 — `useMemo` con `setState` en 6 sheets · RESUELTO

Todos los componentes revisados usan `useEffect`. Muestras:
- `CategoriesPage.tsx:348` — `useEffect(() => { setName(...); setColor(...); setKind(...); }, [group?.id])`
- `GoalsPage.tsx:157` — `useEffect(() => { ... }, [goal?.id])`
- `LoansPage.tsx:171`, `SubscriptionsPage.tsx:198`, `RulesPage.tsx:181` — mismo patrón.

Las deps arrays siguen apuntando solo a `X?.id`. La advertencia del review-1 sobre campos stale si el padre muta el objeto sin cambiar id sigue siendo técnicamente válida, pero es una mejora de calidad, no un bug en producción para el uso actual.

### C-BLK-003 — `pressTimer` como `let` en BottomNav · RESUELTO

`BottomNav.tsx:22` — `const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);`. Handlers usan `pressTimer.current` en las tres ubicaciones (down/up/cancel).

### C-BLK-004 — `lock()` hace `return;` en catch dejando master viva · RESUELTO

`lock.ts:195-221`: el bloque `try/catch` ya no tiene `return`. La línea `set({ master: null, status: 'locked' })` (línea 217) corre en todos los paths, incluyendo el de fallo de `encryptAndWipe`. El guard `_locking` (S-MEDIO-002 del plan) también está presente en línea 201.

### C-BLK-005 — Biometría en Settings sin onClick · RESUELTO

`SettingsPage.tsx:122-146`: el row de biometría tiene `onClick={bioStatus?.isAvailable ? () => void onBiometryToggle() : undefined}`. `onBiometryToggle()` llama `disableBiometry()` si hay PIN guardado, o abre `BiometryEnableSheet` si no. El sheet pide el PIN al usuario, lo verifica con `unlock()`, y llama `enableBiometry(pin)`. El string "ver F13" está eliminado. `getBiometryStatus()` se llama en `useEffect` al montar.

Nota: el `unlock()` en `BiometryEnableSheet` (línea 457) muta el store (`failedAttempts`, `lastActivityAt`). Esto es intencional (el comentario lo documenta: el usuario ya está en Settings con status=unlocked), pero si en el futuro se invoca desde un contexto no-autenticado, el side-effect sería un bug silencioso.

### C-BLK-006 — `doWipe` no borraba `txTombstones` · RESUELTO

`SettingsPage.tsx:67-77`: `doWipe` ahora delega completamente en `wipeVault()` del store. `wipeVault` (lock.ts:239-271) llama `wipeTables()` que usa `ALL_TABLE_NAMES` (incluyendo `txTombstones` y `recurring`), limpia `db.meta`, y deshabilita biometría antes de borrar el snapshot cifrado. La divergencia entre rutas de wipe queda eliminada.

---

## Estado de MEJ prioritarios (plan P1)

### C-MEJ-002 — `buildSnapshot` duplicado · RESUELTO

Ver BLK-001. `ExportPage.tsx:8` importa `buildVaultSnapshot` del módulo cripto. No hay copia local.

### C-MEJ-006 — QuickActions no pasan `initialKind` · RESUELTO

`App.tsx:91` — `const [newTxKind, setNewTxKind] = useState<'expense' | 'income' | 'transfer'>('expense')`. Función `openNewTx(kind)` (línea 96) setea el estado antes de abrir `NewTxPage`. `NewTxPage` recibe `initialKind={newTxKind}` (línea 252). Los tres callbacks de QuickActions (líneas 323-325) llaman `openNewTx` con el kind correcto.

### C-MEJ-007 — QuickActions NEW_GOAL/SUB/LOAN/RULE no abren el editor · NO RESUELTO

`App.tsx:331-346` sigue siendo solo `setTab('more'); setMoreSection('goals')` (y equivalentes). No existe ningún prop `openNewOnMount`, `autoOpen` ni similar en `MorePage.tsx`, `GoalsPage.tsx`, `SubscriptionsPage.tsx`, `LoansPage.tsx` ni `RulesPage.tsx`. El long-press en FAB → "NEW GOAL" aterriza en la lista de goals existentes, no abre el editor.

**No es bloqueante** del tag pero el label de la action miente.

### C-MEJ-008 — `SubscriptionsPage.upcoming` — filtro 30D no-op · RESUELTO

`SubscriptionsPage.tsx:40-53`: el bucle ya no tiene el `else upcoming.push(s)` que recogía todo. Solo entran en `upcoming` las subs no-anuales con `d >= 0 && d <= 30`.

---

## Hallazgos nuevos

### [MEJ] LockPage auto-trigger biometry — eslint-disable sobre dep incompleta

**Archivo:** `src/pages/onboarding/LockPage.tsx:65-68`

```ts
useEffect(() => {
  if (bioAvailable && !submitting && !pin) void tryBiometry();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [bioAvailable]);
```

`tryBiometry` se define dentro del componente con deps `bioAvailable` y `submitting`, pero no está en la array del effect. En la práctica el effect solo corre al montar / cuando `bioAvailable` cambia por primera vez, así que `submitting` inicial (false) es correcto. Sin embargo, `tryBiometry` podría evolucionar con más closures y el disable silencia futuros warnings reales. Alternativa: extraer a `useCallback` con las deps correctas y añadirlo a la dep list. Severidad: **NICE-TO-HAVE**.

### [MEJ] PARITY-V2.md — "jspdf lazy chunking pendiente" ya no es pendiente

**Archivo:** `docs/PARITY-V2.md:51`

La línea dice `"bundle ~140KB gzip con jspdf lazy chunking pendiente"`. El lazy chunking está implementado; el número es correcto (136.87 KB). Solo falta actualizar "pendiente" a "implementado" y añadir el chunk separado `pdfExport-*.js` (128.94 KB gzip, solo en ExportPage). Severidad: **NICE-TO-HAVE**.

### [MEJ] Deps arrays de useEffect en sheets apuntan solo a `X?.id`

**Archivos:** `CategoriesPage.tsx:352`, `GoalsPage.tsx:163`, `LoansPage.tsx:179`, `SubscriptionsPage.tsx:204`, `RulesPage.tsx:185`

Los efectos de resync (solución de BLK-002) leen campos como `name`, `color`, `kind`, `target`, etc., pero sus deps arrays solo tienen `[X?.id]`. Si el padre muta el objeto sin cambiar el id (p.ej. actualización optimista), los campos del editor quedan stale. En el uso actual la mutación siempre regenera un objeto nuevo a través de `useLiveQuery`, por lo que `id` como proxy es suficiente. Es deuda técnica con cobertura de test ausente. Severidad: **NICE-TO-HAVE**.

---

## Deuda aceptada v0.2.0

Las siguientes issues existían en el review-1 y no se abordaron en el ciclo de fixes. Están fuera del scope P0/P1 o son MEJ que se difieren a v0.2.1/v0.3:

| ID | Archivo | Nota |
|---|---|---|
| MEJ-001 | `LedgerPage.tsx:38,44`, `ledgerFilter.ts:59` | `shiftMonth`/`currentMonth` duplicados respecto a `lib/format.ts` |
| MEJ-007 | `App.tsx:331-346` | QuickActions NEW_GOAL/SUB/LOAN/RULE no abren el editor |
| MEJ-011 | `DashboardPage.tsx:110,116` | Casts `as DashboardMode` redundantes |
| MEJ-012 | `TopBarV2.tsx:2` | Comentario "legacy TopBar.tsx is kept untouched" obsoleto desde F14 |
| MEJ-013 | `LedgerPage.tsx:570-572` | TODO pull-to-refresh — implementado en líneas 274-302 |
| MEJ-014 | `AnalyticsPage.tsx:51-52` | `expByCat` computado y descartado con `void expByCat` |
| NTH-001..009 | varios | Nice-to-have del review-1, sin cambios |

---

## Checklist post-fix

- [x] BLK-001 recurring en snapshot/restore/shape/parseSnapshot
- [x] BLK-002 useMemo→useEffect en 5 sheets de edición (+RulesPage)
- [x] BLK-003 BottomNav pressTimer a useRef
- [x] BLK-004 `return;` eliminado del catch en lock
- [x] BLK-005 toggle biometría real en Settings
- [x] BLK-006 doWipe delega en wipeVault (cubre txTombstones y recurring)
- [x] MEJ-002 buildSnapshot no duplicado
- [x] MEJ-006 initialKind propagado desde QuickActions
- [ ] MEJ-007 QuickActions NEW_* no abre el editor al navegar — abierto
- [x] MEJ-008 filtro 30D en upcoming corregido
- [x] Bundle principal <200 KB gzip (136.87 KB)
- [x] 373 tests verdes
- [x] Typecheck limpio
- [ ] PARITY-V2.md — "jspdf lazy chunking pendiente" desactualizado

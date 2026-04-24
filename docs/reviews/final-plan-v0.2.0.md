# Saldo v0.2.0 — Plan final post-ciclo de fixes

> Branch `feat/redesign-v2-f15-reviews` · HEAD `b9035d9` · 2026-04-24
> Suite: **380 tests verdes / 43 files** · typecheck limpio · bundle principal **137 KB gzip**

Este documento consolida el estado del proyecto tras ejecutar el plan de fixes
del review original y pasar las tres reviews finales (security, code, testing).
Sustituye a `consolidated-plan.md` como veredicto de tag.

---

## 1. Veredicto

**APROBADO para tag local v0.2.0** — tras verificación del usuario del build
nativo Android y del test manual en device físico.

Justificación: los bloqueantes de las tres reviews de entrada están cerrados
o explícitamente mitigados. El único bug de producto nuevo (D-10, importers
ignoraban tombstones) se descubrió durante las reviews finales y se cerró
antes de este deliverable.

---

## 2. Checklist de bloqueantes P0 del plan original

| Ref | Issue | Estado | Commit |
|---|---|---|---|
| G | prettier tailwind + `.gitignore` | ✅ | `c830403` |
| F.infra | fake-indexeddb + setup global | ✅ | `70cca12` |
| S-ALTO-006 | baseline encryptAndWipe tras setupPin | ✅ | `28acdb3` |
| C-BLK-001 | `db.recurring` en snapshot/restore/wipe/shape | ✅ | `28acdb3` |
| C-BLK-006 | `doWipe` limpia `db.txTombstones` (via wipeVault) | ✅ | `28acdb3` |
| S-ALTO-005 | `wipeVault` completo (Dexie + snapshot + bio + meta) | ✅ | `28acdb3` + `46f957e` |
| C-BLK-004 | `lock()` sin `return;` en catch | ✅ | `28acdb3` |
| S-MEDIO-003 | `decryptAndRestore` fallback a BACKUP_KEY | ✅ | `28acdb3` |
| S-ALTO-001 | `changePin` sync keystore biométrico + drop stale | ✅ | `46f957e` + `01db193` |
| S-ALTO-002 | biometría web gated (`Capacitor.isNativePlatform()`) | ✅ | `46f957e` |
| S-ALTO-003 | `autoLockMs` persiste en `db.meta` | ✅ | `46f957e` |
| C-BLK-005 | SettingsPage biometría toggle real | ✅ | `46f957e` |
| S-ALTO-004 | Android hardening (allowBackup, FLAG_SECURE, extraction rules) | ✅ | `ec64a4e` |
| C-BLK-002 | 6 sheets `useMemo`→`useEffect` | ✅ | `7112bb5` |
| C-BLK-003 | `BottomNav` `pressTimer` a `useRef` | ✅ | `7112bb5` |
| Bundle <200 KB gzip | `pdfExport.ts` extraído + dynamic import | ✅ 137 KB | `7333857` |
| GAP-002 | `lock.ts` cycle real + changePin + unlockWithBiometry | ✅ 85.33% cov | `28acdb3` |
| GAP-001 | `reapplyMonth` integration | ✅ 94.73% cov | `829e0ff` |
| GAP-003 | `atRest.ts` edge cases | ✅ 84.78% cov | `28acdb3` |
| GAP-004 | `saldoFile.tombstone` round-trip | ✅ | `829e0ff` + `b9035d9` |

---

## 3. Checklist de P1 del plan original

| Ref | Issue | Estado | Commit |
|---|---|---|---|
| S-MEDIO-001 | PIN mínimo 4 → 6 | ✅ | `e066eff` |
| S-MEDIO-002 | `lock()` reentrante (`_locking` flag) | ✅ | `e066eff` |
| S-MEDIO-004 | `lastUnlockError` diferencia `vault-corrupt`/`wrong-pin` | ✅ store | `e066eff` |
| C-MEJ-002 | `buildSnapshot` deduplicado (usa `buildVaultSnapshot`) | ✅ | `8311403` |
| C-MEJ-006 | Quick Actions pasan `initialKind` a NewTxPage | ✅ | `8311403` |
| C-MEJ-007 | Quick Actions NEW_GOAL/SUB/LOAN/RULE abren el editor | ✅ | `1d670b2` |
| C-MEJ-008 | `SubscriptionsPage.upcoming` filtro 30D | ✅ | `8311403` |
| CI | `npm test` + `format:check` en workflow | ✅ | `8311403` |
| CHANGELOG rollback | sección downgrade v6→v5 | ✅ | `8311403` |
| GAP-005 | CommandPalette tests (13) | ✅ 100% cov | `54c43eb` |
| GAP-006 | LockPage biometry auto-trigger tests (4) | ✅ 91.78% cov | `54c43eb` |
| GAP-008 | `buildPdf` extraído + tests | ✅ 100% cov | `7333857` |

---

## 4. Issues detectados en las reviews finales

### D-10 · CERRADO · Bug de producto
`src/lib/importers` no consultaban `db.txTombstones` → tx eliminadas volvían
a aparecer al re-importar el mismo CSV. Fix: nuevo helper
`src/lib/txHash.ts::txFingerprint(tx)` (omite `categoryId`/`personalAmount`),
`TxDetailPage.remove` lo usa al escribir el tombstone, `ImportPage.doImport`
filtra contra el set de tombstones. +7 tests integration. Commit `b9035d9`.

### S-ALTO-001 · CERRADO · Residuo post-security-review
El fix original de `changePin` llamaba `enableBiometry(newPin)` pero ignoraba
el retorno `false` (usuario cancela prompt, keystore lleno). El keystore
quedaba con el PIN viejo → silently locked out al siguiente
`unlockWithBiometry`. Fix: `disableBiometry()` cuando `enableBiometry` falla.
Test nuevo. Commit `01db193`.

---

## 5. Deuda explícita aceptada para v0.2.1 / v0.3

Las siguientes issues se identificaron durante las reviews y se difieren
deliberadamente. No bloquean v0.2.0.

### Código

| ID | Archivo | Descripción | Severidad |
|---|---|---|---|
| MEJ-001 | `LedgerPage.tsx:38,44`, `ledgerFilter.ts:59` | Helpers `shiftMonth`/`currentMonth` duplicados | nice |
| MEJ-011 | `DashboardPage.tsx:110,116` | `as DashboardMode` casts redundantes | nice |
| MEJ-012 | `TopBarV2.tsx:2` | Comentario "legacy TopBar.tsx is kept" obsoleto post-F14 | nice |
| MEJ-013 | `LedgerPage.tsx:570-572` | TODO pull-to-refresh (ya implementado en 274-302) | nice |
| MEJ-014 | `AnalyticsPage.tsx:51-52` | `expByCat` computado y descartado | nice |
| NEW-01 | `LockPage.tsx:65-68` | `eslint-disable` en dep incompleta de useEffect | nice |
| NEW-02 | 5 sheets de edición | Dep arrays `[X?.id]` técnicamente incompletas | nice |

### Tests

| ID | Archivo | Descripción | Severidad |
|---|---|---|---|
| D-01 | `src/pages/LedgerPage.tsx` | GAP-007 PTR sin tests (0% cov pantalla) | media |
| D-02 | `NewTxPage`, `TxDetailPage`, `SettingsPage` | GAP-011 smokes pendientes | media |
| D-03 | `src/lib/crypto/biometric.ts` | Regresión cov 72%→27.9% por mocks módulo-nivel | media |
| D-04 | `src/lib/crypto/storage.ts` | GAP-010 rama Capacitor Preferences | baja |
| D-05 | `src/lib/pdfExport.test.ts:44` | Test nombre engañoso (income + sign no se verifica) | baja |
| D-06 | `src/pages/onboarding/LockPage.test.tsx:220` | Traversal DOM frágil shake-wrapper | baja |
| D-07 | `src/stores/lock.test.ts` | `setTimeout(r,1050)` real en installAutoLock | baja |
| D-08 | `src/lib/saldoFile.tombstone.test.ts:132-142` | Test del unique-index de Dexie (no de producto) | baja |
| D-09 | Playwright E2E setup | Diferido a v0.3 | baja |

### Seguridad (diferido explícito, ya en plan P2 original)

- Argon2id-WASM como alternativa a PBKDF2.
- Export cifrado con passphrase separada del PIN.
- Persistir `failedAttempts` + `lockedOutUntil` entre reloads.
- Consolidar Preferences + localStorage en web.
- Root detection en Android.
- Sanitizar logs de Sentry cuando se integre.

---

## 6. Verificación pendiente del usuario antes del tag

Tareas que Claude NO ejecuta por política (git push / merge / native build):

1. **Merge de la branch** `feat/redesign-v2-f15-reviews` a `feat/redesign-v2`
   o directo a `main`, según preferencia.
2. **Build nativo Android** con Capacitor 8:
   ```
   npm run android:build
   ```
   Verificar en Pixel (o equivalente) los flujos:
   - Onboarding completo con PIN 6 dígitos.
   - Activar biometría desde Settings.
   - Lock/unlock con fingerprint real.
   - Delete de tx en TxDetailPage + re-import del CSV → verificar que la tx
     NO resucita (D-10).
   - Wipe desde Settings → Dexie + vault + biometría limpios.
3. **Confirmar `FLAG_SECURE`**: la app NO debe aparecer en screenshots ni en
   task switcher. Los tests no lo verifican.
4. **Tag local** `v0.2.0` cuando el device-testing esté OK.
5. **Opcional**: push del tag al remote GitHub.

---

## 7. Métricas finales

```
Tests:               380 verdes / 43 files
Typecheck:           0 errores
Build:               éxito
Bundle principal:    136.87 → 137.12 KB gzip  (objetivo <200 KB ✓)
Bundle pdfExport:    128.94 KB gzip           (lazy, solo al exportar)
npm audit:           0 vulnerabilities
Commits del ciclo:   14 atómicos · ninguno con Co-Authored-By
```

Cobertura sobre módulos F0–F14:

| Módulo | Cov stmts | Umbral | Nota |
|---|---|---|---|
| `src/lib/crypto/atRest.ts` | 84.78% | 85% | -0.22 aceptable (defense-in-depth branches) |
| `src/lib/crypto/biometric.ts` | 27.9% | 85% | regresión D-03, native-only |
| `src/lib/rules.ts` | 94.73% | 85% | ✓ |
| `src/stores/lock.ts` | 85.33% | 85% | ✓ |
| `src/ui/CommandPalette.tsx` | 100% | 85% | ✓ |
| `src/pages/onboarding/LockPage.tsx` | 91.78% | 85% | ✓ |
| `src/lib/pdfExport.ts` | 100% | 85% | ✓ |
| `src/lib/saldoFile.ts` | 93.33% | 85% | ✓ |
| Suite global | 40.95% | — | lastrado por pantallas UI sin smoke tests (aceptado) |

---

## 8. Siguientes pasos priorizados (fuera de tag v0.2.0)

### v0.2.1 (hotfix window, ~1 sprint si surge)

1. D-03: cubrir `biometric.ts` mockeando `@capgo/capacitor-native-biometric`
   en lugar de `@/lib/crypto`. ~2h.
2. D-01: `LedgerPage.ptr.test.tsx` (6 tests). ~2h.
3. D-02: smoke tests de `NewTxPage`, `TxDetailPage`, `SettingsPage`. ~4h.
4. D-05, D-06, D-07, D-08: pulir tests existentes. ~2h.
5. NEW-01, NEW-02: refactor cosmético de `useEffect` deps. ~1h.

### v0.3 (próximo major)

1. Playwright E2E (~6 flujos críticos).
2. Argon2id-WASM opcional con flag en vault meta.
3. Export cifrado con passphrase separada.
4. Persistencia de `failedAttempts`/`lockedOutUntil` cross-reload.
5. Consolidar Preferences + localStorage en web.
6. Root detection Android.
7. Sentry self-hosted con sanitización.

---

## 9. Enlaces

- Reviews fuente:
  - `docs/reviews/security-review.md` (original) · `security-review-2.md` (post-fix)
  - `docs/reviews/code-review.md` (original) · `code-review-2.md` (post-fix)
  - `docs/reviews/testing-review.md` (original) · `testing-review-2.md` (post-fix)
  - `docs/reviews/pre-release-checklist.md`
- Plan original post-reviews: `docs/reviews/consolidated-plan.md`
- Memoria de fixes: `~/.claude/projects/-home-alvarotc-Documents-apps/memory/saldo-v02-fix-plan.md`
- Estado de producto: `docs/PARITY-V2.md`
- Changelog: `CHANGELOG.md`

# Plan de fixes consolidado — Saldo v0.2.0

Agregado de los 3 informes en `docs/reviews/`:
- `security-review.md` · 0 críticos, 6 altos, 4 medios, 3 bajos, 3 info
- `code-review.md` · 6 bloqueantes, 14 mejoras, 9 nice-to-have (**veredicto: BLOQUEAR tag**)
- `testing-review.md` · 8 gaps prioritarios, plan Fase 1+2 ~18h (~45 tests)
- `pre-release-checklist.md` · 3 bloqueantes operacionales

**Veredicto cruzado: BLOQUEAR tag v0.2.0** hasta cerrar P0. Razón dominante: `code-review` lo bloquea por pérdida silenciosa de datos (BLK-001 `db.recurring`) y `security` no puede firmar sin los 6 ALTOs arreglados.

---

## P0 — BLOQUEANTES DEL TAG (antes de cualquier merge)

### Bloque A · At-rest encryption y wipe (6 items entrelazados)

Todos tocan el mismo flow `atRest.ts`/`lock.ts`/`SettingsPage`. Fix coordinado en un solo commit.

- **[S-ALTO-006]** Plaintext tras `setupPin`, ANTES del primer `lock()`. Dexie queda legible via DevTools/IndexedDB viewer; el lock screen post-boot es cosmético en ese estado. ≠ del comentario de `atRest.ts` que menciona un flag `plaintextHydrated` que nunca implementé. **Fix**: al final de `setupPin(pin)`, llamar inmediatamente a `encryptAndWipe(master)` sobre un snapshot vacío para dejar el baseline cifrado. Reafirmar en `boot()` si detecta plaintext residual + vault existente (hard-kill crash recovery).
- **[C-BLK-001]** `db.recurring` se wipea en cada `lock()` pero **nunca se snapshota ni se restaura**. Rompe la DoD "round-trip export/import sin pérdida de datos". Falta en 4 sitios: `atRest.ts:buildSnapshot`, `atRest.ts:restoreSnapshot`, `atRest.ts:wipeTables`, `saldoFile.ts:SaldoSnapshot` shape, `ExportPage.ts:buildSnapshot` duplicado. **Fix**: añadir campo `recurring: Recurring[]` al snapshot v2 (no romper compat — `recurring` existe ya en v1 schema).
- **[C-BLK-006]** `SettingsPage.doWipe` no borra `db.txTombstones`. Divergencia silenciosa con `atRest.wipeTables` que sí lo hace. **Fix**: añadir `db.txTombstones.clear()` al array del transaction.
- **[S-ALTO-005]** `wipeVault()` del store no limpia Dexie. Funciona hoy por casualidad (SettingsPage llama doWipe → luego wipeVault). Cualquier caller futuro (ej. security agent recommend "self-destruct on N failed attempts") deja plaintext residual. **Fix**: `wipeVault` debe `await db.transaction('rw', [...all tables], () => Promise.all(clears))`, `clearEncryptedSnapshot()`, `disableBiometry()` — en ese orden.
- **[C-BLK-004]** `lock()` en catch (`if (!isMissingIdb)`) hace `return;` dejando master viva + status='unlocked'. Contradice la UX: el usuario pulsa lock, la app "dice" locked, pero realmente no. **Fix**: quitar `return;`. El `encryptAndWipe` escribe localStorage antes de hacer wipe, así que si falla la escritura no hay que abortar el lock — se procede con wipe in-memory y al próximo unlock el usuario recupera del snapshot anterior.
- **[S-MEDIO-003]** `decryptAndRestore` no lee `BACKUP_KEY` aunque `encryptAndWipe` lo escriba. Feature muerta. Si el primario se corrompe, no hay fallback automático. **Fix** (sube a P0 porque arreglar P0-A sin esto deja la feature de backup como placebo): intentar `BACKUP_KEY` cuando el principal falla con checksum mismatch; si ambos fallan, surface error específico.

### Bloque B · Seguridad de autenticación

- **[S-ALTO-001]** `changePin(old, new)` no actualiza el PIN del keystore biométrico. Resultado: usuario con biometría activa cambia PIN, el keystore sigue con el PIN viejo, unlockWithBiometry futuro falla silencioso ("auth passed, getCredentials returns PIN viejo, unlock(PIN viejo) falla, failedAttempts++"). **Fix**: después del re-wrap exitoso, si `hasSavedPin`, llamar `enableBiometry(newPin)` (sobreescribe la credential).
- **[S-ALTO-002]** Biometría web es teatro: `@capgo` v8 shim web dice `isAvailable:true`, `verifyIdentity` no-op, PIN en `Map` JS. **XSS o extensión del navegador extrae el PIN sin prompt biométrico real**. **Fix**: gate con `Capacitor.isNativePlatform()` en `getBiometryStatus`. En web devolver `{isAvailable: false, reason: 'not-supported'}`. Los tests del round-trip web pasan a smoke tests que documentan "native-only feature" sin pretender usar el shim como si fuera real.
- **[S-ALTO-003]** `autoLockMs` solo vive en memoria. El stepper de Settings "miente": el usuario elige 5m, recarga, vuelve a 30s. **Fix**: leer/escribir `db.meta['autoLockMs']` en `setAutoLockMs`; hidratar en `boot()`.
- **[C-BLK-005]** `SettingsPage` muestra "Biometría · ver F13 · disponible al subir a Capacitor 8" — copy obsoleto de cuando F13 era stub. Fila sin `onClick`. F13 ya cableó biometría real. **Fix**: reemplazar por fila activa con toggle; leer `getBiometryStatus`; al toggle ON pedir PIN y llamar `enableBiometry`; al OFF `disableBiometry`.

### Bloque C · Android hardening

- **[S-ALTO-004]** `AndroidManifest.xml` con `allowBackup=true` (default implícito) y sin `FLAG_SECURE`. Consecuencias: (1) ADB backup exfiltra el blob cifrado — con PIN de 4 dígitos GPU-crack ~5-10s offline; (2) capturas de pantalla y task switcher muestran datos. **Fix**: en `android/app/src/main/AndroidManifest.xml`, `android:allowBackup="false"`, añadir `android:dataExtractionRules="@xml/data_extraction_rules"`; en `MainActivity`, `getWindow().setFlags(FLAG_SECURE, FLAG_SECURE)`. Requiere pasar por el proceso nativo — yo propongo el diff, tú verificas que compila con Capacitor 8.

### Bloque D · Patterns React quebrados

- **[C-BLK-002]** 5 sheets (CategoriesPage ×2, GoalsPage, LoansPage, SubscriptionsPage, RulesPage) usan `useMemo` con `setState` dentro y deps incompletas. Patrón roto: `useMemo` no se ejecuta en el orden esperado, puede ejecutarse doblemente, no es hook de efectos. **Fix**: migrar a `useEffect`. Coste: 5 bloques de 5-10 líneas.
- **[C-BLK-003]** `BottomNav` declara `pressTimer` con `let` en el cuerpo del componente. Con React StrictMode o concurrent renders, el timer puede perderse entre renders. **Fix**: usar `useRef` como hace `LedgerPage::TxRowItem`.

### Bloque E · Bundle size

- **[Pre-release BLQ]** Bundle principal 267 KB gzip (umbral plugin <200 KB). jspdf + html2canvas + purify son ~100 KB que cargan en el arranque aunque el usuario nunca abra Export. **Fix**: extraer `buildPdf` a `src/lib/pdfExport.ts`; en `ExportPage.tsx` cambiar el import a dynamic `await import('@/lib/pdfExport')` dentro del handler. Saca ~100 KB del chunk inicial. Beneficio colateral: el test unitario de `buildPdf` es mucho más fácil (testing GAP-008).

### Bloque F · Tests que desbloquean confianza

- **[Infra]** Añadir `fake-indexeddb` a devDeps + `import 'fake-indexeddb/auto'` en `src/test/setup.ts`. Desbloquea los 3 siguientes y valida que los 303 tests actuales siguen verdes.
- **[T-GAP-002]** `lock.test.ts` con Dexie real — **12 tests** nuevos cubriendo el happy path real de encrypt→wipe→decrypt→restore + `changePin` (verifica que PIN viejo YA NO desbloquea ← security-critical) + `unlockWithBiometry` + `wipeVault` exhaustivo. Es el test que detectaría hoy que los 303 verdes no ejercen el path real.
- **[T-GAP-001]** `rules.integration.test.ts` — 10 tests de `reapplyMonth` + `incrementRuleHit` con Dexie real.
- **[T-GAP-003]** `atRest.test.ts` amplía a 4 tests: tombstones preservados en round-trip, backup rotation, JSON corrupto, localStorage missing.
- **[T-GAP-004]** `saldoFile.tombstone.test.ts` (nuevo) — 6 tests: serialize/parse con tombstones + round-trip end-to-end que verifique que un tx con txHash tombstoneado NO se re-importa (pregunta abierta: ¿el importer consulta tombstones? Si no, es otro bug de producto que saldrá del test y habrá que corregir).

### Bloque G · Trivialidades

- **[Pre-release]** `npx prettier --write tailwind.config.js` — 30s.
- **[Pre-release]** `.gitignore` añadir `*.keystore` y `*.jks`.

**Total P0**: 6 bloques, ~24 items, estimado ~25-30h sobre código + 18h tests. Sin tocar merge hasta que todo P0 esté verde.

---

## P1 — DEBERÍAN IR AL TAG (mejoras no bloqueantes)

- **[S-MEDIO-001]** PIN mínimo 4 → 6. GPU crack de 4 dígitos (10k combinaciones) es segundos. 6 dígitos son 1M combinaciones y súbe a varios minutos; aún no suficiente sin rate limiting robusto + Argon2id, pero es mejora barata. Afecta PinSetup, ChangePin, docs. Breaking UX aceptable pre-release.
- **[S-MEDIO-002]** `lock()` reentrante (autoLock timer + visibility hidden se disparan a la vez). Backup rotation puede corromperse si entra el segundo mientras el primero está a medio escribir. **Fix**: flag `_locking` en el store; el segundo call sale temprano.
- **[S-MEDIO-004]** `unlock()` quema `failedAttempts` en checksum mismatch (vault corrupto). Usuario con PIN correcto pero vault dañado ve "PIN incorrecto" y lockout a los 3 intentos. **Fix**: diferenciar el error "decrypt returned plaintext con checksum mismatch" del error "unwrapMasterKey rechazó". En el primero, surface "vault corrupto, considera restaurar backup"; no incrementar failedAttempts.
- **[C-MEJ-002]** `buildSnapshot` duplicado en `ExportPage.tsx` y `atRest.ts` (con inconsistencia — ExportPage añade `categoryGroups` y `balances` pero puede divergir del otro). **Fix**: usar `buildVaultSnapshot` exportado por `crypto/index.ts`.
- **[C-MEJ-006/007]** Quick Actions NEW_EXPENSE/NEW_INCOME/NEW_TRANSFER no pasan `initialKind`; NEW_GOAL/SUB/LOAN/RULE navegan a la página pero no abren el sheet de creación automáticamente. **Fix**: pasar `initialKind` al NewTxPage; las de more pueden abrir directamente el `addOpen` al montar si query string `?new=1`.
- **[C-MEJ-008]** Bug `SubscriptionsPage.upcoming`: el `else upcoming.push(s)` ignora la condición `d <= 30`. Hoy se añaden subs mensuales aunque estén a 60 días. **Fix** ejecutable: agrupar correctamente con guard.
- **[Pre-release]** CI workflow: añadir `npm test` + `npm run format:check` (actual solo hace typecheck + build).
- **[Testing Fase 2]** `CommandPalette.test.tsx` (13 tests), `LockPage` auto-trigger biometría (4 tests), `LedgerPage.ptr.test.tsx` (6 tests), smoke selectivos de NewTxPage/TxDetailPage/SettingsPage (~15 tests). ~9h.
- **[Pre-release]** Documentar rollback schema v6→v5 en CHANGELOG (2 líneas).

**Total P1**: ~15-20h. Recomendable antes del tag pero no bloquea si el tiempo aprieta.

---

## P2 — POST-TAG (v0.2.1 o v0.3)

- **[S-info]** Argon2id-WASM como alternativa a PBKDF2 (migración con flag en vault meta).
- **[S-info]** Export cifrado con passphrase separada del PIN (independencia de compromisos).
- **[S-info]** Persistir `failedAttempts` + `lockedOutUntil` entre reloads (hoy se resetean al recargar la página).
- **[S-info]** Consolidar persistencia: Preferences en nativo + localStorage en web sin duplicación.
- **[S-info]** Root detection en Android (aborto o warning si device rooteado).
- **[S-info]** Sanitizar logs de Sentry (si se añade) — no enviar stack traces con posible PII.
- **[Testing Fase 3]** Playwright E2E en v0.3 (~6 flows críticos).
- **[Testing Fase 3]** Smokes UI restantes (Categories, Goals, Subs, Loans, NetWorth, Budgets, Rules, Analytics, Import, MorePage) — diminishing returns, hacer solo si Playwright cubre todo de todas formas.
- **[C-nice]** DashboardPage.test.tsx usa `emptyChain` quebradizo — refactor con fake-indexeddb.

---

## Orden recomendado de ejecución

Si decides dar luz verde, mi secuencia:

1. **Bloque G** (trivialidades, 10 min) — prettier + gitignore. Quita ruido.
2. **Bloque F.infra** (30 min) — `fake-indexeddb` instalado, tests actuales verdes.
3. **Bloque A coordinado** (6h) — fix at-rest + wipe + setupPin + backup read. **Primero tests nuevos (GAP-002 + GAP-003) en rojo, luego fix, luego verdes**. TDD real.
4. **Bloque D** (2h) — 5 useMemo→useEffect + BottomNav ref.
5. **Bloque B** (3h) — changePin keystore + biometría web gate + autoLockMs persist + SettingsPage onClick real.
6. **Bloque E** (2h) — extraer `buildPdf` + lazy import + test de pdf.
7. **Bloque F.1/F.4** (~8h) — GAP-001 y GAP-004.
8. **Bloque C** (4h) — Android hardening + te paso diff para que tú verifiques el build local antes del merge.
9. **P1 seguridad MEDIOs** (~4h).
10. **P1 testing Fase 2** (~9h).
11. **P1 misceláneas** (MEJ-002/006/007/008, CI, CHANGELOG rollback, ~3h).
12. `CHANGELOG.md` amplía con los fixes y el `npm run build` final confirma bundle <200KB gzip.
13. PARITY-V2.md update final.

**Duración realista**: 40-50h de código + tests si se ejecuta sin interrupciones. Si delegas lo puramente UI a un agente `project-standards:frontend`, bajas ~10h.

---

## Recomendación al usuario

**No hacer los fixes de golpe**. Sugerencia:

1. Arranca por **Bloque G + F.infra + Bloque A** (data integrity + at-rest correctness). Mergeable aparte como rama `feat/redesign-v2-f15-reviews-p0a`.
2. Revisa el diff (tú); si conforme, sigo con **Bloque D + Bloque B + Bloque E**.
3. Revisa otra vez; paso a **Bloque F.1/F.4 + Bloque C**.
4. P1 en bloque final.

Así tienes 3-4 puntos de control y no un commit monstruoso de 40h de trabajo.

¿Arranco por bloque G + F.infra + Bloque A?

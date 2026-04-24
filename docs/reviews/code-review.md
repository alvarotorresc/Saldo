# Code Review v0.2.0

Revisado sobre branch `feat/redesign-v2-f15-reviews` (46 commits vs `main`, 155 archivos). Fecha: 2026-04-24.

## Resumen ejecutivo

- **Veredicto: BLOQUEAR tag v0.2.0.** Dos divergencias respecto a la Definition of Done del plan: (i) el round-trip `.saldo` NO es lossless (la tabla `recurring` no entra en el snapshot y se wipea en cada lock) y (ii) `doWipe` en Settings deja tombstones vivos, rompiendo la expectativa "wipe → fresh import" en v0.3+. Además cinco páginas con `useMemo` usado como `useEffect`, y biometría imposible de activar desde Settings (regresión respecto al valor prometido en F13). Todos triviales de arreglar pero inaceptables en un tag estable de una app financiera local-first.
- Además hay un desalineamiento entre `docs/PARITY-V2.md` y la realidad del bundle (se declara ~140 KB gzip; el build real genera un chunk principal de 267 KB gzip + jsPDF/html2canvas en el mismo grafo = ~380 KB gzip cuando se toca Export).
- **6 bloqueantes, 14 mejoras, 9 nice-to-have.** Tests 303/303 verdes, typecheck limpio, build OK con warning explícito de chunk size.

---

## Bloqueantes (fix antes del tag)

### [BLK-001] `db.recurring` se borra en cada lock y NUNCA se restaura — rompe el round-trip `.saldo` prometido en la DoD

- **Archivos:** `src/lib/crypto/atRest.ts:39-55`, `src/lib/crypto/atRest.ts:57-91`, `src/lib/crypto/atRest.ts:93-139`, `src/lib/saldoFile.ts:17-31`, `src/lib/saldoFile.ts:54-85`, `src/pages/ExportPage.tsx:37-53`.
- **Problema:** `wipeTables()` **clearea** `db.recurring` dentro de la transacción del lock, pero:
  1. `buildSnapshot()` no lee `db.recurring` — no entra en el JSON cifrado.
  2. `restoreSnapshot()` no repuebla `db.recurring`. Además **`db.recurring` no está en la lista de tablas de la transacción de restore** (`atRest.ts:96-108`) **ni en los `.clear()` iniciales** (`atRest.ts:111-123`), con lo que el fix no es sólo añadir el `bulkAdd`: hay que meter `db.recurring` en las tres ubicaciones.
  3. `SaldoSnapshot` ni siquiera declara el campo `recurring`, ni `parseSnapshot` lo lee.
  4. `ExportPage.buildSnapshot()` (duplicado local del de atRest, ver MEJ-002) tampoco exporta la tabla.
- **Impacto:**
  - (a) Usuarios migrando desde v0.1 (donde la tabla ya puede tener filas) pierden sus registros en el primer unlock de v0.2.
  - (b) **Rompe la DoD explícita** del plan `REDESIGN-V2-PLAN.md:621` "Round-trip export/import sin pérdida de datos": un usuario que exporta `.saldo`, wipes la DB y reimporta pierde silenciosamente la tabla `recurring`.
  - (c) En v0.2 "native" la pérdida es efectivamente nula *hoy* porque `lib/recurring.ts` no tiene consumidor UI (ver MEJ-004), pero la garantía de round-trip es ya falsa en cuanto cualquier parche cablee `detectRecurring`.
- **Fix concreto:**
  ```ts
  // saldoFile.ts — extender el shape + parseSnapshot
  export interface SaldoSnapshot {
    ...
    recurring?: Recurring[]; // v2+
    txTombstones?: TxTombstone[];
  }
  // parseSnapshot — detrás del check por clave
  const recurring = Array.isArray(d.recurring) ? d.recurring : [];
  // atRest.ts buildSnapshot() — añadir
  recurring: await db.recurring.toArray(),
  // atRest.ts restoreSnapshot() — añadir db.recurring a la lista de tablas
  //                              de la transacción (linea 96-108)
  //                              Y a la Promise.all de clears (linea 111-123)
  //                              Y luego:
  if (s.recurring?.length) await db.recurring.bulkAdd(s.recurring);
  // ExportPage.tsx — sustituir buildSnapshot local por buildVaultSnapshot del
  //                  módulo crypto (ver MEJ-002) — arregla el problema en un sólo sitio.
  ```

### [BLK-002] Cinco páginas usan `useMemo` como `useEffect` (side-effect en selector memoizado)

- **Archivos:**
  - `src/pages/CategoriesPage.tsx:348-352` (GroupEditorSheet)
  - `src/pages/CategoriesPage.tsx:449-454` (CategoryEditorSheet)
  - `src/pages/GoalsPage.tsx:157-163` (GoalEditorSheet)
  - `src/pages/LoansPage.tsx:171-179` (LoanEditorSheet)
  - `src/pages/SubscriptionsPage.tsx:199-204` (SubscriptionEditorSheet)
  - `src/pages/RulesPage.tsx:181-185` (RuleEditorSheet)
- **Problema:** los seis ejecutan `setState` dentro de `useMemo`. React 18 no garantiza corrida única de `useMemo` por render — puede descartarlo y recomputar, y setState en render provoca re-renders en cascada o, en concurrent mode, "cannot update a component while rendering another component". La deps array de todos es `[X?.id]` aunque el cuerpo lee `X?.name/color/kind/...` — si el padre muta el objeto sin cambiar `id`, los campos quedan stale.
- **Fix concreto:** convertir a `useEffect` y ajustar deps al conjunto real de campos usados. Alternativa más limpia: que el padre desmonte el sheet entre ediciones usando `key={X?.id}` y eliminar la resync por completo:
  ```ts
  useEffect(() => {
    setName(category?.name ?? '');
    setColor(category?.color ?? PALETTE[0]);
    setKind(category?.kind ?? 'expense');
    setGroupId(category?.groupId ?? defaultGroupId);
  }, [category?.id, defaultGroupId]);
  ```

### [BLK-003] `BottomNav` declara `pressTimer` como `let` dentro del componente: el long-press del FAB no es fiable

- **Archivo:** `src/ui/BottomNav.tsx:20-21` y handlers 45-65.
- **Problema:** `let pressTimer` se declara en el cuerpo de la función del componente. Cada render la reinicia a `null`. Funciona en la práctica porque React no re-renderiza entre `pointerdown` y `pointerup` **de un mismo gesto**, pero cualquier re-render externo (parent que cambia de estado mientras el dedo está presionado) deja un `setTimeout` colgando sin poder cancelarse y acaba disparando `onFabLongPress` aunque el usuario ya haya soltado. También rompe bajo concurrent rendering.
- **Fix concreto:** usar el mismo patrón que ya aplica `TxRowItem` en `LedgerPage.tsx:142-143` (referencia correcta de cómo hacerlo):
  ```ts
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // y sustituir todas las referencias directas a pressTimer por pressTimer.current
  ```

### [BLK-004] `encryptAndWipe` falla silencioso fuera de jsdom — deja la master key viva y datos posiblemente parciales

- **Archivo:** `src/stores/lock.ts:122-140`.
- **Problema:** el catch dentro de `lock()` distingue "missing IndexedDB" (tests) del resto, y en "el resto" hace `console.error(...); return;` sin cambiar `status` a `locked` y sin nullificar `master`. Si `encryptAndWipe` falla a mitad, Dexie puede haber escrito parcialmente, hay master key viva y el usuario cree que está bloqueado cuando no lo está.
- **Fix concreto:** el cambio mínimo es **una línea**: borrar el `return;` de la línea 136. El orden de `encryptAndWipe` en `atRest.ts:146-157` ya escribe el ciphertext **antes** de tocar Dexie, con lo que el snapshot es durable aunque el wipe falle. Dropping that `return;` deja que la línea 139 `set({ master: null, status: 'locked' })` corra en todos los paths.
  ```ts
  // lock.ts:122-140 — cambio mínimo
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isMissingIdb = /IndexedDB API missing|indexedDB is not defined/i.test(msg);
    if (!isMissingIdb) {
      console.error('encryptAndWipe failed', e);
      // ← borrar el `return;` aquí
    }
  }
  ```
  Idealmente además surfacear el error al UI (toast / error state) para que el usuario sepa que hay que revisar/restaurar.

### [BLK-005] `SettingsPage` muestra biometría como "ver F13 · disponible al subir a Capacitor 8" — copy obsoleto e impide activar biometría desde Settings

- **Archivo:** `src/pages/SettingsPage.tsx:125-130`.
- **Problema:** F13 ya actualizó Capacitor a 8 y cableó `@capgo/capacitor-native-biometric`. `BiometricsPage` de onboarding sí invoca `enableBiometry`. Pero en Settings el row es puramente informativo, sin `onClick`, con texto literal "ver F13". Un usuario que saltó biometría en el onboarding no tiene manera de activarla después sin hacer `wipeVault`. Regresión clara respecto al valor prometido en CHANGELOG/PARITY.
- **Fix concreto:** convertir ese row en botón que abra un sheet con `getBiometryStatus()`, `enableBiometry(pin)` y `disableBiometry()` (reutilizando partes de `BiometricsPage`). Pedir el PIN inline con `PinPad`. Borrar el string "ver F13".

### [BLK-006] `SettingsPage.doWipe` no borra `db.txTombstones` — re-importar después de un wipe descarta silenciosamente filas con el mismo hash

- **Archivo:** `src/pages/SettingsPage.tsx:47-79`.
- **Problema:** el `doWipe` en Settings wipea todas las tablas del schema **menos** `txTombstones`. Ni en la lista de tablas de la transacción, ni en el `Promise.all` de clears. `atRest.wipeTables` (crypto/atRest.ts:87) sí la wipea — **divergencia entre las dos rutas de wipe**.
  - Como el tombstone match es por `txHash` (content hash de la tx), un usuario que wipea y después reimporta el mismo CSV verá filas silenciosamente descartadas por la vía de dedup del importador que lee tombstones.
  - Hoy (v0.2.0) el importador no consulta tombstones en el path activo, pero la tabla existe y `TxDetailPage.remove` sí los escribe. Cualquier cableado futuro lo rompe.
  - Además rompe la promesa de "DATOS / Borrar todos los datos" del copy de la UI.
- **Fix concreto:** añadir `db.txTombstones` a la lista de tablas del `db.transaction('rw', [...])` (líneas 48-62) y `db.txTombstones.clear()` al `Promise.all` (líneas 64-77). Idealmente centralizar la lista de tablas en una constante compartida con `atRest.wipeTables` para evitar la divergencia en futuros schemas.

---

## Mejoras recomendadas (no bloquean pero deberían ir al tag)

### [MEJ-001] `shiftMonth` y `currentMonth` duplicados

- `src/lib/format.ts:51,56` ya los exporta.
- `src/pages/LedgerPage.tsx:38-47` y `src/stores/ledgerFilter.ts:59-64` reimplementan `shiftMonth` con la misma semántica.
- `src/pages/LedgerPage.tsx:44-47` reimplementa `currentMonth`.
- **Fix:** `import { shiftMonth, currentMonth } from '@/lib/format'` en los dos consumidores.

### [MEJ-002] `buildSnapshot` duplicado entre `crypto/atRest.ts` y `ExportPage.tsx`

- El módulo cripto ya exporta `buildVaultSnapshot` (alias desde `atRest.buildSnapshot`). `ExportPage` lo reimplementa localmente con el mismo contenido.
- **Fix:** `import { buildVaultSnapshot as buildSnapshot } from '@/lib/crypto'`. Efecto secundario positivo: BLK-001 se arregla en un sólo sitio.

### [MEJ-003] `TerminalEmpty` y `TerminalLoading` nunca se consumen

- Escritos en F9 con ~63 tests en `src/ui/states/`. Ninguna pantalla los importa.
- Cada screen rehace su empty state ASCII a mano (LedgerPage, GoalsPage, SubscriptionsPage, ImportPage...).
- **Fix:** o se adoptan (al menos en los 4-5 empty states más repetidos), o se borran junto con sus tests. Mantener ambos componentes, sus tests y la duplicación manual de estados en cada page es dead code con coste de mantenimiento real.

### [MEJ-004] `lib/recurring.ts` es huérfano en v0.2

- `detectRecurring` no se invoca desde ninguna UI ni desde el resto de lib. La tabla Dexie sólo se declara en el schema y se wipea/clearea.
- Combinado con BLK-001 la pérdida es absoluta.
- **Fix:** o se cablea (job al terminar un import grande, botón en Subscriptions "Detect recurring"), o se purga `lib/recurring.ts` + la tabla + las referencias en migrations/wipe. Dejar ambas mitades es deuda doble.

### [MEJ-005] `parseSnapshot` / importación de `.saldo` no leen `recurring`

- `src/lib/saldoFile.ts:17-87`. Aunque se resuelva BLK-001 en el ciclo lock/unlock, sin tocar `parseSnapshot` un import desde un `.saldo` externo sigue perdiendo la tabla.
- **Fix:** añadir al shape + lectura opcional; no bloquear si falta (back-compat con v1).

### [MEJ-006] QuickActions NEW_EXPENSE / NEW_INCOME / NEW_TRANSFER van todas al mismo `setNewTxOpen(true)` sin pasar `initialKind`

- `src/App.tsx:316-318`. Las tres callbacks son idénticas.
- `NewTxPage` acepta `initialKind` pero App nunca lo setea.
- **Fix:**
  ```ts
  const [newTxKind, setNewTxKind] = useState<TxKind>('expense');
  // ... en NewTxPage: initialKind={newTxKind}
  onNewExpense={() => { setNewTxKind('expense'); setNewTxOpen(true); }}
  onNewIncome ={() => { setNewTxKind('income');  setNewTxOpen(true); }}
  onNewTransfer={() => { setNewTxKind('transfer'); setNewTxOpen(true); }}
  ```

### [MEJ-007] QuickActions NEW_GOAL / NEW_SUB / NEW_LOAN / NEW_RULE sólo navegan a la lista, no abren el editor

- `src/App.tsx:324-339`. Long-press en FAB → "NEW_GOAL" → aterriza en la página de goals existentes. UX rota respecto al label.
- **Fix:** propagar un flag `openNewOnMount` (o equivalente) a cada page para abrir su sheet de creación, o enlazar con un deep-link al sheet.

### [MEJ-008] Bug lógico en `SubscriptionsPage.upcoming` — el filtro 30D es no-op

- `src/pages/SubscriptionsPage.tsx:46-49`:
  ```ts
  if (s.cadence === 'yearly') annuals.push(s);
  else if (d >= 0 && d <= 30) upcoming.push(s);
  else upcoming.push(s);
  ```
- El `else upcoming.push(s)` recoge todo lo que no sea yearly — la condición `d <= 30` se ignora. Toda sub no-anual aparece en la sección "PRÓXIMOS COBROS · 30D".
- **Fix:** eliminar el `else` final (subs sin cobro en 30d no deberían ir a "upcoming"), o ajustar a la intención real del handoff.

### [MEJ-009] `NewTxPage` no resetea `categoryId` al cambiar `kind`

- `src/pages/NewTxPage.tsx:28-43`. Al pasar de expense→income, `categoryId` mantiene un id que no está en `categoriesForKind`, y `selectedCategory` queda undefined sin feedback.
- **Fix:** `useEffect(() => setCategoryId(undefined), [kind])`.

### [MEJ-010] Bundle real ≈ 267 KB gzip (chunk principal) — `PARITY-V2.md` declara ~140 KB

- `npm run build` emite warning explícito: "Some chunks are larger than 500 kB after minification." jsPDF (160 KB index.es) + html2canvas (48 KB) + purify (9 KB) entran estáticos porque `ExportPage.tsx:6` importa `jsPDF` arriba del módulo.
- **Fix:** dinamizar sólo en el path del usuario que elige PDF:
  ```ts
  // ExportPage.tsx — dentro de exportNow()
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    // buildPdf(...) inline aquí o recibiendo el constructor por parámetro
  }
  ```
  Con eso el chunk principal baja a ~110 KB gzip y sólo quien pulsa Export se come los 200+ KB. Actualizar `PARITY-V2.md` con números reales medidos tras el cambio.

### [MEJ-011] Casts `'charts' as DashboardMode` y `'sobrio' as DashboardMode` son redundantes

- `src/pages/DashboardPage.tsx:110,116`. `DashboardMode = 'charts' | 'sobrio'`; los string literals son ya del tipo.
- **Fix:** borrar `as DashboardMode`.

### [MEJ-012] Comentario obsoleto en `TopBarV2.tsx:2`

- "The legacy TopBar.tsx is kept untouched so existing pages continue to compile" — F14 purgó `TopBar.tsx`.
- **Fix:** borrar o actualizar ("replaces the removed v1 TopBar").

### [MEJ-013] TODO obsoleto al final de `LedgerPage.tsx`

- `src/pages/LedgerPage.tsx:570-572` dice que pull-to-refresh está pendiente. Está implementado en 274-302 con `reapplyMonth`.
- **Fix:** borrar el TODO.

### [MEJ-014] `expByCat` calculado y descartado en AnalyticsPage

- `src/pages/AnalyticsPage.tsx:51-52`:
  ```ts
  const expByCat = useLiveQuery(() => expensesByCategory(month), [month]);
  void expByCat; // currently unused directly; reserved for future drill-downs.
  ```
- Cuesta una query Dexie por cada render/mes sin consumidor.
- **Fix:** borrar ambas líneas; si llega el drill-down, se añade entonces.

---

## Nice-to-have (post-release, v0.2.1 o v0.3)

### [NTH-001] Test real de migración v4→v5→v6

- No existe. El plan original decía "v5 añade txTombstones" pero terminó siendo v5 (rules.enabled/hits) + v6 (txTombstones). Sin un test con fake-indexeddb, un próximo cambio de schema puede corromper bases de usuarios v0.1.
- **Fix:** test que crea una DB v4 con datos representativos, instancia `new SaldoDB()`, y verifica que rules terminan con `enabled=1` y `txTombstones` existe vacía.

### [NTH-002] `lib/saldoFile.ts:66-85` — 10 non-null assertions consecutivos

- Justificados por la validación previa pero feos. Un type predicate o zod daría el mismo resultado sin `!`.

### [NTH-003] `PALETTE` duplicado entre Goals / Loans / Subscriptions / Categories

- Cada página tiene su propia paleta con **distintos colores** (brand icons para subs, tonos danger para loans, etc.), no es dead duplication. Pero centralizarlas en `lib/palettes.ts` con named exports (`LOAN_PALETTE`, `SUB_PALETTE`…) evita que alguien edite una sin saber que existen otras.

### [NTH-004] `CommandPalette` y algunos sheets usan `<li onClick>` sin `role="option"` ni keyboard

- `src/ui/CommandPalette.tsx:89-103` y `src/pages/NewTxPage.tsx:222-236`.
- El palette sí maneja keyboard a nivel input (↑↓↵), pero los `<li>` son pseudo-buttons accesibles sólo con ratón. Con TalkBack mobile pueden no anunciarse.
- **Fix:** `<button role="option">` o `role="menuitem"` con teclado delegado al contenedor.

### [NTH-005] `useTweenedNumber` depende de `value` en closure pero lo excluye de deps con eslint-disable

- `src/lib/tween.ts:34,48`: `fromRef.current = value` está en el efecto, `value` no está en deps porque es el state que gestiona. Aceptable pero frágil.

### [NTH-006] `changePin` sólo valida el PIN antiguo al final del flow

- `src/pages/SettingsPage.tsx:319-352`. El user pasa dos phases completas antes de enterarse de que escribió mal el antiguo. Menor UX.
- **Fix:** validar en `phase === 'old'` antes de avanzar (derivar + unwrap silenciosamente).

### [NTH-007] Legacy icon aliases siguen en `Icon.tsx`

- `chevron-left/right/down`, `trending-up/down`, `split`, `utensils`, `bus`, ... se mantienen para seeds y un test. Tax en tamaño de bundle + unión de tipos enorme.
- **Fix:** migrar seeds a canonicales del handoff y eliminar alias.

### [NTH-008] Commits-monolito detectados

- `6e8d861 feat(ui): reescritura terminal de 6 pantallas legacy + purga TopBar v1` — 8 files, 1840/1825 (seis pantallas en un commit).
- `dfddfa5 feat(data-flows): tombstones, pull-to-refresh y exports completos (F11)` — 13 files, 864 insertions (tres features distintas).
- `2ebbf28 chore(release): polish final + CHANGELOG + README + PARITY v0.2.0 (F14)` — mezcla purga, radius, polish y docs.
- Convención del ecosistema pide "un commit = un cambio lógico". No bloquea v0.2 (historia ya escrita) pero nota para v0.3.

### [NTH-009] `PARITY-V2.md` declara "jspdf lazy chunking pendiente"

- El "pendiente" nunca se cerró antes del tag. O se hace ahora (MEJ-010) o se actualiza el documento con el número real.

---

## Qué está bien hecho (mención)

- **Capa cripto sólida.** PBKDF2-SHA256 600 000 iters, AES-256-GCM con IV 96-bit aleatorio, SHA-256 verificado antes de descifrar, master no-extractable tras unwrap, wrapped master en `@capacitor/preferences` nativo. Los trade-offs están documentados en el docstring de `atRest.ts`. Round-trip cubierto por tests reales.
- **Conventional Commits consistentes.** 46 commits, inglés y español pero siempre con `type(scope): descripción`. Cero referencias a IA en mensajes o trailers — la regla absoluta se respeta.
- **Tests de helpers puros al día.** `goals`, `netWorth`, `rules`, `budgets`, `analytics`, `fuzzy`, `ranges`, `newTx`, `exportFormats`, `tween`, `txHash`, `importConfidence`, `saldoFile`, `errorTrace`, `charts/math` — todos con su test. Separación helper puro / hook / componente bien respetada.
- **`useLock` completo.** Todos los boot paths (welcome / setup / locked / unlocked / booting), auto-lock por timer + visibilitychange, lockout 30s tras 3 intentos, `changePin`, `wipeVault`, `unlockWithBiometry`. El store también limpia keystore en wipe.
- **`reapplyMonth` en `lib/rules.ts`** — transacción atómica, bulk updates y bump de `hits/lastHitAt`. Pull-to-refresh en LedgerPage lo consume correctamente.
- **TopBarV2 adoptado al 100%.** `grep -rln TopBar src/ | grep -v TopBarV2` sólo encuentra un comentario en `DashboardCharts.tsx:6`. Consistencia visual real.
- **Radius ≤4px respetado.** `grep rounded-{lg,xl,2xl,3xl}` vacío. `rounded-full` sólo en dots (PinPad, Sheet handle) y en un toggle switch — intencional.
- **Cero `console.log` residual** fuera de tests. Sólo `console.error` en rutas de fallo real (ErrorBoundary, lock store).
- **Cero `any` tipados.** Disciplina TS. Los casts que hay (`as UpdateSpec<T>`, `as EncryptedPayload`, `as HTMLElement | null`) están puntualmente justificados.
- **Singleton de seed con cleanup de duplicados.** `cleanupDuplicatesMigration` en `database.ts` es un parche bien pensado para heredar bases de v0.1 con el bug del seed doble. Transaccional, idempotente, gated por meta flag.

---

## Checklist pre-tag

- [ ] Fix BLK-001 (recurring en snapshot + restore + shape + parseSnapshot)
- [ ] Fix BLK-002 (useMemo→useEffect en 6 sheets de edición)
- [ ] Fix BLK-003 (BottomNav pressTimer a useRef)
- [ ] Fix BLK-004 (`return;` fuera del catch en lock)
- [ ] Fix BLK-005 (toggle biometría real en Settings)
- [ ] Fix BLK-006 (doWipe borra txTombstones)
- [ ] MEJ-001..014 — mínimo los que tocan correctness: MEJ-002, MEJ-005, MEJ-006, MEJ-008, MEJ-009, MEJ-010
- [ ] Actualizar `PARITY-V2.md` con el bundle real medido y deuda cerrada
- [ ] Considerar NTH-001 (test de migración) si hay usuarios reales en v0.1 que vayan a upgrader

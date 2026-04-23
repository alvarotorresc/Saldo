# Saldo v0.2 — Plan de rediseño "Terminal / Technical"

> **Documento de ejecución.** Pensado para que otra sesión lo lea en frío y pueda implementar sin contexto previo. No editar a la ligera: refleja decisiones de producto cerradas el 2026-04-24.

---

## 0. Contexto

Saldo es una app de finanzas personales **local-first, monodispositivo, monousuario**, publicada en GitHub (https://github.com/alvarotorresc/Saldo) bajo MIT. v0.1.0 está en `main`, basada en Vite + React 18 + TS + Tailwind 3 + Dexie + Zustand + Capacitor 7.

El handoff de diseño v2 está en `~/Downloads/design_handoff_saldo/`. Define una dirección visual única — "Terminal / Technical" — con tokens, ~30 pantallas en 8 flujos, primitivos React de referencia y un README detallado. **Si algo discrepa entre este plan y los archivos del handoff, los archivos del handoff mandan** (regla del propio README).

### Decisiones cerradas

| # | Decisión | Confirmado |
|---|----------|------------|
| 1 | **Cripto + lock (PIN + biometría + AES-256-GCM + PBKDF2) dentro de v0.2.** No se aparca. | 2026-04-24 |
| 2 | **Reskin sobre React + Capacitor.** Se reescribe toda la capa UI/UX (`ui/`, `pages/`, tokens) manteniendo lógica de negocio (`db/`, `lib/`, `stores/`). | 2026-04-24 |
| 3 | **Sin multi-cuenta ni multi-usuario.** Un móvil, un usuario. El modelo `Account` interno se mantiene como agrupador técnico (origen del import: N26 / BBVA / manual) pero NO se expone como entidad navegable. Bottom nav del handoff queda en 4 tabs (HOME, LEDGER, NEW, MORE) — el slot `ACCT` desaparece y el botón central NEW es el FAB del FAB primario. | 2026-04-24 |
| 4 | **Light mode fuera de alcance.** Dark only, como dice el handoff. | Por handoff |
| 5 | **Fonts self-hosted** (no Google Fonts CDN) — local-first incompatible con CDN. JetBrains Mono + Inter en `public/fonts/`. | 2026-04-24 |

### Aparcado explícitamente (NO en v0.2)

- Multi-currency (asumido EUR siempre)
- Adjuntos (recibos, fotos)
- Widget Android para balance del día
- Compartir tx a otra app
- Sync entre dispositivos
- Multi-cuenta navegable (regla 3)
- Light mode

Cualquiera de estos vuelve a la mesa **solo si** el usuario lo pide explícitamente.

---

## 1. Alcance v0.2

**Se reescribe (capa visual):**
- `src/ui/` — todos los primitivos
- `src/pages/` — todas las pantallas existentes
- `src/App.tsx` — shell, routing, boot flow
- `tailwind.config.js`, `src/index.css`, `index.html`

**Se mantiene (lógica):**
- `src/db/database.ts` — esquema Dexie + seeds (con migración v5: ver §3)
- `src/db/queries.ts`
- `src/lib/` — `csv.ts`, `categorize.ts`, `format.ts`, `loan.ts`, `recurring.ts`, importadores
- `src/stores/app.ts` — Zustand
- `src/types.ts` — con extensiones puntuales

**Se añade nuevo:**
- Capa de cripto: AES-256-GCM + PBKDF2 sobre payload Dexie
- Lock screen + auto-lock + biometría
- Pantallas nuevas: Onboarding (Welcome/PIN/Bio/First import/Lock), Tx detail, Filter sheet, Quick actions, Command palette, Rules UI, Net worth (derivado), Analytics enriquecida, States (empty/loading/error)
- Iconografía: ~40 SVG custom del handoff
- Fuentes JetBrains Mono + Inter en `public/fonts/`

---

## 2. Stack changes

### Dependencias a añadir

```json
{
  "dependencies": {
    "@capacitor-community/biometric-auth": "^3.x",
    "@capacitor/preferences": "^7.x"
  }
}
```

- **`@capacitor-community/biometric-auth`** — biometría nativa Android. En web: stub que devuelve "no disponible" (cae a PIN).
- **`@capacitor/preferences`** — almacenar el `wrappedKey` y `kdfSalt` fuera del payload cifrado. En web: usa localStorage como fallback.

**No se añaden:** ninguna lib de charting (todos los charts del handoff son SVG inline en `primitives.jsx`, los recreamos a mano).

### Dependencias a verificar

- React 18 → mantener. No subir a 19 en este sprint.
- TypeScript 5.7 → mantener. **No migrar a TS 6** (memoria `feedback-ts6-wait.md`).
- Tailwind 3 → mantener (Tailwind 4 fuera de scope).
- Dexie 4 → mantener.

### Tooling existente (mantener)

- Lefthook + Prettier (pre-commit)
- CI: typecheck + build en Node 20
- Vitest (a añadir si no está) para tests unitarios

---

## 3. Migraciones de schema (Dexie v5)

Versión 5 añade soporte de tabla cifrada y campos faltantes mínimos. **No** se añaden multi-cuenta ni Account.type.

```ts
this.version(5).stores({
  // Existentes, sin cambios estructurales:
  accounts: '++id, name, bank, archived',
  categoryGroups: '++id, name, kind, order',
  categories: '++id, name, kind, groupId, builtin',
  transactions: '++id, accountId, date, month, kind, categoryId, importHash, reimbursementFor, [accountId+importHash]',
  budgets: '++id, month, categoryId, [month+categoryId]',
  goals: '++id, name, deadline',
  recurring: '++id, signature, kind',
  rules: '++id, priority, categoryId',
  subscriptions: '++id, name, cadence, nextCharge, active',
  loans: '++id, name, startDate',
  balances: '++id, accountId, month, [accountId+month]',
  meta: '&key',
  // Nueva: store de transacciones eliminadas con razón (para audit/restore)
  txTombstones: '++id, txId, deletedAt',
});
```

**Backfill:** ninguno necesario — schemas v4 → v5 son compatibles (sólo añade `txTombstones`, no modifica existentes).

**La cripto NO va en el schema Dexie** — va como wrapper externo (ver §4 fase F1). Dexie sigue siendo la fuente de verdad y se cifra al volcar a almacenamiento físico.

### Extensiones de tipos

```ts
// types.ts
export interface Rule {
  // existentes
  enabled?: 0 | 1;       // nuevo: para toggle on/off en Rules UI
  hits?: number;         // nuevo: contador de tx auto-categorizadas
  lastHitAt?: number;    // nuevo: para "regla matched" en Tx detail
}

export interface AppMeta {
  // existentes — claves nuevas usadas:
  // 'dashboardMode' → 'charts' | 'sobrio'
  // 'lockTimeoutMs' → string (default '30000')
  // 'biometricEnabled' → '0' | '1'
}

export interface TxTombstone {
  id?: number;
  txId: number;
  deletedAt: number;
  reason?: string;
}
```

---

## 4. Plan por fases

10 fases secuenciales. Cada una es un **PR independiente**, con commits atómicos Conventional Commits, tests verdes (cobertura ≥ 85% del código tocado), y verificación visual side-by-side contra `~/Downloads/design_handoff_saldo/design/Saldo v2.html`.

**Branch raíz:** `feat/redesign-v2`. Cada fase en sub-branch (`feat/redesign-v2-fX-...`) que se mergea a `feat/redesign-v2`. Al terminar F9, merge a `main` y tag `v0.2.0`.

### F0 — Foundation (tokens, fuentes, iconos, primitivos base)

**Objetivo:** sistema visual reutilizable. Ninguna pantalla cambia todavía.

**Alcance:**
- `tailwind.config.js`: nuevo color palette (bg `#08090a`, surface `#0e0f11`, surface2 `#14161a`, surface3 `#1a1d22`, border `#1e2126`, borderStrong `#2a2e35`, text `#e8e8ea`, textDim `#b9bac0`, muted `#7a8089`, dim `#4a4f57`, accent `#8fc088`, accentDim `#1a2e1c`, danger `#c97c7c`, dangerDim `#2a1616`, warning `#c9a86a`, info `#7ea6c9`).
- Font families: `mono: 'JetBrains Mono'`, `sans: 'Inter'`. Tamaños `mono8/9/10/11/12`, `sans10..20`, display `d24/d32/d40/d52`. Letter-spacing tokens (`tight`, `wide`, `wider`, `widest`).
- Radius tokens: `xs:2 sm:3 md:4 lg:6 full:999`. Eliminar `xl:14 2xl:18` (regla del handoff: máximo `md:4`).
- Spacing tokens 4pt (ya implícito en Tailwind, documentar).
- `public/fonts/`: JetBrainsMono-Regular/Medium/SemiBold + Inter-Regular/Medium/SemiBold como WOFF2 self-hosted. `@font-face` en `index.css` con `font-display: swap`.
- `src/ui/Icon.tsx`: reescribir con los ~40 iconos del handoff (`primitives.jsx` líneas 9-78). Mantener API `<Icon name="..." size={...} />` para no romper imports legacy.
- `src/ui/primitives/`: nuevo directorio con primitivos comunes:
  - `Badge` (6 tonos: muted/ok/warn/danger/info/solid)
  - `Btn` (variants solid/danger/outline/ghost; sizes sm/md/lg)
  - `KV` (key/value row)
  - `Metric` (label + value + unit + delta + sparkline)
  - `Row` (lista genérica con icon + sub + right + chevron)
  - `Section` (header de sección)
- `src/ui/charts/`: chart primitives SVG:
  - `Ring` (radial progress)
  - `Donut` (multi-segment)
  - `AreaChart`
  - `StackedBars` (IN vs OUT)
  - `Bars`
  - `HeatmapCal`
  - `Spark` (sparkline)
  - `StackBar` (horizontal stacked)

**Done criteria:**
- `npm run typecheck && npm run build` verde.
- Storybook NO requerido — basta una página `src/pages/_DesignKit.tsx` (no enlazada en nav, accesible por URL `/design-kit` o flag) que renderice todos los primitivos para verificación visual.
- Tests unitarios de Ring/Donut/Spark (cálculos de offset/path) — Vitest + jsdom.
- Cobertura ≥ 85% sobre `src/ui/charts/` y `src/ui/primitives/`.

**Tests budget:** ~30 tests (12 chart edge cases + 18 primitives interaction/render).

**Refs handoff:** `design/tokens.jsx`, `design/primitives.jsx`.

---

### F1 — App shell + Crypto + Lock + Onboarding

**Objetivo:** flujo de boot reescrito. La app arranca a Welcome (si no hay setup) o Lock (si lo hay), y solo entra al contenido tras desbloqueo. **Toda la persistencia Dexie pasa por la capa cripto.**

**Alcance — Capa cripto (`src/lib/crypto/`):**
- `key.ts`: `derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey>` usando PBKDF2-SHA256, 600 000 iteraciones, longitud 256 bits. Web Crypto API (`window.crypto.subtle`).
- `vault.ts`:
  - `wrapMasterKey(master: CryptoKey, pinKey: CryptoKey): Promise<{wrapped: string, iv: string}>`
  - `unwrapMasterKey(wrapped: string, iv: string, pinKey: CryptoKey): Promise<CryptoKey>`
  - `encryptPayload(payload: Uint8Array, master: CryptoKey): Promise<{ct: string, iv: string, sha: string}>`
  - `decryptPayload(ct: string, iv: string, master: CryptoKey, expectedSha: string): Promise<Uint8Array>` — verifica SHA-256 antes de devolver.
- `storage.ts`: wrapper sobre `@capacitor/preferences` (con fallback localStorage en web) para guardar `wrappedKey`, `kdfSalt`, `wrapIv`, `payloadSha`.
- **Modelo de cifrado:** Dexie sigue siendo en claro EN MEMORIA (para no penalizar reads). En "lock" o "exit", se serializa el payload completo (`db.export()`) y se cifra. En "unlock", se descifra y se hidrata Dexie. Esto es viable porque la app es monousuario y los datasets son pequeños (~MB). Documentar trade-off: no es zero-knowledge contra ataques con app abierta, sí lo es a disco.

**Alcance — Lock state (`src/stores/lock.ts`):**
```ts
interface LockState {
  status: 'booting' | 'welcome' | 'setup' | 'locked' | 'unlocked';
  master: CryptoKey | null;
  setStatus(s: LockState['status']): void;
  setMaster(k: CryptoKey | null): void;
  lock(): void;
  unlock(pin: string): Promise<boolean>;
  setupPin(pin: string): Promise<void>;
}
```
- Auto-lock: timer en `App.tsx` que se reinicia con cada interacción. Default 30 000 ms (configurable en Settings, persistido en `meta.lockTimeoutMs`).
- Visibilidad: `document.visibilitychange` → si `hidden` por > timeout, lock.

**Alcance — Pantallas onboarding (`src/pages/onboarding/`):**
- `WelcomePage.tsx` — `ScrOnboardWelcome`
- `PinSetupPage.tsx` — `ScrOnboardPIN` (con confirmación: pide el PIN dos veces antes de derivar)
- `BiometricsPage.tsx` — `ScrOnboardBio`
- `FirstImportPage.tsx` — `ScrOnboardImport` (CTA recomendada: import CSV; alternativas: manual, restore)
- `LockPage.tsx` — `ScrLock`

**Alcance — App shell:**
- `src/App.tsx` se reescribe: enrutador de estado en `useLock`. Boot:
  1. Leer `meta.setupComplete`. Si `false` → Welcome flow.
  2. Si `true` → Lock screen.
  3. Tras unlock → app principal (mantiene tab actual del Zustand).
- Top bar del handoff (`saldo@local · SUB`) implementado en `src/ui/TopBar.tsx`.
- Bottom nav reescrito en `src/ui/BottomNav.tsx` — 5 slots, slot central FAB `NEW` que abre Quick actions sheet (placeholder en F1; implementación real en F5).

**Done criteria:**
- Flujo completo: Welcome → PIN setup (confirmación) → Bio → First import (skip) → Lock → Unlock → Main.
- Auto-lock funciona en 30s de inactividad.
- Reload del navegador → siempre va a Lock.
- 3 PINs erróneos → lockout 30s (defensa básica anti-brute-force).
- Tests cripto:
  - Round-trip encrypt/decrypt (10 cases con payloads variados).
  - Wrong PIN → unwrap falla.
  - Tampered ciphertext → SHA mismatch.
  - PBKDF2 produce key estable para mismo (pin, salt).
- Tests lock:
  - Auto-lock timer.
  - visibilitychange hide → lock.
- Web fallback verificado (sin biometría disponible, salta Bio screen).
- En Android: build APK debug con biometría real (test manual).

**Tests budget:** ~40 tests (20 cripto + 12 lock state + 8 onboarding flow).

**Refs handoff:** `design/screens/01-onboarding.jsx`, README sección "Lock screen / auto-lock" y "State & data".

**Riesgos:**
- Web Crypto API no disponible en contextos no-secure (HTTP). Documentar requisito HTTPS o `localhost`.
- PBKDF2 600k es lento (~1s en mobile). Mostrar `ScrLoading` durante derive.
- Cifrar/descifrar payload entero en cada lock/unlock puede ser lento con miles de tx. Si excede 500ms, considerar cifrado por tabla. **Decisión deferida hasta medir.**

---

### F2 — Ledger reskin (la pantalla más usada)

**Objetivo:** primera pantalla "real" con el nuevo lenguaje. Valida que tokens + primitivos funcionan contra datos reales descifrados.

**Alcance:**
- `src/pages/LedgerPage.tsx` (sustituye `TransactionsPage.tsx`):
  - Search bar terminal: `$ grep -e ".*" ledger.db` (placeholder con caret parpadeante).
  - Tabs `ALL / IN / OUT / TRANSFERS`.
  - Summary bar compacta: `COUNT=X IN=+Y€ OUT=−Z€ Δ=W€`.
  - Transacciones agrupadas por fecha con header `YYYY-MM-DD · Σ ±X€`.
  - Cada fila merchant (mono 12) · time · cat · source · importe.
  - Long-press: menú contextual (duplicar / borrar / cambiar categoría).
  - Swipe horizontal: izq → categorizar siguiente, der → categorizar anterior (placeholder, implementación full en F5).
  - Pull-to-refresh: re-aplicar reglas (llama `categorize.ts`).

**Done criteria:**
- Renderiza sobre datos reales descifrados de F1.
- Tabs filtran correctamente (kind === 'income' | 'expense' | 'transfer' | all).
- Summary bar suma exacta a queries.ts.
- Pull-to-refresh re-aplica reglas y refresca contador `Rule.hits`.
- Tests: filtros (4), agrupación por fecha (3), summary (3), interacción long-press (4).
- Verificación visual side-by-side con `screens/03-ledger.jsx#ScrLedger`.

**Tests budget:** ~14 tests.

**Refs handoff:** `design/screens/03-ledger.jsx`.

---

### F3 — Dashboard Sobrio

**Objetivo:** versión simple del dashboard. Más sencilla visualmente que Charts, prueba la hero metric "NET" y sparklines.

**Alcance:**
- `src/pages/DashboardPage.tsx` reescrita:
  - Toggle `CHARTS / SOBRIO` en TopBar (estado en `meta.dashboardMode`, default `sobrio`).
  - Solo modo Sobrio implementado en F3.
  - Hero NET 40px + 3 métricas (IN/OUT/SAVINGS RATE) en grid + sparkline 30D inline.
  - Bloque IN/OUT split (StackBar).
  - Category breakdown con barras lineales.
  - Recent tx (top 6, reutilizar `Row` de F0).
  - Quick actions: chips para "Import" / "New tx" / "Subscriptions" / "Charts".

**Done criteria:**
- Persiste el modo elegido tras lock/unlock.
- Hero NET cuenta animada (tween 700ms al cambiar de mes).
- Sparkline 30D refleja `daily_spend` real (nueva query `dailySpend(month: string)` en `queries.ts`).
- Tests: dailySpend query (5), tween counter (2), persistencia mode (2).

**Tests budget:** ~9 tests.

**Refs handoff:** `design/screens/02-dashboard.jsx#ScrDashSobrio`.

---

### F4 — Dashboard Charts mode

**Objetivo:** "hero screen" del rediseño. Ring + AreaChart + StackedBars + Donut + HeatmapCal + budgets mini-rings.

**Alcance:**
- Modo Charts del `DashboardPage`:
  - Hero ring savings rate (92px, stroke 5) + bloque NET 28px.
  - Selector rango `7D/30D/90D/12M/YTD` (default `30D`).
  - AreaChart 30 días con grid + dot final.
  - 3-up metrics (hoy/sem/mes) cada uno con sparkline.
  - StackedBars IN vs OUT 12M.
  - Donut categorías con leyenda.
  - HeatmapCal calendario 6×5.
  - Budgets como mini-rings (top 4).
  - Lista de "accounts" → reemplazada por una sola entrada "Cuenta principal" con sparkline (regla 3: sin multi-cuenta).

**Done criteria:**
- Selector de rango cambia datos del AreaChart en <100ms.
- Donut suma 100% (ajusta segmento "OTROS" si <5%).
- Heatmap renderiza correctamente meses con <30 días.
- Tests: rango selector (5), donut math (4), heatmap (3).

**Tests budget:** ~12 tests.

**Refs handoff:** `design/screens/02-dashboard.jsx#ScrDashCharts`.

**Riesgos:** la lista de accounts del handoff asume multi-cuenta. Sustituirla por una entrada única o por una métrica "balance acumulado".

---

### F5 — Tx detail + Filter sheet + New tx + Quick actions + Command palette

**Objetivo:** completar el flujo de ledger con interacciones avanzadas.

**Alcance:**
- `src/pages/TxDetailPage.tsx` — `ScrTxDetail`:
  - Hero importe 42px (danger si expense, accent si income).
  - KV list: ACCOUNT, SOURCE, CATEGORY, TAGS, TX_ID, CREATED, HASH (SHA del tx — derivable de `JSON.stringify` + sha256).
  - Notes panel (editable inline).
  - "Rule matched" card si la tx fue auto-categorizada.
  - Related transactions (mismo merchant, últimos 30 días).
  - Actions: duplicar / borrar (con confirmación + escribe a `txTombstones`).
- `src/ui/sheets/FilterSheet.tsx` — `ScrLedgerFilter`:
  - Periodo (chips), Tipo (chips), Categorías (multi-chip), Importe (min/max).
  - Footer `RESET` + `APLICAR (N)`.
  - Filtros se persisten en Zustand `useApp`.
- `src/pages/NewTxPage.tsx` — `ScrTxNew`:
  - Reemplaza `TxForm` actual. Segmented EXPENSE/INCOME/TRANSFER.
  - Calculadora-style amount input (mono 38, caret parpadeante).
  - Filas con icono+label izquierda / valor+chevron derecha.
  - Toggles compartido y recurrente.
  - CTA `COMMIT`.
- `src/ui/sheets/QuickActionsSheet.tsx` — `ScrQuickSheet`:
  - Bottom sheet 3×3 de acciones: New expense, New income, New transfer, Import CSV, Export, New goal, New sub, New loan, New rule.
  - Conectada al FAB del bottom nav (placeholder de F1).
- `src/ui/CommandPalette.tsx` — `ScrCmdPalette`:
  - Trigger: long-press FAB / icono en TopBar dashboard.
  - Búsqueda fuzzy sobre comandos predefinidos.
  - ↑↓ + ↵ navegación. Esc cierra.

**Done criteria:**
- Tx detail abre desde ledger con animación slide.
- Filter sheet aplica y refleja count en CTA.
- New tx commit redirige a ledger con scroll a la nueva tx.
- Command palette implementa al menos 12 comandos.
- Tests: tx hash (3), filter logic (8), new tx validation (6), cmd palette fuzzy (5).

**Tests budget:** ~22 tests.

**Refs handoff:** `design/screens/03-ledger.jsx`, `design/screens/08-states.jsx#ScrQuickSheet`, `ScrCmdPalette`.

---

### F6 — Budgets + Categories + Rules engine UI

**Objetivo:** dar vida al motor de reglas (existe en DB, no tenía UI).

**Alcance:**
- `src/pages/BudgetsPage.tsx` — `ScrBudgets`:
  - Total mes con barra y proyección fin de mes.
  - Lista de budgets con barra + %/día restante + badge `OVER`.
  - CRUD inline (edit amount con stepper).
- `src/pages/CategoriesPage.tsx` reescrita — `ScrCategories`:
  - Lista por gasto: avatar cuadrado + nombre + count + % + importe + sparkline.
  - CRUD categorías y grupos.
- `src/pages/RulesPage.tsx` (nueva) — `ScrRules`:
  - Lista con formato código: `WHEN merchant ~ /mercadona/i THEN category = "Supermercado"`.
  - Toggle on/off por regla (`Rule.enabled`).
  - Contador `hits` visible.
  - Editor inline: pattern + categoryId + priority.
  - Summary header: "N tx auto-categorizadas este mes" (calculado sobre `lastHitAt` + month).
  - Acción "Test rule" — ejecuta contra ledger y previsualiza matches.

**Done criteria:**
- Crear regla, ejecutarla, ver `hits` incrementar.
- Toggle off → no aplica en re-categorize.
- Tests: rule predicate parsing (10), hits counter (5), toggle behavior (4).

**Tests budget:** ~19 tests.

**Refs handoff:** `design/screens/05-budgets-categories-rules.jsx`.

---

### F7 — Goals + Subscriptions + Loans + Net worth (derivado)

**Objetivo:** completar módulos secundarios.

**Alcance:**
- `src/pages/GoalsPage.tsx` reescrita — `ScrGoals`:
  - Hero total ahorrado.
  - Cada goal: ring 46px + nombre + target date + barra + €/mes necesarios.
- `src/pages/SubscriptionsPage.tsx` reescrita — `ScrSubscriptions`:
  - Summary mensual + anual.
  - Lista con color-bar vertical izquierda.
- `src/pages/LoansPage.tsx` reescrita — `ScrLoans`:
  - Hero DEUDA TOTAL en danger.
  - Cada préstamo: barra + TAE + próxima cuota + % pagado.
- `src/pages/NetWorthPage.tsx` (nueva, sustituye `WealthPage.tsx`) — `ScrNetWorth` adaptado a "un usuario":
  - Hero patrimonio neto.
  - **Activos:** balance acumulado + saved goals.
  - **Pasivos:** loans pendientes.
  - SIN lista de cuentas (regla 3).
  - Cada ítem: color dot + nombre + importe.

**Done criteria:**
- Goal con deadline calcula €/mes correctamente.
- Loans usa `loan.ts` existente para amortización.
- Net worth = sum(activos) − sum(pasivos), refrescado en live.
- Tests: goal monthly calc (4), subs cadence math (5 — reutilizar tests existentes si hay), net worth aggregate (3).

**Tests budget:** ~12 tests.

**Refs handoff:** `design/screens/06-goals-subs-loans-nw.jsx`.

---

### F8 — Import + Export + Settings + Analytics

**Objetivo:** flujos de datos y configuración.

**Alcance:**
- `src/pages/ImportPage.tsx` reescrita — `ScrImport`:
  - Detección automática banco + formato.
  - Column mapping CSV → app (checks).
  - Preview table con confidence score por fila.
  - Filas con confidence <80% en tint warning.
- `src/pages/ExportPage.tsx` (nueva) — `ScrExport`:
  - Selector formato (.saldo recomendado, .csv, .json, .ofx, .pdf — solo `.saldo` y `.json` implementados en v0.2; resto deferidos).
  - Range selector.
  - Toggle "proteger con contraseña" (cifra el .saldo con un PIN distinto al de la app).
  - Warning panel.
- `src/pages/SettingsPage.tsx` reescrita — `ScrSettings`:
  - Identity header `usuario@local · device`.
  - Secciones SEGURIDAD (cambiar PIN, biometría, auto-lock timeout), DATOS (import, export, wipe), APARIENCIA (toggle Charts/Sobrio default), PRIVACIDAD (telemetría OFF + sync OFF — ambos disabled con opacity 0.6, sin checkbox real, son decisiones de producto).
  - INFO: versión, build hash, link al repo GitHub.
- `src/pages/AnalyticsPage.tsx` (nueva) — `ScrAnalytics`:
  - Selector rango 6 opciones.
  - Net worth hero con AreaChart 12M + cash flow.
  - StackedBars IN vs OUT.
  - Top categories con YoY trends.
  - Top merchants.
  - Year heatmap 26×7.

**Done criteria:**
- Import N26/BBVA funciona idéntico a v0.1 (regression test).
- Export `.saldo` round-trip: export → wipe DB → import → datos idénticos.
- Cambio de PIN re-deriva master key sin perder datos.
- Tests: import confidence (6), export round-trip (4), settings PIN change (3), analytics aggregates (5).

**Tests budget:** ~18 tests.

**Refs handoff:** `design/screens/07-import-export-settings.jsx`, `04-analytics-accounts.jsx#ScrAnalytics`.

---

### F9 — States (empty/loading/error) + Polish + Parity check final

**Objetivo:** estados ricos y revisión final.

**Alcance:**
- `src/ui/states/EmptyState.tsx` reescrito — `ScrEmpty`:
  - ASCII box art + mensaje + 2 CTAs + línea terminal `$ wc -l ledger.db → 0`.
  - Variantes por contexto (ledger empty, goals empty, etc.).
- `src/ui/states/LoadingState.tsx` (nueva) — `ScrLoading`:
  - Spinner `◍` rotando + progress bar + checklist de pasos con estados `✓ OK / … / ○`.
  - Usado en boot (cripto derive), import grande, export.
- `src/ui/states/ErrorState.tsx` (nueva) — `ScrError`:
  - Stack trace falso pero creíble (Rust idiomatic, plantilla en `src/lib/errorTrace.ts`).
  - Hash esperado vs actual.
  - Lista de últimos backups disponibles (lee de `localStorage.saldo.lastError` y de `meta.lastBackupAt`).
  - CTAs: reportar (copia stack al clipboard) / restaurar.
- Animaciones globales:
  - Sheets slide up 200ms.
  - Overlays fade 120ms + scale 0.98→1.
  - Counters tweened 700ms (ya en F3).
- Polish:
  - Verificar todos los `console.log` eliminados.
  - Verificar no haya emojis en UI (regla handoff).
  - Verificar radius máximo 4px en toda la app.
  - Verificar todas las pantallas usan TopBar canónico.
- **Parity check final:** abrir `Saldo v2.html` lado a lado con la app real, screenshot por pantalla, anotar discrepancias en `docs/PARITY-V2.md`. Iterar hasta delta visible < 5%.

**Done criteria:**
- Boot con DB cifrada vacía → Loading state correcto.
- Force checksum mismatch (dev tool) → Error state bloquea app.
- Restore desde backup funciona.
- `docs/PARITY-V2.md` con tabla de pantallas y notas.
- Tests: error trace generation (3), loading checklist state (3), empty state variants (4).

**Tests budget:** ~10 tests.

**Refs handoff:** `design/screens/08-states.jsx`.

---

## 5. Reglas de ejecución

### Workflow por fase

Cada fase sigue el ciclo del usuario (memoria `feedback-every-change-needs-cycle.md`):

1. **Plan detallado de la fase** (si la fase es grande, split en sub-tareas).
2. **Tests primero** (TDD donde tenga sentido — al menos red tests antes de implementar).
3. **Implementación** delegada al agente correspondiente:
   - F0, F2-F4, F9: `frontend-agent` + `ui-design-agent`
   - F1: `security-agent` (cripto) + `frontend-agent` (UI)
   - F5-F8: `frontend-agent` + `backend-agent` (queries)
4. **Security review** al cerrar la fase (especialmente F1, F8) — `security-agent`.
5. **Coverage check ≥ 85%** sobre código tocado.
6. **Code review** — `code-reviewer` agente.
7. **Commits atómicos** Conventional Commits.
8. **Pre-release checklist** del plugin project-standards al cerrar v0.2.

### Branching y commits

- Branch raíz: `feat/redesign-v2`.
- Sub-branches: `feat/redesign-v2-f0-foundation`, `feat/redesign-v2-f1-crypto-lock`, etc.
- Commits Conventional: `feat(ui): add Ring chart primitive`, `feat(crypto): implement PBKDF2 key derivation`, `test(ledger): cover filter sheet logic`.
- **NUNCA** referencias a IA/Claude/Copilot en mensajes ni Co-Authored-By (memoria absoluta).
- **NUNCA** `git push` — el push lo hace el usuario.
- Merge cada sub-branch a `feat/redesign-v2` con commits squash limpios.
- Al cerrar F9: merge a `main` + tag `v0.2.0`.

### Prohibiciones recordatorio

- No `git push`, pull, merge a remoto, rebase de remoto, crear/cerrar PRs/issues.
- No publicar packages.
- No tocar otros productos del ecosistema.

### Verificación visual

- Antes de marcar fase done, abrir `~/Downloads/design_handoff_saldo/design/Saldo v2.html` en navegador.
- Comparar pantalla por pantalla en split-screen.
- Screenshots a `docs/screenshots/v2/<fase>-<pantalla>.png`.
- Discrepancias documentadas en `docs/PARITY-V2.md`.

### Tests budget total

| Fase | Tests |
|------|-------|
| F0 | ~30 |
| F1 | ~40 |
| F2 | ~14 |
| F3 | ~9 |
| F4 | ~12 |
| F5 | ~22 |
| F6 | ~19 |
| F7 | ~12 |
| F8 | ~18 |
| F9 | ~10 |
| **Total** | **~186** |

Suma a los tests existentes; cobertura objetivo ≥ 85% sobre `src/`.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| PBKDF2 600k lento en mobile | Mostrar `ScrLoading` con checklist; medir y considerar reducir a 300k si excede 2s en device real |
| Cifrar payload entero en cada lock excede 500ms | Medir en F1 con dataset realista (1000+ tx); si excede, fasear cifrado por tabla |
| Web Crypto requiere HTTPS | Documentar en README; usar `localhost` en dev; producción Capacitor cumple por defecto |
| Biometría plugin no compatible con Capacitor 7 | Verificar versión `@capacitor-community/biometric-auth` antes de F1; alternativa `@capgo/capacitor-native-biometric` |
| Diseño asume multi-cuenta en varias pantallas | Adaptar `ScrAccounts` → eliminar; `ScrNetWorth` → derivar; bottom nav 4 tabs en vez de 5 |
| Fuentes self-hosted aumentan bundle | Subset Latin + medidas con `npm run build` analyzer; objetivo +<150 KB total |
| Verificación visual subjetiva | Screenshots side-by-side documentados en `docs/PARITY-V2.md`; criterio "delta visible <5% por pantalla" |

---

## 7. Definition of Done — v0.2.0

- [ ] Todas las fases F0–F9 cerradas y mergeadas a `feat/redesign-v2`.
- [ ] `docs/PARITY-V2.md` lleno, con screenshots por pantalla.
- [ ] Cobertura ≥ 85% sobre `src/` (medida con Vitest).
- [ ] APK debug + release verificados en device físico Android.
- [ ] Build web verificado en navegador (Chrome + Firefox).
- [ ] Onboarding completo a Lock funcional sin errores.
- [ ] Round-trip export/import sin pérdida de datos.
- [ ] CI verde en `feat/redesign-v2` antes de merge a `main`.
- [ ] Pre-release checklist del plugin project-standards completado.
- [ ] CHANGELOG.md actualizado con todas las pantallas reescritas y features nuevas.
- [ ] README.md actualizado con screenshots v0.2.
- [ ] Tag `v0.2.0` creado (sin push — el usuario hace el push).

---

## 8. Referencias

### Handoff de diseño
- README: `~/Downloads/design_handoff_saldo/README.md`
- Tokens: `~/Downloads/design_handoff_saldo/design/tokens.jsx`
- Primitivos: `~/Downloads/design_handoff_saldo/design/primitives.jsx`
- Mock data: `~/Downloads/design_handoff_saldo/design/data.jsx`
- Canvas navegable: abrir `~/Downloads/design_handoff_saldo/design/Saldo v2.html` en navegador
- Pantallas:
  - `screens/01-onboarding.jsx`
  - `screens/02-dashboard.jsx`
  - `screens/03-ledger.jsx`
  - `screens/04-analytics-accounts.jsx`
  - `screens/05-budgets-categories-rules.jsx`
  - `screens/06-goals-subs-loans-nw.jsx`
  - `screens/07-import-export-settings.jsx`
  - `screens/08-states.jsx`

### Documentos del ecosistema (consulta obligatoria)
- `/home/alvarotc/Documents/apps/STANDARDS.md`
- `/home/alvarotc/Documents/apps/IDENTITY.md`
- `/home/alvarotc/Documents/apps/PATTERNS.md`
- `/home/alvarotc/Documents/apps/WORKFLOW.md`

### Plugin project-standards
- `~/.claude/plugins/cache/alvarotc/project-standards/1.0.0/core/`
- `~/.claude/plugins/cache/alvarotc/project-standards/1.0.0/agents/`
- `~/.claude/plugins/cache/alvarotc/project-standards/1.0.0/standards/pre-release-checklist.md`

### Memoria persistente
- `memory/saldo-progress.md`
- `memory/saldo-no-multi-account.md`
- `memory/feedback-security-innegociable.md`
- `memory/feedback-always-write-tests.md`
- `memory/feedback-every-change-needs-cycle.md`
- `memory/feedback-design-quality.md`
- `memory/feedback-simplicity.md`

### Código actual de Saldo (tocar con consciencia)
- `src/db/database.ts` — schema v4
- `src/db/queries.ts` — queries existentes (extender, no romper)
- `src/lib/csv.ts`, `categorize.ts`, `format.ts`, `loan.ts`, `recurring.ts` — mantener
- `src/types.ts` — extender (Rule.enabled, Rule.hits, AppMeta keys nuevas)
- `src/stores/app.ts` — extender con `useLock`

---

## 9. Cómo retomar este plan en otra sesión

1. Lee este archivo completo.
2. Lee `memory/MEMORY.md` y los archivos de memoria referenciados en §8.
3. Lee los 4 documentos del ecosistema (`STANDARDS/IDENTITY/PATTERNS/WORKFLOW`).
4. Carga el plugin project-standards (agentes + skills).
5. Comprueba el estado de la branch `feat/redesign-v2`: ¿qué fases están done?
6. Si ninguna: empieza por **F0 — Foundation**. Plan detallado de F0 → tests → implementación → review → commits.
7. Avanza fase a fase, **siempre con aprobación explícita del usuario** entre cada fase mayor (memoria `feedback-user-approves-everything.md`).
8. Si encuentras un patrón nuevo durante la implementación, propón actualizar el plugin project-standards (memoria `feedback-detect-patterns.md`).

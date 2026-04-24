# CHANGELOG

## v0.2.0 — Terminal / Technical redesign (unreleased)

Reescritura visual completa en estilo "Terminal / Technical" (monospace,
letras densas, radius ≤4px, paleta oscura) más cifrado at-rest real, tombstones,
reglas con toggle y analytics.

### Pantallas reescritas al nuevo estilo

- **Dashboard** — modos Sobrio (hero NET tweened, 3 métricas, sparkline 30D,
  StackBar IN/OUT, breakdown top 5, recent tx top 6, quick actions) y Charts
  (Ring savings rate, AreaChart con range selector 7D/30D/90D/12M/YTD,
  StackedBars 12M, Donut con colapso OTROS, HeatmapCal, budgets mini-rings,
  ACCOUNT único).
- **Ledger** — search terminal `$ grep -e`, tabs ALL/IN/OUT/TRANSFERS, summary
  COUNT/IN/OUT/Δ, grouping por fecha, long-press para duplicar/borrar/cambiar
  categoría, FAB conectado al Quick Actions Sheet, pull-to-refresh con
  `reapplyRules()` bulk.
- **Tx Detail** — hero 42px, KV list (ACCOUNT/SOURCE/CATEGORY/TAGS/TX_ID/
  CREATED/HASH SHA-256), notes inline, `RULE_MATCHED` card, related tx,
  duplicar/borrar con tombstone.
- **New Tx** — segmented EXPENSE/INCOME/TRANSFER, calculator amount input
  (mono 38px), shared toggle con personalAmount, COMMIT redirige al detalle.
- **Budgets** — hero TOTAL_SPEND con proyección EOM, stepper inline, badge OVER.
- **Categories** — lista por grupo ordenada por gasto, avatar cuadrado 30×30,
  sparkline por grupo, CRUD grupos y categorías con color picker.
- **Rules** — WHEN/THEN sintaxis, toggle on/off, hits y preview en vivo, edit
  inline con pattern/priority/categoryId.
- **Goals** — hero TOTAL_SAVED, Ring 46px por meta, €/mes necesarios
  calculados con `goalProgress`.
- **Subscriptions** — summary MENSUAL + ANUAL_EQ, color-bar vertical,
  acciones MARK_PAID (NEXT+1), cadence segmented.
- **Loans** — hero DEUDA_TOTAL en danger, barra de % pagado, TAE y próxima
  cuota calculadas con `amortize()` existente.
- **Net Worth** — nueva pantalla (reemplaza WealthPage): activos (cash + saved
  goals) menus pasivos (loans pendientes). Single-user por regla de producto.
- **Analytics** — RUNNING_NET 12M, StackedBars IN vs OUT, TOP_CATEGORIES YoY,
  TOP_MERCHANTS 12M, YEAR_HEATMAP 365d.
- **Import** — detección auto de banco, preview con score de confidence
  visible, filas <0.8 en warning tint, categoría predicha por `categorize()`.
- **Export** — 5 formatos: `.saldo`/`.json` (snapshot v2 con tombstones),
  `.csv` (RFC-4180), `.ofx` (SGML 1.x), `.pdf` (jspdf).
- **Settings** — identity header, secciones SEGURIDAD/DATOS/APARIENCIA/
  PRIVACIDAD/INFO, PIN change (ChangePinSheet 3 fases), auto-lock stepper,
  wipe completo vaciando Dexie + vault + biometric credentials.
- **Onboarding** — Welcome, PinSetup (con confirmación), Biometrics (real
  con @capgo), FirstImport.
- **Lock** — auto-trigger de biometría al mount, fallback a PIN.
- **States** — TerminalEmpty (ASCII box + terminal line), TerminalLoading
  (checklist ✓/…/○/✗), TerminalError (formato rust-like con retry/copy).
- **More** — lista terminal con iconos en cajas 26×26.

### Seguridad

- **Dexie at-rest encryption**: cada `useLock.lock()` serializa Dexie a
  SaldoSnapshot v2, lo cifra con AES-256-GCM + SHA-256 bajo la master key y
  lo guarda en `localStorage[saldo.vaultPayload]`; wipe de tablas. Cada
  `unlock()` descifra, valida checksum y restaura. Backup de una generación
  bajo `saldo.vaultPayloadBackup`.
- **Biometría real** vía `@capgo/capacitor-native-biometric` v8 (post-CVE
  GHSA-vx5f-vmr6-32wf). El PIN se guarda en el keystore/keychain del sistema
  bajo `server=saldo@local`. Auto-trigger en LockPage; toggle en onboarding.
- **PIN change** en Settings: verifica PIN actual, re-deriva con salt nuevo,
  re-wrap de la master key sin pérdida de datos.
- **Wipe completo**: borra Dexie + vault PBKDF2 + payload cifrado +
  credenciales biométricas.
- **Tombstones** para soft-delete de transacciones — round-trip export/import
  preserva borrados.

### Datos y flows

- **Reglas con estado**: Schema v5 añade `Rule.enabled`, `Rule.hits`,
  `Rule.lastHitAt`. `matchRule` ignora reglas deshabilitadas; `categorize()`
  incrementa hits automáticamente.
- **reapplyMonth**: re-aplica rule set sobre txs del mes activo desde el
  pull-to-refresh.
- **dailySpendSeries / monthlyInOut**: series temporales arbitrarias para
  AreaChart (ranges 7D–YTD) y StackedBars 12M.
- **importConfidence**: scoring [0,1] por fila con pesos (date 0.4, amount 0.3,
  description 0.15, merchant 0.1, kind 0.05).
- **txHash**: SHA-256 canónico sobre campos estables (accountId, date, amount,
  kind, description, merchant, categoryId, personalAmount, reimbursementFor).
  Ignora id/createdAt/tags/notes.

### Infra / stack

- **Capacitor bump 7 → 8** (@capacitor/core, cli, android, app, haptics,
  preferences, status-bar).
- **jspdf ^4** para export PDF.
- **Test suite**: de 199 tests (F2 close) a **303 tests** sobre 38 files,
  typecheck + build + coverage ≥85% en módulos F3→F13.
- **Schema v6**: tabla `txTombstones` con unique `txHash`.

### Breaking changes

- Schema v4 → v5 (rules.enabled) → v6 (txTombstones). Las DBs existentes se
  migran automáticamente al abrir la app.
- Export `.saldo` ahora es v2 (incluye tombstones). El parser acepta v1
  (pre-tombstone → array vacío).
- Se eliminan pantallas/archivos legacy reemplazados: WealthPage, ChartsPage,
  ForecastPage, TransactionsPage, DashboardPage.legacy, TopBar v1, Card,
  Button, EmptyState, SegmentedControl, MonthSwitcher, Input, List, Money,
  BottomNavV2, BarChart, LineChart, TxForm.

### Deuda resuelta respecto al plan original

- ~~Tombstones diferidos~~ → implementados en F11.
- ~~Pull-to-refresh diferido~~ → implementado en F11 con `reapplyMonth`.
- ~~Export CSV/OFX/PDF diferidos~~ → los 5 formatos en F11.
- ~~Biometría bloqueada por CVE~~ → Capacitor 8 + @capgo v8 en F13.
- ~~Dexie at-rest encryption «hasta medir»~~ → implementado en F12.
- ~~CategoriesPage/GoalsPage/SubscriptionsPage/LoansPage/ImportPage/
  SettingsPage legacy~~ → reescritas en F10.

---

## v0.1.0

Versión inicial: dashboard v1, ledger v1, import CSV (N26/BBVA), budgets
básicos, settings minimalista.

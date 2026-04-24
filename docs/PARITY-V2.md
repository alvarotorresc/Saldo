# Saldo v0.2 — Parity check vs handoff

Estado al cierre de F14 (release polish) antes del tag `v0.2.0`.

## Matriz por pantalla

| Pantalla handoff | Archivo app | Estado |
|---|---|---|
| `01-onboarding.jsx` | `OnboardingFlow.tsx` + páginas onboarding | ✅ |
| `02-dashboard.jsx#ScrDashCharts` | `DashboardCharts.tsx` | ✅ |
| `02-dashboard.jsx#ScrDashSobrio` | `DashboardPage.tsx` (rama Sobrio) | ✅ |
| `03-ledger.jsx` | `LedgerPage.tsx` | ✅ |
| `03-ledger.jsx#ScrTxDetail` | `TxDetailPage.tsx` | ✅ |
| `03-ledger.jsx#ScrLedgerFilter` | `sheets/FilterSheet.tsx` | ✅ |
| `03-ledger.jsx#ScrTxNew` | `NewTxPage.tsx` | ✅ |
| `04-analytics-accounts.jsx#ScrAnalytics` | `AnalyticsPage.tsx` | ✅ |
| `05-budgets-categories-rules.jsx#ScrBudgets` | `BudgetsPage.tsx` | ✅ |
| `05-budgets-categories-rules.jsx#ScrCategories` | `CategoriesPage.tsx` | ✅ |
| `05-budgets-categories-rules.jsx#ScrRules` | `RulesPage.tsx` | ✅ |
| `06-goals-subs-loans-nw.jsx#ScrGoals` | `GoalsPage.tsx` | ✅ |
| `06-...#ScrSubscriptions` | `SubscriptionsPage.tsx` | ✅ |
| `06-...#ScrLoans` | `LoansPage.tsx` | ✅ |
| `06-...#ScrNetWorth` | `NetWorthPage.tsx` | ✅ (sin lista de cuentas — regla 3) |
| `07-import-export-settings.jsx#ScrImport` | `ImportPage.tsx` | ✅ |
| `07-...#ScrExport` | `ExportPage.tsx` | ✅ (5 formatos: saldo/json/csv/ofx/pdf) |
| `07-...#ScrSettings` | `SettingsPage.tsx` | ✅ |
| `08-states.jsx#ScrEmpty/Loading/Error` | `ui/states/Terminal*.tsx` | ✅ |
| `08-states.jsx#ScrQuickSheet` | `sheets/QuickActionsSheet.tsx` | ✅ |
| `08-states.jsx#ScrCmdPalette` | `ui/CommandPalette.tsx` | ✅ |

**0 pantallas diferidas. 0 deuda técnica explícita.**

## Deuda técnica resuelta (vs plan original)

| Item | Estado |
|---|---|
| Tombstones para soft-delete | ✅ F11 — `txTombstones` v6 + txHash + round-trip |
| Pull-to-refresh con reapplyRules | ✅ F11 — `reapplyMonth` bulk + gesture |
| Export CSV / OFX / PDF | ✅ F11 — los 5 formatos |
| Biometría real | ✅ F13 — `@capgo` v8 tras bump a Capacitor 8 |
| Dexie at-rest encryption | ✅ F12 — snapshot cifrado en cada lock |
| Purga de páginas legacy | ✅ F10/F14 — Wealth/Charts/Forecast/Transactions/ |
|   | DashboardPage.legacy/TxForm/TopBar v1 fuera |
| Reescritura terminal de las 6 pantallas legacy | ✅ F10 |
| Radius ≤4px en toda la app | ✅ F14 — Sheet sin rounded-t-3xl, FAB a rounded-xs |

## Tests / build

- **Tests: 303 verdes** en 38 files tras la purga de legacy UI.
- **Typecheck limpio** (tsc --noEmit).
- **Build OK** (Vite 6, bundle ~140KB gzip con jspdf lazy chunking pendiente).
- **Coverage ≥85%** en los módulos nuevos (F3→F13).

## Responsabilidad del usuario antes del tag

1. Merge de las sub-branches F3→F14 a `feat/redesign-v2` en orden.
2. Verificar APK en device físico Android (Capacitor 8 puede requerir Android
   Gradle Plugin 8.x y Java 17; `npx cap sync android` y `npm run android:build`).
3. Side-by-side visual vs `~/Downloads/design_handoff_saldo/design/Saldo v2.html`,
   screenshots a `docs/screenshots/v2/`.
4. Tag `v0.2.0` local.

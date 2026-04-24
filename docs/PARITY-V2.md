# Saldo v0.2 — Parity check vs handoff

Este documento rastrea el estado de paridad entre el rediseño implementado
(F0→F9) y el handoff `~/Downloads/design_handoff_saldo/design/Saldo v2.html`.
Se escribe al cierre de F9; la intención es iterar con screenshots antes del
tag `v0.2.0`.

## Estado por pantalla

| Pantalla handoff | Archivo app | Estado | Notas |
|---|---|---|---|
| `01-onboarding.jsx` | `src/app/OnboardingFlow.tsx` + páginas onboarding | ✅ | Biometría diferida a v0.3. |
| `02-dashboard.jsx#ScrDashCharts` | `src/pages/DashboardCharts.tsx` | ✅ | Ring + AreaChart + StackedBars + Donut + Heatmap + budgets mini-rings + single-account row. |
| `02-dashboard.jsx#ScrDashSobrio` | `src/pages/DashboardPage.tsx` (rama Sobrio) | ✅ | Hero NET tweened, 3 métricas, sparkline 30D, breakdown top5, recent tx top6, 4 chips. |
| `03-ledger.jsx` | `src/pages/LedgerPage.tsx` | ⚠️ 90% | Pull-to-refresh (reapplyRules bulk) pendiente. |
| `03-ledger.jsx#ScrTxDetail` | `src/pages/TxDetailPage.tsx` | ✅ | Tombstones diferidos. |
| `03-ledger.jsx#ScrLedgerFilter` | `src/ui/sheets/FilterSheet.tsx` | ✅ | |
| `03-ledger.jsx#ScrTxNew` | `src/pages/NewTxPage.tsx` | ✅ | Calculadora mono 38px, segmented, shared toggle. |
| `04-analytics-accounts.jsx#ScrAnalytics` | `src/pages/AnalyticsPage.tsx` | ✅ | Range selector fijo (12M) — el switch del handoff se difiere a v0.3. |
| `05-budgets-categories-rules.jsx#ScrBudgets` | `src/pages/BudgetsPage.tsx` | ✅ | |
| `05-budgets-categories-rules.jsx#ScrCategories` | `src/pages/CategoriesPage.tsx` (legacy) | ❌ | Reescritura pendiente. |
| `05-budgets-categories-rules.jsx#ScrRules` | `src/pages/RulesPage.tsx` | ✅ | Toggle + hits + preview + edit sheet. |
| `06-goals-subs-loans-nw.jsx#ScrGoals` | `src/pages/GoalsPage.tsx` (legacy) | ❌ | Reescritura pendiente. |
| `06-...#ScrSubscriptions` | `src/pages/SubscriptionsPage.tsx` (legacy) | ❌ | |
| `06-...#ScrLoans` | `src/pages/LoansPage.tsx` (legacy) | ❌ | |
| `06-...#ScrNetWorth` | `src/pages/NetWorthPage.tsx` | ✅ | Adaptado a un usuario: sin lista de cuentas. |
| `07-import-export-settings.jsx#ScrImport` | `src/pages/ImportPage.tsx` (legacy) | ❌ | Confidence score ya implementado en `src/lib/importConfidence.ts`, UI pendiente. |
| `07-...#ScrExport` | `src/pages/ExportPage.tsx` | ⚠️ | Sólo `.saldo`/`.json`; CSV/OFX/PDF diferidos. |
| `07-...#ScrSettings` | `src/pages/SettingsPage.tsx` (legacy) | ❌ | Reescritura pendiente. |
| `08-states.jsx#ScrEmpty/Loading/Error` | `src/ui/states/Terminal{Empty,Loading,Error}.tsx` | ✅ | ErrorBoundary integra TerminalError. |
| `08-states.jsx#ScrQuickSheet` | `src/ui/sheets/QuickActionsSheet.tsx` | ✅ | 3×3 grid. |
| `08-states.jsx#ScrCmdPalette` | `src/ui/CommandPalette.tsx` | ✅ | 15 comandos, fuzzy, ↑↓ Enter Esc. |

## Deuda consolidada para post-v0.2.0

1. Pantallas legacy por reescribir (no bloquean funcionalidad): CategoriesPage,
   GoalsPage, SubscriptionsPage, LoansPage, ImportPage, SettingsPage.
2. Tombstones para soft-delete en TxDetail (+ migración export).
3. Pull-to-refresh en LedgerPage con reapplyRules bulk (`categorize.ts`).
4. Export formatos CSV/OFX/PDF.
5. Biometría `@capgo` v8 tras subir a Capacitor 8 (CVE GHSA-vx5f-vmr6-32wf en v7).
6. Verificación visual final side-by-side con `Saldo v2.html` + screenshots por
   pantalla en `docs/screenshots/v2/`.

## Tests y build

- Tests: **296 verdes** al cierre de F9 (budget del plan ~186 tests nuevos).
- Build: ✅ (Vite 6.4.2, bundle ~138KB gzip).
- Typecheck: ✅ (`tsc --noEmit`).
- Cobertura sobre código nuevo: ≥85% en DashboardPage, DashboardCharts,
  budgets, rules, goals, netWorth, saldoFile, analytics, importConfidence,
  errorTrace, terminal states.

## Polish pendiente

- Verificar que todas las pantallas usen `TopBarV2` (6 pantallas legacy aún
  usan `TopBar` v1).
- Auditar `console.log` residuales (quedan varios en `App.tsx` boot/seed).
- Animaciones globales de sheets/overlays: Sheet ya anima (`slideUp` 200ms).

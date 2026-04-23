# Informe de testing exhaustivo — Saldo

- **Fecha:** 2026-04-16
- **Versión probada:** 0.1.0 (commit local, `vite dev`)
- **Metodología:** Playwright MCP (Chromium headed) sobre `http://localhost:5173/`
- **Viewports:** 390×844 (mobile) y 1440×900 (desktop)
- **Stack:** Vite + React 18 + TypeScript + Dexie/IndexedDB + Capacitor 7
- **Alcance:** Todo Dashboard, Movimientos, Categorías, Metas, Préstamos, Suscripciones, Forecast, Patrimonio, Gráficas, Import CSV (N26 + BBVA), Settings, Backup/Export, responsive y navegación global.
- **Sin modificaciones de código.** Sólo testing por UI + inspección de IndexedDB vía `page.evaluate`.

## Resumen ejecutivo

La app funciona en el flujo principal. No se detectaron errores de consola, warnings ni tráfico de red externo (offline-first confirmado). Hay **1 bug crítico** (seed duplicado en BD) y **3 bugs menores** + **5 observaciones de UX**. Toda la lógica de cálculo financiero verificada es correcta (cuotas de amortización francesa, dedup de importaciones, auto-split de gastos compartidos, totales mensuales, forecast 30 días).

---

## 🐞 Bugs

### 🔴 BUG-1 (crítico) · Seed duplicado al inicializar IndexedDB

**Impacto:** Distorsiona toda la UI basada en categorías/grupos/reglas. Los selects muestran cada opción dos veces. El listado de categorías aparece duplicado con conteos 0 y N mezclados. Las estadísticas ("Top categorías") cuentan categorías dos veces. El backup JSON exporta datos duplicados.

**Cómo se reproduce:**
1. Borrar IndexedDB (`saldo` db) en DevTools.
2. Recargar `localhost:5173`.
3. Abrir DevTools → Application → IndexedDB → saldo → categories / categoryGroups / rules.
4. Contar registros.

**Datos observados (con BD nueva):**
- `categoryGroups`: 20 (esperado 10)
- `categories`: 26 (esperado 13)
- `rules`: 84 (esperado 42)

**Causa probable:** `src/App.tsx:22-26` llama `seedIfEmpty()` en un `useEffect` sin guard de idempotencia por ejecución. React 18 en StrictMode (dev) invoca el effect dos veces; ambas ejecuciones pasan el check `count() === 0` antes de que la primera haga `bulkAdd` → se insertan dos lotes.

**También puede afectar a producción** si el componente se remonta por cualquier motivo (navegación, HMR real, fast refresh, etc.) antes de que el primer seed complete.

**Fix sugerido:**
- Opción A: añadir un flag en `db.meta` (`seededAt`) y chequearlo antes del `bulkAdd`, todo dentro de la misma transacción Dexie.
- Opción B: cachear la promesa del seed a nivel de módulo (singleton) para que N llamadas compartan la misma.
- Opción C: mover el seed a `db.on('populate')` de Dexie que sólo corre una vez por versión.

**Archivos relevantes:**
- `src/App.tsx:17-34` (entrypoint del seed)
- `src/db/database.ts:202-241` (`seedIfEmpty`)

**Evidencia:** `.playwright-mcp/saldo-test-categories.png`

---

### 🟡 BUG-2 · Doble signo `--` en "Ahorrado este mes"

**Impacto:** Dashboard muestra `--45,20 €` (dos guiones) cuando ingresos=0 y hay gastos. Se aprecia también en comparativas mes-a-mes con valores negativos.

**Cómo se reproduce:**
1. Home → mes con 0 ingresos y al menos 1 gasto.
2. Observar el bloque "AHORRADO ESTE MES".

**Causa raíz:** `src/ui/Money.tsx:14-18`:

```tsx
const prefix = signed ? (kind === 'expense' ? '-' : kind === 'income' ? '+' : '') : '';
return (
  <span className={`tabular ${color} ${className}`}>
    {prefix}
    {formatMoney(value, currency)}
  </span>
);
```

`formatMoney()` (usa `Intl.NumberFormat`) ya formatea valores negativos con `-`. Si el caller pasa `signed=true, kind='expense'` con un `value` negativo, se concatenan dos guiones.

**Fix sugerido:** aplicar el prefijo sobre `Math.abs(value)`, o no aplicarlo si `value < 0`.

**Evidencia:** `.playwright-mcp/saldo-test-dashboard-bug-double-minus.png`

---

### 🟡 BUG-3 · Top categorías duplicadas en Charts

**Impacto:** La tarjeta "Top categorías (rango)" muestra `Superm 45,20 €` listado dos veces con el mismo importe.

**Causa:** consecuencia del BUG-1. Al haber dos categorías "Supermercado" en BD, el agrupador por categoría produce dos filas. Se arregla al corregir el seed duplicado.

**Archivo:** `src/pages/ChartsPage.tsx`.

---

### 🟡 BUG-4 · Baseline anómala en gráfico "Ahorro mensual"

**Impacto:** El eje Y del gráfico de ahorro mensual muestra `-245,48 €` como mínimo visible en meses sin ninguna transacción, tanto en vista 3M como 6M.

**Datos del escenario de prueba:**
- 1 gasto manual (Mercadona -45,20 €)
- 1 ingreso (Nómina +2500 €)
- 5 filas importadas desde N26
- 5 filas importadas desde BBVA
- 1 préstamo (cuota teórica 612,36 €)
- 1 suscripción (10,99 €/mes)

Ni 612,36 ni 623,35 ni 245,48 encajan obviamente con ningún cálculo directo. Posible residuo de pagos recurrentes proyectados hacia meses pasados o cálculo con una división por cero en meses vacíos.

**Acción:** auditar `src/pages/ChartsPage.tsx` y las series que produce para meses sin datos (debería ser `0`, no un valor prorrateado).

**Evidencia:** `.playwright-mcp/saldo-test-charts.png`.

---

## ⚠️ Observaciones UX (no bugs funcionales)

### UX-1 · Acciones destructivas sin confirmación
- "Eliminar meta" (GoalsPage) borra al primer click.
- "Eliminar" dentro del TxForm borra la transacción al primer click.
- Cualquier toque accidental = pérdida de datos sin undo.
- **Sugerencia:** `confirm()` nativo o un `Sheet` de confirmación con `Eliminar` en variante `danger`.

### UX-2 · `Escape` no cierra los Sheets
Sheet modal abierto (ej. edición de préstamo) no se cierra con `Esc`. Convención web/iOS es cerrar. Hay que acertar el backdrop (al que además le tapa el sheet) o usar "Cancelar".
- **Archivo:** `src/ui/Sheet.tsx`
- **Fix:** añadir listener a `keydown` de `Escape` y llamar `onClose`.

### UX-3 · Month switcher sin tope futuro
Desde Abril 2026 se puede ir a Mayo 2026, Junio 2026... indefinidamente. Todos vacíos.
- **Sugerencia:** deshabilitar "Mes siguiente" cuando `month >= currentMonth`.

### UX-4 · Desktop sin `max-width`
En 1440px el contenido se estira al 100% del viewport. Las cards quedan enormes y el FAB "Añadir" se superpone al contenido de "Presupuestos" ocultando porcentajes.
- **Fix:** envolver `<main>` con `max-w-[480px] md:max-w-[720px] mx-auto` o similar; considerar `min-h-screen` + viewport móvil simulado en desktop.
- **Evidencia:** `.playwright-mcp/saldo-test-desktop.png`

### UX-5 · EmptyState "cuadrito gris" como ilustración
`src/ui/EmptyState.tsx:12` renderiza un `<div className="w-12 h-12 rounded-2xl border border-border bg-elevated mb-4" />` como decoración. Parece un icono que no ha cargado.
- **Sugerencia:** sustituir por un Icon Lucide apropiado a cada contexto (objetivo, cartera, bookmark...) o eliminarlo.

---

## ✅ Funcionalidades verificadas (100% por UI)

### Dashboard / Home
- [x] Estado vacío con 2 CTAs (Importar / Añadir manual)
- [x] Switcher de mes (prev/next)
- [x] Card "Ahorrado este mes" con tasa de ahorro y delta vs mes anterior
- [x] Totales ingresos/gastos
- [x] Desglose por grupo con %
- [x] Lista "Últimos movimientos" con tap → edit

### Movimientos
- [x] Crear gasto (Mercadona -45,20 €)
- [x] Crear ingreso (Nómina +2.500 €)
- [x] Categorización automática (reglas + text match)
- [x] Edit transacción (abre sheet pre-rellenado)
- [x] Delete transacción (lista se actualiza)
- [x] Buscador por texto (case-insensitive)
- [x] Filtros Todo / Gastos / Ingresos
- [x] Agrupación por día

### Gasto compartido
- [x] Toggle "Gasto compartido"
- [x] Auto-cálculo: `personal_amount = importe / personas` (120/4 = 30 ✅)
- [x] Campo "Con quién" (freeform)

### Reembolso
- [x] En kind=income, botón "Enlazar"
- [x] Picker muestra sólo gastos con `personalAmount < amount`
- [x] Preview correcta: "16 abr · tu parte 30,00 € de 120,00 €"

### Categorías
- [x] Nuevo grupo custom con nombre + tipo (gasto/ingreso) + color (paleta de 15)
- [x] El grupo creado aparece en la lista de grupos
- [x] El sheet de edición de categorías existe (no probado editar builtin)

### Metas
- [x] Crear meta con nombre + objetivo + (fecha opcional) + color
- [x] Sin fecha límite = válido
- [x] Editar "Ya ahorrado" actualiza el % (0 → 20% con 600/3000)
- [x] Eliminar meta (sin confirmación — ver UX-1)

### Préstamos
- [x] Crear préstamo (Hipoteca 150.000 €, 2,75 % TAE, 360 meses)
- [x] Cálculo cuota mensual: **612,36 €** (fórmula francesa correcta)
- [x] Total intereses: 70.450,24 €
- [x] Fin: 16 de marzo de 2056 (correcto 360 meses)
- [x] Tabla de amortización paginada mes a mes con capital/interés/pendiente

### Suscripciones
- [x] Crear Spotify 10,99 €/mes
- [x] Conversión: **10,99 €/mes → 131,88 €/año** ✅
- [x] Cadencias: Semanal / Mensual / Trimestral / Anual
- [x] Botón "Calcular próximo cobro desde inicio + cadencia"
- [x] Flag "Activa" con default true

### Forecast 30 días
- [x] SALDRÁ = 623,35 € (= 612,36 cuota + 10,99 sub ✅)
- [x] ENTRARÁ = 0,00 € (sin ingresos recurrentes registrados)
- [x] NETO = -623,35 €
- [x] Lista "Próximos 30 días" con Spotify + Cuota Hipoteca

### Patrimonio
- [x] Registro manual de saldo mensual por cuenta
- [x] Evolución 12 meses

### Gráficas
- [x] Rangos 3M / 6M / 1A / 2A (recalculan)
- [x] Ingresos vs Gastos (bar chart)
- [x] Ahorro mensual (line chart) ⚠️ ver BUG-4
- [x] Ahorro acumulado (line chart)
- [x] Top categorías del rango

### Importación CSV
- [x] Auto-detección formato N26 (headers `Booking Date`, `Partner Name`, `Payment Reference`)
- [x] Auto-detección formato BBVA (headers `Fecha`, `F.Valor`, `Concepto`, `Importe`)
- [x] Preview con conteo "N válidas · M ignoradas"
- [x] Parseo fechas `YYYY-MM-DD` (N26) y `DD/MM/YYYY` (BBVA)
- [x] Parseo decimales `,` y `.`
- [x] Dedup al importar: CSV con 1 fila repetida → **5 añadidos + 1 omitido** ✅
- [x] Re-import del mismo CSV → **0 añadidos + 6 omitidos** (idempotencia OK)
- [x] Categorización automática post-import correcta:
  - Mercadona → Supermercado ✅
  - Glovo → Restaurantes ✅
  - Renfe → Transporte ✅
  - Zara → Compras ✅
  - Iberdrola → Servicios ✅
  - Farmacia García → Salud ✅
  - Spotify → Suscripciones ✅
  - Netflix → Suscripciones ✅
  - Nomina ACME → Nómina ✅

### Settings / Ajustes
- [x] Listado de cuentas
- [x] Crear presupuesto por categoría (Supermercado 250 €/mes)
- [x] "Aplica a": Todos los meses / Solo este mes
- [x] Presupuesto se refleja en Home con barra de progreso
- [x] Botón "Redetectar" gastos recurrentes ejecuta sin errores
- [x] **Backup JSON**: 13 tablas, ~21 KB, incluye version/exportedAt/accounts/categoryGroups/categories/transactions/budgets/goals/recurring/rules/subscriptions/loans/balances
- [x] **Export CSV**: header español (Fecha/Descripción/Comercio/Importe/Tipo/Categoría/Tu parte/Notas/Etiquetas), 12 filas de transacciones

### Navegación global
- [x] Bottom nav 5 tabs, estado activo visible
- [x] Cambio entre tabs conserva estado del subpath en "Más"
- [x] "Atrás" desde subpáginas de "Más" vuelve al grid
- [x] Cambio a "home" desde "more" limpia `moreSection`

### Consola / Red / Errores
- [x] 0 errores en consola
- [x] 0 warnings
- [x] 1 log debug esperado (HMR de Vite)
- [x] 0 peticiones de red externas (offline-first verificado)

### Theme / Responsive
- [x] Dark mode consistente en todas las pantallas
- [x] Mobile 390×844: diseño correcto
- [ ] Desktop 1440×900: funcional pero con problemas (UX-4)

---

## 🎯 Prioridades de remediación

1. **Fix BUG-1** (seed duplicado) — afecta a datos reales de usuarios si ya instalaron. Requiere migración de limpieza para usuarios existentes.
2. **Fix BUG-2** (`--` en Money) — fix trivial en 1 fichero.
3. **Investigar BUG-4** (baseline charts) — puede ser visible al onboarding.
4. **Añadir confirmación UX-1** antes de delete destructivo.
5. **Resolver Escape + month switcher** (UX-2, UX-3) — baratos.
6. **Max-width desktop** (UX-4) — salud a futuro si alguien accede por web en escritorio.

---

## Artefactos

Screenshots en `/home/alvarotc/Documents/apps/.playwright-mcp/`:

- `saldo-test-home-empty.png` — estado inicial vacío
- `saldo-test-dashboard-bug-double-minus.png` — **BUG-2**
- `saldo-test-home-with-income.png` — Dashboard con datos
- `saldo-test-home-full.png` — Dashboard con todos los imports
- `saldo-test-transactions.png` — Movimientos
- `saldo-test-more.png` — grid de "Más"
- `saldo-test-categories.png` — **BUG-1 visible**
- `saldo-test-goals-empty.png`, `saldo-test-goal-created.png`
- `saldo-test-loans-empty.png`, `saldo-test-loans-created.png`, `saldo-test-loan-detail.png`
- `saldo-test-subs-empty.png`
- `saldo-test-charts.png` — **BUG-4 visible**
- `saldo-test-wealth.png`, `saldo-test-forecast.png`
- `saldo-test-import.png`, `saldo-test-import-preview.png`
- `saldo-test-settings.png`
- `saldo-test-desktop.png` — **UX-4 visible**

Fixtures usadas:
- `.playwright-mcp/saldo-test-n26.csv` (6 filas, 1 duplicada para probar dedup)
- `.playwright-mcp/saldo-test-bbva.csv` (5 filas)

---

## Cómo retomar en la siguiente sesión

1. Empezar por **BUG-1**: necesita diseño (cómo migrar users que ya tienen duplicados) + fix (idempotencia del seed).
2. BUG-2 y UX-2 (Escape) son fix rápidos, buenos para warm-up.
3. Si se toca `ChartsPage.tsx`, aprovechar para cerrar BUG-4.
4. Cuando se haga el fix de BUG-1, regresar IndexedDB local y repetir los tests anteriores para confirmar que todos los selects, lists y Top categorías muestran valores únicos.

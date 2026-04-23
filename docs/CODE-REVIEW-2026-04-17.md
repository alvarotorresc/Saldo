# Code review completo — Saldo

- **Fecha:** 2026-04-17
- **Versión revisada:** 0.1.0 (post-fixes de TEST-REPORT-2026-04-16)
- **Alcance:** Codebase completo (`src/**`). Revisión estática: bugs, cálculos financieros, race conditions, tipos, accesibilidad, mantenibilidad y la higiene de los fixes aplicados en esta sesión.
- **Metodología:** Lectura de todos los módulos, verificación cruzada de convenciones (signo de `amount`, cadencias, timezones, dedup), análisis de patrones con `useLiveQuery` y efectos.
- **Sin modificaciones de código.** Solo review.

## Resumen ejecutivo

La arquitectura es sólida: singleton del seed (ya corregido), schema versionado en Dexie v4, store Zustand minimalista, patrón `useLiveQuery` aplicado con consistencia y convención clara de `amount` positivo + `kind` para el signo. No hay imports externos en runtime, sin secrets, sin red (offline-first confirmado por inspección).

Se detectan **3 bugs críticos** no vistos por el QA (timezone en forecast, race de dedup en import, catch silencioso en restore de backup), **2 bugs altos** (mapeo de cadencias roto para quincenales, recurring usa `amount` bruto en gastos compartidos), **1 alto de UX** (Sheet anidados con Escape), **5 observaciones medias** de refactor con impacto, y varios **bajos** de higiene.

---

## 🐞 Bugs

### 🔴 BUG-A (crítico) · Timezone shift en `ForecastPage` (fecha del forecast se adelanta 1 día)

**Archivo:** `src/pages/ForecastPage.tsx:57-59`

**Impacto:** Para usuarios en España (GMT+1/+2), los items de tipo `recurring` en el forecast pueden aparecer con fecha un día antes de lo real. Afecta el ordenamiento del listado, el cálculo de `daysUntil`, y la etiqueta "En X días". Ejemplo: un recurrente cuyo próximo cobro es el 2026-05-01 a las 00:00 local aparece como 2026-04-30 porque `toISOString()` convierte a UTC.

**Código:**
```ts
const last = new Date(r.lastSeen + 'T00:00:00').getTime();
const nextDate = new Date(last + r.cadenceDays * 86400000);
const iso = nextDate.toISOString().slice(0, 10); // ← UTC, rompe con TZ positivo
```

**Solución:** usar el mismo patrón que `loan.ts:22-28` (`addMonths`): construir el ISO manual con `getFullYear/getMonth/getDate`. El resto del codebase es consistente con fechas locales (parse-helpers, format.ts); este es el único outlier.

**Nota sobre el DST:** sumar `cadenceDays * 86400000` cruzando el cambio de hora puede desplazar también la fecha en ±1 hora; construir un nuevo `Date` y usar `setDate(getDate() + cadenceDays)` es más robusto.

---

### 🔴 BUG-B (crítico) · Race de dedup al importar extracto (no atómico)

**Archivo:** `src/pages/ImportPage.tsx:52-72`

**Impacto:** El loop de import lee `where('[accountId+importHash]').first()` y a continuación hace `db.transactions.add(...)` fuera de cualquier `db.transaction('rw', ...)`. El índice `importHash` no es `&` único (schema `database.ts:96-97`). Si el usuario pulsa "Importar" dos veces seguidas (el botón no se bloquea hasta `setRunning(true)`, pero aún así React puede ejecutar dos onClick si el device es lento), o si el componente re-renderiza y alguna promesa paralela arranca una segunda pasada, se cuelan duplicados que ningún check posterior recupera.

**Código:**
```ts
for (const row of result.rows) {
  const base = toTransaction(accId, result.bank, row);
  if (base.importHash) {
    const exists = await db.transactions.where(...).first(); // check
    if (exists) { skipped++; continue; }
  }
  // ... sin transacción, otra ejecución puede insertar el mismo hash aquí
  await db.transactions.add({ ...base, categoryId: catId });
}
```

**Solución:**
1. Cambiar el schema a `&[accountId+importHash]` en la próxima versión (rompe datos existentes — requiere migración) o mantenerlo y envolver todo el loop en `db.transaction('rw', db.transactions, db.rules, async () => { ... })`.
2. Deshabilitar el botón al primer click (`disabled={running || !result}`), ya está parcialmente hecho pero falta `!result` para evitar relanzar tras el reset.

---

### 🔴 BUG-C (crítico) · `importBackup` traga errores en silencio

**Archivo:** `src/pages/SettingsPage.tsx:411-432`

**Impacto:** Si el JSON de backup está corrupto o es de una versión incompatible, el `catch` solo hace `console.error` sin feedback al usuario. El usuario cree que el restore funcionó, puede seguir usando la app y luego perder datos al exportar/sobrescribir otro backup. No hay validación del campo `version`, ni del shape de los arrays (se hace `bulkPut` directo).

**Código:**
```ts
} catch (e) {
  console.error('Backup inválido', e); // ← silencioso
}
```

**Solución:**
- Validar `data.version` antes del `bulkPut` y rechazar si no es conocido.
- Mostrar `alert`/toast con el error real (ya hay Card de error en otros sitios, reutilizar el pattern).
- Considerar hacer backup del estado actual a otra DB antes del restore para permitir rollback.

---

### 🟠 BUG-D (alto) · Mapeo de cadencias roto para quincenales en "Detectar suscripciones"

**Archivo:** `src/pages/SubscriptionsPage.tsx:336`

**Impacto:** `detectRecurring` (`src/lib/recurring.ts:39-42`) acepta cadencias de 13-16 días (quincenal). Al añadir un recurrente como suscripción, el ladder:

```ts
r.cadenceDays <= 10 ? 'weekly'
: r.cadenceDays <= 20 ? 'monthly'
: r.cadenceDays <= 40 ? 'monthly' // ← rama redundante + clasifica quincenal como mensual
: r.cadenceDays <= 100 ? 'quarterly' : 'yearly';
```

clasifica un pago quincenal (≈14 días) como `'monthly'`. Resultado: `nextDateFromCadence(..., 'monthly')` suma 1 mes en vez de 14 días; todas las fechas de próximo cobro y el coste mensual (`monthlyCostForCadence`) salen incorrectos.

**Solución:** el tipo `SubscriptionCadence` no tiene `biweekly`. O se amplía el tipo (y `nextDateFromCadence`, `monthlyCostForCadence`, Select en SubForm), o se decide explícitamente convertir quincenal a mensual con la mitad del importe. Hoy no hay decisión, solo un bug.

---

### 🟠 BUG-E (alto) · `detectRecurring` usa `amount` bruto ignorando `personalAmount`

**Archivo:** `src/lib/recurring.ts:35-36`

**Impacto:** El `averageAmount` de un recurrente se calcula con el total cargado a la cuenta, no con la parte personal. Si el usuario marca un gasto como compartido (ej: 200 € en total / 50 € suyos), el recurrente detectado reporta 200 €, y como esto alimenta el forecast (`ForecastPage.tsx:65`), la previsión de gastos del mes se infla.

**Solución:** importar `effectiveAmount` de `@/db/queries` y usar `items.map((i) => effectiveAmount(i))` en lugar de `items.map((i) => i.amount)`. Aplicar también al filtro de desviación para que no rechace recurrentes con splits variables.

---

### 🟠 BUG-F (alto UX) · `Sheet` anidados: Escape cierra todos, no solo el topmost

**Archivo:** `src/ui/Sheet.tsx:17-24`

**Impacto:** El fix UX-2 añadió `window.addEventListener('keydown', ...)` por cada Sheet abierto. Cuando hay dos Sheets abiertos (p.ej. si en el futuro un Sheet abre otro, o ya hoy por render transitorios), ambos listeners están activos y **ambos** llaman a su `onClose` en la misma pulsación. Resultado: un Escape cierra dos Sheets a la vez.

**Hoy el código** no anida Sheets por construcción (solo un Sheet a la vez en cada página), pero el patrón de `TxForm` con `linkPicker` sustituye el contenido inline en vez de anidar, justo porque esto no es trivial. Queda como landmine para el próximo feature que sí anide.

**Solución mínima:** mantener una lista module-level de listeners; solo el último añadido ejecuta. Algo como:

```ts
const sheetStack: Array<() => void> = [];
// en el useEffect:
sheetStack.push(onClose);
const onKey = (e) => { if (e.key === 'Escape') sheetStack[sheetStack.length-1]?.(); };
return () => { sheetStack.splice(sheetStack.indexOf(onClose), 1); ... };
```

---

## 🛠️ Higiene de los fixes de esta sesión

### H-1 · Cast en `cleanupDuplicatesMigration`

**Archivo:** `src/db/database.ts:340-354`

El `(table as unknown as { update: ... })` funciona pero es evitable. Dexie ya exporta el tipo `Table<T, K>` (ya importado en la línea 1). Refactor limpio:

```ts
import type { Table } from 'dexie';

const remapCat = async <T extends { id?: number; categoryId?: number }>(
  table: Table<T, number>,
): Promise<void> => {
  const rows = await table.toArray();
  for (const row of rows) {
    if (row.id == null || row.categoryId == null) continue;
    const canon = catIdRemap.get(row.categoryId);
    if (canon != null && canon !== row.categoryId) {
      await table.update(row.id, { categoryId: canon } as Partial<T>);
    }
  }
};
```

### H-2 · Edge cases de la migración dedup

**Archivo:** `src/db/database.ts:292-395`

Tres escenarios que la migración no cubre bien:
1. **`categoryGroup` sin `kind`:** la clave `${g.name}\u0000${g.kind}` queda como `"Ocio\u0000undefined"`. Funciona, pero si el mismo nombre existiera para `expense` e `income` y ambos con `kind=undefined` (no debería pasar con el seed actual), se colapsan.
2. **`category` sin `groupId`:** la clave `${c.name}\u0000${c.groupId ?? ''}\u0000${c.kind}` colapsa todas las categorías con el mismo nombre y sin grupo, **incluso si el usuario había creado dos categorías "Café" en grupos distintos** y al menos una perdió el groupId por error. En la práctica con datos de seed es seguro, pero con datos de usuario reales puede colapsar categorías legítimas.
3. La flag `duplicatesMigratedAt` se guarda como último paso. Si falla a media migración la transacción hace rollback y se reintenta: OK. Pero si se parchea el código para cambiar reglas de dedup en el futuro, los usuarios ya migrados no se re-limpiarán. Recomendado: guardar versión (`duplicatesMigratedV1`, `V2`, etc.).

### H-3 · `LineChart`: series mixtas pequeñas

**Archivo:** `src/ui/charts/LineChart.tsx:23-50`

El fix funciona: `min===max` tiene tres ramas (cero puro, todo positivo, todo negativo) y el caso general agrupa `min>=0`, `max<=0`, y mixto. No se han encontrado regresiones visuales. Solo un edge cosmético: un valor absoluto ~0 (ej. 1e-9) entra en la rama "positivo" y se pinta con padding superior. Inofensivo.

### H-4 · `DashboardPage` cap en MonthSwitcher

**Archivo:** `src/pages/DashboardPage.tsx:38-41` + `src/ui/MonthSwitcher.tsx:10-12`

`currentMonth()` se recalcula en cada render; cualquier `useLiveQuery` dispara re-render. En la práctica el cap refleja el mes real dentro de segundos de que cambie. Correcto para esta app. No hay poll periódico, pero no hace falta.

### H-5 · Delete con confirmación

**Archivo:** `src/features/transactions/TxForm.tsx:105-110` + `src/pages/GoalsPage.tsx:143-148`

El `window.confirm` no es ideal UX en móvil nativo (Capacitor puede degradarse al prompt del sistema operativo, que luce distinto), pero es funcionalmente correcto. Otros deletes siguen sin confirmación: `LoansPage.tsx:186-189`, `SubscriptionsPage.tsx:210-213`, `CategoriesPage.tsx:226-241` (éste último además hace delete de transacciones sin confirmar). Inconsistencia: aplicar el mismo patrón o extraer un helper `confirmDelete('¿Eliminar...?')`.

---

## 🔧 Mejoras (medias)

### M-1 · Dead prop `expByCat` en `DashboardPage.BudgetSummary`

**Archivo:** `src/pages/DashboardPage.tsx:241-246, 351-378`

`BudgetSummary` recibe `expByCat={new Map()}` pero internamente ignora el prop y recalcula con su propio `useLiveQuery`. Son dos queries redundantes a la misma tabla. O se remueve el prop y la interface, o se reutiliza la query padre y se elimina la interna.

### M-2 · Constante `30.4375` duplicada (cálculo de meses transcurridos)

**Archivos:** `src/pages/LoansPage.tsx:33, 78, 318`, `src/pages/ForecastPage.tsx:76`

El cálculo de `paidMonths` con `(Date.now() - startDate) / (86400000 * 30.4375)` está en 4 sitios. Para préstamos cortos es aceptable pero en hipotecas a 30 años acumula error de varias semanas (los meses no son uniformes). Extraer a `lib/loan.ts`:

```ts
export function monthsElapsed(fromISO: string): number {
  const [y, m, d] = fromISO.split('-').map(Number);
  const now = new Date();
  const start = new Date(y, (m ?? 1) - 1, d ?? 1);
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  return Math.max(0, months);
}
```

### M-3 · `DashboardPage.tsx` (416 líneas) y `SubscriptionsPage.tsx` (396) son muy largos

Mezclan componente principal + subcomponentes + forms. Extraer los forms (`SubForm`, `DetectRecurring`, `GoalForm`, `BudgetForm`) a `features/.../` facilita reuso y lectura. `TxForm` ya sigue este patrón.

### M-4 · `categorize` fallback por `name.startsWith('Otros')`

**Archivo:** `src/lib/categorize.ts:32-33`

Si el usuario renombra la categoría "Otros gastos" u "Otros ingresos", el fallback devuelve `undefined` silenciosamente. Usar `builtin === 1` como señal primaria, o marcar explícitamente una categoría como `isFallback`.

### M-5 · `ChartsPage.tsx:38` dependencia con `months[0]` y `months[n-1]` no suficientes

**Archivo:** `src/pages/ChartsPage.tsx:36-38`

El `useLiveQuery` depende de `[months[0], months[months.length - 1]]`, pero `months` completo influye en `byMonth` a través del `useMemo`. Es consistente porque `preset` controla ambos, pero queda frágil. Mejor `[preset]` solo, o `[months.join(',')]`.

---

## 🔎 Observaciones bajas

### B-1 · Pct de préstamo nunca llega a 100%
`LoansPage.tsx:84`: `idx = Math.min(paidMonths, rows.length-1)`, después `pct = idx / rows.length`. Con `rows.length=60`, pagado todo → `idx=59`, pct=98. Cap manual: `paidMonths >= rows.length ? 100 : Math.round((idx / rows.length) * 100)`.

### B-2 · `IconName` no incluye iconos guardados en DB
`Icon.tsx:8-38` lista 30 iconos; los seeds en `database.ts:112-155` referencian `'utensils'`, `'bus'`, `'zap'`, `'heart'`, `'star'`, `'bag'`, `'dots'`, `'briefcase'`, `'cart'`, `'arrow'`. Hoy no se renderizan (solo se muestra la inicial), pero es dead data. O se purga el campo `icon` de seed, o se completa `IconName` y se usa.

### B-3 · Random color en `DetectRecurring`
`SubscriptionsPage.tsx:346`: `COLORS[Math.floor(Math.random() * COLORS.length)]`. Hace los tests visuales no deterministas. Usar hash del `signature` como índice.

### B-4 · `formatMonthShort` duplicado
`ChartsPage.tsx:245-249` y `WealthPage.tsx:140-144` tienen la misma función. Mover a `lib/format.ts`.

### B-5 · `useMemo` con dep `subs` en Dashboard no desestructura activeOnly
`DashboardPage.tsx:89-96`: itera `subs` completo filtrando activos. La query padre (`line 53-60`) ya filtra por `active=1`. Está consistente porque la misma query, pero si alguien cambia una y no la otra se desincroniza.

### B-6 · Accesibilidad
- Botones con solo iconos tienen `aria-label` (bien) pero los botones "Ver todas", "Ver todos", "Gráficas" en cards son solo texto chico sin target role claro; semántica ya es `<button>`, OK.
- El `Sheet` no tiene `role="dialog"` ni `aria-modal="true"` ni `aria-labelledby`. Un lector de pantalla no anuncia el título correctamente.
- `FAB` sin `aria-label` cuando solo tiene icono (casos en que `label` es undefined).
- Los checkboxes de Split y Activa en SubForm: sin `<label for>` explícito (usan `<label>` wrapper, lo cual es válido pero algunos screen readers lo manejan peor).

### B-7 · i18n: 100% hardcoded en ES
Todos los strings de UI y errores están en español embebido. Para un v2 en inglés hay ~200 strings que migrar. Preparar con `const MSG = { ... }` o `i18next` desde ya evitaría trabajo luego.

### B-8 · `importBackup` sin `invalidateRulesCache()` antes del `bulkPut`
Las reglas viejas quedan en la cache del `categorize` hasta el siguiente `invalidateRulesCache`, que sí se llama al final. Pero si durante el `bulkPut` hay alguna categorización asíncrona en vuelo (import simultáneo), usa reglas stale. Edge pero real.

### B-9 · `console.error` único en `App.tsx:24`
No hay logger centralizado. Para diagnosticar bugs de usuario (el usuario no va a abrir DevTools en Capacitor), sería útil un toast o un buffer persistido. Tampoco hay error boundary React — si un componente throw, pantalla en blanco.

### B-10 · `TxForm.tsx:69` validación del formulario
`if (!desc || !Number.isFinite(a) || a <= 0) return;` simplemente no guarda y no muestra error. El usuario ve el botón pulsado y nada pasa. Añadir setError + mensaje.

---

## ✅ Cosas bien hechas (vale la pena señalar)

- **Singleton de seed + cleanupMigration en una sola transacción**: robusto, idempotente, se recupera de DBs ya corruptos.
- **`effectiveAmount`** como abstracción única del split/reembolso; usado consistente en `queries.ts`, `DashboardPage`, `ChartsPage`, `ForecastPage`.
- **Convención `amount` positivo + `kind`** aplicada sin fisuras; el único sitio signo-aware es `toTransaction` (al importar) y `Money` (al renderizar).
- **Schema versionado Dexie v1→v4** con upgrade functions; migración de seeds de grupos correcta.
- **`parseAmount` maneja** locales ES/EN, paréntesis negativos, símbolo €; bien cubierto.
- **CSV parser (`csv.ts`)** respeta comillas dobles escapadas, BOM, CRLF, auto-detecta delimitador. Nivel industrial.
- **Offline-first** verificado: ningún `fetch()`/`XMLHttpRequest` en `src/**`. Solo `capacitor/status-bar` en `main.tsx`.
- **TypeScript:** 1 solo `as unknown` en todo el codebase (el marcado en H-1). Sin `any`.

---

## 🏁 Top 5 acciones recomendadas

1. **🔴 BUG-A (timezone forecast, `ForecastPage.tsx:57-59`)** — reemplazar `toISOString().slice(0,10)` por construcción local con `getFullYear/getMonth/getDate`. Fix de 3 líneas, alto impacto: todos los forecasts salen con fecha correcta.

2. **🔴 BUG-B (race de dedup en import, `ImportPage.tsx:52-72`)** — envolver el loop en `db.transaction('rw', ...)` y bloquear el botón hasta completar. Evita duplicados silenciosos durante la importación.

3. **🟠 BUG-D + BUG-E (recurring/cadencia quincenal y `amount` vs `effectiveAmount`)** — ambos viven en el flujo "detectar recurrentes → crear suscripción → alimentar forecast". Arreglarlos juntos garantiza que la previsión de gastos y el coste mensual reportado sean exactos en presencia de gastos compartidos o cadencias ≠ mensual.

4. **🟠 BUG-C (importBackup silencioso, `SettingsPage.tsx:411-432`)** — validar `data.version` y surface el error al usuario. Es un feature del settings y hoy puede provocar pérdida de datos sin feedback.

5. **🛠️ H-1 + M-2 (refactor cast Dexie + helper `monthsElapsed`)** — sustituir el `as unknown` por `Table<T, number>` genérico, y extraer la constante `30.4375` a una única función local-time-aware. Eleva la calidad del codebase sin cambiar comportamiento, y arregla deriva de fechas en préstamos largos.

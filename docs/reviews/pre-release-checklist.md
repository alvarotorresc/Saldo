# Pre-Release Checklist — Saldo v0.2.0

Fuente del checklist: `~/.claude/plugins/cache/alvarotc/project-standards/1.0.0/standards/pre-release-checklist.md`.
Rellenado contra el estado de la branch `feat/redesign-v2-f15-reviews` tras F0→F14.

Leyenda: ✅ OK · ❌ FAIL · ⚠️ PARCIAL · 🟡 PENDIENTE USUARIO · N/A no aplica.

---

## Obligatorio

- **❌ Coverage ≥ 85% en todas las métricas** — falla. Módulos nuevos por debajo del umbral: `rules.ts` 52%, `lock.ts` 68%, `atRest.ts` 77%, `biometric.ts` 72%, `storage.ts` 78%. El agente `project-standards:testing` está generando el plan de tests para cubrirlo.
- **✅ Todos los tests pasan, ninguno skipped** — 303/303 verdes, 0 skipped.
- **✅ Security audit pasado** — `npm audit` reporta **0 vulnerabilidades** (total 415 deps: 27 prod + 373 dev + 78 optional + 7 peer). El agente `project-standards:security` completará OWASP básico.
- **N/A SQL queries parametrizadas** — Saldo usa Dexie/IndexedDB, no SQL.
- **✅ No hay secrets, keys o credenciales en el código** — grep sobre `src/**` con patrones comunes no encuentra literales. Master key y PIN se derivan del input del usuario; nunca hardcoded.
- **N/A Env vars validados con schema** — Saldo es local-first, no lee env vars en runtime. `vite.config.ts` y `capacitor.config.ts` son estáticos.
- **⚠️ Lint + format sin errores** — `npx prettier --check .` reporta 1 archivo mal formateado: `tailwind.config.js`. **Fix trivial** con `npx prettier --write tailwind.config.js`.
- **✅ TypeScript strict sin errores** — `tsc --noEmit` limpio.
- **✅ README actualizado** — reescrito en F14 con features v0.2, stack (Capacitor 8, jspdf 4, Dexie 4), secciones Datos/Import-Export/Seguridad/UX.
- **✅ CHANGELOG actualizado** — `CHANGELOG.md` creado en F14 con entrada exhaustiva v0.2.0 (pantallas reescritas, seguridad, breaking changes, deuda resuelta).

## Mobile adicional (Capacitor / Android)

- **🟡 Device testing Android real** — **pendiente tú**. Yo no tengo device. Capacitor 8 bump puede requerir Android Gradle Plugin 8.x y Java 17; flujos a validar: boot → setupPin → lock → unlock (incluyendo restauración desde snapshot cifrado) → biometría real con huella/face.
- **⚠️ Keystore configurado y en `.gitignore`** — ningún keystore presente en repo (no se va a firmar release ahora); `.gitignore` NO tiene una entrada explícita para `*.keystore` / `*.jks`. Propuesta: añadir `*.keystore` y `*.jks` a `.gitignore` como precaución para cuando llegue el release firmado.
- **N/A Screenshots + descripción Play Store** — v0.2.0 no es release de Play Store (es tag local según `feedback-ia-engineering.md` + regla de hosting del ecosistema). Aplica cuando v1.0.
- **N/A Privacy policy URL** — idem, aplica al publicar.
- **N/A `Appearance.setColorScheme`** — esta regla es de React Native. Saldo es web + Capacitor (no RN); no aplica.
- **N/A NativeWind Pressable sin function styles** — idem, no aplica.
- **N/A AAB format** — no release a Play Store.
- **N/A `versionCode` incrementado** — aplicará al firmar release; `android/app/build.gradle` se revisa al lado de tu device.

## Frontend adicional

- **⚠️ i18n completo (EN + ES)** — Saldo está **sólo en español**. Regla del ecosistema en `IDENTITY.md` debería confirmar si se acepta ES-only para v0.2. Propuesta: dejar ES-only para v0.2 y meter `en` en v0.3 (no bloqueante).
- **⚠️ Dark mode funcional** — Saldo es **dark-only por diseño** (estilo Terminal / Technical). No hay light mode y no está planeado. Aceptable como excepción documentada.
- **⚠️ Accesibilidad básica** — 59 ocurrencias de `aria-label` / `role=` en `src/`. No es audit completo pero hay cobertura. TopBarV2 tiene back button, PinPad tiene `role="status"` con label, tabs usan `role="tab"`, radios tienen `role="radio"`, el Sheet es `dialog`, Ring/Donut/Spark tienen `aria-hidden`. Faltan keyboard traps específicos en Sheets (el plugin Sheet ya gestiona Escape). El agente `code-review` cubre el audit detallado.
- **✅ Loading y error states en toda la app** — F9 entregó TerminalEmpty, TerminalLoading (spinner + checklist ✓/…/○/✗) y TerminalError. ErrorBoundary integra TerminalError. LockPage tiene countdown lockout; BiometricsPage tiene estado pending/error.
- **❌ Bundle size razonable (< 200 KB gzip para SPAs)** — **FALLA**. El bundle principal es **~267 KB gzip** (855 kB min). jspdf + html2canvas + purify meten ~100 KB gzip. **Fix obligatorio** antes del tag: dynamic `import()` de `ExportPage` + `buildPdf` y `html2canvas` para que solo se cargue cuando el usuario abre export. Esto recorta ~100 KB del chunk inicial y lo deja en el rango.

## Deploy adicional

- **⚠️ CI workflow validado completo** — `.github/workflows/ci.yml` existe pero solo corre `npm ci + typecheck + build`. **NO corre tests ni coverage ni prettier check**. Propuesta: extender CI a `npm test`, `npm run format:check` y al menos un coverage report. No bloqueante si pasa local, pero es deuda de CI trivial.
- **N/A Docker build** — Saldo es SPA + Capacitor, no backend.
- **N/A Environment variables documentadas** — sin env vars runtime.
- **⚠️ Plan de rollback definido** — implícito: como es local-first, rollback a versión anterior es `npm install && npm run dev` en el commit previo. Schema v6→v5 requiere el migrador Dexie que ya está. Propuesta: documentar 1-párrafo el downgrade path en `CHANGELOG.md`.
- **N/A Monitoring/health checks** — sin backend, sin monitoring.

---

## Resumen

- **Bloqueantes para tag v0.2.0** (obligatorios antes del tag):
  1. **Bundle size >200KB gzip** → dynamic `import()` de ExportPage.
  2. **Coverage <85% en módulos críticos** → completar tras ver propuesta del agente testing.
  3. **Format pendiente** → `npx prettier --write tailwind.config.js` (30s).

- **Mejoras recomendadas** (deberían ir al tag):
  - `.gitignore` con `*.keystore` / `*.jks`.
  - CI workflow con `npm test` + `npm run format:check`.
  - Documentar rollback de schema en CHANGELOG.

- **Post-tag / v0.3**:
  - i18n con idioma EN.
  - AAB + Play Store cuando decidas publicar.
  - E2E tests.

- **Pendiente del usuario** (no lo puedo ejecutar yo):
  - Device testing Android real con Capacitor 8.
  - Merge de las sub-branches a `feat/redesign-v2`.
  - Push + tag local + push del tag.

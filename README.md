# Saldo

> Control de gastos y ahorros, 100% local y privado.

[![CI](https://github.com/alvarotorresc/Saldo/actions/workflows/ci.yml/badge.svg)](https://github.com/alvarotorresc/Saldo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

![Home de Saldo](docs/screenshots/home.png)

## Qué es

App móvil (y web) para llevar tus finanzas sin ceder tus datos a nadie. Movimientos, categorías, presupuestos y metas viven en tu dispositivo — sin servidor, sin cuentas, sin tracking.

## Características

- Vista mensual con ingresos, gastos, tasa de ahorro y comparativa con el mes anterior.
- Importación de extractos CSV de **N26** y **BBVA** con detección automática de formato y deduplicación.
- Categorización por reglas y detección heurística de gastos recurrentes.
- Presupuestos mensuales por categoría.
- Metas de ahorro con fecha límite.
- Préstamos con tabla de amortización.
- Gráficas y forecast simple.
- Export/import de backup en JSON.

## Tech stack

- Vite + React + TypeScript
- Tailwind CSS 3
- Dexie (IndexedDB)
- Zustand (estado)
- Capacitor 7 (Android)

## Desarrollo local

### Requisitos

- Node.js >= 20
- npm

### Instalación

```bash
git clone https://github.com/alvarotorresc/Saldo.git
cd Saldo
npm install
npm run dev
```

## Scripts

| Comando                   | Descripción                           |
| ------------------------- | ------------------------------------- |
| `npm run dev`             | Servidor de desarrollo                |
| `npm run build`           | Build de producción                   |
| `npm run typecheck`       | Type checking con TypeScript          |
| `npm run cap:add:android` | Añadir proyecto Android (primera vez) |
| `npm run android:build`   | Build APK debug                       |

El APK generado queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Privacidad

Todos los datos viven en tu dispositivo (IndexedDB). Sin servidor, sin analytics, sin tracking.

## Licencia

MIT — ver [LICENSE](./LICENSE).

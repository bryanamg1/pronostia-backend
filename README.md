# PronostIA Backend

Backend de PronostIA para orquestar analisis prepartido de futbol, exponer una API REST y persistir resultados auditables.

## Estado

- Fase 0 completada con decision publica `CONDITIONAL GO` para API-Football.
- Fase 1 en implementacion sobre la fundacion del backend.
- No existen aun integraciones deportivas productivas, pronosticos ni OpenAI operativo.

## Stack

- JavaScript
- Node.js
- Express
- MySQL
- Winston
- node-cron
- Zod

## Arquitectura

El backend usa arquitectura por capas:

- `src/config`
- `src/domain`
- `src/application`
- `src/infrastructure`
- `src/presentation`
- `src/shared`

## Instalacion

```bash
npm install
cp .env.example .env
npm run check
```

## Variables de entorno principales

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `LOG_LEVEL`
- `TIMEZONE`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `SCHEDULER_ENABLED`
- `SCHEDULER_CRON`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`

## Scripts

- `npm run dev`
- `npm start`
- `npm test`
- `npm run test:coverage`
- `npm run lint`
- `npm run format:check`
- `npm run check`
- `npm run migrate`
- `npm run migrate:status`

## Health endpoints

- `GET /api/health`
- `GET /api/health/ready`

Documentacion publica: [docs/api/health-endpoints.md](./docs/api/health-endpoints.md)

## Migraciones

La infraestructura inicial de migraciones y la tabla `system_runs` se documentan en [docs/database/migrations.md](./docs/database/migrations.md).

## Seguridad de dependencias

El resultado publico de la auditoria de dependencias se resume en [docs/security/dependency-audit.md](./docs/security/dependency-audit.md).

## Discovery del proveedor

La evidencia publica de Fase 0 vive en:

- [docs/phase-0-provider-discovery.md](./docs/phase-0-provider-discovery.md)
- [docs/provider-discovery-matrix.csv](./docs/provider-discovery-matrix.csv)
- `scripts/discovery/`

## Blueprint oficial

El blueprint fuente de verdad del proyecto esta en [./blueprint-celula-hibrida.md](./blueprint-celula-hibrida.md).

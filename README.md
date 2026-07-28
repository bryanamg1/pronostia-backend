# PronostIA Backend

Backend de PronostIA para orquestar analisis prepartido de futbol, exponer una API REST y persistir resultados auditables.

## Estado

- Fase 0 completada con decision publica `CONDITIONAL GO` para API-Football.
- Fase 1 completada y fusionada en ramas estables.
- Fase 2 completada con cierre tecnico sobre ingesta deportiva acotada, cache historica y scheduler.
- Restriccion externa conocida: la cuenta API-Football Free validada no tiene acceso a `season=2026` para las ligas trianguladas; la evidencia real disponible en esta fase fue historica.
- No existen aun pronosticos, odds productivas ni OpenAI operativo.

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
- `SPORTS_API_PROVIDER`
- `SPORTS_API_BASE_URL`
- `SPORTS_API_KEY`
- `SPORTS_DEFAULT_SEASON`
- `SPORTS_API_MIN_INTERVAL_MS`
- `SPORTS_API_RETRY_AFTER_FALLBACK_MS`
- `SPORTS_API_SOFT_LIMIT_PERCENT`
- `SPORTS_SYNC_LOOKAHEAD_HOURS`
- `SPORTS_SYNC_MAX_FIXTURES`
- `SPORTS_SYNC_HISTORY_MAX_PAGES_PER_RUN`

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
- `npm run sync:sports`

## Health endpoints

- `GET /api/health`
- `GET /api/health/ready`

Documentacion publica: [docs/api/health-endpoints.md](./docs/api/health-endpoints.md)

## Sports endpoints

- `GET /api/competitions`
- `GET /api/fixtures/today`
- `GET /api/fixtures/:id`

Documentacion publica: [docs/api/sports-endpoints.md](./docs/api/sports-endpoints.md)
Documentacion operativa de ingesta/cache: [docs/sports-ingestion.md](./docs/sports-ingestion.md)

## Migraciones

La infraestructura de migraciones, `system_runs` y las tablas base de ingesta deportiva se documentan en [docs/database/migrations.md](./docs/database/migrations.md).

## Seguridad de dependencias

El resultado publico de la auditoria de dependencias se resume en [docs/security/dependency-audit.md](./docs/security/dependency-audit.md).

## Discovery del proveedor

La evidencia publica de Fase 0 vive en:

- [docs/phase-0-provider-discovery.md](./docs/phase-0-provider-discovery.md)
- [docs/provider-discovery-matrix.csv](./docs/provider-discovery-matrix.csv)
- `scripts/discovery/`

## Blueprint oficial

El blueprint fuente de verdad del proyecto esta en [./blueprint-celula-hibrida.md](./blueprint-celula-hibrida.md).

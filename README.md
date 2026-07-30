# PronostIA Backend

Backend de PronostIA para orquestar analisis prepartido de futbol, exponer una API REST y persistir resultados auditables.

## Estado

- Fase 0 completada con decision publica `CONDITIONAL GO` para API-Football.
- Fase 1 completada y fusionada en ramas estables.
- Fase 2 completada con cierre tecnico sobre ingesta deportiva acotada, cache historica y scheduler.
- Fase 3 completada tecnicamente con motor estadistico determinista y evaluacion historica real sobre Premier League 2024.
- Fase 4 completada tecnicamente con persistencia de odds, scoring determinista, endpoints de predicciones y validacion empirica controlada sobre una muestra real de API-Football.
- Fase 5 completada tecnicamente con explicaciones opcionales OpenAI, validacion estructurada, presupuesto mensual, ledger de coste y fallback determinista sobre predicciones ya persistidas.
- Restriccion externa conocida: la cuenta API-Football Free validada no tiene acceso a `season=2026` para las ligas trianguladas; la evidencia real disponible en esta fase fue historica.
- OpenAI no recalcula probabilidades ni recomendaciones; solo puede seleccionar explicaciones estructuradas a partir de hechos ya calculados.

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
- `ADMIN_API_TOKEN`
- `ADMIN_RATE_LIMIT_WINDOW_MS`
- `ADMIN_RATE_LIMIT_MAX_REQUESTS`
- `OPENAI_API_KEY`
- `OPENAI_ENABLED`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_MONTHLY_BUDGET_USD`
- `OPENAI_MONTHLY_ALERT_PERCENT`
- `OPENAI_MONTHLY_DEGRADED_PERCENT`
- `OPENAI_HARD_LIMIT_PERCENT`
- `OPENAI_TIMEOUT_MS`
- `OPENAI_INPUT_COST_USD_PER_1M_TOKENS`
- `OPENAI_CACHED_INPUT_COST_USD_PER_1M_TOKENS`
- `OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS`

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
- `npm run sync:sports:history -- --competition=premier-league --season=2024`
- `npm run model:predict -- --fixtureId=<id>`
- `npm run model:score -- --fixtureId=<id>`
- `npm run model:explain -- --predictionId=<id>`
- `npm run model:evaluate -- --competition=premier-league --season=2024`

## Health endpoints

- `GET /api/health`
- `GET /api/health/ready`

Documentacion publica: [docs/api/health-endpoints.md](./docs/api/health-endpoints.md)

## Sports endpoints

- `GET /api/competitions`
- `GET /api/fixtures/today`
- `GET /api/fixtures/:id`
- `GET /api/predictions/today`
- `GET /api/predictions/top`
- `GET /api/predictions/:id`
- `GET /api/system/runs/latest`
- `POST /api/admin/odds/manual`
- `POST /api/admin/predictions/:id/explanation`
- `POST /api/admin/predictions/explanations/today`

Documentacion publica: [docs/api/sports-endpoints.md](./docs/api/sports-endpoints.md)
Endpoints admin de explicaciones: [docs/api/admin-prediction-explanations.md](./docs/api/admin-prediction-explanations.md)
Documentacion operativa de ingesta/cache: [docs/sports-ingestion.md](./docs/sports-ingestion.md)

Los endpoints publicos de predicciones para dashboard y detalle exponen un DTO saneado y enriquecido con:

- datos basicos del fixture y competencia;
- version de modelo;
- `modelProbability`, `marketProbability`, `edgePp`, `confidenceScore`, `riskLevel`, `recommendation`;
- analisis determinista de solo lectura (`expectedGoals`, `probabilities`, `dataQuality`);
- explicacion persistida saneada (`status`, `source`, `generatedAt`, `summary`, factores, avisos).

No exponen metadata interna de OpenAI, presupuestos, usage, tokens ni request ids de proveedor.

## Migraciones

La infraestructura de migraciones, `system_runs` y las tablas base de ingesta deportiva se documentan en [docs/database/migrations.md](./docs/database/migrations.md).

## Modelo estadistico

La documentacion tecnica del motor determinista y su modo historico vive en:

- [docs/statistical-model.md](./docs/statistical-model.md)
- [docs/model-evaluation.md](./docs/model-evaluation.md)

La salida de scoring con odds y reglas de abstencion queda documentada en:

- [docs/statistical-model.md](./docs/statistical-model.md)
- [docs/api/sports-endpoints.md](./docs/api/sports-endpoints.md)

La capa explicativa de Fase 5 agrega:

- explicacion estructurada persistida dentro de cada `prediction`;
- presupuesto mensual con alerta al `70 %`, modo degradado al `85 %` y bloqueo al `100 %`;
- fallback determinista cuando OpenAI no esta configurado, falla, devuelve una salida invalida o queda bloqueado por presupuesto;
- validacion posterior con allowlist cerrada y descarte automatico de contenido no permitido.

La fase quedo cerrada con una validacion real controlada sobre una prediccion elegible persistida, sin modificar la probabilidad estadistica ni la recomendacion original.

Documentacion especifica:

- [docs/openai-explanations.md](./docs/openai-explanations.md)
- [docs/api/admin-prediction-explanations.md](./docs/api/admin-prediction-explanations.md)

## Seguridad de dependencias

El resultado publico de la auditoria de dependencias se resume en [docs/security/dependency-audit.md](./docs/security/dependency-audit.md).

## Discovery del proveedor

La evidencia publica de Fase 0 vive en:

- [docs/phase-0-provider-discovery.md](./docs/phase-0-provider-discovery.md)
- [docs/provider-discovery-matrix.csv](./docs/provider-discovery-matrix.csv)
- `scripts/discovery/`

## Blueprint oficial

El blueprint fuente de verdad del proyecto esta en [./blueprint-celula-hibrida.md](./blueprint-celula-hibrida.md).

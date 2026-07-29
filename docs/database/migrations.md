# Database Migrations

## Requisitos

Configurar MySQL localmente y completar estas variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

## Ejecutar migraciones

```bash
npm run migrate
```

## Consultar estado

```bash
npm run migrate:status
```

## Importar historia real controlada

```bash
npm run sync:sports:history -- --competition=premier-league --season=2024
```

Este flujo reutiliza un payload local ignorado por Git cuando existe. Si no existe, realiza una sola consulta controlada a API-Football para `league=39`, `season=2024`, `status=FT`, conserva el payload localmente y luego ejecuta upserts cronologicos idempotentes.

Si la configuracion de MySQL no esta completa o las credenciales no son validas, el comando responde con un resultado controlado o un error sanitizado. No se deben publicar credenciales ni connection strings completas.

## Tablas gestionadas actualmente

- `system_runs`
- `competitions`
- `teams`
- `fixtures`
- `sports_sync_state`
- `model_versions`
- `historical_predictions`
- `model_evaluations`
- `odds`
- `analysis_runs`
- `predictions`
- `manual_odds_audit`

## Alcance actual

- `system_runs` registra la ejecucion preparada y el cierre del scheduler.
- `competitions` persiste el catalogo autorizado sincronizado contra API-Football.
- `teams` mantiene el cache persistente minimo de equipos observados en fixtures.
- `fixtures` concentra tanto la ventana diaria como el historico por temporada que se vaya backfilleando de forma incremental.
- `sports_sync_state` guarda checkpoints durables para evitar rehacer paginas historicas ya sincronizadas.
- `model_versions` versiona parametros reproducibles del motor estadistico.
- `historical_predictions` persiste predicciones historicas auditables con su cutoff temporal.
- `model_evaluations` registra metricas agregadas de backtesting cronologico por competicion y temporada.
- `odds` persiste snapshots de cuotas por fixture, bookmaker, mercado, seleccion y origen (`API` o `MANUAL`).
- `analysis_runs` reserva el estado agregable de futuras corridas diarias de analisis.
- `predictions` persiste scoring prepartido con `edge_pp`, `confidence_score`, `risk_level` y `recommendation`.
- `manual_odds_audit` registra cambios manuales de cuotas sin exponer secretos.

## Revertir

La infraestructura de migraciones inicial define una operacion `down` para revertir `system_runs` cuando resulte razonable y seguro usarla desde una sesion controlada.

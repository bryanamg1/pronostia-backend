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

## Alcance actual

- `system_runs` registra la ejecucion preparada y el cierre del scheduler.
- `competitions` persiste el catalogo autorizado sincronizado contra API-Football.
- `teams` mantiene el cache persistente minimo de equipos observados en fixtures.
- `fixtures` concentra tanto la ventana diaria como el historico por temporada que se vaya backfilleando de forma incremental.
- `sports_sync_state` guarda checkpoints durables para evitar rehacer paginas historicas ya sincronizadas.
- `model_versions` versiona parametros reproducibles del motor estadistico.
- `historical_predictions` persiste predicciones historicas auditables con su cutoff temporal.
- `model_evaluations` registra metricas agregadas de backtesting cronologico por competicion y temporada.

## Revertir

La infraestructura de migraciones inicial define una operacion `down` para revertir `system_runs` cuando resulte razonable y seguro usarla desde una sesion controlada.

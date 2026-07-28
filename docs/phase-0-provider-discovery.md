# Fase 0 - Discovery y validacion de proveedor

## Estado

Completada a nivel de discovery empirico y documentacion. La rama `bryan/docs/provider-discovery` contiene la evidencia de proveedor, el cierre presupuestario y la decision de Fase 0.

## Objetivo

Validar si API-Football puede sostener el MVP de PronostIA sin acoplar la arquitectura al proveedor y sin violar las restricciones de costo, cobertura y auditabilidad definidas en el blueprint.

## Alcance

- Verificar documentacion oficial publica y condiciones actuales del proveedor.
- Confirmar que las 11 competiciones objetivo figuran en la cobertura publica.
- Preparar scripts locales para descubrir:
  - ids de competiciones;
  - temporadas disponibles;
  - cobertura por liga/temporada;
  - disponibilidad de fixtures;
  - disponibilidad de estadisticas;
  - disponibilidad de odds;
  - bookmakers disponibles;
  - presencia o ausencia real de Bet365 y Betano.
- Estimar consumo de requests por corrida y por dia mediante escenarios conservadores.
- Registrar riesgos, bloqueos y criterio go/no-go.

## Repositorio afectado

- `pronostia-backend`

## Rama

- `bryan/docs/provider-discovery`

## Archivos previstos en esta fase

- `docs/phase-0-provider-discovery.md`
- `docs/provider-discovery-matrix.csv`
- `scripts/discovery/validate-api-football.js`
- `scripts/discovery/estimate-request-budget.js`

## Migraciones

- Ninguna.

## Endpoints productivos

- Ninguno.

## Variables de entorno utilizadas por discovery

- `SPORTS_API_KEY`
- `SPORTS_API_BASE_URL`
- `SPORTS_API_PROVIDER`
- `SPORTS_API_MIN_INTERVAL_MS`
- `DISCOVERY_SMOKE_TEST`
- `SPORTS_API_SOFT_LIMIT_PERCENT`

## Dependencias

- Ninguna dependencia adicional.
- Scripts preparados con APIs nativas de Node.js para respetar el alcance de la fase.

## Fuentes oficiales verificadas

### API-Football

- Pricing oficial: https://www.api-football.com/pricing
- Coverage oficial: https://www.api-football.com/coverage
- Documentacion v3: https://www.api-football.com/documentation-v3
- Tutorial oficial de optimizacion de cuota: https://www.api-football.com/news/post/how-to-optimize-api-sports-calls-and-quota-usage
- Tutorial oficial de inicio: https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide

### OpenAI

- Model reference: https://platform.openai.com/docs/api-reference/models/object
- GPT-5 mini model page: https://developers.openai.com/api/docs/models/gpt-5-mini
- GPT-5 developer announcement: https://openai.com/index/introducing-gpt-5-for-developers/

## Hallazgos publicos verificados

### API-Football

- A fecha de verificacion local, API-Football publica documentacion `v3.9.3`.
- Evidencia empirica local confirmada:
  - `SPORTS_API_KEY` valida;
  - endpoint `/status` con `HTTP 200`;
  - plan observado: `Free`;
  - consumo observado: `10/100` requests;
  - causa de fallo observada en la validacion inicial: `HTTP 429` por limite de requests por minuto.
- Evidencia empirica local posterior al ajuste de pacing:
  - smoke test completado con `5` llamadas HTTP;
  - intervalos observados entre llamadas: aproximadamente `7001-7011 ms`;
  - cero respuestas `HTTP 429`;
  - clave redactada correctamente en logs;
  - checkpoint local creado;
  - pasos guardados en checkpoint:
    - `seasons`;
    - `bookmakers`;
    - `bets`;
  - catalogo de `/odds/bookmakers`: `32` bookmakers;
  - `/odds/bets`: `338` registros;
  - Bet365 listado en el catalogo general;
  - Betano listado en el catalogo general.
- El pricing publico muestra:
  - Free: `100 requests/day`
  - Pro: `7,500 requests/day`
  - Ultra: `75,000 requests/day`
  - Mega: `150,000 requests/day`
- El sitio publica que todos los planes incluyen todas las competiciones y endpoints, con la salvedad de que el plan free limita temporadas disponibles.
- El coverage oficial publica `1235 Leagues & Cups` y advierte que la cobertura puede variar por temporada o fixture.
- La documentacion oficial indica que `/leagues` devuelve `coverage` por competicion y temporada.
- La misma documentacion advierte que:
  - valores `true` en `coverage` no garantizan disponibilidad al 100 %;
  - una competicion que aun no empezo puede devolver capacidades en `false`;
  - los torneos de copa agregan fixtures a medida que se conocen los cruces.
- `odds` pre-match:
  - disponibles entre `1` y `14` dias antes del partido;
  - historial retenido: `7` dias;
  - actualizacion: cada `3` horas;
  - paginacion: `10` resultados por pagina.
- `/odds/bookmakers`, `/odds/bets` y `/odds/live/bets` deben tratarse como endpoints de referencia y cachearse.
- `/teams/statistics` existe y permite consultar estadisticas de un equipo para una liga y temporada dadas.

### OpenAI

- El uso de OpenAI sigue siendo exclusivamente para explicaciones estructuradas, no para calcular probabilidades.
- El endpoint oficial `/v1/models` sigue siendo la referencia para listar modelos realmente disponibles por cuenta.
- La pagina oficial de `gpt-5-mini` indica soporte para `Structured outputs`.
- La comunicacion oficial de OpenAI para desarrolladores indica precios publicos de `gpt-5-mini` de:
  - input: `USD 0.25 / 1M tokens`
  - output: `USD 2.00 / 1M tokens`

## Resultado empirico de la corrida completa

Ejecucion autorizada:

```bash
SPORTS_API_MIN_INTERVAL_MS=7000 node --env-file=.env ./scripts/discovery/validate-api-football.js
```

Resultado observado el 28 de julio de 2026:

- duracion aproximada: `5m 16s`;
- llamadas HTTP emitidas: `46`;
- rate limiting: `0` respuestas `HTTP 429`;
- checkpoint reutilizado:
  - `seasons`
  - `bookmakers`
  - `bets`
- nuevos checkpoints creados:
  - once competiciones objetivo;
- cuota inicial: `13/100`;
- cuota final: `22/100`;
- delta observado por `/status`: `9`;
- consumo local conservador: `46`;
- `effectiveEstimatedRemaining`: `32`;
- `quotaObservationStatus`: `EVENTUAL_OR_INCONSISTENT`;
- `quotaConfidence`: `MEDIUM`.

Interpretacion:

- la cuota diaria del cuerpo `/status` es confiable como fuente primaria;
- los headers siguen siendo evidencia secundaria y no monotona;
- el consumo local debe mantenerse como guardrail conservador.

## Competencias objetivo y estado actual

El archivo `docs/provider-discovery-matrix.csv` contiene la matriz final empirica por competicion.

Resumen ejecutivo:

- las `11` competiciones fueron resueltas a `leagueId` valido y `season=2026`;
- ninguna devolvio fixture de evidencia en la ventana `next=1` al momento de la validacion;
- por lo tanto ninguna competencia puede marcarse `VERIFIED`;
- todas quedan en estado `PARTIAL`;
- Bet365 y Betano siguen `INCONCLUSIVE` a nivel fixture porque no hubo muestra real de odds.

IDs verificados:

- La Liga: `140`
- Premier League: `39`
- Ligue 1: `61`
- Serie A (Italia): `135`
- Bundesliga: `78`
- Liga Profesional Argentina: `128`
- Brasileirao Serie A: `71`
- UEFA Champions League: `2`
- UEFA Europa League: `3`
- CONMEBOL Libertadores: `13`
- CONMEBOL Sudamericana: `11`

## Estimacion de requests

La estimacion detallada se genera con `scripts/discovery/estimate-request-budget.js`.

Escenarios modelados:

- jornada sin partidos;
- primera ejecucion de desarrollo con `10` fixtures y sin cache;
- ejecucion posterior con cache para `10`, `20` y `40` fixtures;
- escenario naive diario de `40` fixtures;
- escenario optimizado diario de `40` fixtures;
- escenario maximo diario de `40` fixtures con buffer de reintentos.

Conclusiones de presupuesto:

- discovery de Fase 0:
  - compatible con plan free;
- desarrollo y smoke tests:
  - viables en free plan con pacing y checkpoint;
- piloto de bajo volumen:
  - posible solo con cache fuerte y recorte de refrescos;
- operacion diaria normal:
  - riesgosa en free plan;
- operacion diaria de hasta `40` fixtures:
  - no viable de forma consistente en free plan, incluso con optimizacion agresiva.

## Estrategia de cache propuesta

| Tipo de dato | Persistencia | TTL | Invalida cuando | Reutilizacion | Costo aproximado |
|---|---|---|---|---|---|
| Competitions e IDs | DB/cache persistente | 30 dias | cambio de temporada o proveedor | muy alta | 1 request por lookup puntual |
| Temporadas globales | cache persistente | 30 dias | inicio de nueva temporada o drift del proveedor | muy alta | 1 request |
| Teams por liga/temporada | DB/cache persistente | 7 dias | nueva temporada o equipos faltantes | alta | 1 request por liga/temporada |
| Fixtures del dia | cache operativa | 15 min | cambio de ventana, kickoff cercano o status change | media | 1 request por competicion activa |
| Standings | cache operativa | 12 h | nueva jornada o cambio de tabla | alta | 1 request por competicion activa |
| Historicos cerrados | DB persistente | sin TTL duro | solo backfill/correccion | muy alta | costo inicial de ingesta |
| Team statistics agregadas | DB persistente | 24 h | nuevo partido cerrado o recalculo | alta | 1 request por equipo refrescado |
| Fixture statistics | cache/DB | 24 h tras cierre | fixture terminado o cambio de fuente | media | 1 request por fixture |
| Odds pre-match | DB persistente | 3 h antes de kickoff y congelar snapshot | nueva captura o cierre de ventana | media | 1 request por fixture/pagina |
| Bookmakers | cache persistente | 30 dias | drift del catalogo | muy alta | 1 request |
| Markets (`/odds/bets`) | cache persistente | 30 dias | drift del catalogo | muy alta | 1 request |

## Estrategia de degradacion propuesta

- Si no hay fixtures elegibles: terminar corrida sin invocar OpenAI.
- Si aparece `HTTP 429` por limite por minuto:
  - ejecutar todas las solicitudes de discovery de forma secuencial;
  - respetar `Retry-After`;
  - si el header no existe, esperar `65000 ms`;
  - reintentar como maximo dos veces;
  - detener la corrida de discovery de forma controlada si el 429 persiste.
- Si la cobertura de odds es insuficiente para una competicion:
  - permitir analisis sin recomendacion;
  - admitir carga manual de Betano en fases posteriores.
- Si se alcanza el soft limit del proveedor:
  - priorizar fixtures dentro de las proximas 24 horas;
  - saltar refresh no criticos;
  - reutilizar cache.
- Si el plan free no alcanza aun con cache:
  - documentar no-go para operacion diaria completa sobre free plan;
  - promover decision humana entre upgrade a Pro o ajuste de alcance.

Umbrales operativos propuestos:

- al `70 %` de cuota:
  - priorizar fixtures de la ventana inmediata;
  - reutilizar standings, teams y referencias cacheadas;
  - omitir refrescos no criticos;
  - no invocar OpenAI si no hay analisis valido;
- al `85 %` de cuota:
  - detener enriquecimientos secundarios;
  - limitar analisis a fixtures ya materializados en cache;
  - deshabilitar nuevas capturas de odds no esenciales;
  - conservar resultados parciales y cerrar corrida;
- al `100 %` de cuota:
  - bloquear nuevas llamadas externas;
  - finalizar de forma controlada;
  - registrar abstenciones y evidencia disponible;
  - no generar explicaciones.

## Observabilidad de cuota

Fuente primaria:

- cuerpo del endpoint `/status`, usando:
  - `response.subscription.plan`
  - `response.requests.current`
  - `response.requests.limit_day`

Fuente secundaria:

- headers sanitizados de respuesta, especialmente:
  - `x-ratelimit-requests-limit`
  - `x-ratelimit-requests-remaining`

Reglas:

- no usar headers como unica fuente de cuota diaria;
- mantener contador local de llamadas HTTP emitidas;
- clasificar la observacion como `EVENTUAL_OR_INCONSISTENT` si `/status` no refleja inmediatamente el consumo o si los headers no son monotonicamente decrecientes;
- calcular de forma conservadora:

```text
effectiveEstimatedRemaining =
min(
  remaining reportado o derivado del estado conocido,
  knownDailyLimit - (knownCurrentUsage + locallyEstimatedConsumption)
)
```

- `quotaConfidence`:
  - `HIGH`: datos del cuerpo consistentes con el consumo observado;
  - `MEDIUM`: datos del cuerpo validos pero con comportamiento eventual o headers inconsistentes;
  - `LOW`: falta algun dato del cuerpo y se requiere apoyo de headers.

## Bookmakers: catalogo vs disponibilidad real

Debe distinguirse entre:

1. presencia en `/odds/bookmakers`;
2. disponibilidad real para un fixture;
3. disponibilidad real para una competicion concreta;
4. disponibilidad para los mercados MVP.

Estado actual confirmado:

- Bet365:
  - `catalogListed = true`
  - `fixtureAvailability = INCONCLUSIVE`
  - `competitionAvailability = INCONCLUSIVE`
  - `mvpMarketAvailability = INCONCLUSIVE`
- Betano:
  - `catalogListed = true`
  - `fixtureAvailability = INCONCLUSIVE`
  - `competitionAvailability = INCONCLUSIVE`
  - `mvpMarketAvailability = INCONCLUSIVE`

No deben marcarse como totalmente verificados hasta consultar cuotas reales por fixture.

## Riesgos tecnicos confirmados

- El plan free de `100 requests/day` es estrecho para una corrida diaria de hasta 40 partidos si se consulta estadistica de equipos y odds sin cache historica fuerte.
- La cobertura publica no basta para afirmar ids, temporadas ni disponibilidad real por bookmaker.
- La ventana de historial de odds de solo `7` dias obliga a capturar y persistir odds localmente; no se pueden reconstruir despues.
- Bet365 y Betano no pueden declararse disponibles hasta ejecutar `/odds/bookmakers` con credenciales.
- Los flags `coverage` pueden devolver `false` antes del inicio de temporada aunque la liga exista en catalogo.

## Bloqueos y limitaciones vigentes

- La validacion completa no encontro fixtures inmediatos (`next=1`) para las once competiciones en la ventana observada.
- Sin fixture de evidencia:
  - no se pudo probar disponibilidad real de odds por fixture;
  - no se pudo confirmar mercados MVP en muestras reales;
  - no se pudo ejecutar `/teams/statistics` por ausencia de team ids en `teamsProbe`.
- La lista de temporadas historicas por competicion no fue persistida en el primer diseño del checkpoint y queda como limitacion de esta corrida.
- El free plan sirve para discovery y desarrollo acotado, pero no alcanza como conclusion de produccion diaria.

## Decision de Fase 0

Decision: `CONDITIONAL GO`

Justificacion:

- GO porque:
  - las once competiciones objetivo existen y fueron resueltas con `leagueId` y temporada vigentes;
  - el proveedor soporta integracion desacoplada por adaptadores;
  - no se requiere scraping;
  - hay catalogo real de bookmakers y mercados;
  - Bet365 y Betano existen en el catalogo general;
  - la arquitectura puede avanzar sin casar el dominio a la API.
- CONDITIONAL porque:
  - no hubo fixture real para validar odds por fixture ni mercados MVP observados;
  - Bet365 y Betano siguen `INCONCLUSIVE` a nivel fixture/competicion;
  - el free plan no es suficiente para una operacion diaria de `40` partidos;
  - la cobertura historica minima para Elo/Poisson debe validarse en F2 con ingesta y cache reales.

Condiciones necesarias para avanzar:

1. Mantener proveedores desacoplados mediante contratos estables.
2. Implementar cache persistente antes de cualquier piloto operativo.
3. Tratar Betano manual como fallback del MVP hasta observar fixture-level odds reales.
4. No asumir free plan como capacidad productiva para `40` fixtures.
5. Volver a validar odds y mercados MVP cuando exista un fixture real en la ventana de analisis.

## Criterio go/no-go de esta fase

### Go

- ids y temporadas verificados por script;
- mas del 50 % de las competiciones con cobertura util para fixtures e historicos minimos;
- odds utilizables para mercados MVP o fallback manual viable;
- requests compatibles con cache demostrada o con upgrade aceptado.

### No-go

- cobertura util por debajo del umbral del blueprint;
- imposibilidad de verificar ligas y temporadas objetivo;
- dependencia practica de scraping;
- consumo inviable en operacion diaria sin una mitigacion aprobada.

## Comandos previstos

```powershell
node .\scripts\discovery\estimate-request-budget.js
node .\scripts\discovery\validate-api-football.js
DISCOVERY_SMOKE_TEST=true SPORTS_API_MIN_INTERVAL_MS=7000 node .\scripts\discovery\validate-api-football.js
DISCOVERY_DRY_RUN=true node .\scripts\discovery\validate-api-football.js
```

## Evidencia operativa y controles agregados

- Discovery HTTP completamente secuencial.
- `SPORTS_API_MIN_INTERVAL_MS` configurable; default `7000 ms`.
- Sin `Promise.all` ni solicitudes paralelas.
- Lectura de `Retry-After`.
- Fallback a `65000 ms` si `Retry-After` no existe.
- Maximo de dos reintentos ante `HTTP 429`.
- Checkpoint local ignorado por Git para no repetir pasos exitosos.
- `DISCOVERY_SMOKE_TEST=true` para modo reducido.
- `DISCOVERY_DRY_RUN=true` para preflight sin llamadas externas.
- Tests simulados con `node:test`, sin consumo de API real.

## Formato de salida relevante

### Estado parseado del proveedor

```json
{
  "plan": "Free",
  "current": 10,
  "limitDay": 100,
  "remaining": 90,
  "warnings": []
}
```

### Observabilidad de cuota

```json
{
  "statusCurrentInitial": 10,
  "statusCurrentFinal": 10,
  "observedStatusDelta": 0,
  "headerRemainingObservations": [90, 88, 87, 89, 90],
  "locallyEstimatedConsumption": 5,
  "quotaObservationStatus": "EVENTUAL_OR_INCONSISTENT",
  "quotaConfidence": "MEDIUM",
  "effectiveEstimatedRemaining": 85
}
```

### Preflight sin red

```json
{
  "checkpointSteps": 3,
  "estimatedReusedCalls": 3,
  "estimatedNewCalls": 57,
  "estimatedMaximumCalls": 59,
  "knownDailyLimit": 100,
  "knownCurrentUsage": 10,
  "softLimit": 70,
  "safeToRun": true
}
```

## Resultado esperado al cerrar Fase 0

Entregables logrados:

- ids oficiales por competicion;
- temporadas vigentes verificadas;
- matriz empirica de cobertura con evidencia;
- lista real de bookmakers;
- catalogo real de Bet365 y Betano;
- estimacion final de requests;
- decision final `CONDITIONAL GO`.

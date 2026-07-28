# Fase 0 - Discovery y validacion de proveedor

## Estado

En curso. Esta fase deja evidencia publica verificada, scripts de validacion y una matriz inicial de descubrimiento.

La validacion empirica esta parcialmente habilitada. Ya existe evidencia local de autenticacion y cuota, pero la validacion completa no debe ejecutarse en rafaga.

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

## Competencias objetivo y estado actual

El archivo `docs/provider-discovery-matrix.csv` deja la lista canonica de competiciones del MVP y su estado de verificacion.

Por evidencia publica, todas las competiciones objetivo figuran listadas en la pagina oficial de coverage. Lo que sigue pendiente es su validacion por:

- `league_id` real;
- temporada vigente util;
- cobertura efectiva de odds;
- cobertura efectiva de statistics;
- disponibilidad concreta de fixtures de las proximas 24 horas;
- bookmakers reales devueltos por `/odds/bookmakers`.

## Estimacion de requests

La estimacion detallada se genera con `scripts/discovery/estimate-request-budget.js`.

Resumen actual:

- Descubrimiento inicial de ligas/bookmakers/bets:
  - compatible con plan free si se ejecuta de forma acotada.
- Corrida diaria naive sin cache historica:
  - alta probabilidad de exceder `100 requests/day`.
- Corrida diaria con cache historica agresiva y refresh limitado:
  - potencialmente compatible con `100 requests/day`, pero requiere demostracion empirica en F2.

## Estrategia de cache propuesta

- Cache casi estatico:
  - `/odds/bookmakers`
  - `/odds/bets`
  - `/leagues/seasons`
- Cache diario:
  - `/leagues`
  - `/teams`
- Cache historico persistente:
  - fixtures cerrados;
  - resultados;
  - team statistics por liga/temporada/fecha de corte;
  - odds pre-match capturadas antes de vencer la ventana de 7 dias.

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

## Riesgos tecnicos confirmados

- El plan free de `100 requests/day` es estrecho para una corrida diaria de hasta 40 partidos si se consulta estadistica de equipos y odds sin cache historica fuerte.
- La cobertura publica no basta para afirmar ids, temporadas ni disponibilidad real por bookmaker.
- La ventana de historial de odds de solo `7` dias obliga a capturar y persistir odds localmente; no se pueden reconstruir despues.
- Bet365 y Betano no pueden declararse disponibles hasta ejecutar `/odds/bookmakers` con credenciales.
- Los flags `coverage` pueden devolver `false` antes del inicio de temporada aunque la liga exista en catalogo.

## Bloqueos vigentes

- La credencial ya no es el bloqueo principal.
- El bloqueo actual es operativo:
  - falta completar la validacion autentica con pacing secuencial y checkpoint local;
  - siguen pendientes:
    - ids verificados;
    - temporadas verificadas;
    - bookmakers disponibles completos;
    - disponibilidad real de Bet365 y Betano;
    - probes de fixtures, team statistics y odds.

## Decision provisional de proveedor

- Candidato actual: `API-Football`.
- Estado de la decision: `pendiente de validacion empirica`.

No existe decision final de go/no-go todavia porque faltan pruebas autenticadas contra el proveedor.

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
- Tests simulados con `node:test`, sin consumo de API real.

## Resultado esperado al cerrar Fase 0

Una vez provista la credencial local, esta fase debe cerrar con:

- ids oficiales por competicion;
- temporadas vigentes verificadas;
- matriz de cobertura con evidencia;
- lista real de bookmakers;
- confirmacion o descarte de Bet365 y Betano;
- estimacion final de requests;
- recomendacion final de proveedor.

# Statistical Model

## Objetivo

La Fase 3 implementa un motor estadistico determinista, reproducible y testeable para transformar fixtures historicos persistidos en probabilidades prepartido.

La estrategia activa es `HISTORICAL_FIRST_HYBRID_STRATEGY`.

## Entradas

- fixtures historicos persistidos en MySQL;
- goles reales;
- condicion local o visitante;
- promedios de competicion;
- forma reciente ponderada;
- rating Elo por equipo y competicion.

El motor no depende de xG externos y no consume OpenAI.

## Componentes

### Elo

- rating inicial configurable;
- factor K configurable;
- ventaja de localia configurable;
- actualizacion cronologica obligatoria;
- regresion entre temporadas configurable;
- versionado de parametros.

### Poisson

- expected goals local y visitante a partir de fortalezas ofensivas y defensivas;
- distribucion de goles;
- matriz de marcadores;
- probabilidades 1X2;
- over/under 2.5;
- BTTS;
- double chance derivada de 1X2.

### Forma reciente

- ventana configurable;
- pesos decrecientes por recencia;
- puntos ponderados;
- goles a favor y en contra;
- home form y away form;
- ajuste ligero por fuerza aproximada del rival mediante Elo.

## Combinacion

Los pesos iniciales de mezcla se clasifican como `INITIAL_HEURISTIC_WEIGHTS`.

Estos pesos:

- suman `1`;
- son validados;
- quedan versionados junto con el modelo;
- no se presentan como optimos.

La combinacion mezcla senales direccionales de Poisson, Elo y forma reciente antes de derivar los mercados desde la matriz Poisson final.

## Salidas

Salida minima por fixture:

- version del modelo;
- cutoff historico;
- expected goals local y visitante;
- probabilidades `homeWin`, `draw`, `awayWin`;
- probabilidades `over25`, `under25`;
- probabilidades `bttsYes`, `bttsNo`;
- probabilidades `doubleChance1X`, `doubleChanceX2`, `doubleChance12`;
- estado y flags de data quality.

## Prevencion de leakage

- solo se usan partidos anteriores al kickoff del fixture evaluado;
- fixtures con el mismo kickoff se ordenan por `fixture_id` ascendente;
- no se usa el resultado del fixture objetivo en su propia prediccion;
- no se usan standings ni agregados futuros;
- el cutoff queda persistido junto con la prediccion historica.

## Limitaciones

- la cuenta actual de API-Football Free no valida `season=2026` en las ligas trianguladas;
- esta fase opera en modo historico y no debe presentar datos historicos como partidos futuros;
- no incluye odds, implied probability, edge ni recomendaciones de apuestas;
- no incluye OpenAI.

## Validacion historica real

La validacion empirica final de Fase 3 se ejecuto sobre:

- competicion: Premier League;
- leagueId: `39`;
- season: `2024`;
- dataset real recibido: `380` fixtures `FT`;
- fixtures persistidas en cache local: `380`;
- warm-up cronologico: `30` fixtures excluidas por muestra previa insuficiente;
- fixtures evaluadas: `350`;
- cobertura: `92.11%`.

Parametros usados en la evaluacion real:

- `modelVersion`: `historical-first-v1`;
- `INITIAL_HEURISTIC_WEIGHTS`: `poisson=0.60`, `elo=0.25`, `form=0.15`;
- `minSamplesPerTeam`: `3`;
- `minFixturesForEvaluation`: `20`;
- orden temporal: `kickoff_at ASC`, desempate por `fixture_id ASC`.

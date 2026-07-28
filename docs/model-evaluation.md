# Model Evaluation

## Alcance

La evaluacion inicial del modelo es cronologica y exclusivamente historica.

No utiliza ROI porque en esta fase no existen cuotas historicas validadas.

## Metricas

- accuracy `1X2`;
- log loss `1X2`;
- Brier score `1X2`;
- accuracy over/under `2.5`;
- Brier score over/under `2.5`;
- accuracy BTTS;
- Brier score BTTS;
- cobertura del modelo;
- fixtures excluidos y motivo.

## Persistencia

La fase persiste:

- `model_versions`;
- `historical_predictions`;
- `model_evaluations`.

Cada prediccion historica conserva su `cutoff_at` para auditoria temporal.

## Comandos

Evaluar una competicion historica persistida:

```bash
npm run model:evaluate -- --competition=premier-league --season=2024
```

Generar una prediccion historica para un fixture persistido:

```bash
npm run model:predict -- --fixtureId=1
```

## Estados de salida esperados

- `ok`: la evaluacion o prediccion se ejecuto correctamente;
- `not_found`: la competicion o fixture solicitado no existe en cache local;
- `insufficient_persisted_history`: no hay suficientes fixtures historicos persistidos para calcular metricas reales sin inventarlas.

## Resultado real de referencia

Evaluacion real ejecutada sobre Premier League `2024`:

- fixtures persistidas: `380`;
- warm-up: `30`;
- fixtures evaluadas: `350`;
- cobertura: `92.11%`;
- `modelVersion`: `historical-first-v1`;
- `accuracy 1X2`: `0.4829`;
- `log loss 1X2`: `1.0580`;
- `Brier 1X2`: `0.6371`;
- `accuracy over/under 2.5`: `0.5543`;
- `Brier over/under 2.5`: `0.2690`;
- `accuracy BTTS`: `0.4886`;
- `Brier BTTS`: `0.2782`.

Promedios de probabilidad observados:

- `homeWin`: `0.4358`;
- `draw`: `0.2224`;
- `awayWin`: `0.3417`.

Distribucion de data quality observada:

- `SUFFICIENT`: `350`.

Interpretacion:

- este resultado valida el pipeline historico y la reproducibilidad del modelo;
- no implica rentabilidad futura;
- la calibracion fina queda para una fase posterior.

## Interpretacion responsable

- las probabilidades son estimaciones estadisticas;
- no garantizan resultados;
- la evaluacion historica no garantiza rendimiento futuro;
- PronostIA no es una casa de apuestas;
- no existen apuestas seguras.

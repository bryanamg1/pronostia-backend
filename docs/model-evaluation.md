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

## Interpretacion responsable

- las probabilidades son estimaciones estadisticas;
- no garantizan resultados;
- la evaluacion historica no garantiza rendimiento futuro;
- PronostIA no es una casa de apuestas;
- no existen apuestas seguras.

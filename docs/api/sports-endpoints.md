# Sports Endpoints

## GET /api/competitions

Retorna las competiciones habilitadas ya persistidas localmente.

Comportamiento actual:

- expone un catalogo publico consolidado de `18` competiciones autorizadas;
- no duplica una categoria por temporada: la temporada se devuelve como metadata de la competicion consolidada;
- soporta filtros publicos opcionales:
  - `type`
  - `country`
  - `region`
  - `availabilityStatus`
- devuelve un DTO saneado por competicion:
  - `id`
  - `key`
  - `targetKey`
  - `name`
  - `country`
  - `region`
  - `type`
  - `availabilityStatus`
  - `season`
  - `isEnabled`
  - `displayOrder`
- no expone `providerId`, payloads crudos ni metadata administrativa del proveedor.

## GET /api/fixtures/today

Retorna los fixtures almacenados dentro de la ventana activa de Fase 2.

Comportamiento actual:

- lee desde MySQL;
- no consulta el proveedor en tiempo de request;
- acepta el filtro publico opcional `competition` para cualquiera de las `18` keys autorizadas;
- respeta el limite operativo configurado para la ventana diaria.
- devuelve solo un DTO publico saneado por fixture:
  - `id`
  - `competition.{id,key,name,country,season}`
  - `homeTeam.{id,key,name}`
  - `awayTeam.{id,key,name}`
  - `kickoffAt`
  - `status`
  - `isHistorical`
  - `prediction.{id,market,selection,recommendation,confidenceScore}` cuando existe
- no expone `providerId`, logos, payload crudo, metadatos privados ni informacion administrativa.

## GET /api/fixtures/:id

Retorna el detalle de un fixture persistido por su id interno con el mismo DTO publico saneado usado en `/api/fixtures/today`.

Si el fixture no existe, responde `404` con el contrato uniforme de error del backend.

## GET /api/predictions/today

Retorna las predicciones persistidas en la ventana activa.

Comportamiento actual:

- lee solo desde MySQL;
- no consulta el proveedor en tiempo de request;
- devuelve un DTO publico saneado con `fixture`, `model`, `selection`, `analysis`, `explanation`, `isDailyTop`, `createdAt` y `updatedAt`;
- nunca expone metadatos internos del proveedor OpenAI, presupuesto, usage ni request ids;
- soporta filtros publicos opcionales:
  - `competition`
  - `market`
  - `recommendation`
  - `dataQuality`
  - `explanationSource`

## GET /api/predictions/top

Retorna hasta `5` predicciones destacadas, con maximo una por fixture.

## GET /api/predictions/:id

Retorna el detalle completo de una prediccion persistida con el mismo DTO publico saneado usado por el dashboard.

Si la prediccion no existe, responde `404`.

Si el identificador no es un entero positivo, responde `400`.

## GET /api/system/runs/latest

Retorna el ultimo `system_run` publico disponible para mostrar el estado operativo del backend.

Contrato actual:

- `runId`
- `runType`
- `status`
- `startedAt`
- `finishedAt`
- `errorCode`

## POST /api/admin/odds/manual

Registra o actualiza una cuota manual para un fixture persistido.

Contrato minimo esperado:

```json
{
  "fixtureId": 763,
  "bookmaker": "Betano",
  "market": "MATCH_RESULT",
  "selection": "HOME",
  "decimalOdds": 2.05,
  "enteredBy": "operator"
}
```

Restricciones actuales:

- solo acepta combinaciones de mercado/seleccion soportadas por el scoring;
- persiste auditoria de cambios manuales;
- no expone credenciales ni consulta el proveedor en el request.

## POST /api/admin/predictions/:id/explanation

Genera o regenera la explicacion estructurada de una prediccion ya persistida.

Comportamiento actual:

- solo opera sobre predicciones `CONSIDER`;
- reutiliza probabilidades y scoring ya calculados;
- nunca recalcula `modelProbability`, `edgePp` ni `recommendation`;
- usa OpenAI solo si esta configurado y el presupuesto mensual lo permite;
- cae a fallback determinista si OpenAI falla, no esta configurado o el presupuesto esta bloqueado.

Los detalles operativos de autenticacion temporal, payload y errores se documentan en [admin-prediction-explanations.md](./admin-prediction-explanations.md).

## POST /api/admin/predictions/explanations/today

Procesa las predicciones `CONSIDER` de la ventana activa y genera explicaciones de forma secuencial.

Reglas actuales:

- presupuesto mensual base: `USD 20`;
- alerta operativa al `70 %`;
- modo degradado al `85 %`: OpenAI se reserva para el Top 5 diario y el resto usa plantilla determinista;
- bloqueo al `100 %`: no se realizan nuevas llamadas a OpenAI hasta el siguiente periodo.

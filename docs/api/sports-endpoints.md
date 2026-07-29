# Sports Endpoints

## GET /api/competitions

Retorna las competiciones habilitadas ya persistidas localmente.

## GET /api/fixtures/today

Retorna los fixtures almacenados dentro de la ventana activa de Fase 2.

Comportamiento actual:

- lee desde MySQL;
- no consulta el proveedor en tiempo de request;
- respeta el limite operativo configurado para la ventana diaria.

## GET /api/fixtures/:id

Retorna el detalle de un fixture persistido por su id interno.

Si el fixture no existe, responde `404` con el contrato uniforme de error del backend.

## GET /api/predictions/today

Retorna las predicciones persistidas en la ventana activa.

Comportamiento actual:

- lee solo desde MySQL;
- no consulta el proveedor en tiempo de request;
- devuelve scoring persistido con `modelProbability`, `marketProbability`, `edgePp`, `confidenceScore`, `riskLevel` y `recommendation`.

## GET /api/predictions/top

Retorna hasta `5` predicciones destacadas, con maximo una por fixture.

## GET /api/predictions/:id

Retorna el detalle completo de una prediccion persistida.

Si la prediccion no existe, responde `404`.

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

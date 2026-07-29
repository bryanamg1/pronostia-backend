# Admin Prediction Explanations API

## Autenticacion temporal

Mientras no exista un sistema administrativo completo, los endpoints admin usan un token estatico temporal configurado mediante:

- `ADMIN_API_TOKEN`

El token puede enviarse por:

- header `x-admin-token`
- header `Authorization: Bearer <token>`

Sin token valido, las rutas responden `401` o `403`.

## Rate limiting

Las rutas admin de explicaciones tienen rate limit propio:

- `ADMIN_RATE_LIMIT_WINDOW_MS`
- `ADMIN_RATE_LIMIT_MAX_REQUESTS`

## POST /api/admin/predictions/:id/explanation

Genera o regenera la explicacion de una prediccion puntual.

Payload opcional:

```json
{
  "force": false
}
```

Reglas:

- `id` debe ser entero positivo;
- solo procesa predicciones `CONSIDER`;
- no recalcula probabilidades;
- si ya existe explicacion terminal y `force` no es `true`, devuelve el estado persistido;
- usa fallback determinista si OpenAI esta deshabilitado, bloqueado o devuelve salida invalida.

## POST /api/admin/predictions/explanations/today

Procesa de forma secuencial las predicciones elegibles de la ventana activa.

Payload opcional:

```json
{
  "limit": 5
}
```

Restricciones:

- `limit` debe estar entre `1` y `40`;
- el lote se limita al orden de prioridad actual;
- en modo degradado, OpenAI se reserva para el Top 5 diario y el resto usa fallback.

## Respuestas

Contrato uniforme:

- `success`
- `data`
- `meta.requestId`

Los errores quedan sanitizados y no exponen prompts ni credenciales.

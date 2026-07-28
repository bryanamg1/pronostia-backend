# Health Endpoints

## GET /api/health

Retorna el estado basico del servicio.

Respuesta exitosa esperada:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "pronostia-backend",
    "timestamp": "2026-07-28T00:00:00.000Z",
    "environment": "development"
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

## GET /api/health/ready

Retorna el estado de readiness usando una abstraccion de readiness.

Comportamiento:

- consulta la abstraccion correspondiente;
- verifica la base de datos solo si esta configurada;
- no expone credenciales;
- responde con contrato uniforme;
- devuelve `200` cuando la readiness esta disponible;
- devuelve `503` cuando la readiness falla.

Estados observados en la implementacion actual:

- `status: "ok"` con `checks.database.status = "not_configured"` cuando no hay configuracion DB utilizable
- `status: "ok"` con `checks.database.status = "ok"` cuando la base responde correctamente
- `status: "error"` con `checks.database.status = "error"` cuando la comprobacion falla

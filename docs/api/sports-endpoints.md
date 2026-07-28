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

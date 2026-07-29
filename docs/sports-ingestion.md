# Sports Ingestion

## Estado publico de Fase 2

La Fase 2 quedo cerrada tecnicamente con un flujo de ingesta deportiva desacoplado por adapters, persistencia MySQL, scheduler y endpoints de lectura locales.

La validacion empirica confirmo una limitacion externa del proveedor usado en esta fase:

- API-Football Free permitio validar temporadas historicas accesibles.
- La cuenta validada no tuvo acceso a `season=2026` en las ligas trianguladas.
- El backend distingue entre respuesta vacia valida, restriccion de plan, error tecnico y datos historicos disponibles.

## Evidencia publica utilizada

- Consultas futuras autorizadas sobre `league=128` y `league=71` para `season=2026` respondieron `HTTP 200` con `results=0` y `errors.plan`.
- Consulta historica autorizada sobre `league=39` y `season=2024` respondio `HTTP 200` con `results=380`.
- La fixture `1208021` se usa solo como muestra historica sanitizada de tests.

En la validacion final de Fase 3, esa evidencia historica se amplio con una unica consulta controlada adicional a `GET /fixtures?league=39&season=2024&status=FT`, cuyo payload quedo guardado solo en una ruta ignorada por Git para reutilizacion local.

La fixture `1208021` no representa un partido futuro y nunca debe presentarse como evidencia de disponibilidad productiva actual.

## Comportamiento del backend

- La ingesta consulta el proveedor fuera del tiempo de request y persiste resultados en MySQL.
- `GET /api/fixtures/today` lee solo desde cache persistida.
- Una ejecucion sin fixtures elegibles se trata como resultado valido.
- Una restriccion de plan queda diferenciada de un error tecnico.
- El scheduler registra ejecuciones sin fixtures como `NO_FIXTURES`.
- La importacion historica controlada de Premier League 2024 persiste la temporada completa mediante upserts cronologicos e idempotentes.
- El feed diario validado usa consultas secuenciales `GET /fixtures?date=YYYY-MM-DD` por cada dia de la ventana activa; no depende de `next` ni de `from/to`.

## Desacople y alcance

- El dominio y los casos de uso no dependen de detalles especificos de API-Football.
- Cambiar de proveedor no debe afectar las capas `domain` ni `application`.
- La Fase 2 sigue sin calcular probabilidades ni recomendaciones.
- La Fase 4 agrega captura de odds y scoring encima del cache persistido, sin mezclar esa logica con la capa de ingesta.
- OpenAI sigue fuera de alcance.

## Evidencia empirica adicional de Fase 4

Validacion controlada ejecutada el `2026-07-29`:

- `GET /fixtures?date=2026-07-29&timezone=America/Argentina/Buenos_Aires` devolvio `HTTP 200` con `results=227`;
- dentro de esa fecha se detectaron `23` fixtures autorizadas;
- `GET /odds?fixture=1589421&page=1` devolvio `HTTP 200`, `results=1` y `13` bookmakers;
- la muestra real utilizada para scoring fue `FK Crvena Zvezda vs Larne`;
- el proveedor devolvio errores de parametros al usar `from/to` para ese caso y bloqueo de plan al usar `next`, por lo que el backend se corrigio para usar consultas diarias por fecha.

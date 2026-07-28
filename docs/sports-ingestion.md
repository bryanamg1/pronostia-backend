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

## Desacople y alcance

- El dominio y los casos de uso no dependen de detalles especificos de API-Football.
- Cambiar de proveedor no debe afectar las capas `domain` ni `application`.
- Esta fase no valida pronosticos, modelos estadisticos, probabilidades, odds ni integracion con OpenAI.

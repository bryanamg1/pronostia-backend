# OpenAI Explanations

## Objetivo

La capa OpenAI de PronostIA solo explica predicciones ya calculadas y persistidas por el motor determinista.

No puede:

- recalcular probabilidades;
- modificar expected goals;
- modificar `confidenceScore`;
- cambiar `recommendation`;
- inventar estadisticas, lesiones o cuotas;
- introducir hechos fuera de la allowlist construida por el backend.

## Activacion

OpenAI es opcional.

Variables operativas relevantes:

- `OPENAI_ENABLED`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MONTHLY_BUDGET_USD`
- `OPENAI_MONTHLY_ALERT_PERCENT`
- `OPENAI_MONTHLY_DEGRADED_PERCENT`
- `OPENAI_HARD_LIMIT_PERCENT`
- `OPENAI_TIMEOUT_MS`
- `OPENAI_INPUT_COST_USD_PER_1M_TOKENS`
- `OPENAI_CACHED_INPUT_COST_USD_PER_1M_TOKENS`
- `OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS`

Si OpenAI no esta habilitado o configurado, el backend usa fallback determinista.

## Structured Output

El backend envia:

- identificadores sanitizados;
- probabilidades persistidas;
- expected goals persistidos;
- data quality;
- mercado y seleccion;
- listas cerradas de hechos permitidos;
- aviso de uso responsable.

La salida se solicita mediante Structured Output con `additionalProperties=false`, `maxItems`, `uniqueItems` y enums cerrados por campo.

Despues de recibir la respuesta, el backend valida nuevamente con Zod y descarta la salida si:

- el JSON no cumple el esquema;
- aparece un hecho no permitido;
- se altera una cifra;
- aparece lenguaje prohibido como garantia o apuesta segura;
- el contenido llega incompleto.

## Fallback determinista

El fallback se activa cuando:

- `OPENAI_ENABLED=false`;
- falta `OPENAI_API_KEY`;
- el presupuesto esta bloqueado;
- el sistema entra en modo degradado y la prediccion no esta dentro del Top 5 priorizado;
- hay timeout o error HTTP;
- el ledger no esta disponible;
- la salida estructurada es invalida;
- la respuesta contiene contenido no permitido.

El fallback:

- es reproducible;
- usa solo datos persistidos;
- conserva la comunicacion responsable;
- registra la causa del fallback en la explicacion persistida.

## Presupuesto

Reglas actuales:

- menor a `70 %`: OpenAI puede ejecutarse;
- desde `70 %` y menor a `85 %`: se mantiene disponible con advertencia interna;
- desde `85 %` y menor a `100 %`: modo degradado, OpenAI solo para el Top 5 diario;
- `100 %` o mas: `BUDGET_BLOCKED`, no se realizan nuevas llamadas.

## Ledger

La tabla `openai_usage_records` registra intentos y consumo estimado sin exponer secretos.

Campos relevantes:

- `prediction_id`
- `status`
- `source`
- `model`
- `request_id`
- `input_tokens`
- `cached_input_tokens`
- `output_tokens`
- `reasoning_tokens`
- `estimated_cost_usd`
- `metadata_json`
- `created_at`

No se persisten:

- API keys;
- headers de autenticacion;
- prompts privados completos;
- respuestas crudas innecesarias;
- Chain-of-Thought.

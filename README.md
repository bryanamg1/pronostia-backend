# PronostIA Backend

Backend de PronostIA para orquestar analisis prepartido de futbol, exponer una API REST y persistir resultados auditables.

## Estado

`Fase 0 completada`

La Fase 0 de discovery del proveedor fue completada con decision `CONDITIONAL GO`. La implementacion funcional del backend comienza en la Fase 1.

## Proposito

El backend gestionara en fases posteriores:

- calculo determinista de probabilidades;
- exposicion de endpoints REST;
- scheduler diario;
- maquina de estados propia;
- persistencia en MySQL;
- integraciones futuras con proveedor deportivo y OpenAI.

## Stack previsto

- JavaScript
- Node.js
- Express
- MySQL
- API REST
- Scheduler
- Maquina de estados
- Integracion futura con API deportiva y OpenAI

## Blueprint oficial

El blueprint fuente de verdad del proyecto esta en [./blueprint-celula-hibrida.md](./blueprint-celula-hibrida.md).

## Resultado de discovery

La evidencia publica de Fase 0 vive en:

- [docs/phase-0-provider-discovery.md](./docs/phase-0-provider-discovery.md)
- [docs/provider-discovery-matrix.csv](./docs/provider-discovery-matrix.csv)
- `scripts/discovery/`

Resumen publico de la decision:

- API-Football quedo en estado `CONDITIONAL GO`.
- Las 11 competiciones objetivo fueron identificadas.
- El plan Free es util para discovery y desarrollo acotado.
- El plan Free no es suficiente para operacion diaria con 40 partidos.
- Bet365 y Betano aparecen en el catalogo, pero su disponibilidad real por fixture sigue `INCONCLUSIVE`.

## Repositorio relacionado

Frontend: https://github.com/bryanamg1/pronostia-frontend

## Flujo Git

- `main`: linea estable del repositorio.
- `develop`: base obligatoria para cada nueva tarea.
- ramas de trabajo: `bryan/<tipo>/<nombre-corto>`.

Cada fase requiere autorizacion explicita antes de iniciar cambios de implementacion.

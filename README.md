# PronostIA Backend

Backend planificado de PronostIA para orquestar el análisis prepartido de fútbol, exponer una API REST y persistir resultados auditables.

## Estado

`Fase 0 / discovery de proveedor en curso`

Todavia no existe una implementacion funcional del backend. El repositorio contiene bootstrap documental y artefactos de discovery previos a la implementacion.

## Propósito

El backend gestionará en fases posteriores:

- cálculo determinista de probabilidades;
- exposición de endpoints REST;
- scheduler diario;
- máquina de estados propia;
- persistencia en MySQL;
- integraciones futuras con proveedor deportivo y OpenAI.

## Stack previsto

- JavaScript
- Node.js
- Express
- MySQL
- API REST
- Scheduler
- Máquina de estados
- Integración futura con API deportiva y OpenAI

## Blueprint oficial

El blueprint fuente de verdad del proyecto está en [./blueprint-celula-hibrida.md](./blueprint-celula-hibrida.md).

## Discovery actual

Los artefactos de Fase 0 viven en:

- [docs/phase-0-provider-discovery.md](./docs/phase-0-provider-discovery.md)
- [docs/provider-discovery-matrix.csv](./docs/provider-discovery-matrix.csv)
- `scripts/discovery/`

## Repositorio relacionado

Frontend: https://github.com/bryanamg1/pronostia-frontend

## Flujo Git

- `main`: línea estable del repositorio.
- `develop`: base obligatoria para cada nueva tarea.
- ramas de trabajo: `bryan/<tipo>/<nombre-corto>`.

Cada fase requiere autorización explícita antes de iniciar cambios de implementación.

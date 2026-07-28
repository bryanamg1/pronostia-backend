# PronostIA Backend

Backend planificado de PronostIA para orquestar el análisis prepartido de fútbol, exponer una API REST y persistir resultados auditables.

## Estado

`Fase Bootstrap / planificación`

Todavía no existe una implementación funcional del backend. Este repositorio contiene únicamente la base documental y operativa inicial.

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

## Repositorio relacionado

Frontend: https://github.com/bryanamg1/pronostia-frontend

## Flujo Git

- `main`: línea estable del repositorio.
- `develop`: base obligatoria para cada nueva tarea.
- ramas de trabajo: `bryan/<tipo>/<nombre-corto>`.

Cada fase requiere autorización explícita antes de iniciar cambios de implementación.

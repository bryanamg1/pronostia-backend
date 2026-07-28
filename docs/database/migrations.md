# Database Migrations

## Requisitos

Configurar MySQL localmente y completar estas variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

## Ejecutar migraciones

```bash
npm run migrate
```

## Consultar estado

```bash
npm run migrate:status
```

## Revertir

La infraestructura de migraciones inicial define una operacion `down` para revertir `system_runs` cuando resulte razonable y seguro usarla desde una sesion controlada.

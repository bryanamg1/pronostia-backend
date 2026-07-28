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

Si la configuracion de MySQL no esta completa o las credenciales no son validas, el comando responde con un resultado controlado o un error sanitizado. No se deben publicar credenciales ni connection strings completas.

## Revertir

La infraestructura de migraciones inicial define una operacion `down` para revertir `system_runs` cuando resulte razonable y seguro usarla desde una sesion controlada.

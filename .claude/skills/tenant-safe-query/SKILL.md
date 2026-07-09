---
name: tenant-safe-query
description: >
  Reglas de aislamiento multi-tenant de este repo. Usar SIEMPRE que escribas o
  revises código que lee/escribe datos por-cliente (leads, nutricion_*, wa_*,
  email_*, evolution_*, etc.), un route handler bajo app/api, un webhook, un
  cron, o cualquier lib que toque Supabase. Evita los leaks cross-tenant que las
  reviews adversariales encuentran una y otra vez.
---

# Tenant-safe queries (multi-inquilino)

La app es multi-tenant: cada cliente = un `workspace_id`. El service_role bypassa
RLS, así que **la frontera de aislamiento es la app**, no la base. Regla de oro:
si una tabla está en `TENANT_TABLES` (`lib/workspace.ts`), sus queries DEBEN ir
scopeadas por workspace — o filtrás datos de un cliente a otro.

## Las 3 formas de acceder a la base

1. **`getTenantDb()`** (de `@/lib/workspace`) — cliente Supabase que AUTO-scopea:
   filtra `SELECT/UPDATE/DELETE` y estampa `INSERT/UPSERT` con el `workspace_id`
   del request. **Este es el default** para todo lo por-cliente.
2. **`getSupabaseServer()`** (de `@/lib/supabase`) — cliente CRUDO, sin scope.
   Solo para: tablas NO-tenant (workspaces, usuarios), o lookups deliberados por
   una clave global única (ver Webhooks).
3. **`getSetting/setSetting`** (de `@/lib/settings`) y **`credWs`** (de
   `@/lib/credenciales`) — ya scopean por su cuenta (app_settings, credenciales).

## Reglas duras

- **Toda lib de datos por-cliente usa `getTenantDb()`.** Nunca `getSupabaseServer()`
  para leads/nutrición/wa_*/email_*/evolution_*.
- **Al crear una tabla nueva por-cliente**: (a) la migración le agrega
  `workspace_id bigint not null default 1 references workspaces(id)`; (b) agregala
  al set `TENANT_TABLES` en `lib/workspace.ts` (si no, el proxy no la scopea).
- **Crons**: iterá los workspaces activos con `runWithWorkspace(ws.id, fn)`
  (`lib/workspace.ts` / patrón en `lib/cron-workspaces.ts`). Adentro, `getTenantDb`
  y `getSetting` resuelven ese ws. Un ws que falla no corta a los demás; si TODOS
  fallan, devolvé 500 (que el monitoreo del cron lo vea).
- **Webhooks (sin sesión)**: `getWorkspaceActual()` cae a `OWNER_WS` (dueño). NO
  uses `getTenantDb` a ciegas — resolvé el workspace desde el payload (ej.
  `instance_name`/`proveedor_id` que son claves GLOBALES únicas) con
  `getSupabaseServer()`, y después `runWithWorkspace(ws, fn)` para escribir con
  scope. Fail-CLOSED: sin secret configurado → 401 (nunca `if (secret && ...)`,
  siempre `if (!secret || ...)`).
- **Contexto sin sesión (funciones invocadas fuera de un request)**: no uses
  `?? OWNER_WS` como fallback silencioso en operaciones de escritura — un admin
  de agencia SIN impersonar tiene `getWorkspaceActual() === null`. Cortá con
  error (patrón `wsEstricto()` en `lib/evolution.ts`) o dejá que `getTenantDb`
  falle-cerrado (ws null → id -1 → 0 filas / FK error).
- **Excepción legítima a `credWs`** (que jamás da env a un cliente): la key
  compartida de una cuenta única de la agencia (ej. Resend/Evolution Opción A)
  cae al env global a propósito — pero el REMITENTE/dominio/instancia sigue siendo
  por-workspace. Documentá la excepción en el código.

## Antes de dar por terminado

- ¿La tabla nueva está en `TENANT_TABLES`? (grep `TENANT_TABLES` en `lib/workspace.ts`)
- ¿Algún `getSupabaseServer()` que debería ser `getTenantDb()`?
- ¿El webhook mapea payload→workspace y corre con `runWithWorkspace`?
- ¿Un guard de rol donde corresponde? (`getRolWsEfectivo()`, `requireRolWs`,
  `esWorkspaceDueno`) para acciones outward-facing (enviar, escribir a Meta).
- ¿Una query con `.like('%'+algo)` sin `.order` estable? → match no determinista.

Verificalo con una lectura adversarial de tus rutas nuevas antes de pushear.
Relacionado: `lib/workspace.ts` (getTenantDb/TENANT_TABLES/runWithWorkspace),
`lib/settings.ts`, `lib/credenciales.ts`.

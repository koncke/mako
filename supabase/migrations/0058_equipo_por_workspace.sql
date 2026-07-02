-- =============================================================================
-- 0058 — Rol POR WORKSPACE (equipo del cliente): admin-cliente / closer / setter
-- =============================================================================
-- Hoy usuarios.rol es un eje GLOBAL de la app ('admin'=agencia | 'usuario'=cliente).
-- Este cambio agrega un SEGUNDO eje, el rol DENTRO del negocio del cliente:
--   rol_ws = 'admin'  → dueño del cliente: ve TODAS las tabs de su negocio (NO es
--                       admin de la app, no ve /admin).
--            'closer' → toma llamadas agendadas y cierra: subconjunto de tabs.
--            'setter' → agenda/prospecta: subconjunto de tabs.
--            NULL     → admin de la AGENCIA (cruza workspaces por impersonación,
--                       no tiene rol dentro de un negocio).
--
-- El modelo sigue siendo 1 usuario = 1 workspace, así que el rol vive en la MISMA
-- fila de usuarios (junto a workspace_id). Aditiva e idempotente.
-- =============================================================================

begin;

alter table usuarios
  add column if not exists rol_ws text
  check (rol_ws is null or rol_ws in ('admin', 'closer', 'setter'));

-- Backfill: los usuarios-cliente existentes (rol='usuario' con workspace) pasan a
-- ser admin de su negocio → nadie pierde acceso a las tabs que ya veía. Los admin
-- de la agencia (rol='admin') quedan con rol_ws NULL a propósito.
update usuarios
   set rol_ws = 'admin'
 where rol = 'usuario' and workspace_id is not null and rol_ws is null;

commit;

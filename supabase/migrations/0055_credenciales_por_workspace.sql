-- =============================================================================
-- 0055 — credenciales por workspace: cada cliente con sus propios tokens
-- =============================================================================
-- Fase 1 (0054) le agregó workspace_id a credenciales pero dejó la PK en
-- `clave` sola, así que dos workspaces no podían guardar la misma env (p.ej.
-- ambos su META_ACCESS_TOKEN). Fase 2 hace la PK compuesta (workspace_id,
-- clave): cada cliente guarda su propio set. El resolver de la app
-- (lib/credenciales.ts) devuelve el token del workspace actual; para el
-- workspace dueño (1) el env de Vercel sigue ganando → su comportamiento no
-- cambia.
--
-- Aditiva: las filas existentes (workspace_id=1 por el DEFAULT de la 0054)
-- quedan intactas. Mismo patrón que app_settings en 0054. Idempotente.
-- =============================================================================

begin;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'credenciales_pkey' and conrelid = 'credenciales'::regclass
      and array_length(conkey, 1) = 1
  ) then
    alter table credenciales drop constraint credenciales_pkey;
    alter table credenciales add constraint credenciales_pkey primary key (workspace_id, clave);
  end if;
end $$;

commit;

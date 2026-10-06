-- =============================================================================
-- 0199_lineas_sin_unique_ws — la segunda línea de un negocio deja de estar prohibida
-- =============================================================================
-- Segunda mitad de la 0198 (varias líneas de WhatsApp por negocio).
--
-- ⚠️ ORDEN DE DESPLIEGUE: **DESPUÉS** del deploy que trae `onConflict: 'instance_name'` en
-- `upsertInstancia` (lib/evolution.ts). El código anterior conecta la línea con
-- `onConflict: 'workspace_id'`, y Postgres rechaza un ON CONFLICT que no tiene un único que
-- lo respalde: aplicada antes, «conectar» falla para todos hasta que llegue el deploy.
-- Mientras tanto (deploy nuevo + esta sin aplicar), agregar una SEGUNDA línea falla con un
-- duplicado y el código lo dice; la primera sigue andando igual.
--
-- La llave real sigue siendo el `unique (instance_name)` de la 0072: el nombre de una
-- instancia es único en todo Evolution, no sólo dentro de un workspace.
-- =============================================================================

begin;

-- Se busca el constraint por su DEFINICIÓN y no por su nombre: medido el 06/10/2026 se llama
-- `evolution_instancias_workspace_id_key`, pero un restore o un rename deja un `drop
-- constraint if exists <nombre>` sin efecto y en silencio — y acá el silencio significa que
-- la segunda línea sigue siendo imposible, con todo lo demás aplicado.
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'evolution_instancias'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) = 'UNIQUE (workspace_id)';
  if c is not null then
    execute format('alter table evolution_instancias drop constraint %I', c);
    raise notice 'se quitó el unique por workspace: %', c;
  else
    raise notice 'no había unique (workspace_id): nada que quitar';
  end if;
end $$;

-- Para que «las líneas de este negocio» no recorra la tabla entera.
create index if not exists idx_evolution_instancias_ws on evolution_instancias (workspace_id);

-- ── Lo que el código VIEJO escribió entre la 0198 y el deploy ─────────────────
-- (revisión adversarial del 06/10/2026). El código desplegado en ese rato no sabe nada de
-- líneas: una primera conexión crea su fila con es_default=false, y cada saliente se espeja con
-- `instance_name = ''`. Son los mismos dos rellenos de la 0198, repetidos para ese hueco.
update evolution_instancias e set es_default = true
 where not e.es_default
   and not exists (select 1 from evolution_instancias b where b.workspace_id = e.workspace_id and b.es_default)
   and e.id = (select min(c.id) from evolution_instancias c where c.workspace_id = e.workspace_id);

update wa_mensajes m set instance_name = 'mako_ws' || m.workspace_id
 where coalesce(m.instance_name, '') = ''
   and exists (select 1 from evolution_instancias e
                where e.workspace_id = m.workspace_id and e.instance_name = 'mako_ws' || m.workspace_id);

commit;

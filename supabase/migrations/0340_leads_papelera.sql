-- =============================================================================
-- 0340_leads_papelera — «Eliminar» un lead lo manda a una PAPELERA de 30 días (28/10/2026)
-- =============================================================================
-- Leila (ticket #22, sobre los 394 de «Contacto nuevo» de LíderMente): «Los podemos borrar de ahí». El Cerebro, el mismo
-- día: «Eliminar en bloque que NO borra para siempre: papelera recuperable 30 días (Cerrar ≠ borrar), con confirmación que
-- dice cuántos». Hasta hoy «Eliminar» era `delete from leads` (lib/leads.ts, `deleteLead`): irreversible, y se llevaba en
-- cascada 26 columnas de 23 tablas (pagos, sus funnels, sus etiquetas, sus automatizaciones, su comunidad…).
--
-- POR QUÉ UNA FOTO Y NO UNA COLUMNA `eliminado_at` (medido el 28/10/2026, docs/hallazgos-crm.md → «La papelera de leads»):
-- la columna obliga a que TODA lectura de `leads` la filtre, y hay 269 `.from('leads')`, 45 `leerTodo`, joins embebidos
-- desde pagos, vistas SQL y lecturas con service_role que no pasan por `getTenantDb`. Las tablas hijas (nutrición, curso,
-- mensajes) leen por `lead_id` sin mirar el lead: un lead «en la papelera» seguía recibiendo su secuencia. Con la foto, el
-- lead SE BORRA como siempre (nadie lo ve, nada le escribe) y lo que se guarda es lo necesario para devolverlo IGUAL: la
-- fila del lead y todas las filas que el borrado se lleva en cascada, con sus MISMOS ids (AGENTS.md, «Deshacer una acción
-- destructiva devuelve la MISMA identidad»). Lo que no tiene FK (el historial `lead_audit`, los análisis) no se borra hoy y
-- vuelve a quedar enganchado solo, por el mismo id.
--
--   · `leads_papelera`: una fila por lead (workspace, lead_id único), lo que la pantalla lista sin abrir la foto (nombre,
--     teléfono, email, funnel y etapa de donde salió), la foto (`foto` jsonb: filas por tabla, el orden en que se insertan
--     y las columnas que el borrado puso en NULL), quién y cuándo, y `purgar_at` (30 días).
--   · `papelera_leads_fks()`: las FKs de la base REAL que cuelgan del lead, recorridas desde `pg_constraint`. No es una
--     lista escrita a mano: la base de producción tiene migraciones que nunca se aplicaron (lib/tablas-de-inquilino.ts), y
--     una tabla nueva con FK al lead entra sola a la foto.
--   · `mandar_leads_a_papelera(ws, ids, por)`: por cada lead, en su propio punto de guardado, saca la foto (las filas en
--     cascada, hasta el punto fijo: las que cuelgan de las que cuelgan) y borra el lead. Todo o nada POR LEAD: si la foto
--     no se puede sacar entera (una FK de varias columnas que no sabe seguir, un ciclo entre tablas), ese lead NO se borra.
--   · `recuperar_leads_de_papelera(ws, ids)`: inserta la foto en orden (padres antes que hijos), vuelve a apuntar lo que
--     el borrado dejó en NULL (mensajes de WhatsApp, conversaciones, correos) y saca la fila de la papelera. Todo o nada
--     por lead: si algo choca (otro lead con su mismo id de Meta, que llegó de nuevo), ese lead queda en la papelera y
--     vuelve el motivo.
--   · `purgar_papelera_leads(ws)`: borra las fotos vencidas (las corre el cron diario /api/cron/leads-papelera).
--
-- `security invoker` y el workspace EXPLÍCITO en cada consulta, como la 0318: la app entra con service_role y el rpc no
-- pasa por el scoping de lib/workspace.ts. Las funciones sólo las ejecuta service_role.
--
-- ORDEN DE DESPLIEGUE: ANTES del código que la llama. Sin la migración, «Eliminar» NO borra nada y lo dice («falta la
-- migración 0340»): nunca cae al borrado de antes. Con la migración y el código viejo no cambia nada (nadie la llama).
-- Sin datos que migrar. Seguro de re-ejecutar.
-- =============================================================================

begin;

create table if not exists leads_papelera (
  id bigserial primary key,
  workspace_id bigint not null references workspaces(id) on delete cascade,
  lead_id bigint not null,
  nombre text,
  telefono text,
  email text,
  funnel_id bigint,
  etapa text,
  foto jsonb not null,
  por text,
  eliminado_at timestamptz not null default now(),
  purgar_at timestamptz not null default (now() + interval '30 days')
);
create unique index if not exists leads_papelera_lead_uidx on leads_papelera (workspace_id, lead_id);
create index if not exists leads_papelera_ws_idx on leads_papelera (workspace_id, eliminado_at desc);
create index if not exists leads_papelera_purgar_idx on leads_papelera (purgar_at);
alter table leads_papelera enable row level security;
revoke all on leads_papelera from anon, authenticated;

-- Las FKs de una sola columna cuyo padre está en el árbol del lead (el lead y todo lo que cuelga de él en CASCADA). `accion`
-- es la de pg_constraint: 'c' cascade, 'n' set null, 'd' set default, 'r'/'a' restrict/no action. `multi`: la FK es de
-- varias columnas (la foto no la sabe seguir: si es una cascada del árbol, no se borra nada).
create or replace function public.papelera_leads_fks()
returns table (hijo text, col text, tipo text, padre text, pcol text, accion text, multi boolean, tipo_id text)
language sql
stable
security invoker
set search_path = public
as $$
  with recursive fk as (
    select c.conrelid::regclass::text as hijo,
           a.attname::text as col,
           format_type(a.atttypid, a.atttypmod) as tipo,
           c.confrelid::regclass::text as padre,
           pa.attname::text as pcol,
           c.confdeltype::text as accion,
           cardinality(c.conkey) > 1 as multi,
           (select format_type(i.atttypid, i.atttypmod) from pg_attribute i
             where i.attrelid = c.conrelid and i.attname = 'id' and not i.attisdropped) as tipo_id
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
    where c.contype = 'f'
  ),
  arbol(tabla) as (
    select 'leads'::regclass::text
    union
    select fk.hijo from fk join arbol on fk.padre = arbol.tabla where fk.accion = 'c'
  )
  select fk.hijo, fk.col, fk.tipo, fk.padre, fk.pcol, fk.accion, fk.multi, fk.tipo_id
  from fk
  where fk.padre in (select tabla from arbol)
$$;

-- La foto de UN lead y su borrado, en la transacción de quien llama (`mandar_leads_a_papelera` le pone un punto de guardado
-- por lead). `p_fks`: lo de `papelera_leads_fks()`, leído una vez por llamada. Devuelve cuántas filas guardó. Tira si no
-- puede sacarla entera: entonces el lead no se borra.
create or replace function public.papelera_leads_uno(p_ws bigint, p_lead bigint, p_por text, p_fks jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead jsonb;
  v_filas jsonb;
  v_rep jsonb := '[]'::jsonb;
  v_orden text[] := '{}';
  v_quedan text[];
  v_listas text[];
  v_cambio boolean;
  v_claves text[];
  v_nuevas jsonb;
  v_antes jsonb;
  v_union jsonb;
  v_grupos jsonb;
  v_total integer := 0;
  e record;
begin
  select to_jsonb(l) into v_lead from leads l where l.id = p_lead and l.workspace_id = p_ws for update;
  if v_lead is null then
    raise exception 'papelera: el lead % no está en este negocio', p_lead using errcode = 'P0002';
  end if;

  -- Las filas que el borrado se lleva, hasta el punto fijo: las que cuelgan de las que cuelgan (los comentarios de sus
  -- publicaciones, los «me gusta» de otros en ellas). Una fila se guarda una sola vez (por su id, o entera si no tiene).
  v_filas := jsonb_build_object('leads', jsonb_build_array(v_lead));
  loop
    v_cambio := false;
    for e in select * from jsonb_to_recordset(p_fks) as f(hijo text, col text, tipo text, padre text, pcol text, accion text, multi boolean, tipo_id text)
             where f.accion = 'c' loop
      v_antes := v_filas -> e.padre;
      continue when v_antes is null or jsonb_array_length(v_antes) = 0;
      select array_agg(distinct x ->> e.pcol) into v_claves from jsonb_array_elements(v_antes) x where x ->> e.pcol is not null;
      continue when v_claves is null;
      execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %s t where t.%I = any($1::%s[])', e.hijo, e.col, e.tipo)
        into v_nuevas using v_claves;
      continue when jsonb_array_length(v_nuevas) = 0;
      v_antes := coalesce(v_filas -> e.hijo, '[]'::jsonb);
      select coalesce(jsonb_agg(d.f), '[]'::jsonb) into v_union from (
        select distinct on (coalesce(s.f ->> 'id', s.f::text)) s.f
        from (select jsonb_array_elements(v_antes) as f union all select jsonb_array_elements(v_nuevas)) s
      ) d;
      if jsonb_array_length(v_union) > jsonb_array_length(v_antes) then
        v_filas := jsonb_set(v_filas, array[e.hijo], v_union, true);
        v_cambio := true;
      end if;
    end loop;
    exit when not v_cambio;
  end loop;

  -- Lo que el borrado deja en NULL (o en su default) y apunta a algo de la foto: para volver a apuntarlo al recuperar.
  -- Sólo tablas con `id` (sin id no hay cómo nombrar la fila). Agrupado por el valor al que apuntaba.
  for e in select * from jsonb_to_recordset(p_fks) as f(hijo text, col text, tipo text, padre text, pcol text, accion text, multi boolean, tipo_id text)
           where f.accion in ('n', 'd') and not f.multi and f.tipo_id is not null loop
    v_antes := v_filas -> e.padre;
    continue when v_antes is null or jsonb_array_length(v_antes) = 0;
    select array_agg(distinct x ->> e.pcol) into v_claves from jsonb_array_elements(v_antes) x where x ->> e.pcol is not null;
    continue when v_claves is null;
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''valor'', g.v, ''ids'', g.ids)), ''[]''::jsonb) from ('
      || 'select t.%I::text as v, jsonb_agg(t.id) as ids from %s t where t.%I = any($1::%s[]) group by t.%I) g',
      e.col, e.hijo, e.col, e.tipo, e.col)
      into v_grupos using v_claves;
    if jsonb_array_length(v_grupos) > 0 then
      v_rep := v_rep || jsonb_build_array(jsonb_build_object('tabla', e.hijo, 'col', e.col, 'tipo', e.tipo, 'tipo_id', e.tipo_id, 'grupos', v_grupos));
    end if;
  end loop;

  -- El orden para recuperar: una tabla va después de todas las de la foto a las que apunta (cualquier FK, no sólo las de
  -- cascada: una fila que apunta a otra que todavía no volvió choca). Sin orden posible (un ciclo), no se borra.
  v_quedan := array(select jsonb_object_keys(v_filas));
  loop
    exit when cardinality(v_quedan) = 0;
    v_listas := array(
      select t from unnest(v_quedan) t
      where not exists (
        select 1 from jsonb_to_recordset(p_fks) as f(hijo text, padre text)
        where f.hijo = t and f.padre <> t and f.padre = any(v_quedan)
      )
    );
    if cardinality(v_listas) = 0 then
      raise exception 'papelera: las tablas % se apuntan en círculo, no sé en qué orden devolverlas', v_quedan;
    end if;
    v_orden := v_orden || v_listas;
    v_quedan := array(select t from unnest(v_quedan) t where not (t = any(v_listas)));
  end loop;

  select coalesce(sum(jsonb_array_length(v)), 0) into v_total from jsonb_each(v_filas) as j(k, v);

  insert into leads_papelera (workspace_id, lead_id, nombre, telefono, email, funnel_id, etapa, foto, por)
  values (
    p_ws, p_lead, v_lead ->> 'nombre', v_lead ->> 'telefono', v_lead ->> 'email',
    nullif(v_lead ->> 'funnel_id', '')::bigint, v_lead ->> 'pipeline_stage',
    jsonb_build_object('v', 1, 'orden', to_jsonb(v_orden), 'filas', v_filas, 'repuntar', v_rep),
    p_por
  )
  on conflict (workspace_id, lead_id) do update
    set foto = excluded.foto, nombre = excluded.nombre, telefono = excluded.telefono, email = excluded.email,
        funnel_id = excluded.funnel_id, etapa = excluded.etapa, por = excluded.por,
        eliminado_at = now(), purgar_at = now() + interval '30 days';

  delete from leads where id = p_lead and workspace_id = p_ws;
  return v_total;
end;
$$;

-- Manda VARIOS leads a la papelera. Cada uno es todo o nada (su propio punto de guardado): uno que falla no frena a los
-- demás, y vuelve con su motivo. [{lead_id, ok, filas | error}]
create or replace function public.mandar_leads_a_papelera(p_ws bigint, p_ids bigint[], p_por text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id bigint;
  v_n integer;
  v_fks jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) into v_fks from papelera_leads_fks() f;
  -- Una cascada de varias columnas no se sabe seguir: se perdería al recuperar. Ningún lead se borra así.
  if exists (select 1 from jsonb_to_recordset(v_fks) as f(hijo text, accion text, multi boolean) where f.accion = 'c' and f.multi) then
    raise exception 'papelera: hay una FK de varias columnas en cascada (%), no sé guardarla',
      (select string_agg(f.hijo, ', ') from jsonb_to_recordset(v_fks) as f(hijo text, accion text, multi boolean) where f.accion = 'c' and f.multi);
  end if;
  foreach v_id in array coalesce(p_ids, '{}'::bigint[]) loop
    begin
      v_n := papelera_leads_uno(p_ws, v_id, p_por, v_fks);
      v_out := v_out || jsonb_build_array(jsonb_build_object('lead_id', v_id, 'ok', true, 'filas', v_n));
    exception when others then
      v_out := v_out || jsonb_build_array(jsonb_build_object('lead_id', v_id, 'ok', false, 'error', sqlerrm, 'codigo', sqlstate));
    end;
  end loop;
  return v_out;
end;
$$;

-- Devuelve VARIOS leads de la papelera, cada uno todo o nada. [{lead_id, ok | error}]
create or replace function public.recuperar_leads_de_papelera(p_ws bigint, p_ids bigint[])
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id bigint;
  v_foto jsonb;
  v_t text;
  v_filas jsonb;
  v_cols text;
  v_rep jsonb;
  v_g jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  foreach v_id in array coalesce(p_ids, '{}'::bigint[]) loop
    begin
      select foto into v_foto from leads_papelera where workspace_id = p_ws and lead_id = v_id for update;
      if v_foto is null then
        raise exception 'papelera: el lead % no está en la papelera', v_id using errcode = 'P0002';
      end if;
      for v_t in select jsonb_array_elements_text(v_foto -> 'orden') loop
        v_filas := v_foto -> 'filas' -> v_t;
        continue when v_filas is null or jsonb_array_length(v_filas) = 0;
        if to_regclass(v_t) is null then
          raise exception 'papelera: ya no existe la tabla %', v_t;
        end if;
        -- Sólo las columnas que la foto trae y la tabla tiene hoy (sin las generadas): una columna nueva con default
        -- toma su default, una que se fue no se nombra.
        select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
        from pg_attribute a
        where a.attrelid = to_regclass(v_t) and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
          and (v_filas -> 0) ? a.attname;
        continue when v_cols is null;
        execute format('insert into %s (%s) overriding system value select %s from jsonb_populate_recordset(null::%s, $1)',
          v_t, v_cols, v_cols, v_t) using v_filas;
      end loop;
      for v_rep in select jsonb_array_elements(coalesce(v_foto -> 'repuntar', '[]'::jsonb)) loop
        continue when to_regclass(v_rep ->> 'tabla') is null;
        for v_g in select jsonb_array_elements(v_rep -> 'grupos') loop
          execute format('update %s set %I = $1::%s where id = any(array(select jsonb_array_elements_text($2))::%s[]) and %I is null',
            v_rep ->> 'tabla', v_rep ->> 'col', v_rep ->> 'tipo', v_rep ->> 'tipo_id', v_rep ->> 'col')
            using v_g ->> 'valor', v_g -> 'ids';
        end loop;
      end loop;
      delete from leads_papelera where workspace_id = p_ws and lead_id = v_id;
      v_out := v_out || jsonb_build_array(jsonb_build_object('lead_id', v_id, 'ok', true));
    exception when others then
      v_out := v_out || jsonb_build_array(jsonb_build_object('lead_id', v_id, 'ok', false, 'error', sqlerrm, 'codigo', sqlstate));
    end;
  end loop;
  return v_out;
end;
$$;

-- Borra para siempre las fotos vencidas (de un negocio, o de todos con null). Devuelve cuántas.
create or replace function public.purgar_papelera_leads(p_ws bigint default null)
returns integer
language sql
security invoker
set search_path = public
as $$
  with fuera as (
    delete from leads_papelera where purgar_at < now() and (p_ws is null or workspace_id = p_ws) returning 1
  )
  select count(*)::integer from fuera
$$;

revoke execute on function public.papelera_leads_fks() from public, anon, authenticated;
revoke execute on function public.papelera_leads_uno(bigint, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.mandar_leads_a_papelera(bigint, bigint[], text) from public, anon, authenticated;
revoke execute on function public.recuperar_leads_de_papelera(bigint, bigint[]) from public, anon, authenticated;
revoke execute on function public.purgar_papelera_leads(bigint) from public, anon, authenticated;
grant execute on function public.papelera_leads_fks() to service_role;
grant execute on function public.papelera_leads_uno(bigint, bigint, text, jsonb) to service_role;
grant execute on function public.mandar_leads_a_papelera(bigint, bigint[], text) to service_role;
grant execute on function public.recuperar_leads_de_papelera(bigint, bigint[]) to service_role;
grant execute on function public.purgar_papelera_leads(bigint) to service_role;

commit;

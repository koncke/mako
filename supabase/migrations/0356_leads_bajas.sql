-- ============================================================================
-- 0356_leads_bajas — el renglón que sobrevive al borrado de un lead (30/10/2026)
-- ============================================================================
-- Medido el 30/10/2026: 4.457 filas de `lead_audit` (1.371 leads) son de leads que ya no existen, y ninguna dice quién los
-- borró ni cuándo. La papelera (0340) saca una foto, pero la foto se purga a los 30 días, y dos caminos no pasan por ella. Si un
-- cliente pregunta «¿qué pasó con estos leads?», la respuesta era «no sabemos».
--
-- Es un TRIGGER y no una línea en el código porque así no lo esquiva nadie: ni un camino nuevo, ni un script, ni el SQL a mano.
--   · A NIVEL DE SENTENCIA (`referencing old table`): un borrado de 400 es UN renglón por negocio, no 400 inserts.
--   · NUNCA FRENA UN BORRADO: si anotar falla, avisa con un warning y el lead se borra igual.
--   · SIN FK a `leads`: tiene que sobrevivirle. Y no se purga.
--   · SÓLO IDS, sin nombres ni teléfonos: esto queda para siempre, y la foto con los datos ya tiene su plazo de 30 días.
--
-- Quién y por qué camino los dice quien borra, en dos variables de la transacción (`mako.baja_camino`, `mako.baja_por`). Sólo se
-- pueden poner desde una función: desde PostgREST cada pedido es su propia transacción. Por eso `borrar_lead_anotado`, y por eso
-- `mandar_leads_a_papelera` se vuelve a crear con esas dos líneas. Sin ellas el renglón dice `sin_camino`, y `rol` y `app` dicen
-- de dónde vino (`service_role` + `postgrest` es la app; `postgres` es un script o SQL a mano).
--
-- Los dos caminos que NO pasan por la papelera, y por qué (lib/leads-bajas.ts):
--   · `unificar` (lib/leads-unificar.ts): todo lo que colgaba ya se mudó a la ficha que queda, y lo que se decidió está en su
--     historial. Recuperarla devolvería una ficha duplicada y vacía.
--   · `zernio_duplicado` (lib/zernio-entrante.ts): el lead nació segundos antes en la misma función y perdió la carrera contra
--     otro evento de la misma persona. Nadie lo vio y lo que traía se le pasa al ganador.

create table if not exists leads_bajas (
  id bigserial primary key,
  workspace_id bigint not null,
  at timestamptz not null default now(),
  cuantos integer not null,
  lead_ids bigint[] not null,
  camino text not null,
  por text,
  rol text,
  app text
);
create index if not exists leads_bajas_ws_idx on leads_bajas (workspace_id, at desc);
create index if not exists leads_bajas_lead_idx on leads_bajas using gin (lead_ids);
alter table leads_bajas enable row level security;
revoke all on leads_bajas from anon, authenticated;
grant select, insert, delete on leads_bajas to service_role;
grant usage, select on sequence leads_bajas_id_seq to service_role;
comment on table leads_bajas is
  'Quién, cuándo, cuántos y por qué camino se borraron leads. Lo escribe el trigger trg_leads_bajas. No se purga: sobrevive a la foto de la papelera (30 días). Sólo ids.';

create or replace function public.leads_bajas_anotar()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into leads_bajas (workspace_id, cuantos, lead_ids, camino, por, rol, app)
  select v.workspace_id, count(*)::integer, array_agg(v.id order by v.id),
         coalesce(nullif(current_setting('mako.baja_camino', true), ''), 'sin_camino'),
         nullif(current_setting('mako.baja_por', true), ''),
         current_user,
         nullif(current_setting('application_name', true), '')
  from viejos v
  group by v.workspace_id;
  return null;
exception when others then
  -- Anotar nunca frena el borrado: perder este renglón es malo, pero un «Eliminar» que no borra es peor.
  raise warning 'leads_bajas: no pude anotar la baja (%): %', sqlstate, sqlerrm;
  return null;
end;
$$;

drop trigger if exists trg_leads_bajas on leads;
create trigger trg_leads_bajas
  after delete on leads
  referencing old table as viejos
  for each statement
  execute function public.leads_bajas_anotar();

-- Borra UN lead diciendo por qué camino y quién. Devuelve cuántas filas borró (0 si no es de ese negocio).
create or replace function public.borrar_lead_anotado(p_ws bigint, p_id bigint, p_camino text, p_por text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_n integer;
begin
  perform set_config('mako.baja_camino', coalesce(p_camino, ''), true);
  perform set_config('mako.baja_por', coalesce(p_por, ''), true);
  delete from leads where id = p_id and workspace_id = p_ws;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- La misma de la 0340, con las dos líneas de `set_config`: cada lead de la tanda queda anotado como «papelera», con quién.
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
  perform set_config('mako.baja_camino', 'papelera', true);
  perform set_config('mako.baja_por', coalesce(p_por, ''), true);
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

revoke execute on function public.leads_bajas_anotar() from public, anon, authenticated;
revoke execute on function public.borrar_lead_anotado(bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.borrar_lead_anotado(bigint, bigint, text, text) to service_role;

notify pgrst, 'reload schema';

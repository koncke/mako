-- =============================================================================
-- 0340_partner_codigo_editable — el partner cambia su código, y los links viejos siguen contando (27/10/2026)
-- =============================================================================
-- Leila en la llamada con Martín (Fathom 876470842-06): el código de MaKo Partners nace del nombre del negocio y no se podía
-- cambiar (app/partners/PanelPartner.tsx sólo lo copiaba). Cambiarlo tiene que dejar el nuevo ÚNICO y que lo de antes siga
-- acreditándole: los links /r/<viejo> que ya mandó por WhatsApp, la cookie de 60 días de quien ya entró, y los cobros que ya
-- tienen `ref_codigo = <viejo>`.
--
--   · `partner_codigos_anteriores`: cada código que un partner dejó de usar, con su negocio. Un código viejo NUNCA pasa a
--     otro negocio: la lectura (lib/partners-programa.ts, `wsDelCodigo`) busca primero el actual y después acá.
--   · `cambiar_codigo_partner(ws, nuevo)`: el cambio, atómico y serializado (un candado de la transacción): el nuevo no puede
--     ser el actual de nadie ni el anterior de OTRO negocio; el viejo pasa a los anteriores. Volver a un código propio de
--     antes vale (sale de los anteriores). Devuelve 'ok' | 'igual' | 'ocupado' | 'invalido' | 'sin_codigo'.
--   · Un TRIGGER en `partner_codigos`: ningún código nuevo (el que nace del nombre, `codigoDe`) puede ser el anterior de otro
--     negocio. Choca con 23505, el mismo error de «ocupado», y `codigoDe` prueba con sufijo como siempre.
--
-- NO va en lib/tablas-de-inquilino.ts a propósito: el reset del cliente de prueba la recorrería y, sin esta migración, una
-- tabla que no existe le da error. Borrar un negocio se la lleva igual (on delete cascade).
--
-- ORDEN: da igual. Sin la migración, el código nuevo no ofrece «Cambiar» con éxito (dice «todavía no se puede») y las lecturas
-- de los anteriores dan vacío. Con la migración y el código viejo, nada la usa.
-- TODO ADITIVO: una tabla, una función y un trigger nuevos. Seguro de re-ejecutar.
-- =============================================================================

create table if not exists partner_codigos_anteriores (
  codigo       text primary key check (codigo ~ '^[a-z0-9-]{3,32}$'),
  workspace_id bigint not null references workspaces(id) on delete cascade,
  hasta        timestamptz not null default now()
);
create index if not exists partner_codigos_anteriores_ws on partner_codigos_anteriores (workspace_id);
comment on table partner_codigos_anteriores is 'Los códigos de MaKo Partners que un negocio dejó de usar: siguen acreditándole (mig 0340).';

alter table partner_codigos_anteriores enable row level security;
revoke all on partner_codigos_anteriores from anon, authenticated;

create or replace function partner_codigo_no_es_de_otro() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from partner_codigos_anteriores a where a.codigo = new.codigo and a.workspace_id <> new.workspace_id) then
    raise exception 'el código % fue de otro partner', new.codigo using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists partner_codigos_no_de_otro on partner_codigos;
create trigger partner_codigos_no_de_otro before insert or update of codigo on partner_codigos
  for each row execute function partner_codigo_no_es_de_otro();

create or replace function cambiar_codigo_partner(p_ws bigint, p_nuevo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_viejo text;
begin
  if p_nuevo is null or p_nuevo !~ '^[a-z0-9-]{3,32}$' then return 'invalido'; end if;
  -- Un cambio a la vez en todo el programa: el chequeo y la escritura no se cruzan con otro cambio ni con otra alta.
  perform pg_advisory_xact_lock(hashtext('partner_codigos'));
  select codigo into v_viejo from partner_codigos where workspace_id = p_ws for update;
  if v_viejo is null then return 'sin_codigo'; end if;
  if v_viejo = p_nuevo then return 'igual'; end if;
  if exists (select 1 from partner_codigos where codigo = p_nuevo) then return 'ocupado'; end if;
  if exists (select 1 from partner_codigos_anteriores where codigo = p_nuevo and workspace_id <> p_ws) then return 'ocupado'; end if;
  delete from partner_codigos_anteriores where codigo = p_nuevo and workspace_id = p_ws;
  insert into partner_codigos_anteriores (codigo, workspace_id) values (v_viejo, p_ws) on conflict (codigo) do nothing;
  update partner_codigos set codigo = p_nuevo where workspace_id = p_ws;
  return 'ok';
end $$;

revoke all on function cambiar_codigo_partner(bigint, text) from public, anon, authenticated;
grant execute on function cambiar_codigo_partner(bigint, text) to service_role;

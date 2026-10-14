-- 0272 — La OFERTA que compró un lead, y el modelo de cobro de una oferta.
--
-- Pedido de Martín (13/10/2026, feedback del detalle del lead, Pagos punto 1): «dentro de un
-- FUNNEL el usuario podría elegir como "Ganado" y asignar una OFERTA de las que haya analizado...
-- primero deberías poner un desplegable para asignar una oferta, o agregar una nueva que se haga
-- desde allí mismo, con unas preguntas mínimas como nombre de la oferta, modelo (pago unico,
-- suscripción) y el ticket».
--
-- · leads.oferta_id: a qué oferta entró el lead. NULL = no se eligió. Si la oferta se borra, el
--   lead queda sin oferta (no se borra el lead).
-- · ofertas.modelo: cómo se cobra ('unico' | 'suscripcion'). NULL = no se dijo; las ofertas que ya
--   existen quedan así. El ticket sigue en `precio_usd` (en una suscripción, el de cada mes).
--
-- ⚠️ ORDEN: ANTES (o junto con) el deploy. `listarOfertas` pide `modelo` en su lista de columnas, y
-- sin la columna esa lectura falla — también en la tab Offer.
--
-- ⚠️ La FK sólo mira que la oferta EXISTA, no de quién es: que sea del mismo workspace lo comprueba
-- el código antes de escribir (`esDelWorkspace`, lib/ofertas.ts).

alter table leads add column if not exists oferta_id bigint references ofertas(id) on delete set null;

alter table ofertas add column if not exists modelo text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ofertas_modelo_ck') then
    alter table ofertas add constraint ofertas_modelo_ck check (modelo is null or modelo in ('unico', 'suscripcion'));
  end if;
end $$;

create index if not exists leads_oferta_idx on leads (workspace_id, oferta_id) where oferta_id is not null;

comment on column leads.oferta_id is 'La oferta a la que entró el lead (la tab Pagos de su ficha). Mig 0272.';
comment on column ofertas.modelo is 'Cómo se cobra: unico | suscripcion (el ticket es precio_usd; en una suscripción, el mensual). Mig 0272.';

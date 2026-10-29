-- =============================================================================
-- 0343_tickets_al_cerebro — cada ticket NUEVO le llega al Cerebro por el Runner (29/10/2026)
-- =============================================================================
-- Martín, 29/10/2026 ~05:55: «Te están llegando los tickets? Cada cuánto?… Mejor si puede ser instantáneo». Medido esa noche:
-- al Cerebro le llegaban solos sólo los del triage (`despacho = 'runner'`, por el Runner, con la marca `aviso_*` de la 0311).
-- Los que esperan la decisión de Martín no le llegaban nunca: había 8 en `esperando_decision`, uno de 6 minutos antes.
--
-- Desde ahora el Runner (cartero 1.23.0) le escribe al chat «Cerebro» un texto FIJO con el número de cada ticket que entra a
-- esperar a Martín (lib/tickets-runner.ts → `ticketsNuevosParaElCartero`; el texto, `mensajeTicketNuevo`). Nada del cliente.
--
--   · `cerebro_*`: la marca de ESA entrega. Es aparte A PROPÓSITO: `aviso_*` es lo que la bandeja de Martín dibuja como
--     «Entregado al Cerebro» para los del triage (lib/tickets-aviso.ts → `entregaAlCerebro`), y se queda como está.
--   · `cerebro_estado` arranca en 'pendiente' y nunca es null: así la vuelta filtra lo que falta con un `in` (un `<>` de SQL
--     deja afuera los null, y un ticket sin marca no saldría nunca).
--   · Los tickets que ya existen quedan 'pendiente': los que siguen esperando a Martín le llegan al Cerebro en la primera
--     vuelta (de a 5). Los cerrados, los del triage y los que Martín ya aprobó no: la vuelta mira el estado y el despacho.
--
-- ⚠️ ORDEN DE DESPLIEGUE: da igual. El código nuevo sin estas columnas no se cae: la vuelta dice el error en
-- `ticketsNuevosError` y entrega lo demás (los pedidos, los avisos y los del triage); `hay` no los cuenta. Idempotente.

begin;

alter table tickets
  add column if not exists cerebro_id       uuid,
  add column if not exists cerebro_estado   text not null default 'pendiente'
    check (cerebro_estado in ('pendiente', 'tomado', 'entregado', 'no_entregado', 'incierto')),
  add column if not exists cerebro_at       timestamptz,
  add column if not exists cerebro_intentos integer not null default 0,
  add column if not exists cerebro_motivo   text;

comment on column tickets.cerebro_estado is 'La entrega al Cerebro de un ticket NUEVO por el Runner (cartero 1.23.0, mig 0343). Aparte de aviso_*, que es la de los bugs del triage.';

-- El acuse busca por el id del intento, como el de aviso_id.
create unique index if not exists tickets_cerebro_id_idx on tickets (cerebro_id) where cerebro_id is not null;

commit;

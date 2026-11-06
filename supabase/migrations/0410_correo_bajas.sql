-- ============================================================================
-- 0410_correo_bajas — «no me escribas más» se guarda por DIRECCIÓN, no por cuenta (6/11/2026)
-- ============================================================================
-- La baja de los correos de avance de un ticket vivía SÓLO en `usuarios.perfil.ticketsPorEmail`
-- (0364 + app/api/email/unsubscribe/tickets). Eso la ata a una FILA de `usuarios`, y una fila de
-- `usuarios` no es una persona: es una persona EN UN NEGOCIO. `usuarios(email)` tiene un índice
-- NO único (0053), así que la misma dirección puede estar en varios workspaces — es el caso normal
-- de quien trabaja en su cuenta y en la de un cliente de su agencia.
--
-- Qué compraba eso: alguien que apretó «Dejar de recibirlos» en el correo de un negocio seguía
-- recibiéndolos por el otro. La decisión del cron es por `usuario_id` (lib/tickets-avance.ts →
-- `decidirAvance`), y la otra fila nunca se enteró. Para la persona, que ve una sola casilla de
-- correo, es «pedí la baja y me siguen llegando».
--
-- Y el otro agujero, el que quedó anotado en docs/relevo/nube-tickets.md: quien NO tiene cuenta (un
-- ticket por WhatsApp sin perfil, el alumno de un curso) no tenía NINGÚN lugar donde guardar su
-- baja. Hoy a esa persona no le sale ningún correo de avance (`decidirAvance` pide `usuario_id` y un
-- email de verdad), así que no es un correo de más todavía; es que el día que un camino nuevo le
-- escriba, su «no me escribas» no existe en ninguna parte. Acá sí.
--
--   · SIN `workspace_id`, A PROPÓSITO. Es la única columna que alguien va a querer agregarle, y
--     agregarla sería volver al bug: la dirección es de la PERSONA y no del negocio, y una baja que
--     vale en un negocio y no en el otro es exactamente lo que esto viene a arreglar. Por eso
--     tampoco lleva RLS por negocio: la lee y la escribe el service_role.
--   · `tipo` para no mezclar familias de correo. Hoy sólo `ticket-avance`: la baja de los correos de
--     los tickets no apaga, por ejemplo, un aviso de cambio de plan. Sumar una familia es tocar el
--     `check`.
--   · `email` en minúsculas, y lo fija un `check`: la comparación del cron es con `toLowerCase()`, y
--     una fila en mayúsculas sería una baja que no frena nada. El `unique (email, tipo)` es lo que
--     hace que el upsert de la ruta sea idempotente (apretar dos veces no apila filas).
--   · NO se purga, y no es dato de un negocio: es lo contrario de un dato: es el pedido de que no se
--     le escriba. Borrarlo le volvería a mandar correos.
--
-- ⚠️ ORDEN DE DESPLIEGUE: esta migración va PRIMERO. El código nuevo la necesita para decidir, y si
-- la tabla no está la vuelta del cron NO manda nada y lo dice («falta la migración 0410»): un correo
-- a quien pidió la baja es peor que un correo de menos, y esa es la regla que ya tenía el archivo.
-- Sólo AGREGA (tabla nueva) y es idempotente.

begin;

create table if not exists correo_bajas (
  id bigserial primary key,
  email text not null check (email = lower(email) and email <> ''),
  tipo text not null check (tipo in ('ticket-avance')),
  at timestamptz not null default now(),
  -- De qué camino vino la baja: el botón de la página, el «Cancelar suscripción» de Gmail (RFC 8058)
  -- o la casilla de Notificaciones. Para poder contestar «¿cuándo y cómo la pidió?».
  por text,
  unique (email, tipo)
);

alter table correo_bajas enable row level security;
revoke all on correo_bajas from anon, authenticated;
grant select, insert, update, delete on correo_bajas to service_role;
grant usage, select on sequence correo_bajas_id_seq to service_role;

comment on table correo_bajas is
  'Quién pidió no recibir una familia de correos, por DIRECCIÓN y no por cuenta (mig 0410). Sin workspace_id a propósito: la dirección es de la persona, no del negocio, y la misma puede estar en varios workspaces. No se purga.';
comment on column correo_bajas.tipo is
  'La familia de correos que se apagó. Hoy sólo ticket-avance (lib/tickets-avance.ts → TIPO_BAJA_TICKETS).';

commit;

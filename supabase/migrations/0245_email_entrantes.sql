-- =============================================================================
-- 0245 — email_entrantes: los emails que LLEGAN (Resend `email.received`), deduplicados y con rastro
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae app/api/webhooks/email-entrante. La
-- ruta nueva ESCRIBE acá antes de disparar nada, y sin la tabla contesta 200 «sin_tabla» y no inscribe
-- a nadie (sin fila no hay cómo deduplicar: un reintento del webhook dispararía dos veces). Agrega y
-- no saca nada: la versión desplegada no la mira, así que aplicarla antes no le molesta a nadie. Y
-- hoy no llega ningún mail todavía: falta prender «Receiving» en Resend (ver la cabecera de la ruta).
--
-- Pedido de Martín (09/10/2026, sexta tanda, CRON 8): «Si recibo un email, que se pueda configurar
-- automatizaciones». Las reglas, en lib/email-entrante-reglas.ts.
--
-- UNA FILA POR EMAIL, y es dos cosas a la vez:
--   · LA DEDUPLICACIÓN: `email_id` (el id de Resend) es ÚNICO. Resend firma con Svix y REINTENTA: el
--     reintento trae el mismo id y choca acá (23505) en vez de disparar la automatización otra vez.
--   · EL RASTRO de lo que se descartó, con su motivo (AGENTS.md, «Una política puede RECHAZAR; no
--     puede no dejar rastro»): sin un workspace que reclame el dominio, sin lead con ese email, varios
--     leads con el mismo email, un remitente automático. Por eso `workspace_id` ADMITE null: un email
--     que no es de ningún negocio también queda escrito (y nunca se le asigna uno «por default»).
--
-- Guarda los datos del SOBRE (quién, a quién, el asunto): el cuerpo no viene en el webhook de Resend
-- y no se pide. ⚠️ `de` es un email de una persona: la tabla es sólo server-side (RLS sin políticas y
-- sin grants para anon/authenticated), como el resto.
--
-- ⚠️ Y VA A `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts): el reset y el borrado de un workspace
-- tienen que vaciarla. Lo hace quien integra la tanda (es un archivo de otra parte).

begin;

create table if not exists email_entrantes (
  id             bigserial primary key,
  email_id       text not null check (char_length(email_id) between 1 and 120),
  -- null = no es de ningún negocio (o es de dos): queda el rastro, no se le asigna uno.
  workspace_id   bigint references workspaces(id) on delete cascade,
  de             text not null check (char_length(de) between 3 and 320),
  para           text[] not null default '{}',
  asunto         text not null default '' check (char_length(asunto) <= 300),
  message_id     text check (message_id is null or char_length(message_id) <= 300),
  recibido_at    timestamptz,
  lead_id        bigint references leads(id) on delete set null,
  -- La misma lista que `ESTADOS_ENTRANTE` (lib/email-entrante-reglas.ts). 'error' es el único que un
  -- reintento del webhook puede volver a procesar (compare-and-set sobre esta columna).
  estado         text not null check (estado in ('procesando', 'disparado', 'sin_workspace', 'sin_lead', 'ambiguo', 'automatico', 'error')),
  motivo         text check (motivo is null or char_length(motivo) <= 300),
  -- Cuántas automatizaciones inscribió (`enrolarPorEvento`). 0 = ninguna escucha ese evento.
  inscripciones  integer check (inscripciones is null or inscripciones >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists email_entrantes_email_id_uk on email_entrantes (email_id);
create index if not exists idx_email_entrantes_ws on email_entrantes (workspace_id, created_at desc);

comment on table email_entrantes is 'Emails que llegan por Resend (email.received): deduplicación por email_id y rastro de lo que disparó o se descartó. workspace_id null = de ningún negocio.';

-- RLS on sin políticas = sólo server-side (service_role), igual que el resto.
alter table email_entrantes enable row level security;
revoke all on email_entrantes from anon, authenticated;

commit;

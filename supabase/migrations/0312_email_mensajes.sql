-- =============================================================================
-- 0312 — email_mensajes: los emails de la bandeja de Chats (17/10/2026)
-- =============================================================================
-- Pedido de Martín (17/10/2026): «eliminar las tabs de "Email y WhatsApp" y unificarlo todo en "Chats"... que todo
-- funcione bien». El email pasa a ser un CANAL de la bandeja: lo que llega y lo que se contesta, con su hilo y sus
-- adjuntos. El diseño: docs/diseno-sidebar.md §5.
--
-- UNA FILA POR EMAIL de una conversación, entrante o saliente:
--   · entrante: la escribe el webhook de Resend (`email.received`, lib/email-entrante.ts) DESPUÉS de leer el cuerpo y
--     los adjuntos con GET /emails/receiving/{id} (el webhook trae sólo el sobre). `resend_id` es el id del recibido.
--   · saliente: la escribe /api/chats/email al contestar desde Chats; `resend_id` es el id del enviado.
-- `resend_id` ÚNICO: un reintento del webhook no duplica el mensaje.
-- `contacto` es el email del OTRO, en minúsculas: con él se arma el contacto sin lead (`em:<email>`) y se busca el hilo.
-- `lead_id` admite null: un email de alguien que todavía no está en el CRM también se ve (se agrega desde Chats).
--
-- ⚠️ `email_entrantes` (0245) SIGUE SIENDO la deduplicación y el rastro del DISPARO de automatizaciones; esta tabla es la
-- CONVERSACIÓN. Son dos preguntas distintas y no se mezclan.
-- ⚠️ Server-only (RLS sin políticas, sin grants para anon/authenticated), y a TABLAS_DE_INQUILINO y TENANT_TABLES.
-- Aditiva: la versión desplegada no la mira; se aplica antes o junto con el deploy.

begin;

create table if not exists email_mensajes (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  lead_id       bigint references leads(id) on delete set null,
  direccion     text not null check (direccion in ('entrante', 'saliente')),
  contacto      text not null check (char_length(contacto) between 3 and 320),
  de            text not null check (char_length(de) between 3 and 320),
  para          text[] not null default '{}',
  asunto        text not null default '' check (char_length(asunto) <= 300),
  texto         text not null default '' check (char_length(texto) <= 100000),
  message_id    text check (message_id is null or char_length(message_id) <= 300),
  in_reply_to   text check (in_reply_to is null or char_length(in_reply_to) <= 300),
  resend_id     text check (resend_id is null or char_length(resend_id) <= 120),
  -- [{ nombre, mime, tamano, ruta }]: `ruta` es la del bucket privado `chats-email` (`<ws>/<id>/<nombre>`).
  adjuntos      jsonb not null default '[]'::jsonb,
  estado        text not null default 'ok' check (estado in ('ok', 'fallido')),
  error         text check (error is null or char_length(error) <= 300),
  -- Quién lo mandó desde Chats (un saliente); null en un entrante.
  autor         text check (autor is null or char_length(autor) <= 120),
  created_at    timestamptz not null default now()
);

create unique index if not exists email_mensajes_resend_id_uq on email_mensajes (resend_id) where resend_id is not null;
create index if not exists email_mensajes_lead_idx on email_mensajes (workspace_id, lead_id, created_at desc);
create index if not exists email_mensajes_contacto_idx on email_mensajes (workspace_id, contacto, created_at desc);

alter table email_mensajes enable row level security;
revoke all on email_mensajes from anon, authenticated;

-- Los adjuntos: bucket PRIVADO, se sirven con una URL firmada desde /api/chats/email/adjunto.
insert into storage.buckets (id, name, public) values ('chats-email', 'chats-email', false)
on conflict (id) do nothing;

commit;

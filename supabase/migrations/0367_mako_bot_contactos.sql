-- =============================================================================
-- 0367 — mako_bot_contactos: quién le escribió al WhatsApp de MaKo, y cuándo
-- =============================================================================
--
-- ORDEN DE DESPLIEGUE: da igual. Sin la tabla, la puerta de salida (lib/mako-salida.ts) no puede leer la ventana y no manda
-- nada; el bot, además, está apagado hasta que alguien le ponga una línea (`mako.bot.instancia`). Sólo agrega.
--
-- POR QUÉ UNA TABLA Y NO `mako_doer_conv`. «Sólo contesta a quien le escribió hace menos de 24 horas» es la regla que no se puede romper, y
-- tiene que valer para los que no son de ningún negocio (quien llega de la landing). La conversación es de cada negocio; esta fila es de la PERSONA,
-- y por eso no lleva `workspace_id`: se lee con la llave de servicio y ningún cliente la ve.
--
-- `pregunta`: los mensajes que esperan a que elija de cuál negocio habla (una agencia), para contestarlos después de elegir.

create table if not exists public.mako_bot_contactos (
  jid                 text primary key,
  telefono            text,
  nombre              text,
  primer_entrante_at  timestamptz not null default now(),
  ultimo_entrante_at  timestamptz not null default now(),
  ws_elegido          bigint,
  pregunta            jsonb,
  dia                 date,
  turnos_dia          integer not null default 0,
  tope_avisado        boolean not null default false,
  updated_at          timestamptz not null default now()
);

create index if not exists mako_bot_contactos_telefono on public.mako_bot_contactos (telefono);

alter table public.mako_bot_contactos enable row level security;

comment on table public.mako_bot_contactos is
  'Quién le escribió al WhatsApp de MaKo. Sin fila o con más de 24 horas, la puerta de salida no manda nada (lib/mako-salida.ts).';

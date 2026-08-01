-- =============================================================================
-- 0108: biblioteca de audios del setting (notas de voz del dueño)
-- =============================================================================
-- La reunión del 31/07 definió que el vehículo de la nutrición por WhatsApp son
-- AUDIOS grabados por el dueño con su propia voz (estandarizados, el mismo para
-- todos), no texto. Acá viven: el binario va al bucket wa-media (mismo que el
-- espejo del no oficial) y esta tabla guarda el catálogo por workspace.
--
-- Un paso de secuencia con tipo='audio' referencia `audio_id`; el motor baja el
-- binario y lo manda por Evolution (enviarAudioYEspejar).

create table if not exists setting_audios (
  id           bigserial primary key,
  workspace_id bigint not null default 1 references workspaces(id) on delete cascade,
  titulo       text not null,
  media_path   text not null,              -- path dentro del bucket wa-media
  media_mime   text not null default 'audio/ogg',
  duracion_s   integer,
  transcript   text,                       -- lo que dice el audio (STT) — contexto para MaKo
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_setting_audios_ws on setting_audios (workspace_id, created_at desc);

alter table setting_audios enable row level security;

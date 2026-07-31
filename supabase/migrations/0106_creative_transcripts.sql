-- =============================================================================
-- 0106_creative_transcripts — transcribir el video AL SUBIRLO, no al día siguiente
-- =============================================================================
-- Hasta ahora el video se transcribía DOS veces de más: el creativo se subía a
-- Meta (los bytes ya pasaban por nuestro storage) y recién al día siguiente el
-- cron transcribe-ads volvía a bajar el mp4 DESDE Meta para pasarlo por whisper,
-- de a 8 por corrida. Trabajo y plata duplicados, y encima el anuncio no tenía
-- texto durante ~1 día (por eso los que crea MaKo se llamaban "Anuncio" a secas:
-- al nombrarlos todavía no había nada que leer).
--
-- Acá se guarda la transcripción hecha EN EL MOMENTO DE LA SUBIDA, indexada por
-- el video_id de Meta (que es lo único que existe en ese momento: el ad_id se
-- crea después, al publicar). Cuando el anuncio se crea, la fila se copia a
-- ad_transcripts con su ad_id — y como ad_transcripts ya tiene fila, el cron lo
-- saltea solo (esa tabla usa "existe fila = no re-transcribir").
--
-- Es además una CACHÉ por video: si el mismo video se usa en varios anuncios
-- (muy común al testear ángulos), se transcribe una sola vez.
-- =============================================================================

begin;

create table if not exists creative_transcripts (
  video_id      text        not null,
  workspace_id  bigint      not null default 1 references workspaces(id) on delete cascade,
  -- mismos estados que ad_transcripts, para poder copiar la fila tal cual
  status        text        not null default 'ok'
                  check (status in ('ok', 'muy_grande', 'error')),
  transcript    text,
  secciones     jsonb,
  idioma        text,
  duracion_s    numeric,
  model         text,
  error         text,
  filename      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, video_id)
);

create index if not exists creative_transcripts_video on creative_transcripts (video_id);

comment on table creative_transcripts is
  'Transcripción del video hecha al SUBIR el creativo (antes de que exista el anuncio), indexada por el video_id de Meta. Al crear el anuncio se copia a ad_transcripts con su ad_id; el cron transcribe-ads entonces lo saltea. Evita transcribir dos veces el mismo video.';

-- Solo service_role, igual que el resto de las tablas multi-tenant.
alter table creative_transcripts enable row level security;

commit;

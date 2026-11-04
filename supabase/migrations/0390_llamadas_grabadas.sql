-- =============================================================================
-- 0390 — llamadas_grabadas: las llamadas que se graban desde MaKo (la ficha del lead y Cold Calling)
-- =============================================================================
-- Pedido de Martín (04/11/2026): «quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard
-- template que sea "Call Calling"». El botón graba en el navegador (o en la app del teléfono), el audio queda en el lead,
-- y MaKo lo transcribe y lo analiza con el Closing (lib/grabar-llamada.ts, docs/relevo/nube-grabar.md).
--
-- DOS TABLAS, a propósito:
--   · `llamadas_grabadas`: UNA fila por llamada (el lead, quién grabó, cuánto duró, cómo terminó y en qué va).
--   · `llamadas_grabadas_partes`: el audio va en PARTES de 3 minutos, cada una un archivo entero que se sube apenas se
--     cierra. Si el navegador se cae a mitad de la llamada, lo grabado hasta ahí ya está guardado. Cada parte escribe SU
--     transcripción en SU fila: dos partes que terminan a la vez no se pisan (en un jsonb de la llamada, sí).
--
-- `clave`: la clave de la reunión para el Closing (`closing_analyses.recording_id`, negativa: lib/grabadores/reunion.ts →
--   `claveDeReunion('grabadora', id)`). Con ella el análisis queda atado a ESTA llamada y la ficha de la llamada del
--   Dashboard lee la transcripción de acá.
-- `resultado`: lo que dice la PERSONA al cortar (un toque: no contestó, habló, agendó, no le interesa). Es lo que cuenta la
--   plantilla Cold Calling; no lo adivina un modelo.
--
-- El audio: bucket PRIVADO `llamadas-grabadas` (`<ws>/<grabacion>/<n>.<ext>`), servido con una URL firmada.
--
-- ORDEN DE DESPLIEGUE: ANTES o junto con el deploy. Sólo agrega. Sin las tablas el botón dice que la grabación todavía no
-- está lista y no graba (lib/grabar-llamada.ts tolera 42P01), pero el reset del Cliente de Prueba barre TABLAS_DE_INQUILINO y
-- avisaría que no existen.
-- ⚠️ Server-only (RLS sin políticas, sin grants para anon/authenticated), y a TABLAS_DE_INQUILINO y TENANT_TABLES.

begin;

create table if not exists llamadas_grabadas (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  -- En cascada: la papelera del lead (mig 0340) se lleva y devuelve la grabación con él.
  lead_id       bigint not null references leads(id) on delete cascade,
  -- De dónde se grabó: la ficha del lead o el Dashboard (la plantilla Cold Calling).
  origen        text not null default 'ficha' check (origen in ('ficha', 'cold-calling')),
  -- Quién grabó (el usuario de la sesión) y su nombre como se veía ese día.
  usuario_id    bigint,
  autor         text check (autor is null or char_length(autor) <= 120),
  -- grabando → (cortó) transcribiendo → analizando → lista. `sin_ia`: el audio quedó y falta la IA del negocio.
  estado        text not null default 'grabando'
                check (estado in ('grabando', 'transcribiendo', 'analizando', 'lista', 'sin_ia', 'error')),
  -- Qué se pudo grabar: el micrófono solo, o el micrófono y la pestaña de la llamada (Meet, Zoom en el navegador).
  fuente        text not null default 'microfono' check (fuente in ('microfono', 'microfono_y_pestana')),
  mime          text check (mime is null or char_length(mime) <= 80),
  -- Las partes que la pantalla dice que mandó al cortar: hasta tenerlas todas, no se analiza.
  partes_total  integer check (partes_total is null or partes_total between 0 and 200),
  duracion_seg  integer check (duracion_seg is null or duracion_seg between 0 and 36000),
  resultado     text check (resultado is null or resultado in ('no_contesto', 'hablo', 'agendo', 'no_interesa')),
  clave         bigint,
  -- El porqué de un `sin_ia` o un `error`, en la frase que lee la persona.
  motivo        text check (motivo is null or char_length(motivo) <= 400),
  -- Quién transcribió (`groq`, `openai · cuenta 2`): lo que se le pide a toda transcripción (IA7).
  transcribio   text check (transcribio is null or char_length(transcribio) <= 80),
  terminada_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists llamadas_grabadas_lead_idx on llamadas_grabadas (workspace_id, lead_id, created_at desc);
create index if not exists llamadas_grabadas_ws_idx on llamadas_grabadas (workspace_id, created_at desc);
create unique index if not exists llamadas_grabadas_clave_uq on llamadas_grabadas (workspace_id, clave) where clave is not null;

create table if not exists llamadas_grabadas_partes (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  grabacion_id  uuid not null references llamadas_grabadas(id) on delete cascade,
  n             integer not null check (n between 0 and 199),
  ruta          text not null check (char_length(ruta) between 3 and 300),
  mime          text not null check (char_length(mime) <= 80),
  bytes         integer not null check (bytes between 1 and 5000000),
  -- Dónde empieza esta parte en la llamada y cuánto dura (segundos): la transcripción de la llamada sale con su minuto.
  inicio_seg    integer not null default 0 check (inicio_seg between 0 and 36000),
  segundos      integer check (segundos is null or segundos between 0 and 3600),
  -- pendiente → lista (con texto, o vacía si no se oía nada) · sin_ia · error.
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'lista', 'sin_ia', 'error')),
  texto         text check (texto is null or char_length(texto) <= 200000),
  motivo        text check (motivo is null or char_length(motivo) <= 400),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Una parte por número: un reintento de la subida no la duplica.
create unique index if not exists llamadas_grabadas_partes_n_uq on llamadas_grabadas_partes (grabacion_id, n);
create index if not exists llamadas_grabadas_partes_ws_idx on llamadas_grabadas_partes (workspace_id, grabacion_id);

alter table llamadas_grabadas enable row level security;
alter table llamadas_grabadas_partes enable row level security;
revoke all on llamadas_grabadas from anon, authenticated;
revoke all on llamadas_grabadas_partes from anon, authenticated;

insert into storage.buckets (id, name, public) values ('llamadas-grabadas', 'llamadas-grabadas', false)
on conflict (id) do nothing;

commit;

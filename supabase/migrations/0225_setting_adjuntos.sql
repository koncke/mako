-- =============================================================================
-- 0225 — setting_adjuntos: la biblioteca de ARCHIVOS de los mensajes del chatbot
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: se aplica ANTES del deploy. El código nuevo la LEE: el editor del
-- mensaje lista la biblioteca (/api/chat-agent/adjuntos), el motor baja el archivo de un paso
-- `tipo: 'media'` (`getAdjunto`) y el reset del workspace la vacía (TABLAS_DE_INQUILINO). Agrega
-- y no saca nada: la versión desplegada no la mira, así que aplicarla antes no le molesta. Sin
-- ella, un paso con archivo falla al mandarse y el reset avisa «esa tabla no existe».
--
-- Pedido de Martín (08/10/2026, punto 8): «todo lo que tenga que ver con WhatsApp tenga un mismo
-- editable, ya sea audio, texto, archivos... que se pueda adjuntar archivos». Diseño:
-- docs/chatbot-flujo-ramas-diseno.md. Molde: `setting_audios` (mig 0108).
--
-- Un paso lleva `media_id` (una fila de aquí), NUNCA el binario: `setSecuenciaPasos` reconstruye
-- cada paso campo por campo, y un base64 embebido se perdería en el primer guardado hecho desde
-- otra pantalla (AGENTS.md, «un adjunto va por referencia»). El mismo PDF de precios se usa en
-- diez secuencias y se cambia en un lugar.
--
-- El binario vive en el bucket `wa-media` (el del espejo del no oficial) bajo
-- `<ws>/setting-adjuntos/<uuid>.<ext>` — NUNCA bajo `<ws>/mako_ws<ws>/`, que es el prefijo del
-- espejo y se limpia. ⚠️ `wa-media` no tiene `allowed_mime_types` ni `file_size_limit` (medido el
-- 08/10/2026): la lista de tipos y los topes los aplica el código (lib/setting-adjuntos-reglas.ts)
-- al firmar la subida y otra vez al registrarla, con lo que Storage dice que se guardó.

begin;

create table if not exists setting_adjuntos (
  id             bigserial primary key,
  -- SIN `default 1`, a propósito: una inserción que se olvide del workspace tiene que fallar, no
  -- caer en el del dueño. La lib lo escribe explícito, además de `getTenantDb`.
  workspace_id   bigint not null references workspaces(id) on delete cascade,
  titulo         text not null check (char_length(titulo) between 1 and 160),
  -- La forma del path, y nada más: el PREFIJO puede ser de otro workspace en una copia de
  -- «Completar con los datos de Mau» (la fila viaja con el path del dueño, como los audios).
  -- Quién puede BORRAR el binario lo decide `pathEsAdjuntoDe`, no esta columna.
  media_path     text not null check (media_path ~ '^[0-9]{1,12}/setting-adjuntos/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'),
  media_mime     text not null check (char_length(media_mime) between 1 and 120),
  -- El nombre con el que se subió: Evolution lo exige para un documento (`fileName`) y es el que
  -- ve el lead. El path es un uuid.
  nombre_archivo text check (nombre_archivo is null or char_length(nombre_archivo) between 1 and 200),
  tamano         bigint check (tamano is null or tamano > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Registrar dos veces el mismo archivo (un doble clic, un reintento) devuelve la misma fila.
create unique index if not exists setting_adjuntos_ws_path_uk on setting_adjuntos (workspace_id, media_path);
create index if not exists idx_setting_adjuntos_ws on setting_adjuntos (workspace_id, created_at desc);

comment on table setting_adjuntos is 'Biblioteca de archivos (foto, video, documento) de los mensajes del chatbot. Un paso tipo media la nombra por media_id. Binario en wa-media bajo <ws>/setting-adjuntos/.';

-- RLS on sin políticas = sólo server-side (service_role), igual que el resto.
alter table setting_adjuntos enable row level security;
revoke all on setting_adjuntos from anon, authenticated;

commit;

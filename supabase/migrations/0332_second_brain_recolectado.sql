-- =============================================================================
-- 0332 — second_brain_recolectado: lo que el recolector del Second Brain ya leyó, por conversación
-- =============================================================================
-- ORDEN DE DESPLIEGUE: ANTES del deploy (aditiva: una tabla nueva, nada se toca).
--
-- El recolector (docs/diseno-second-brain-recolector.md; lib/recolector.ts) lee las conversaciones de WhatsApp de cada
-- negocio, las resume con la IA DEL NEGOCIO en hechos y los guarda en su conocimiento (`mako_knowledge`, fuente
-- 'whatsapp'), que es lo que consulta el chat del Second Brain. Esta tabla es su libro: UNA fila por conversación leída,
-- con hasta qué mensaje leyó (`hasta`) y qué entrada del conocimiento la resume (`knowledge_id`).
--   · Es la MARCA: lo que se lee la vuelta siguiente es lo posterior a `hasta`. Si un paso falla, la fila no se escribe y
--     la marca no avanza («no pude leer» no es «no había nada»).
--   · Es la llave contra el duplicado: (workspace_id, fuente, ref) es único, y la conversación siguiente ACTUALIZA su
--     entrada en vez de crear otra.
--   · Es lo que ve la pantalla: de qué fuentes aprende el negocio, cuándo fue la última vez y cuánto entró.
--
-- Sin `texto` ni resumen acá: el contenido vive en `mako_knowledge` (que el negocio ve, edita y borra). Esta tabla sólo
-- dice QUÉ se leyó y hasta dónde. Por negocio (TENANT_TABLES): un dato recolectado no sale nunca de su workspace.
--
-- Si llega DESPUÉS del deploy: el cron no encuentra la tabla, lo dice en su respuesta y no corre (ni gasta IA). No se
-- pierde nada: la próxima vuelta, con la tabla, empieza desde los últimos 14 días.
-- =============================================================================

begin;

create table if not exists second_brain_recolectado (
  id            bigint generated always as identity primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  -- De dónde salió. Hoy sólo WhatsApp (el primer paso del diseño); Meta y Fathom, después, con el mismo molde.
  fuente        text not null check (fuente in ('whatsapp')),
  -- La conversación: el chat_jid de WhatsApp.
  ref           text not null check (char_length(ref) between 1 and 200),
  -- Con quién (el nombre del lead, del contacto o el número): lo que muestra la pantalla.
  etiqueta      text not null default '' check (char_length(etiqueta) <= 120),
  -- La entrada del conocimiento que resume esta conversación. Null = se leyó y no había nada que guardar.
  knowledge_id  bigint references mako_knowledge(id) on delete set null,
  -- Cuántos mensajes leyó en total y hasta cuál (la marca).
  mensajes      integer not null default 0 check (mensajes >= 0),
  hasta         timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, fuente, ref)
);

create index if not exists second_brain_recolectado_ws_fecha on second_brain_recolectado (workspace_id, updated_at desc);

alter table second_brain_recolectado enable row level security;
revoke all on second_brain_recolectado from anon, authenticated;

comment on table second_brain_recolectado is
  'El libro del recolector del Second Brain: una fila por conversación leída (fuente + ref), hasta qué mensaje (la marca) y qué entrada de mako_knowledge la resume. El contenido vive en mako_knowledge. Por negocio. lib/recolector.ts; docs/diseno-second-brain-recolector.md.';

commit;

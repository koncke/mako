-- =============================================================================
-- 0113 — buffer de mensajes del doer: esperar a que termine de hablar
-- =============================================================================
-- El 5/8 entraron 16 mensajes de WhatsApp en 4 segundos. Cada uno disparó su propia
-- invocación del agente, en paralelo y sin candado: salieron 16 borradores, 133
-- tareas y 19 proyectos duplicados. El dueño lo dijo así: «si detecta que le estoy
-- enviando muchos mensajes debería esperar y luego cargar TODAS las tareas al mismo
-- tiempo».
--
-- Dos tablas:
--   · mako_doer_buffer — los mensajes que van llegando, uno por fila. El índice
--     único por wa_message_id hace el dedup en el motor (antes era un string en
--     app_settings que dos invocaciones concurrentes se pisaban).
--   · mako_doer_lock — UNA fila por grupo. El que gana el update atómico es el
--     único que junta y responde; el resto solo encola y se va.
--
-- El buffer se persiste ANTES de contestarle el 200 a Evolution a propósito:
-- `after()` mantiene viva la invocación pero no la hace durable — si Vercel recicla
-- la instancia, lo que estaba solo en memoria se pierde sin reintento. En la tabla,
-- el cron lo levanta.
-- =============================================================================

begin;

create table if not exists mako_doer_buffer (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  grupo_jid     text not null,
  wa_message_id text not null default '',
  texto         text not null default '',        -- ya resuelto (el audio se transcribe al entrar)
  tiene_media   boolean not null default false,  -- imagen/PDF: no se combina con otros
  tiene_audio   boolean not null default false,  -- nota de voz: se espera más (grabar lleva tiempo)
  payload       jsonb not null default '{}'::jsonb,
  estado        text not null default 'pendiente', -- pendiente | procesado
  created_at    timestamptz not null default now()
);

-- El dedup de re-entregas de Evolution, en el motor y no en el código.
create unique index if not exists ux_doer_buffer_msg
  on mako_doer_buffer (workspace_id, grupo_jid, wa_message_id)
  where wa_message_id <> '';

create index if not exists ix_doer_buffer_pend
  on mako_doer_buffer (workspace_id, grupo_jid, estado, created_at);

create table if not exists mako_doer_lock (
  workspace_id bigint not null references workspaces(id) on delete cascade,
  grupo_jid    text not null,
  quien        text,                              -- id de la invocación que lo tiene
  hasta        timestamptz,                       -- vencimiento: si pasó, cualquiera lo toma
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, grupo_jid)
);

comment on table mako_doer_buffer is 'Mensajes de WhatsApp esperando a que el dueño termine de hablar, para procesarlos JUNTOS (mig 0113).';
comment on table mako_doer_lock   is 'Un solo respondedor por grupo: el que gana el update atómico junta el buffer y contesta.';

-- Solo service_role (getTenantDb): RLS on, sin policies — mismo patrón que el resto
-- de TENANT_TABLES. El scope por workspace lo pone el código.
alter table mako_doer_buffer enable row level security;
alter table mako_doer_lock   enable row level security;

commit;

notify pgrst, 'reload schema';

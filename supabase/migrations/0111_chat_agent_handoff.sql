-- =============================================================================
-- 0111 — protocolo de HAND OFF: cuando el lead se sale del guion
-- =============================================================================
-- Una secuencia tiene ESCENARIOS previstos (viven en estrategia.escenarios). Si
-- el lead contesta algo que encaja en uno, MaKo sabe que hacer. Si no encaja en
-- ninguno, improvisar es justo lo que NO debe hacer: se calla, avisa por el
-- grupo de WhatsApp, y el dueno le ensena el caso nuevo.
--
-- Por que una tabla y no solo un estado en la inscripcion: el estado dice QUE
-- paso, pero para poder ensenar el caso hace falta el mensaje LITERAL que lo
-- disparo. Sin eso el dueno tendria que ir a buscar la conversacion a mano.

create table if not exists chat_agent_handoffs (
  id            bigserial primary key,
  workspace_id  bigint not null default 1 references workspaces(id) on delete cascade,
  lead_id       bigint references leads(id) on delete cascade,
  secuencia_id  bigint references nutricion_secuencias(id) on delete set null,
  -- El mensaje del lead que no encajo en ningun escenario. Es lo que se le
  -- muestra al dueno para que decida como se responde de ahora en mas.
  mensaje       text not null,
  -- Por que el clasificador lo mando aca (para depurar sin prender logs).
  motivo        text,
  -- Null = todavia sin resolver. Se llena cuando el dueno agrega el escenario.
  resuelto_at   timestamptz,
  -- El titulo del escenario con el que se resolvio.
  escenario     text,
  created_at    timestamptz not null default now()
);

comment on table chat_agent_handoffs is
  'Mensajes de leads que no encajaron en ningun escenario previsto. MaKo NO responde: avisa y espera que le ensenen el caso.';

-- La consulta que corre en la pantalla: los sin resolver de este workspace.
create index if not exists idx_handoffs_pendientes
  on chat_agent_handoffs (workspace_id, created_at desc)
  where resuelto_at is null;

alter table chat_agent_handoffs enable row level security;

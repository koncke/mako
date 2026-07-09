-- =============================================================================
-- 0071 — Scoping multi-tenant de meta_health_history y mako_knowledge
-- =============================================================================
-- Ambas guardan data POR-CLIENTE pero nunca recibieron workspace_id (0054 no las
-- incluyó): meta_health_history filtraba en vano (getTenantDb hace passthrough si
-- la tabla no está en TENANT_TABLES) → un cliente veía el saldo/salud Meta del
-- dueño; mako_knowledge era un pool GLOBAL → leak del RAG + IDOR destructivo
-- (un cliente borraba/reescribía el conocimiento de otro).
--
-- Backfill al dueño (OWNER_WS=1): lo existente pasa a ser del dueño. En
-- mako_knowledge, las filas del dueño quedan como "método curado de la agencia"
-- (lib/mako-knowledge lo sirve al RAG de todos, read-only; cada cliente crea/edita
-- SOLO lo suyo).

-- meta_health_history: solo si la tabla ya existe (la mig 0050 puede no estar
-- aplicada — hoy no lo está, así que no hay leak real; esto la deja lista si se crea).
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'meta_health_history') then
    alter table meta_health_history add column if not exists workspace_id bigint not null default 1 references workspaces(id);
    create index if not exists idx_meta_health_ws on meta_health_history (workspace_id, created_at desc);
  end if;
end $$;

alter table mako_knowledge add column if not exists workspace_id bigint not null default 1 references workspaces(id);
create index if not exists idx_mako_knowledge_ws on mako_knowledge (workspace_id);

-- =============================================================================
-- 0090_webhook_routing — reverse-map identificador entrante → workspace
-- =============================================================================
-- Los webhooks entrantes (Meta / Chatwoot / Calendly / Fathom) llegan SIN
-- sesión: la única pista de a qué cliente pertenece cada evento es un
-- identificador en claro que viaja en el payload (page_id de Facebook,
-- account_id de Chatwoot, URI del event type de Calendly, email que grabó en
-- Fathom). Hoy, sin ese mapa, todo cae a OWNER_WS y misrutea datos de un cliente
-- al workspace de otro. Esta tabla es el índice de plataforma que resuelve ese
-- problema: (servicio, identificador) → workspace_id. Es el mismo patrón que ya
-- usa evolution_instancias (instancia → workspace) para su webhook.
--
-- El identificador es NO secreto (nunca un token). La tabla se puebla en el
-- choke point de guardado de credenciales (lib/credenciales.ts) y en setSetting
-- ('meta_page_id'), y se consulta fail-closed desde cada webhook (best-effort:
-- si no hay match, el webhook decide, no se asume el dueño).
--
-- No es data por-cliente: es un índice global de la plataforma, por eso NO va a
-- TENANT_TABLES (se lee/escribe cross-workspace con service_role). RLS on sin
-- políticas = solo server-side, igual que el resto. Seguro de re-ejecutar.
-- =============================================================================

begin;

create table if not exists webhook_routing (
  servicio       text   not null,          -- 'meta' | 'chatwoot' | 'calendly' | 'fathom'
  identificador  text   not null,          -- normalizado, NO secreto (page_id, account_id, event_type URI, recorder email)
  workspace_id   bigint not null references workspaces(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (servicio, identificador)
);

create index if not exists idx_webhook_routing_ws on webhook_routing (workspace_id);

comment on table webhook_routing is
  'Reverse-map (servicio, identificador en claro) → workspace_id para rutear webhooks entrantes sin sesión. Índice de plataforma (cross-workspace, NO tenant); se puebla en el choke point de guardado de credenciales/settings y se consulta fail-closed.';

-- RLS on sin políticas = solo server-side (service_role), igual que el resto.
alter table webhook_routing enable row level security;

commit;

-- =============================================================================
-- 0351 — El Newsletter: la baja POR EDICIÓN y el documento del Copywriter de cada edición
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy (o junto). Agrega dos columnas y no saca nada.
--   · `email_broadcast_envios.baja_at`: la estampa la baja (/api/email/unsubscribe con `&b=<edición>`) y la cuentan
--     las métricas de la tab Newsletters. Sin la columna, la baja SIGUE andando (lo primero que se escribe es
--     `leads.email_opt_out`, como siempre) y sólo la estampa por edición falla, con su log.
--   · `email_broadcasts.copy_doc_id`: el guion del Copywriter donde se escribe cada edición. Lo lee y lo escribe la tab
--     Newsletters; sin la columna, esa tab da error al cargar (es sólo del super admin mientras el envío de email esté
--     apagado). La tab /email y el envío no la leen.
--
-- Pedido de Martín (29/10/2026), aprobado con «Sí, armalo así»: los suscriptos son un CRM «Newsletter» y las ediciones
-- viven en la tab Newsletters. Una EDICIÓN es un broadcast cuyo segmento es ese CRM (`newsletter:<funnelId>`), así que
-- no hay tabla nueva: que sea una edición se deriva del segmento (lib/newsletter-reglas.ts).
--
-- Las dos tablas ya están en TENANT_TABLES (mig 0046 + F1 multi-workspace): getTenantDb las acota por cliente.
-- Se aplica con scripts/apply-migration.mjs (no deja registro: «¿se aplicó?» se contesta con
-- scripts/verificar-migraciones-aplicadas.mjs).

alter table email_broadcast_envios add column if not exists baja_at timestamptz;
comment on column email_broadcast_envios.baja_at is
  'Cuándo se dio de baja desde ESTE envío (el link de baja con &b=<broadcast>). La baja en sí es leads.email_opt_out; esto la atribuye a una edición del newsletter para sus métricas.';

alter table email_broadcasts add column if not exists copy_doc_id text;
comment on column email_broadcasts.copy_doc_id is
  'El guion del Copywriter (app_settings mako.copywriter.doc.<id>) donde se escribe esta edición del newsletter. NULL = se escribió en el broadcast mismo.';

-- La tab Newsletters lee las ediciones de un CRM por su segmento (`newsletter:<id>%`).
create index if not exists email_broadcasts_segmento on email_broadcasts (workspace_id, segmento);

-- =============================================================================
-- 0072 — Índices compuestos (workspace_id, <filtro caliente>) en leads
-- =============================================================================
-- Toda query pasa por getTenantDb → SIEMPRE filtra workspace_id. Los índices de
-- estado_lead / pipeline_stage / fechas eran de una sola columna (sin ws), así que
-- una query multi-tenant hacía bitmap/seq scan. Con el workspace_id como columna
-- líder el planner va directo a las filas del cliente. Aditivo; los índices viejos
-- se conservan (sirven a queries cross-workspace del panel de admin).

create index if not exists idx_leads_ws_estado on leads (workspace_id, estado_lead);
create index if not exists idx_leads_ws_stage on leads (workspace_id, pipeline_stage);
create index if not exists idx_leads_ws_fecha_agenda on leads (workspace_id, fecha_agenda) where fecha_agenda is not null;
create index if not exists idx_leads_ws_fecha_j1 on leads (workspace_id, fecha_junta_1) where fecha_junta_1 is not null;
create index if not exists idx_leads_ws_fecha_j2 on leads (workspace_id, fecha_junta_2) where fecha_junta_2 is not null;

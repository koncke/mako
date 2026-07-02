-- =============================================================================
-- 0061 — índices de performance + normalización de email en leads
-- =============================================================================
-- Cierra hallazgos de la auditoría de performance:
--
-- P-5 (email en el hot-path de webhooks Meta/Calendly): la búsqueda de lead por
-- email usaba .ilike (case-insensitive), que fuerza Seq Scan y no puede usar un
-- índice btree. El código ya normaliza el email de entrada a lowercase; acá
-- normalizamos también lo histórico y creamos el índice para que .eq lo use.
update leads set email = lower(email) where email is not null and email <> lower(email);
create index if not exists idx_leads_ws_email on leads (workspace_id, email);

-- P-6 (feed del tablero / listLeads): ordena por created_at desc scopeado por
-- workspace. Sin este índice el ORDER BY requería un Sort en memoria sobre todas
-- las filas del workspace.
create index if not exists idx_leads_ws_created on leads (workspace_id, created_at desc);

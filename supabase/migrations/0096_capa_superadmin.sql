-- =============================================================================
-- 0096_capa_superadmin — habilita la capa 'superadmin' en workspaces
-- =============================================================================
-- El super-admin de la agencia ahora tiene su PROPIO workspace (no es un cliente):
-- usa MaKo para su trabajo —su plan, sus reuniones (Fathom) y sus IA— pero NO corre
-- ads, no tiene CRM de leads ni mide su propio VSL. Por eso su capa esconde
-- Publicidad (Meta), Mensajería y Datos (ver lib/capas.ts → categoriasIntegraciones).
-- El CHECK viejo solo aceptaba 'pm' | 'completo' y rechazaba el update.
-- =============================================================================

alter table workspaces drop constraint if exists workspaces_capa_valida;

alter table workspaces
  add constraint workspaces_capa_valida
  check (capa = any (array['pm'::text, 'completo'::text, 'superadmin'::text]));

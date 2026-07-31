-- =============================================================================
-- 0107: jugadas de setting — estrategia por secuencia (tab /setting)
-- =============================================================================
-- estrategia = { objetivo, gancho, lead_magnet_id, preguntas[], notas, probada_at }
-- null = secuencia sin jugada definida. Shape validada en la app
-- (lib/setting-estrategia.ts, parser tolerante). Las preguntas de cualificación
-- las hereda el Setter IA (sub-proyecto 2 de la spec 2026-07-31-tab-setting).

alter table nutricion_secuencias add column if not exists estrategia jsonb;

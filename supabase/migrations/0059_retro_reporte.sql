-- =============================================================================
-- 0059_retro_reporte — la Retro pasa a un reporte COMPUESTO (v3)
-- =============================================================================
-- retros.reporte (jsonb) guarda el RetroReporte completo (lib/retro-reporte.ts):
-- tesis + fuga en plata + salud por área + hallazgos con evidencia + plan
-- (Experiments/To-dos con cadena y status del usuario) + seguimiento del retro
-- anterior + cobertura de datos + charts (series reales) + log del proceso.
-- Las retros viejas (reporte NULL) siguen renderizando con el formato legacy
-- (titulo/resumen/destacados/recomendaciones).
-- =============================================================================

begin;

alter table retros
  add column if not exists reporte jsonb;

commit;

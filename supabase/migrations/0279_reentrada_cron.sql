-- =============================================================================
-- 0279 — la «Reentrada» del CRON: si un lead vuelve a entrar a una automatización (14/10/2026)
-- =============================================================================
-- docs/diseno-mako-nada-por-detras.md §1-B y §2.4-a. Hasta hoy lo decidía una regla escondida del motor: un flujo «que
-- prepara una reunión» volvía a correr cuando el lead agendaba OTRA reunión; cualquier otro, una sola vez en la vida del
-- lead. Ahora es una opción del panel del CRON (lib/reentrada.ts):
--   · 'una_vez'      «Una sola vez»
--   · 'otra_reunion' «Otra vez si es otra reunión» (la regla de antes, `inscripcionReusable`)
--   · 'siempre'      «Cada vez que vuelve a entrar» (sólo por evento, y sólo si la anterior terminó)
-- NULL = sin guardar: el motor usa la regla de antes (`reentradaDe`, transitorio hasta que las plantillas la escriban).
-- scripts/reentrada-explicita.mts la deja escrita en las que ya existen.
--
-- ORDEN: da igual antes o después del deploy. Las lecturas del motor toleran la columna que falta (lib/nutricion.ts,
-- `leerFilasDeSecuencias` y `inscribirEnSecuencia`: sin ella, la regla de antes). Guardarla desde el panel sin la
-- columna contesta «falta aplicar la migración 0279».
-- =============================================================================

begin;

alter table nutricion_secuencias add column if not exists reentrada text;

alter table nutricion_secuencias drop constraint if exists nutricion_secuencias_reentrada_check;
alter table nutricion_secuencias add constraint nutricion_secuencias_reentrada_check
  check (reentrada is null or reentrada in ('una_vez', 'otra_reunion', 'siempre'));

comment on column nutricion_secuencias.reentrada is
  'La «Reentrada» del CRON: una_vez | otra_reunion | siempre. NULL = la regla de antes (lib/reentrada.ts, reentradaDe).';

commit;

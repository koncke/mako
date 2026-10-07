-- =============================================================================
-- 0209 — El análisis de una SESIÓN DE ENTREGA: riesgos y próximos pasos (#107)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: se aplica ANTES del deploy. El código nuevo LEE estas dos
-- columnas al dibujar la pestaña «Llamadas» de la ficha de cada cliente
-- (app/customer-success/ficha-lectura.ts) y las ESCRIBE el cron
-- /api/cron/cs-sesiones-entrega. Un `select` de PostgREST con UNA columna que no existe
-- rechaza la consulta ENTERA: sin esta migración, la pestaña diría «No pude leer sus
-- llamadas» para toda la cartera. Agrega y no saca nada.
--
-- Hasta acá una sesión de entrega se TIRABA: `lib/closing.ts` la guarda como
-- `status = 'descartada'` con un resumen de 1-2 frases (o ninguno, si la descartó la
-- heurística por el título) y nunca bajaba su transcript. Ahora la analiza
-- `lib/closing-entrega.ts` con IA gratis y se reusan las columnas que ya existen:
--   · summary          → el resumen de la sesión (3-5 frases)
--   · next_step        → el primer próximo paso (para los lectores que ya lo leen)
--   · status           → 'analizada'   ⚠️ NUNCA 'error' (ver el encabezado de la lib)
--   · analysis_version → 3 = «sesión de entrega analizada»
--   · model / analyzed_at, como en el Closing Analyst
--
-- EL CONTRATO (lo lee otro grupo; no se cambia sin avisarle):
--   riesgos        = [ { riesgo: text, cita: text, gravedad: 'alta'|'media'|'baja',
--                        t_seconds?: int } ]
--   proximos_pasos = [ { que: text, quien: 'cliente'|'equipo' } ]
-- La forma la garantiza el saneo determinista de lib/closing-entrega-contrato.ts, no el
-- modelo. Sin default y sin CHECK a propósito: NULL = «todavía no se analizó», y un `[]`
-- escrito por el análisis es «se analizó y no hay ninguno». Son dos respuestas distintas
-- y un default las fundiría.
--
-- `closing_analyses` ya está en TENANT_TABLES y tiene RLS (mig 0037/0057): no hay tabla
-- nueva que registrar.

alter table closing_analyses
  add column if not exists riesgos        jsonb,
  add column if not exists proximos_pasos jsonb;

comment on column closing_analyses.riesgos is
  'Sesión de entrega (analysis_version 3): [{riesgo, cita, gravedad alta|media|baja, t_seconds?}]. NULL = no analizada; [] = analizada sin riesgos.';
comment on column closing_analyses.proximos_pasos is
  'Sesión de entrega (analysis_version 3): [{que, quien cliente|equipo}]. NULL = no analizada; [] = analizada sin pasos.';

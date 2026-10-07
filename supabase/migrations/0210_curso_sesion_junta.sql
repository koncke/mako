-- =============================================================================
-- 0210 — La JUNTA de una sesión de entrega se marca APARTE del mensaje de después
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy. El cron /api/cron/curso-sesiones
-- (lib/curso-mensajes.ts) LEE y ESCRIBE esta columna. Si el deploy llega primero, el cron
-- no se cae: detecta la columna faltante, lee con las columnas viejas y la junta se mira UNA
-- sola vez (lo de antes) — pero mientras tanto los compromisos de una grabación que llega
-- tarde se pierden. Agrega y no saca nada.
--
-- POR QUÉ (revisión del grupo mako-secuencias-avisos, 06/10/2026). El aviso POSTERIOR a
-- Mauricio suma los compromisos de la junta, sacados de la grabación de esa sesión
-- (`closing_analyses.proximos_pasos`, mig 0209). Se leían una vez, en la corrida que abre la
-- ventana del posterior (2 h después de la hora anotada), y la sesión se marcaba en esa
-- misma corrida. Pero la grabación de una sesión de entrega llega a `closing_analyses` sólo
-- por el cron closing-sync («30 14-23 * * *» UTC; el webhook de Fathom ignora las sesiones
-- de entrega) y después espera su análisis. Una sesión de las 16:30 de CDMX (22:30 UTC)
-- termina después del último sync del día: el posterior salía «sin grabación» y los
-- compromisos no le llegaban nunca.
--
-- LA COLUMNA. `aviso_junta_at` = la junta quedó resuelta: el aviso a Mauricio ya llevó sus
-- compromisos, o la grabación se leyó y no dejó ninguno. Se escribe con compare-and-set
-- ANTES de avisar, igual que las otras dos marcas.
--   · NULL con `aviso_posterior_at` puesto = la junta sigue ABIERTA: cada corrida vuelve a
--     buscar la grabación mientras dure la ventana del posterior (48 h).
--   · NULL pasada esa ventana = nunca llegó. Es lo cierto, y por eso no hay default ni backfill:
--     las sesiones ya procesadas de las últimas 48 h vuelven a buscar su grabación una vez, que
--     es justo lo que hacía falta.
--
-- `curso_sesiones` ya está en TENANT_TABLES y tiene RLS (mig 0202): no hay tabla nueva.

alter table curso_sesiones
  add column if not exists aviso_junta_at timestamptz;

comment on column curso_sesiones.aviso_junta_at is
  'La junta de la sesión quedó resuelta (los compromisos de su grabación ya se le avisaron al dueño, o la grabación no dejó ninguno). NULL con aviso_posterior_at = sigue esperando la grabación.';

-- =============================================================================
-- 0024 — Agendas según Meta (Programaciones) por anuncio
-- =============================================================================
-- El dashboard contaba agendas por anuncio cruzando leads.meta_ad_id (solo
-- existe para instant forms) con fecha_junta_1 (Calendly). Casi nadie cumple
-- ambas → casi todos los ads daban 0 agendas.
--
-- Meta sí reporta la agenda por anuncio: la conversión personalizada
-- "Programaciones" llega en insights como action_type
-- 'offsite_conversion.fb_pixel_custom'. Guardamos ese valor por (ad, día) para
-- usarlo como la fuente de agendas a nivel anuncio (Anuncios ganadores) y para
-- el comparador Meta vs CRM en /anuncios.
--
-- NULL = sin dato/0. Aditiva e idempotente.
-- =============================================================================

ALTER TABLE marketing_metrics_daily
  ADD COLUMN IF NOT EXISTS agendas_meta BIGINT;

COMMENT ON COLUMN marketing_metrics_daily.agendas_meta IS
  'Agendas según Meta por anuncio/día = action_type offsite_conversion.fb_pixel_custom (conversión personalizada "Programaciones"). Atribución de Meta, no del CRM.';

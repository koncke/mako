-- =============================================================================
-- 0061 — Tracking granular: multi-landing y multi-VSL (pruebas A/B)
-- =============================================================================
-- landing_visits gana la URL exacta de la landing (distinguir variantes A/B) y
-- el referrer. vsl_events gana el video de Panda (id + título) — el beacon ya
-- mandaba video_id y se descartaba. Los timestamps por evento ya existían
-- (created_at): el timeline por lead sale de estas dos tablas.

ALTER TABLE landing_visits ADD COLUMN IF NOT EXISTS landing_url text;
ALTER TABLE landing_visits ADD COLUMN IF NOT EXISTS referrer text;

ALTER TABLE vsl_events ADD COLUMN IF NOT EXISTS video_id text;
ALTER TABLE vsl_events ADD COLUMN IF NOT EXISTS vsl_titulo text;

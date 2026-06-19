-- =============================================================================
-- 0022 — Preview de creativo en Anuncios Ganadores
-- =============================================================================
-- Guardamos, por anuncio, la miniatura del creativo y el permalink al post real
-- (Facebook/Instagram) para previsualizarlo desde el dashboard. Nullable: los
-- anuncios de stories / Audience Network / DCO pueden no exponer permalink.
-- =============================================================================

ALTER TABLE marketing_metrics_daily
  ADD COLUMN IF NOT EXISTS ad_thumbnail_url       TEXT,
  ADD COLUMN IF NOT EXISTS ad_permalink           TEXT,
  ADD COLUMN IF NOT EXISTS ad_creative_sin_enlace BOOLEAN;

COMMENT ON COLUMN marketing_metrics_daily.ad_thumbnail_url IS
  'Miniatura del creativo (Graph API creative.thumbnail_url). Se refresca en cada corrida porque las URLs de Meta expiran.';
COMMENT ON COLUMN marketing_metrics_daily.ad_permalink IS
  'URL al post real del anuncio: instagram_permalink_url, o https://www.facebook.com/{effective_object_story_id}. NULL si el creativo no expone post.';
COMMENT ON COLUMN marketing_metrics_daily.ad_creative_sin_enlace IS
  'true si el anuncio no tiene permalink (stories / Audience Network / DCO sin post).';

-- =============================================================================
-- 0348_calendario_publicar_mas_redes — el Calendario publica también en LinkedIn, X, Threads y Google Business (29/10/2026)
-- =============================================================================
-- Martín (29/10): «aprovechar todas las conexiones que tiene [Zernio]... publicar en Facebook, TikTok, LinkedIn, etc.». La 0342
-- dejó `red` en (instagram | facebook | tiktok | youtube); ésta suma las cuatro que el Calendario ya sabe publicar
-- (lib/calendario-publicar-reglas.ts, REDES_PUBLICAR). Sólo agranda la lista: ninguna fila que hoy pasa deja de pasar.
-- Idempotente: se puede correr dos veces.
-- =============================================================================

alter table calendario_eventos drop constraint if exists calendario_eventos_red_ok;
alter table calendario_eventos add constraint calendario_eventos_red_ok
  check (red is null or red in ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'twitter', 'threads', 'googlebusiness'));

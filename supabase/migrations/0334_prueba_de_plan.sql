-- =============================================================================
-- 0334_prueba_de_plan — la prueba gratis de 7 días de un plan de MaKo (25/10/2026)
-- =============================================================================
-- ✅ APLICADA EN PRODUCCIÓN el 25/10/2026 (Martín: «Sí, aplicá en producción la migración 0334 de la prueba gratis»). La
-- aplicó el Cerebro y verificó que PostgREST ve `cobros.prueba_huella` y `cobros.prueba_aviso_at`.
--
-- Martín (25/10/2026, ~10:20): «quiero implementar la prueba gratuita de 7 días... para darte de alta en la prueba
-- gratuita debes poner la tarjeta, tal cual como una suscripción, y se te cobra automático luego de esos 7 días». Y el
-- Cerebro: una prueba por negocio, por tarjeta y por email, y un aviso por email 2 días antes del cobro.
--
--   · `cobros.prueba_huella`: quién autorizó la prueba en Mercado Pago (`mp:<payer_id>|card:<card_id>`,
--     lib/prueba-plan-reglas.ts `huellaMp`). Una segunda prueba con la misma cuenta de MP o la misma tarjeta se rechaza.
--   · `cobros.prueba_aviso_at`: cuándo salió el aviso de «tu prueba termina en 2 días» (uno solo por prueba).
--
-- La prueba en sí NO necesita columnas: es una suscripción de la plataforma con `inicio_at` (mig 0308, el primer cobro
-- diferido de Mercado Pago) y `creado_por = planes:<plan>:prueba`.
--
-- TODO ADITIVO: dos columnas nullables y un índice parcial. Ninguna lectura vieja las mira. Seguro de re-ejecutar.
-- SIN ESTA MIGRACIÓN el código anda igual: la prueba se arma, el antiabuso por email y por cuenta de MaKo corre, y lo que no
-- se pudo anotar (la huella, el aviso) queda en el log. Lo que se pierde es el freno por tarjeta y la marca del aviso.
-- =============================================================================

alter table cobros add column if not exists prueba_huella text check (prueba_huella is null or char_length(prueba_huella) <= 200);
alter table cobros add column if not exists prueba_aviso_at timestamptz;

create index if not exists cobros_prueba_huella on cobros (workspace_id, prueba_huella) where prueba_huella is not null;

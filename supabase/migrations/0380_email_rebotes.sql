-- =============================================================================
-- 0380 — El rebote y la queja de cada email, con su hora (4/11/2026, la campaña de email de Mauricio, punto 7)
-- =============================================================================
-- El freno del email (lib/email-freno.ts, lib/email-reputacion.ts): en 24 h con 50 enviados o más, rebotes de 5 % o más o
-- quejas de 0,3 % o más apagan el envío y avisan al negocio. Para contarlos hace falta saber CUÁNDO rebotó o se marcó como
-- spam cada envío: el webhook de Resend lo escribe acá (`marcarEventoEmail`), como ya escribe `abierto_at` y `clic_at`.
--
-- SÓLO AGREGA. ORDEN DE DESPLIEGUE: da igual. El código tolera que no exista: sin las columnas, el webhook no anota el rebote
-- (lo loguea y sigue dando de baja al lead, como antes) y el freno no tiene qué contar, así que no frena. Aplicada, empieza a
-- contar desde ese momento. Número elegido en la nube el 4/11/2026 (main terminaba en 0373, 0368-0370 y 0372 sin archivo en
-- ninguna rama): confirmarlo con el Cerebro antes de aplicarla.
-- =============================================================================

alter table nutricion_envios add column if not exists rebotado_at timestamptz;
alter table nutricion_envios add column if not exists queja_at timestamptz;
alter table email_broadcast_envios add column if not exists rebotado_at timestamptz;
alter table email_broadcast_envios add column if not exists queja_at timestamptz;

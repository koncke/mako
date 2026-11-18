-- =============================================================================
-- 0421 — MaKo Partners: un crédito POR PAGO del negocio referido (18/11/2026)
-- =============================================================================
-- Regla nueva (Martín, 18/11/2026: «Olvidémonos por ahora de pagar el 100% del primer mes»): el partner se lleva el 30 % de
-- CADA pago de cada negocio que trae (27 % si el pago entró por una pasarela), todos los meses, mientras ese negocio pague.
-- Hasta hoy el libro (`partner_creditos`) guardaba UN renglón `referido` por negocio (índice único por referidor+referido):
-- el 100 % del primer mes, al 2º pago. Ese índice impide el segundo renglón. Esta migración:
--   · agrega `pago_id` (el pago de `pagos` que originó el renglón) y `canal` ('directo' o 'pasarela');
--   · cambia el índice único: el renglón VIEJO (sin `pago_id`) sigue siendo uno por negocio; el NUEVO es uno por pago.
-- Lo ya ganado no se toca: ninguna fila se modifica ni se borra. Seguro de re-ejecutar.
-- ORDEN: no importa. El código que acredita por pago (lib/partners-programa.ts) ve la falta de estas columnas, avisa en el log y
-- no acredita nada hasta que existan (nunca acredita de más ni de menos).
-- =============================================================================

alter table partner_creditos add column if not exists pago_id bigint;
alter table partner_creditos add column if not exists canal text check (canal is null or canal in ('directo', 'pasarela'));

comment on column partner_creditos.pago_id is 'El pago del negocio referido (pagos.id) que originó este renglón `referido`. null = el crédito de la regla vieja (100 % del primer mes). Mig 0421.';
comment on column partner_creditos.canal is 'Por dónde entró ese pago: directo (Binance/transferencia, 30 %) o pasarela (27 %). Mig 0421.';

-- El crédito viejo: UNO por negocio (como antes, pero sólo los que no tienen pago).
drop index if exists partner_creditos_un_referido;
create unique index if not exists partner_creditos_un_referido_viejo
  on partner_creditos (referidor_ws, referido_ws) where tipo = 'referido' and pago_id is null;
-- El crédito nuevo: UNO por pago (dos corridas del cron chocan acá y no suman).
create unique index if not exists partner_creditos_un_pago
  on partner_creditos (referidor_ws, pago_id) where tipo = 'referido' and pago_id is not null;

-- 0417 · pagos.moneda acepta USDT y USDC (P30, 17/11/2026)
-- «Cargar pago» registra una orden en USDT (Código Inmobiliario paga así) y el pago del CRM nacía SIN moneda: se contaba como dólares sin
-- rastro, porque el CHECK de la 0255 (`'^[A-Z]{3}$'`) rechazaba 'USDT'. Los recibos ya aceptan 3 a 5 letras (0397); el pago del CRM, ahora
-- también. Sólo se ensancha el CHECK: no cambia ninguna fila ni ninguna función (los pagos viejos con `moneda` en null quedan igual).
-- Idempotente. Orden: aplicar esta migración y recién después (o antes, da igual) el código: sin ella, lib/recibos.ts reintenta sin moneda.

begin;
alter table pagos drop constraint if exists pagos_moneda_check;
alter table pagos add constraint pagos_moneda_check check (moneda is null or moneda ~ '^[A-Z]{3,5}$');
commit;

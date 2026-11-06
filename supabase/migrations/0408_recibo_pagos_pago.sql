-- =============================================================================
-- 0408_recibo_pagos_pago — qué pago del CRM de la plataforma es cada cobro de un recibo
-- =============================================================================
-- Revisión del Cerebro de Admin (docs/admin/revision-cerebro-6-11.md, punto 4): «Cargar pago» sólo emitía un recibo. Orders, la
-- ficha y Events lo sumaban; Ingresos, Metrics, Top Customers y Finance no lo veían (no está en `pagos`), y si el mismo pago
-- también estaba en el CRM se contaba dos veces. Desde ahora «Cargar pago» registra el pago en `pagos` del lead de esa cuenta (o
-- lo ata a uno que ya estaba), y esta columna dice CUÁL es: Admin › Sales ata cada pago a su recibo por acá
-- (app/admin/_polar/datos/ventas.ts, `pedidosDe`).
--
-- En `recibo_pagos` y no en `recibos`: un recibo puede juntar varios pagos (noviembre de Código Inmobiliario fueron dos órdenes
-- de Binance, 94 y 144, que en el CRM son dos pagos). Un pago del CRM puede ser varias filas del MISMO recibo (los dos cobros de
-- un recibo registrados como un pago); que no sea de dos recibos lo cuida el código (app/admin/cobros/recibos-actions.ts).
--
-- ⚠️ ORDEN DE DESPLIEGUE: en cualquier orden. El código TOLERA que falte: lee `recibo_pagos` con `*` (sin la columna, el pago se
-- ata por el cobro o por su referencia, como antes), y al escribir `pago_id` un 42703 / PGRST204 hace que «Cargar pago» emita el
-- recibo SIN registrar el pago en el CRM (como antes): registrarlo sin poder atarlo es justo lo que contaba dos veces. Sin la
-- migración, un recibo cargado a mano no suma en Orders y se dice debajo de sus cajas.
--
-- `on delete set null`: si se borra el pago del CRM, el recibo queda (es un documento con número) y vuelve a no estar atado.
-- La tabla ya tiene RLS prendido y nada para anon ni authenticated (mig 0397); la columna hereda sus permisos.
-- =============================================================================
begin;

alter table recibo_pagos add column if not exists pago_id bigint references pagos(id) on delete set null;

create index if not exists recibo_pagos_pago_idx on recibo_pagos (pago_id) where pago_id is not null;

commit;

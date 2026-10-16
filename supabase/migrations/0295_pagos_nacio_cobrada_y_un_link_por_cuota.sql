-- =============================================================================
-- 0295_pagos_nacio_cobrada_y_un_link_por_cuota — Deshacer un pago a mano sin inventar deuda, y un solo link vivo por cuota (16/10/2026)
-- =============================================================================
-- Los dos pendientes de la revisión de la tab Pagos en bloques (docs/hallazgos-pagos.md §4), que Cerebro pidió como
-- la tanda siguiente:
--
--   · `pagos.nacio_cobrada`: un pago SUELTO («Registrar un pago») o la mensualidad registrada a mano nacen como una
--     cuota ya cobrada, con vencimiento = el día del pago. Deshacerlos los dejaba impagos y VENCIDOS: «Debe $X», y la
--     cobranza lo recordaba, por una deuda que nunca existió. Con esta marca, deshacerlos los QUITA (lib/pagos.ts,
--     `marcarPago`). Lo escriben `registrarPagoSuelto` (lib/pagos.ts) y la mensualidad cobrada de Editar deal
--     (`saveCuotasAction`). Las filas viejas quedan en false: no hay forma segura de saber cuáles nacieron cobradas.
--   · `cobros_un_link_vivo_por_cuota`: un link que todavía se puede pagar (pendiente o rechazado) por cuota. El
--     server ya devolvía el link vivo si existía (`cuotaParaLink`, lib/cobros.ts), pero dos pedidos simultáneos
--     podían crear dos: dos cobros posibles de la misma plata. Con el índice, el segundo insert choca y `crearCobro`
--     devuelve el que ya estaba. Medido antes de crearlo (16/10/2026): 0 cuotas con más de un link vivo (y 0 cobros).
--
-- ORDEN: ANTES del deploy. `registrarPagoSuelto` y `saveCuotasAction` ESCRIBEN `nacio_cobrada`: sin la columna,
-- PostgREST rechaza el insert y registrar un pago a mano falla. El índice puede ir antes o después (sin él, el código
-- se comporta como hasta hoy). Seguro de re-ejecutar.
-- =============================================================================

alter table pagos add column if not exists nacio_cobrada boolean not null default false;

comment on column pagos.nacio_cobrada is
  'La cuota nació ya cobrada (un pago suelto o una mensualidad registrada a mano): deshacerla la quita en vez de dejarla como deuda. Mig 0295.';

create unique index if not exists cobros_un_link_vivo_por_cuota
  on cobros (pago_id)
  where pago_id is not null and estado in ('pendiente', 'fallido');

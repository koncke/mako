-- =============================================================================
-- 0292_pagos_manual_suscripcion_cancelada — Pagos a mano con concepto y método, y la suscripción manual cancelada (14/10/2026)
-- =============================================================================
-- Pedido de Martín del 14/10/2026 («Que Pagos sea personalizable... edita todo en la misma tab»), diseño en
-- docs/diseno-ficha-bloques.md §3 Pagos y §5 «Datos que hacen falta»:
--
--   · `pagos.concepto` y `pagos.metodo`: lo cargado a mano decía sólo el monto en USD. La moneda en que se
--     cobró ya tenía columna (`pagos.moneda` y `monto_original`, mig 0255, que hasta hoy llenaba sólo la
--     pasarela); faltaban el porqué (un adelanto, la cuota 3) y el cómo (transferencia, efectivo…). El método
--     válido lo decide el código (METODOS_PAGO, lib/pagos-campo.ts): acá sólo el tope de largo, como la mig 0116
--     hizo con `venta_tipo`. `pagos.proveedor` sigue siendo sólo stripe o mercadopago: lo de la pasarela.
--   · `leads.suscripcion_cancelada_at`: la suscripción que se registra a mano no tenía «cancelada» (sólo la de
--     la pasarela, en `cobros.suscripcion_estado`). Cancelarla la pasa a plazo fijo hasta hoy, como la de la
--     pasarela (así el MRR deja de contarla), y esta fecha es lo que distingue «cancelada» de «terminó su plazo».
--   · `leads.suscripcion_meses_antes`: el plazo que tenía al cancelarla. Cancelar pisa `suscripcion_meses` con los
--     meses transcurridos, y sin esto reactivar no tenía de dónde devolverlo: una de 12 meses volvía mes a mes y el
--     MRR la contaba para siempre (revisión del 14/10/2026). null = no tenía plazo (mes a mes) o no está cancelada.
--
-- ORDEN: ANTES o junto con el deploy. Quién las escribe y qué pasa si todavía no corrió:
--   · concepto y método los escribe un update APARTE que no tira (`etiquetarPago`, lib/pagos.ts): sin la
--     migración, el pago se registra igual y se pierde sólo la etiqueta (queda en el historial).
--   · `suscripcion_cancelada_at` la lee `cobradoDelLead` desde `getLead` (select *: sin la columna, undefined, y
--     la suscripción se ve activa como hoy) y la escribe SÓLO «Cancelar suscripción» de una manual
--     (`cambiarEstadoSuscripcionManual`), que sin la migración contesta el error y no escribe nada.
--   · `suscripcion_meses_antes` la leen y escriben SÓLO cancelar y reactivar (la misma función): igual que la anterior.
-- Seguro de re-ejecutar.
-- =============================================================================

alter table pagos add column if not exists concepto text;
alter table pagos add column if not exists metodo text;

do $$
begin
  alter table pagos add constraint pagos_concepto_largo_ck check (concepto is null or char_length(concepto) <= 200);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table pagos add constraint pagos_metodo_largo_ck check (metodo is null or char_length(metodo) <= 40);
exception when duplicate_object then null;
end $$;

alter table leads add column if not exists suscripcion_cancelada_at timestamptz;
alter table leads add column if not exists suscripcion_meses_antes integer;

comment on column pagos.concepto is 'Lo cargado a mano: por qué se cobró (un adelanto, la cuota 3). null en lo de la pasarela.';
comment on column pagos.metodo is 'Lo cargado a mano: cómo se cobró (METODOS_PAGO en lib/pagos-campo.ts). null en lo de la pasarela.';
comment on column leads.suscripcion_meses_antes is 'El plazo (meses) de una suscripción MANUAL antes de cancelarla; vuelve al reactivar. null = mes a mes o no cancelada.';
comment on column leads.suscripcion_cancelada_at is 'Cuándo se canceló una suscripción MANUAL (la de la pasarela vive en cobros.suscripcion_estado). null = activa o de plazo fijo.';

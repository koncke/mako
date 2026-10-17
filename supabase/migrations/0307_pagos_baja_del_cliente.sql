-- =============================================================================
-- 0307_pagos_baja_del_cliente — «Baja del cliente»: lo que no pagó deja de ser deuda y queda en el historial (17/10/2026)
-- =============================================================================
-- La tarjeta #871 del Plan, de la llamada «Mau <> Martin» del 16/10 (28:34): Francisco Javier Hernández pagó unos
-- US$4.000 de US$6.000 y dejó el servicio. La ficha sólo ofrecía «Marcar pagada» o «Quitar», y ninguna de las dos es
-- lo que pasó: quitar borra lo que se le vendió, y dejarlo marca para siempre US$2.000 vencidos (80 días) en el
-- Outstanding, en «A quién cobrarle» y en la cobranza por WhatsApp. Martín: «agregar una opción de el cliente se dio de
-- baja». Mauricio: «para traer la visibilidad».
--
--   · `pagos.baja_at`: cuándo se dio de baja. Una cuota IMPAGA con esta marca no es deuda en ningún lado
--     (`esCuotaDeBaja`, lib/cobrado-lead.ts) y se sigue viendo en la tab Pagos como «baja del cliente».
--   · `pagos.baja_vencia`: el vencimiento que tenía. Al darse de baja la cuota queda SIN vencimiento, a propósito: toda
--     lectura que decide «vencida» por la fecha (la cobranza, Customer Success, las condiciones de Automations, el
--     calendario, las métricas) la deja afuera sin saber que esta marca existe. Deshacer la baja se lo devuelve.
--
-- Lo escribe sólo lib/pagos-baja.ts (la tab Pagos y la API de MaKo, `baja_del_cliente`).
--
-- ORDEN: ANTES del deploy. La tab, el Outstanding y la API leen `baja_at` en un select explícito: sin la columna,
-- PostgREST contesta un error y esas lecturas fallan. Seguro de re-ejecutar.
-- =============================================================================

alter table pagos add column if not exists baja_at timestamptz;
alter table pagos add column if not exists baja_vencia date;

comment on column pagos.baja_at is
  'El cliente se dio de baja: esta cuota impaga no es deuda (no vence, no se cobra, no suma al Outstanding) y queda para el historial. Mig 0307.';
comment on column pagos.baja_vencia is
  'El vencimiento que tenía la cuota al darse de baja (la baja la deja sin fecha). Deshacer la baja se lo devuelve. Mig 0307.';

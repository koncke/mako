-- =============================================================================
-- 0309 — wa_borradores.sin_vista_previa: el borrador manda sus links como el mensaje que lo creó (tarjeta #869)
-- =============================================================================
-- Mauricio (17/10/2026, Fathom 863534245, 16:45): un link con la tarjeta de vista previa «es agresivo» para un
-- prospecto ocupado. Cada WhatsApp de una automatización puede mandar sus links SIN la tarjeta (`sin_vista_previa`
-- del paso, lib/mensaje-partes.ts → `linkPreview: false` en /message/sendText). Un mensaje que no sale solo deja un
-- BORRADOR, y el setter lo manda después: sin esta columna, el borrador saldría con la tarjeta.
--
-- ⚠️ ORDEN DE DESPLIEGUE: da igual. Agrega una columna nullable y no saca nada. El código la tolera AUSENTE
-- (lib/evolution-envio.ts): `crearBorrador` reintenta sin la marca ante un 42703, y `enviarBorrador` la lee APARTE del
-- claim (pedirla ahí sin la columna frenaría todo borrador). Sin la migración, un borrador sale con la tarjeta.
--
-- `null` = con la tarjeta (lo de siempre): sólo se escribe `true`.

begin;

alter table wa_borradores add column if not exists sin_vista_previa boolean;

comment on column wa_borradores.sin_vista_previa is
  'true = los links salen sin la tarjeta de vista previa (`linkPreview: false`), como el paso que creó el borrador (#869). null = con la tarjeta.';

commit;

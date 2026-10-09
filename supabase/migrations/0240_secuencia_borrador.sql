-- =============================================================================
-- 0240_secuencia_borrador — lo que se arma en el lienzo de /chatbot y todavía no se publicó
-- =============================================================================
-- Pedido de Martín (09/10/2026, sexta tanda, punto 7 de «General»): «Que se elimine una flecha no
-- significa que se elimine la tarjeta posterior, sino que queda "flotando". Lo que no se puede es
-- publicar o probar una automatización incompleta». Hasta acá NO había borrador: el lienzo editaba en
-- memoria y lo único que escribía los pasos era Publicar, que valida todo (`validarGrafo`). Una
-- automatización con una tarjeta suelta no se podía guardar: se perdía al recargar.
--
--  · `nutricion_secuencias.pasos_borrador` (jsonb) — `{ "pasos": [...], "base": "<huella>", "guardado_at": "<iso>" }`.
--    Los pasos tal como los tiene el lienzo (con sueltas, condiciones a medias o un ciclo sin espera),
--    saneados y validados SÓLO contra lo que rompe el dato (`validarParaGuardar`, lib/flujo-grafo.ts).
--    `base` es la huella de lo publicado sobre lo que se armó (`firmaPublicado`): si se publicó otra
--    cosa después, el borrador no se abre (lib/secuencia-borrador.ts, `borradorVigente`). Lo escribe SU
--    PROPIA acción (POST /api/chat-agent/secuencias, `action: 'borrador'` → `guardarBorradorSecuencia`),
--    nunca Publicar.
--
--  · EL MOTOR NO LA LEE NUNCA: lee `pasos` (lo publicado). Por eso una tarjeta suelta no corre.
--
-- SIN BACKFILL: NULL = sin borrador, que es exactamente cómo está hoy toda automatización. Sin CHECK de
-- forma: la forma la sanea `sanearBorrador` en la escritura y `borradorVigente` en la lectura.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY (o junto). El GET de /api/chat-agent/secuencias pasa a LEER
-- la columna, en una consulta APARTE de las secuencias (`leerBorradoresSecuencias`). Con el deploy
-- adelantado NO se rompe nada, a propósito (como la 0233): la lectura distingue la columna que falta
-- (42703 / PGRST204) de cualquier otro error y degrada a «sin borradores» —el lienzo abre lo publicado,
-- como hasta hoy—, y la escritura contesta `sin_columna`. Lo que queda sin poder hacerse hasta
-- aplicarla es justamente lo pedido: que una automatización a medias SOBREVIVA a una recarga.
-- =============================================================================

begin;

alter table public.nutricion_secuencias add column if not exists pasos_borrador jsonb;

comment on column public.nutricion_secuencias.pasos_borrador is
  'Lo que se arma en el lienzo de /chatbot sin publicar: { pasos, base, guardado_at }. NULL = sin borrador. El motor NO lo lee (lee pasos). Lo escribe guardarBorradorSecuencia (lib/secuencia-borrador.ts).';

commit;

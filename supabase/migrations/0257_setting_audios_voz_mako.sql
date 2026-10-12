-- =============================================================================
-- 0257 — setting_audios.origen suma 'voz_mako': la Voz de MaKo de las tarjetas «MaKo en WhatsApp»
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy de la undécima tanda (docs/diseno-undecima-tanda.md
-- §8.2). Sólo ensancha un CHECK: la versión desplegada no escribe 'voz_mako', así que aplicarla antes no le
-- molesta a nadie. Sin ella, «generar la Voz de MaKo» (lib/voz-mako.ts) falla RUIDOSO con 23514 al guardar el
-- audio, DESPUÉS del text-to-speech: ese audio se paga una vez (≤700 caracteres) y el binario subido se borra
-- (`crearAudio`, lib/setting-audios.ts). No se pierde nada más: el motor no la usa hasta que una tarjeta tenga
-- un audio de la Voz de MaKo, y no puede tenerlo sin que esto exista.
--
-- Pedido de Martín (11/10/2026, decisión 2 de la décima), textual: «Si, agregale esas opciones. Pero en audios,
-- que se pueda configurar con ElevenLabs que salga la voz de MaKo. La que usamos para crear los VSL de la
-- landing.» La tarjeta «MaKo en WhatsApp» manda notas de voz con ESA voz (no con la del dueño: sería
-- suplantarlo), y cada una es una fila más de esta tabla: el envío la busca por id, como un audio de la
-- biblioteca o una respuesta de un AI Step (mig 0251).
--
-- POR QUÉ OTRO ORIGEN Y NO 'ai_step': la Voz de MaKo no es del negocio ni es una respuesta a un lead. Con su
-- propio origen, «Audios guardados» no la lista (`listAudios` filtra 'biblioteca'), la caché la encuentra por
-- texto (`buscarAudioPorTranscript`) y el tope del mes por negocio la cuenta (`transcriptsDesde`).
--
-- Idempotente: saca el CHECK si está y lo vuelve a crear con los tres valores. La columna ya existe desde la
-- 0251 (aplicada el 11/10/2026); el `add column if not exists` sólo cubre una base que no la tenga.

begin;

alter table setting_audios add column if not exists origen text not null default 'biblioteca';
alter table setting_audios drop constraint if exists setting_audios_origen_check;
alter table setting_audios add constraint setting_audios_origen_check check (origen in ('biblioteca', 'ai_step', 'voz_mako'));

comment on column setting_audios.origen is
  '''biblioteca'' = lo que subió el dueño (lo lista `listAudios`); ''ai_step'' = la nota de voz con que un AI Step le contestó a un lead; ''voz_mako'' = la Voz de MaKo de una tarjeta «MaKo en WhatsApp» (lib/voz-mako.ts). Las dos últimas sólo por id.';

commit;

-- =============================================================================
-- 0229_secuencia_emoji — el emoji del título de una automatización del chatbot, editable
-- =============================================================================
-- Pedido de Martín (09/10/2026, tercera tanda, punto 8): «No puedo editar el emoji del título, y
-- si debería... Dejame poner cualquier emoji, ya tenemos un desplegable al respecto». El contrato,
-- en docs/chatbot-flujo-ramas-diseno.md → «TERCERA TANDA», decisión 8.
--
--  · `nutricion_secuencias.emoji` — NULL = el de siempre, el que sale del OBJETIVO de su
--    estrategia (📅 agendar, 🎯 preparar…; sin estrategia, ⚑). Con valor, el que eligió la persona
--    con el selector de la casa (app/plan/board/EmojiPicker.tsx). Lo escribe
--    `setEmojiSecuencia` (lib/setting-secuencias.ts), que lo sanea (un emoji, tope de 16 bytes
--    UTF-16): la columna no lleva CHECK de forma porque un emoji con modificadores (tono de piel,
--    ZWJ de una familia) no tiene un largo fijo que un CHECK pueda decir sin mentir.
--
-- SIN BACKFILL: NULL ES el comportamiento de hoy (el emoji del objetivo), así que las filas que ya
-- están no necesitan nada.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY. El GET de /api/chat-agent/secuencias pasa a LEER
-- `emoji` (`getSettingData`, en una consulta aparte de las secuencias), y PostgREST rechaza la
-- consulta entera si falta la columna: con el deploy adelantado, /chatbot no carga. La lectura NO
-- tolera la columna que falta (AGENTS.md: sólo se tolera la TABLA que falta), a propósito: un
-- emoji que se elige y no se guarda se lee como un botón roto.
-- =============================================================================

begin;

alter table public.nutricion_secuencias add column if not exists emoji text;

comment on column public.nutricion_secuencias.emoji is
  'El emoji del título de la automatización (/chatbot). NULL = el del objetivo de su estrategia. Lo escribe setEmojiSecuencia (lib/setting-secuencias.ts).';

commit;

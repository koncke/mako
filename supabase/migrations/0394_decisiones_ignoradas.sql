-- =============================================================================
-- 0394 — «Ignorar» una decisión de la Ticketera desde el Ops Center (5/11/2026)
-- =============================================================================
-- Martín: «debería haber una sección que marque la fecha de los pedidos o decisiones y un botón de ignorar». Le llegó para
-- contestar una pregunta del 30/10 sobre una revisión que ya no importaba, y no había cómo sacarla. Las preguntas de los chats
-- (`cartero preguntar`) se ignoran en app_settings, sin migración (lib/centro-preguntas-chat.ts → `ignorada`); las decisiones de
-- la Ticketera que también salen en ese bloque viven en esta tabla, y ésta es su marca:
--   · `ignorada_at`: cuándo Martín la ignoró. No es una respuesta: al chat no le llega ningún aviso (lib/operaciones.ts →
--     avisosParaElCartero mira sólo las contestadas), no espera (lib/centro-preguntas.ts, lib/centro-chats.ts → esperasPorChat),
--     y no se contesta hasta que se vuelva a mostrar (lib/admin-decisiones.ts → guardarRespuesta). Null = no está ignorada.
--   · NO es `archivada_at`: ésa la pone el chat que la publicó cuando ya no hace falta, y republicar la limpia.
--
-- SÓLO AGREGA. ORDEN DE DESPLIEGUE: da igual. Sin la columna, la lectura (`select('*')`) no la trae y nada está ignorado; «Ignorar»
-- en una decisión dice «Todavía no se puede: falta un cambio en la base» y no cambia nada. Las preguntas de los chats se ignoran
-- igual con o sin esta migración. Número elegido en la nube el 5/11/2026 barriendo main, las ramas y las etiquetas de origin (0393
-- era la última): confirmarlo con el Cerebro antes de aplicarla.
-- =============================================================================

alter table admin_decisiones add column if not exists ignorada_at timestamptz;

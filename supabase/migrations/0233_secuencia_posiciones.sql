-- =============================================================================
-- 0233_secuencia_posiciones — dónde puso la persona cada tarjeta del lienzo de /chatbot
-- =============================================================================
-- Pedido de Martín (09/10/2026, quinta tanda, punto 2): «Y tampoco se puede mover las tarjetas
-- libremente por el lienzo». En /chatbot nunca se pudo: el layout se DERIVA del árbol del flujo
-- (lib/flujo-conversacion.ts) y no se guardaba en ningún lado (AGENTS.md, «Un lienzo DIBUJA UNA
-- AFIRMACIÓN», que desde esta migración dice que sí se guarda, dónde y por qué).
--
--  · `nutricion_secuencias.posiciones` (jsonb) — `{ "<id de tarjeta>": { "x": n, "y": n } }`, como
--    DESPLAZAMIENTO desde donde el árbol pone la tarjeta CRON (`entrada`), en coordenadas del grafo.
--    Relativas y no absolutas: una rama nueva que abre hacia arriba corre el dibujo entero
--    (`aOrigen`), y una posición absoluta quedaría corrida respecto del resto. Sólo están las
--    tarjetas que la persona MOVIÓ; las demás se ubican como siempre. Lo escribe SU PROPIA acción
--    (POST /api/chat-agent/secuencias, `action: 'posiciones'` → `guardarPosicionesSecuencia`,
--    lib/secuencia-posiciones.ts), saneado y podado; nunca el guardado del flujo.
--
--  · POR QUÉ UNA COLUMNA Y NO ADENTRO DE `pasos` NI DE `estrategia`: `pasos` lo reconstruye
--    `setSecuenciaPasos` campo por campo y tira lo que no conoce (se perdería en el primer guardado
--    hecho desde otra pantalla), y `estrategia` se guarda ENTERA desde varias pantallas.
--
-- SIN BACKFILL: NULL = ninguna tarjeta movida, que es exactamente cómo se dibuja hoy todo flujo.
-- Sin CHECK de forma: la forma la sanea `sanearPosiciones` (lib/lienzo-posiciones.ts, con test) en
-- la lectura y en la escritura, y un CHECK sobre un jsonb de N claves no puede decirla sin mentir.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY (o junto). El GET de /api/chat-agent/secuencias pasa a
-- LEER `posiciones` (`getSettingData`, en una consulta APARTE de las secuencias). Con el deploy
-- adelantado NO se rompe nada, a propósito (como la 0230 y al revés que la 0229): la lectura
-- distingue la columna que falta (42703 / PGRST204) de cualquier otro error y degrada a «no se
-- guardan posiciones» — el lienzo se dibuja como siempre, las tarjetas se mueven en la pantalla y
-- no se guardan, y la escritura contesta `sinColumna`. Lo que queda sin poder hacerse hasta
-- aplicarla es justamente lo pedido: que lo acomodado SOBREVIVA a una recarga.
-- =============================================================================

begin;

alter table public.nutricion_secuencias add column if not exists posiciones jsonb;

comment on column public.nutricion_secuencias.posiciones is
  'Dónde puso la persona cada tarjeta del lienzo de /chatbot: { id: {x, y} } relativo a la tarjeta CRON derivada. NULL = ninguna movida. Lo escribe guardarPosicionesSecuencia (lib/secuencia-posiciones.ts).';

commit;

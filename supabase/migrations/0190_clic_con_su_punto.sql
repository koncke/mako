-- =============================================================================
-- 0190 — el clic viaja con SU PUNTO: lo que el mapa de calor necesita
-- =============================================================================
-- ORDEN DE DESPLIEGUE: esta migración AGREGA columnas que el código nuevo escribe,
-- así que va ANTES o JUNTO con el deploy. Al revés, el snippet v20 manda `clic_x` y
-- PostgREST rechaza la fila ENTERA por una columna que no existe — o sea que se
-- dejan de guardar todos los clics, no sólo las coordenadas. Es exactamente lo que
-- pasó con `auto` en `landing_visits` (ver el aviso en app/api/track/vsl/route.ts).
--
-- EL PROBLEMA. Desde la mig 0133 el clic se guarda con `detalle`: a DÓNDE iba (el
-- href, el ancla, el texto del botón). Eso contesta «¿qué llamado a la acción usa
-- la gente?», que es el embudo, y no contesta «¿en qué PUNTO de la página tocó?»,
-- que es lo único con lo que un mapa de calor se puede dibujar. Hasta la v19 del
-- snippet no había una sola coordenada en toda la tabla.
--
-- POR QUÉ CUATRO COLUMNAS Y NO DOS. Un par (x, y) solo no se puede pintar: hay que
-- saber sobre QUÉ se pinta.
--   · la posición es de la PÁGINA, no de la ventana. Con la posición en la ventana,
--     el mismo clic sobre el mismo botón da un número distinto según cuánto había
--     bajado la persona, y los puntos salen todos apilados arriba.
--   · `ancho_ventana` es lo que permite ubicar un punto de un celular sobre la
--     captura de un escritorio. Sin él el mapa sale corrido y nadie entiende por
--     qué: un x de 300 es el centro en un teléfono y el margen izquierdo en un
--     monitor.
--   · `alto_pagina` dice si un y de 3000 fue al final de la página o a un tercio.
--     El alto de una landing cambia con las imágenes cargadas y con el contenido
--     dinámico, así que no se puede dar por constante entre visitas.
--
-- MOLDE. El mismo que `segundos` (mig 0121), `auto` (0136) y `landing_url` (0137):
-- NULABLES Y SIN DEFAULT. NULL es «no se sabe» y acá eso cubre tres casos reales:
-- los eventos que no son clics, los clics de un Pixel anterior a la v20, y los
-- clics que un script del sitio disparó por código (reportan (0,0), que no es un
-- punto). Un default de 0 los convertiría a todos en una mancha fija en la esquina
-- de arriba a la izquierda que nadie hizo — y una mancha inventada en un mapa de
-- calor es indistinguible de una real.
--
-- `integer` y no `smallint`: una página con scroll infinito pasa holgadamente los
-- 32.767 px de alto. El saneo del beacon (`pixel()` en el route) descarta lo que se
-- va de rango en vez de acotarlo, por el mismo motivo que el default.
-- =============================================================================

begin;

alter table public.vsl_events
  add column if not exists clic_x        integer,
  add column if not exists clic_y        integer,
  add column if not exists ancho_ventana integer,
  add column if not exists alto_pagina   integer;

comment on column public.vsl_events.clic_x is
  'Posición horizontal del clic en coordenadas de la PÁGINA (px CSS), no de la ventana. Viene del snippet v20+. NULL en los eventos que no son clics, en los de un Pixel anterior y en los clics disparados por código (sin punto real).';

comment on column public.vsl_events.clic_y is
  'Posición vertical del clic en coordenadas de la PÁGINA (px CSS). Se interpreta junto con alto_pagina: sin él no se sabe si fue al final o a un tercio. NULL igual que clic_x.';

comment on column public.vsl_events.ancho_ventana is
  'Ancho del viewport (px CSS) en el momento del clic. Es lo que permite ubicar un punto de un celular sobre la captura de un escritorio: sin esto el mapa de calor sale corrido. NULL igual que clic_x.';

comment on column public.vsl_events.alto_pagina is
  'Alto del documento (px CSS) en el momento del clic. Cambia entre visitas con las imágenes cargadas y el contenido dinámico, así que se guarda por evento. NULL igual que clic_x.';

-- La lectura del mapa de calor es «los clics DIBUJABLES de este workspace en esta
-- ventana de tiempo», y esas son exactamente las filas con coordenadas: una
-- fracción muy chica de la tabla (sólo los clics de la v20 en adelante).
--
-- ⚠️ EL PREDICADO ES `clic_x is not null` Y NO EL TIPO DE EVENTO, a propósito. El
-- mapa tiene que leer DOS tipos ('click' y 'clic_vacio') y
-- `idx_vsl_events_click` (mig 0133) es parcial sobre `tipo_evento = 'click'`, así
-- que un `IN` de los dos no lo usa — eso ya está medido y escrito en
-- lib/landing-pulso-server.ts. Con este predicado alcanza una sola consulta.
--
-- ⚠️ Y QUIEN LEA ESTO TIENE QUE LLEVAR `clic_x is not null` EN SU WHERE, o el
-- índice no se usa y queda pagándose en cada insert del beacon para nada. Es la
-- razón por la que la mig 0137 decidió NO indexar `landing_url`: un índice en esta
-- tabla se paga en cada evento de cada visita.
create index if not exists idx_vsl_events_clic_punto
  on public.vsl_events (workspace_id, created_at desc)
  where clic_x is not null;

commit;

notify pgrst, 'reload schema';

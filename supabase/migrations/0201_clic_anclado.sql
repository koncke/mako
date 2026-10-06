-- =============================================================================
-- 0201 — el clic se ANCLA al elemento que se tocó (snippet v22)
-- =============================================================================
-- ORDEN DE DESPLIEGUE: esta migración AGREGA columnas que el código nuevo escribe,
-- así que va ANTES del deploy. Al revés, el route de /api/track/vsl manda `sel` y
-- PostgREST rechaza la fila ENTERA por una columna que no existe — o sea que se
-- dejan de guardar TODOS los eventos del Pixel, no sólo el ancla. Es el mismo
-- orden que la 0190 y por el mismo motivo.
--
-- EL PROBLEMA. La 0190 guardó el punto del clic en coordenadas de la PÁGINA, con
-- el ancho de la ventana y el alto del documento. Medido el 06/10/2026 sobre la
-- misma landing y el MISMO ancho de celular (411 px): el alto del documento al
-- momento del clic dio 3.518, 3.993 y 4.650 px. Cruzar esos puntos con UNA foto de
-- la página tiene un error de cientos de píxeles en vertical, por más que se
-- escale. Lo que no depende del alto es el ELEMENTO: «tocó el segundo botón del
-- precio, a un tercio de su ancho» se ubica igual en cualquier foto donde ese
-- botón exista.
--
-- LAS CINCO COLUMNAS:
--   · `sel`: la ruta CSS corta del elemento tocado (etiqueta:nth-of-type, hasta el
--     primer ancestro con id). SIN TEXTO, nunca: un toque cae muchas veces sobre un
--     campo del formulario ya completado, y el texto de esa zona es el nombre o el
--     teléfono de quien mira. Es la misma regla del `clic_vacio` (snippet v20).
--   · `rel_x` / `rel_y`: dónde dentro de la caja del elemento, en milésimos (0..1000).
--   · `alto_ventana`: el alto del viewport. Da la línea del pliegue — lo que se ve
--     sin bajar — que es la primera pregunta de cualquier mapa.
--   · `fijo`: el elemento (o un ancestro) es position fixed/sticky. Un botón
--     flotante de WhatsApp o un sello del constructor se mueven con la pantalla:
--     su punto de PÁGINA cambia con el scroll y, sin esta marca, manchan la página
--     a lo largo con toques que fueron todos en el mismo botón.
--
-- MOLDE: el de la 0190 — NULABLES Y SIN DEFAULT. NULL es «no se sabe»: los eventos
-- que no son clics y los clics de un Pixel anterior a la v22. Un default de 0
-- pondría a todos en la esquina del elemento; un `false` en `fijo` afirmaría algo
-- que un Pixel viejo no midió.
--
-- SIN ÍNDICE NUEVO: el mapa lee con `clic_x is not null`, que ya usa el parcial de
-- la 0190, y cada índice en esta tabla se paga en cada evento de cada visita.
-- =============================================================================

begin;

alter table public.vsl_events
  add column if not exists sel          text,
  add column if not exists rel_x        smallint,
  add column if not exists rel_y        smallint,
  add column if not exists alto_ventana integer,
  add column if not exists fijo         boolean;

comment on column public.vsl_events.sel is
  'Ruta CSS corta del elemento tocado (snippet v22+), sin texto. Ancla el clic a un elemento para ubicarlo sobre una foto de la página sin depender del alto del documento. NULL en lo que no es clic y en Pixels anteriores.';

comment on column public.vsl_events.rel_x is
  'Posición horizontal del clic DENTRO de la caja del elemento `sel`, en milésimos (0..1000). NULL igual que sel.';

comment on column public.vsl_events.rel_y is
  'Posición vertical del clic DENTRO de la caja del elemento `sel`, en milésimos (0..1000). NULL igual que sel.';

comment on column public.vsl_events.alto_ventana is
  'Alto del viewport (px CSS) en el momento del clic: la línea del pliegue del mapa de calor. NULL igual que sel.';

comment on column public.vsl_events.fijo is
  'true si el elemento tocado o un ancestro es position fixed/sticky: se mueve con la pantalla, así que su punto de página no sirve y se ubica sólo por el elemento. NULL igual que sel.';

commit;

-- =============================================================================
-- Competitors Spy: la miniatura de una pieza (1/11/2026)
-- =============================================================================
-- Martín: «el rediseño y que tome los videos de IG». Los reels de Instagram YA entraban —
-- `lib/spy.ts` los marca `tipo = 'reel'` y les guarda vistas, me gusta y comentarios—, pero
-- entraban SIN IMAGEN: la tab los mostraba como texto con números. Y no era que Meta no la
-- diera: `lib/instagram-perfil.ts` ya leía `thumbnail_url` y la devolvía como `miniatura`; el
-- mapeo a `PiezaVista` la tiraba, y `miniaturaDePieza` sólo sabía armar la de YouTube
-- (`i.ytimg.com/vi/<id>`). Un swipe file sin la imagen no es un swipe file.
--
-- ⚠️ ESTA URL VENCE, Y POR ESO SE GUARDA IGUAL. Es del CDN de Meta y caduca: el comentario de
-- `lib/instagram-perfil.ts` ya lo decía («se dibuja, no se guarda»). Guardarla igual es lo
-- correcto acá por dos razones medidas, y conviene dejarlas escritas para que nadie la saque:
--   1. sin guardarla, la pieza se ve SÓLO en la pantalla que la acaba de leer: al volver a la
--      ficha, la grilla queda sin imágenes, que es exactamente el estado que esto viene a
--      arreglar;
--   2. la tab ya relee la ficha de más de un día al abrirla (`debeLeerAlAbrir`), así que una URL
--      vencida se reemplaza sola en la próxima lectura, y mientras tanto `TarjetaPieza` esconde
--      la imagen rota con su `onError`. El peor caso es una tarjeta sin foto, que es lo que hay hoy.
-- Lo que NO se hace: copiar la imagen a nuestro storage. Sería durable, y es otro trabajo (bajar,
-- pesar, limpiar lo que ya no se ve); queda anotado como lo que sigue si el parpadeo molesta.
--
-- No lleva índice: no se filtra ni se ordena por esto, sólo se dibuja.

alter table spy_piezas
  add column if not exists miniatura text
    check (miniatura is null or (miniatura like 'https://%' and char_length(miniatura) <= 1000));

comment on column spy_piezas.miniatura is
  'La imagen de la pieza, tal como la dio su fuente. VENCE (CDN de Meta): se reescribe en cada lectura y la pantalla esconde la rota. YouTube no la usa: la suya se deriva del ref.';

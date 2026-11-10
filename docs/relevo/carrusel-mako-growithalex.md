# Relevo — el carrusel de MaKo copiado de @growithalex (9/11/2026, claude4)

**Qué:** Martín quiere hacer, juntos, un carrusel que copie el de `instagram.com/p/DYfVqEmk_to` (@growithalex, «steal my
carousel system», 9 láminas, 6.283 likes y 7.390 comentarios) para PROMOCIONAR el carrusel de MaKo. Y que todo este proceso
se pueda hacer dentro de MaKo: eso lo implementa el chat en la nube «Carruseles en MaKo: replicar guiado, outliers primero»
(rama `punta/carruseles-guiado`, relevo `docs/relevo/nube-carruseles-guiado.md`).

## Dónde está todo (en la PC, fuera del repo)

- `C:/dev/carrusel-mako/growithalex/publicaciones.json`: las 113 publicaciones de la cuenta, leídas con Apify
  (`instagram-scraper`, 33 s, ~US$0,30) con una clave que Martín pegó en el chat. La clave NO se guardó en ningún lado: se
  usó como variable de entorno (`leer-cuenta.mjs`). Hay 44 carruseles, 68 reels y 1 imagen.
- `C:/dev/carrusel-mako/growithalex/<código>/NN.jpg`: las láminas de cada carrusel, 1080×1350. `outliers.json` tiene el
  ranking contra la mediana de la cuenta: carruseles por me gusta + 2×comentarios, reels por reproducciones
  (`outliers.mjs`).
- La referencia: `growithalex/DYfVqEmk_to/01..09.jpg`, la hoja `referencia/laminas.jpg` y el texto `referencia/caption.txt`.

## El diseño de la referencia

- Fila de encabezado en todas: `MAY ©2026 · GROWITHALEX · CREATIVE STRATEGIST`, versalitas chiquitas.
- Portada: «steal my / carousel / system» en serif condensada enorme (estilo editorial), tres tarjetas de ejemplo en
  perspectiva y abajo «6 rules. Every carousel. No exceptions.». Fondo crema con un degradé naranja y grano.
- Láminas 2-7: una insignia negra festoneada con el número, el título en sans negrita de interletra cerrada, el cuerpo en
  sans regular con alguna frase en negrita, y fondos de foto cinematográfica (mar con silla, pasto, puerta de noche, árbol en
  trigo) o de textura (fotocopia, pintura roja).
- Lámina 8: «carousels / aren't just posts.» en serif, sobre papel.
- Lámina 9 (CTA): él en un estudio con cámara, «My name's ALEX / Create SMARTER», «comment / CAROUSEL» en naranja, y el
  regalo («Google Doc with all 6 rules»).

## Instagram desde el Chrome de Martín (trampas)

- Instagram NO tiene la sesión iniciada en ese Chrome (pide entrar con Facebook): no se inicia sesión por él.
- Sin sesión, la página del post deja recorrer las 9 láminas (`ul li img`, 1080×1350), pero:
  - la herramienta no devuelve las URL (llevan query string: se bloquean);
  - Chrome frena las descargas automáticas múltiples después de la primera;
  - la CSP de Instagram no deja hacer `fetch` a `127.0.0.1`.
  Conclusión: para bajar en serio se usa Apify.

## Lo que sigue

1. Mostrarle a Martín los outliers de la cuenta y el plan de láminas para MaKo, con los textos en su voz.
2. Generar las imágenes con Flow / Nano Banana:
   - fondos parecidos (no los de él);
   - las tarjetas de la portada con pantallas de MaKo;
   - la lámina CTA con SU personaje (`omni/personaje-bueno-original.jpg`) en un estudio, conservando la composición.
3. Armar las láminas con texto editable y la tipografía medida del original (el consejo de abajo), comparar al 100 % contra
   la referencia y entregar.

## El consejo sobre la tipografía (Martín preguntó si diseñarla con IA)

Imagen primero y texto encima:
- la IA genera la lámina SIN texto;
- el texto va en capas editables con la fuente medida del original (se compara contra Google Fonts, no se elige por
  categoría);
- sólo el lettering estilizado que ninguna fuente imita va como capa de IA que se regenera al cambiar la palabra.

Ese pedido le quedó al chat de la nube.

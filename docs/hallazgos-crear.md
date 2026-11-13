# Hallazgos — la pantalla de Create y sus portadas de outliers (app/_crear, la grilla de outliers)

La pantalla única de Create (`app/_crear/PantallaCrear.tsx`: el chat de MaKo a la izquierda, los proyectos detrás de la «←», el
centro con la pieza o la portada) y la tarjeta de outliers que comparten Image, Video, Web Generator y Copywriting
(`app/image-editor/carruseles/explorar.module.css`: `.tarjeta`, `.mini`, `.pie`). Lo propio de cada tab va en su documento
(hallazgos-copywriter, hallazgos-carruseles, hallazgos-video-outliers, hallazgos-landing); acá, lo que muerde al tocar lo común.

## La portada de outliers va SIN el chat, y lo que eso deja sin puerta (12/11/2026)

**Lo pedido (Martín, 12/11):** «Si yo estoy en la tab principal donde digo encuentra tu siguiente outlier, no debería salir el chat
de MaKo porque es confuso… cuando le doy clic a uno y entro a editar, ahí sí que salga el chat». Corrige el «chat SIEMPRE a la
izquierda» del 29/10 (memoria `create-un-solo-diseno`).

**Dónde vive la regla:** `PantallaCrear` decide sola cuándo hay portada: `portada` (Web Generator, que pone la portada como
`children`) o `centro === 'nueva'` con `nueva` (Copywriting e Image, que la ponen en lugar de «¿Qué vas a crear hoy?»). Ahí no
monta la tarjeta ni el interruptor «MaKo | tab» del teléfono.

⚠️ **Lo que se pierde sin el chat es la LISTA de proyectos**, que vivía en la otra cara de esa tarjeta (la «←»). Sin una puerta
nueva, «Mis guiones / diseños / landings» quedaban inalcanzables desde la portada. La puerta es `usePortadaCrear().verProyectos`
(`app/_crear/portada-ctx.ts`): abre la lista a la izquierda con un ✕ en vez de la estrella.

⚠️ **El contexto vive en un módulo APARTE y sin dependencias.** Lo primero fue exportarlo desde `PantallaCrear.tsx`, y
`tests/carruseles-pantalla.test.ts` cayó con «This module cannot be imported from a Client Component module»: importar la
pantalla desde una portada arrastra el chat entero (y un módulo `server-only` de su cadena). Una pieza que importan muchas
pantallas no se exporta desde el componente grande que la provee.

## UNA caja por outlier: la entrada animada le ganaba al hover (12/11/2026)

La tarjeta pasó a ser una caja (borde, fondo, `overflow: hidden`) con la imagen y el pie adentro, y el levantarse al pasar el mouse
se movió de la imagen a la caja. ⚠️ **La animación de entrada tenía `both`**: su `transform: none` final queda pegado y le gana a
cualquier `transform` del `:hover` (una animación con relleno pisa las declaraciones normales). Con `backwards` sólo pinta el
arranque. La regla: si un elemento anima su entrada con `transform` y además se mueve al pasar el mouse, el relleno es `backwards`.

## Formatos mezclados: las columnas se reparten por alto ESTIMADO, no medido (12/11/2026)

Con la forma de su red (YouTube 16:9, reel 9:16, carrusel 4:5, anuncio 1:1; `PROPORCION_FORMATO` en lib/copywriter/outliers.ts),
un reel mide 3,2 veces lo que un video de YouTube del mismo ancho, y en una grilla de filas cada reel dejaba un hueco al lado.
`app/_crear/GrillaMixta.tsx` reparte en columnas, cada tarjeta a la más baja, con el alto calculado de la proporción y un pie fijo:
no mide cada tarjeta (sin `ResizeObserver` por tarjeta ni saltos al cargar las imágenes). Sumar una tanda abajo no mueve las de
arriba (el reparto es en orden). Si el pie cambia de alto, se ajusta `ALTO_PIE` en OutliersCopy.tsx; un desbalance chico no se ve.

## Mirar ANTES de desplegar: el banco de las portadas (12/11/2026)

Hay un solo despliegue por día, así que un cambio de diseño que se prueba recién en producción tiene que salir bien a la primera.
`scripts/banco-outliers` compila las portadas REALES (Copywriting, Image, Web) con esbuild y datos inventados, sin base ni chat
(`?p=copy|image|web`, `&tel=1`, `&mis=1`). Las captura `scripts/banco-carruseles/capturar.mjs` con un Chrome sin ventana, a 1440,
a 375 y con el mouse encima. El navegador de la app no sirve para 375 con el panel escondido: recorta todo lo que mida menos de ~300 px.
Las tres fallas que encontró el banco no se veían en los tests ni leyendo el código:
- **un reel de 9:16 con poco texto era una caja blanca casi vacía**: ahora el texto va centrado en el alto, con
  `justify-content: safe center`, que vuelve arriba si el texto no entra;
- **la pastilla «N días al aire» de un anuncio bajaba de renglón a 375 y tapaba el gancho**: ahora va en la fila de números del pie;
- **la fila de tipos de Web a 375 estaba centrada y era más ancha que la pantalla**: se cortaba por los dos lados y «Todas»
  quedaba fuera de alcance. Una fila centrada que puede no entrar va en dos renglones, nunca centrada y deslizable.

## Nunca blanco vacío: la portada llena el marco y el texto va encima (13/11/2026)

El Cerebro, mirando el banco: el reel y el YouTube reservaban su alto pero mostraban sólo texto, y quedaba una caja blanca alta
con el título flotando. La tarjeta de copy cambió de concepto:
- **con imagen**, la portada del original llena el marco, y el gancho y la transcripción van abajo, en blanco, sobre un panel
  oscuro que mide lo que ocupa el texto, con un degradé corto arriba;
- **sin imagen**, el marco toma un fondo oscuro con el color de su red y la transcripción lo llena;
- **al pasar el cursor**, el texto se va y queda el original limpio.

⚠️ El primer intento usaba un degradé de todo el alto. En un carrusel, el título propio de la lámina se mezclaba con el gancho y
quedaban dos títulos encimados: el panel tiene que medir lo que mide el texto.

⚠️ **Lo que «se veía cortado» al pasar el cursor no era la tarjeta.** El banco dibujaba portadas inventadas con los primeros 18
caracteres del gancho («Cobrar mejor no»), y en la captura parecía un título cortado de la interfaz. Los datos inventados de un
banco no llevan texto que se pueda confundir con la interfaz: ahora las portadas son una escena sin letras.

## Sin hacer

- La portada de Video (`app/video-editor/OutliersVideo.tsx`, hoy sólo en el teléfono y en `?ver=outliers`) conserva su párrafo
  de totales («N reels medidos… los que más superaron a su cuenta primero»): lo fija `tests/video-outliers-criterio.test.ts`, del
  chat de Video. El del panel del editor sí se fue.
- El total de Web Generator («N páginas que venden · las de tu competencia primero») sigue: lo fija `tests/web-generator-outliers.test.ts`.

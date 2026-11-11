# Marketing CoPilot: el esquema del descubrimiento (la primera vez)

Pedido de Martín (11/11/2026, mirando la primera maqueta):
- **El chat de MaKo ocupa toda la pestaña, centrado, hasta que haya algo más que mostrar.** Plegado a la izquierda sólo tiene
  sentido cuando al lado se ve otra cosa.
- **La pregunta la hace MaKo en el chat**, y las opciones van en el bloque de preguntas que ya existe, arriba de la caja.
- **Un descubrimiento a fondo antes de la estrategia**, que aprovecha lo que ya hacen Offer y Competitor Spy.
- **Siempre hay salida para quien está empezando** (sin web, sin publicar).

La maqueta navegable de este esquema es [`maqueta-descubrimiento.html`](maqueta-descubrimiento.html). La anterior, con «Tu
funnel» como página de Copywriter, queda en [`maqueta-dos-columnas.html`](maqueta-dos-columnas.html) para comparar. Martín no
quiso esa página: dónde se pliega el chat se decide después.

## Los pasos

| # | Qué pasa | Dónde se ve | De dónde sale |
|---|---|---|---|
| 1 | MaKo saluda y pide **tu Instagram y tu web**. Opciones: «Estoy empezando: todavía no publico», «No uso Instagram», «No tengo web», o escribir el @ y la dirección. | El chat solo, centrado. Las dos preguntas en el bloque, con sus puntos. | El bloque de preguntas del Ops Center (`PreguntasDelChat.tsx`). |
| 2 | **La lectura**: MaKo lee el Instagram, el YouTube que encuentre y la web. Primero la estrella sola con lo que está leyendo («Mirando tu Instagram…», «Leyendo tu YouTube…», «Investigando tu web…»), después la película de las piezas que se juntan y se reparten en carpetas. | La pestaña entera, sin nada más (la regla del Spy: mientras lee y ordena, nada más en pantalla). | La lectura y la animación de Competitor Spy: `mirarCompetidor` (lib/spy.ts), `PeliculaDeOrden` (app/competitor-spy/OrdenSpy.tsx), las frases de lib/spy-lectura-pasos.ts. |
| 3 | **Tu negocio**: lo que publicás (cuánto, en qué formato, a dónde mandás), tu funnel de hoy y **tu oferta con nota** (las nueve dimensiones del marco de Offer, lo más flojo y lo más fuerte). MaKo lo resume en el chat en tres líneas. | Ahora sí hay algo más que el chat: el chat se pliega a la izquierda y a la derecha va la ficha de tu negocio. | La ficha de Competitor Spy («Su funnel», «Su oferta», el riel con «¿En qué publica?»). La oferta, con el analizador de Offer (`diagnosticoOffer`, lib/spy-oferta.ts). Mientras charlan, cada pieza se sigue leyendo (videos transcriptos, texto de los carruseles). |
| 4 | **Lo que la lectura no pudo saber**, de a una: qué vendés exactamente (con las opciones que encontró en tu web y tus piezas), cuánto cuesta, cuántos ya compraron, qué probaste que no funcionó, cuánto podés poner en anuncios. Cada respuesta se suma a tu oferta en la ficha. | El chat, con el bloque. | Las piezas mínimas de Offer (`PIEZAS_DEL_ARRANQUE`: qué vende, a quién, cuánto cuesta) y su guía (`PREGUNTAS_GUIA`, lib/offer-marco.ts). Las de la lectura que ya están contestadas no se preguntan. |
| 5 | **La recomendación**: MaKo dice qué funnel conviene y por qué, y ofrece los otros. | El chat, con el bloque. | `docs/marketing-copilot/funnels-simples.md`: las cuatro preguntas que deciden y las propias de cada funnel. |

**Quien está empezando** (sin Instagram, sin web o sin publicar) no pasa por la lectura: no hay nada que leer. Sigue en el
chat centrado, y MaKo arma la oferta con las preguntas del arranque de Offer (qué querés vender, a quién, cuánto vas a cobrar,
si ya le vendiste a alguien) antes de recomendar un funnel.

## Lo que la maqueta simula y la app ya hace

- La maqueta usa a **Federico Cristofari**, un competidor que ya está en el Competitor Spy del ws 9 (`competidor=20`), como si
  fuera el negocio de quien entra: sus 232 piezas (70 reels, 71 carruseles, 67 videos, 24 shorts), sus números, su funnel de
  hoy (aplicación + llamada) y su oferta (46/100, lo más flojo: precio y cobro), tal como los dejó el Spy el 11/11.
- Las miniaturas de la película van con el texto de cada pieza: el visor de Artifacts no deja cargar imágenes de YouTube ni de
  Instagram. En la app, las de YouTube se ven con su imagen.

## Lo que falta decidir

- Dónde se pliega el chat después de la recomendación, y qué se ve al lado cuando ya hay un funnel elegido.
- Si la lectura de tu propio negocio gasta lo mismo que la de un competidor (Apify y la IA del análisis): es plata, y se
  pregunta una vez, en palabras de producto, antes de programarla.

# Marketing CoPilot: el esquema del arranque (la primera vez)

Lo que pidió Martín, en dos vueltas sobre las maquetas (11/11/2026):
- **Al entrar por primera vez no está el chat.** Primero una pregunta simple, **«¿Por dónde vendés?»**, con botones grandes:
  Anuncios, Instagram, YouTube. Prospección no va por ahora, porque su lectura no se puede hacer.
- **Después, botones grandes para cargar lo que haga falta según lo elegido**:
  - conectar Meta, si hace anuncios;
  - tu Instagram;
  - tu YouTube;
  - y lo que sirve para todos: tu web y el PDF o archivo que explica tu oferta.

  **Ninguno es obligatorio**, y se tiene que ver que no lo es. Es lo que hacía el Archivero, sin llamarlo así.
- **La lectura con la animación de MaKo**: lee todo lo que se cargó.
- Después, el chat. **La pregunta la hace MaKo en el chat**, y las opciones van en el bloque de preguntas que ya existe, arriba
  de la caja. El chat ocupa toda la pestaña hasta que haya algo más que mostrar.
- **Siempre hay salida para quien no tiene nada todavía** (sin web, sin publicar).

Las maquetas, en `docs/marketing-copilot/rediseno/`, una por vuelta para poder compararlas:

| Maqueta | Qué cambia | Artifact |
|---|---|---|
| [`maqueta-arranque.html`](maqueta-arranque.html) | **La vigente.** Botones primero, sin chat, y la lectura de lo que se cargó. | claude.ai/artifact/LUyer4k7kV1sokRuBYeX44 |
| [`maqueta-descubrimiento.html`](maqueta-descubrimiento.html) | El chat desde el principio, pidiendo tu Instagram y tu web en el bloque. | claude.ai/artifact/XboRwCiqtwybpf4iPXQpqw |
| [`maqueta-dos-columnas.html`](maqueta-dos-columnas.html) | La primera: «Tu funnel» como página de Copywriter. Martín no la quiso. | claude.ai/artifact/PyGboJ5AsKL2wUiPe2Kssk |

## Los pasos

| # | Qué pasa | Cómo se ve | De qué pieza de la app sale |
|---|---|---|---|
| 1 | **¿Por dónde vendés?** «Lo que ya hacés o lo que querés empezar. Podés elegir más de uno.» Tres tarjetas: Anuncios (en Facebook e Instagram), Instagram (lo que publicás, sin pagar), YouTube (tus videos). | Pantalla completa, sin chat. Tarjetas grandes que se marcan y «Seguir». | El wizard de pantalla completa de la casa (`app/_components/WizardShell.tsx`: barra de progreso, pregunta grande, «← Atrás», el botón de avanzar). |
| 2 | **Pasame lo que tengas.** «Lo leo todo y te digo qué ajustar. Nada es obligatorio.» Según lo elegido: **Tu cuenta de anuncios** («Conectar con Facebook»), **Tu Instagram**, **Tu canal de YouTube**. Para todos: **Tu página web** y **Subí lo que explica tu oferta** (un PDF, una presentación o un documento). Cada uno queda en verde al cargarse. «Leer todo» se habilita con uno solo. Abajo: «Todavía no tengo nada de esto». | Pantalla completa, sin chat. | La zona para soltar archivos, el input y los botones del Archivero (`app/onboarding/Archivero.tsx`). El botón de la casa para conectar Meta (`ConectarViaZernio`). |
| 3 | **La lectura**: la estrella de MaKo sola con lo que está leyendo, paso por paso y sólo lo que se cargó («Mirando tu Instagram…», «Leyendo tu YouTube…», «Trayendo tus anuncios de Meta…», «Investigando tu web…», «Leyendo tu oferta…»). Después, la película de las piezas, que se juntan en una bola y se reparten en carpetas: Reels, Carruseles e imágenes, Videos de YouTube, Shorts, Anuncios. Si sólo se cargó la web o la oferta, no hay piezas que ordenar, y no se anima (como en el Spy). | La pestaña entera, sin nada más. | La lectura de Competitor Spy: `mirarCompetidor` (lib/spy.ts), `PeliculaDeOrden` (OrdenSpy.tsx) con su carpeta «Anuncios», las frases de lib/spy-lectura-pasos.ts. Los anuncios salen de la conexión con Meta. Los pasos «Trayendo tus anuncios» y «Leyendo tu oferta» son nuevos. |
| 4 | **Tu negocio**: MaKo resume en el chat lo que leyó y la nota de tu oferta, y pregunta lo que no pudo ver, de a una (qué vendés exactamente, con lo que encontró en tu web, tu PDF y tus piezas; cuánto cuesta; cuántos ya compraron; qué probaste que no funcionó; cuánto podés poner en anuncios). Cada respuesta se suma a tu oferta. Al final, la recomendación de funnel. | Ahora sí hay algo que mostrar al lado: el chat se pliega a la izquierda y a la derecha va la ficha. | La ficha de Competitor Spy («Su funnel», «Su oferta» con el analizador de Offer, el riel) y la conversación de MaKo con el bloque de preguntas del Ops Center. Las preguntas, de `PIEZAS_DEL_ARRANQUE` y `PREGUNTAS_GUIA` (lib/offer-marco.ts); la recomendación, de `funnels-simples.md` §3.1. |
| 5 | **Sin nada todavía**: el chat a pantalla completa (no hay nada que mostrar al lado) y MaKo arma la oferta con las preguntas del arranque de Offer (qué querés vender, a quién, cuánto vas a cobrar, si ya le vendiste a alguien) antes de recomendar. | El chat solo, a todo el ancho, como el del Ops Center. | La conversación de MaKo y el bloque de preguntas. |

## Lo que la maqueta simula

- El negocio es **Federico Cristofari**, un competidor que ya está en el Competitor Spy del ws 9 (`competidor=20`). Sus 232
  piezas, sus números, su funnel de hoy (aplicación + llamada) y su oferta (46/100, lo más flojo: precio y cobro) son los que
  dejó el Spy el 11/11.
- **Sus anuncios no están en el Spy**: los 18 anuncios de la película y de la ficha son un número de ejemplo. El PDF de la oferta
  también es de ejemplo.
- Las miniaturas de la película van con el texto de cada pieza: el visor de Artifacts no deja cargar imágenes de YouTube ni de
  Instagram. En la app, las de YouTube se ven con su imagen.

## Lo que falta decidir

- **Quién paga leer tu propio negocio.** Cuesta lo mismo que leer un competidor: Apify más la IA del análisis. Es plata, y se
  pregunta una vez, en palabras de producto, antes de programarla.
- **Dónde se pliega el chat** después de la recomendación, y qué se ve al lado cuando ya hay un funnel elegido.
- **Prospección** quedó afuera: su lectura no se puede hacer.
- **Newsletter** no está entre los tres canales. Entra después, como funnel, con su lista y cómo se anota la gente.

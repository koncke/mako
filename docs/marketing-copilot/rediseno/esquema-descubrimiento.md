# Marketing CoPilot: el esquema del arranque (la primera vez)

Lo que pidió Martín, en dos vueltas sobre las maquetas (11/11/2026):
- **Al entrar por primera vez no está el chat.** Primero una pregunta simple, **«¿Por dónde vendes?»**, con botones grandes:
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
| [`maqueta-por-canal.html`](maqueta-por-canal.html) | **La vigente.** «Tu negocio» con una pestaña por canal, cada una con la cara de su app; logos reales; varios archivos de oferta; el texto en tú; «sin nada» con las preguntas justas. | claude.ai/artifact/97pKNFeiPV4U8asB9ejLwn |
| [`maqueta-arranque.html`](maqueta-arranque.html) | Botones primero, sin chat, y la lectura de lo que se cargó. | claude.ai/artifact/LUyer4k7kV1sokRuBYeX44 |
| [`maqueta-descubrimiento.html`](maqueta-descubrimiento.html) | El chat desde el principio, pidiendo tu Instagram y tu web en el bloque. | claude.ai/artifact/XboRwCiqtwybpf4iPXQpqw |
| [`maqueta-dos-columnas.html`](maqueta-dos-columnas.html) | La primera: «Tu funnel» como página de Copywriter. Martín no la quiso. | claude.ai/artifact/PyGboJ5AsKL2wUiPe2Kssk |

## Los pasos

| # | Qué pasa | Cómo se ve | De qué pieza de la app sale |
|---|---|---|---|
| 1 | **¿Por dónde vendes?** «Lo que ya haces o lo que quieres empezar. Puedes elegir más de uno.» Tres tarjetas: Anuncios (en Facebook e Instagram), Instagram (lo que publicas, sin pagar), YouTube (tus videos). | Pantalla completa, sin chat. Tarjetas grandes que se marcan y «Seguir». | El wizard de pantalla completa de la casa (`app/_components/WizardShell.tsx`: barra de progreso, pregunta grande, «← Atrás», el botón de avanzar). |
| 2 | **Pásame lo que tengas.** «Lo leo todo y te digo qué ajustar. Nada es obligatorio.» Según lo elegido: **Tu cuenta de anuncios** («Conectar con Facebook»), **Tu Instagram**, **Tu canal de YouTube**. Para todos: **Tu página web** y **Subí lo que explica tu oferta** (un PDF, una presentación o un documento). Cada uno queda en verde al cargarse. «Leer todo» se habilita con uno solo. Abajo: «Todavía no tengo nada de esto». | Pantalla completa, sin chat. | La zona para soltar archivos, el input y los botones del Archivero (`app/onboarding/Archivero.tsx`). El botón de la casa para conectar Meta (`ConectarViaZernio`). |
| 3 | **La lectura**: la estrella de MaKo sola con lo que está leyendo, paso por paso y sólo lo que se cargó («Mirando tu Instagram…», «Leyendo tu YouTube…», «Trayendo tus anuncios de Meta…», «Investigando tu web…», «Leyendo tu oferta…»). Después, la película de las piezas, que se juntan en una bola y se reparten en carpetas: Reels, Carruseles e imágenes, Videos de YouTube, Shorts, Anuncios. Si sólo se cargó la web o la oferta, no hay piezas que ordenar, y no se anima (como en el Spy). | La pestaña entera, sin nada más. | La lectura de Competitor Spy: `mirarCompetidor` (lib/spy.ts), `PeliculaDeOrden` (OrdenSpy.tsx) con su carpeta «Anuncios», las frases de lib/spy-lectura-pasos.ts. Los anuncios salen de la conexión con Meta. Los pasos «Trayendo tus anuncios» y «Leyendo tu oferta» son nuevos. |
| 4 | **Tu negocio**, con una pestaña por cosa: **Tu oferta** (la nota de Offer, su funnel de hoy, a dónde manda) y una por canal elegido, cada una con la cara de su app. **YouTube** se ve como un canal (cabecera, pestañas, «Populares», la grilla de videos con vistas). **Instagram** se ve como un perfil (avatar con aro, publicaciones y seguidores, la grilla de reels con vistas). **Anuncios** se ve como la Biblioteca de anuncios de Meta, con el tipo de funnel arriba (mensajes, VSL con llamada, formulario, compra directa): cambian el recorrido, «Lo que veo para este funnel» y el botón de los anuncios. MaKo resume en el chat lo que leyó y pregunta lo que no pudo ver: tres de la oferta (qué vendes, cuánto cuesta, cuántos ya compraron) y una por canal. **Al llegar a la de un canal, se abre su pestaña.** La recomendación abre el funnel elegido (en Anuncios, su tipo). | El chat plegado a la izquierda; a la derecha, las pestañas de la ficha del Spy. | Las pestañas de la ficha (`.spy-pestanas`) y las pastillas de su gráfico (`.spyg-red`). Las caras copian la disposición de YouTube, Instagram y la Biblioteca de anuncios en CSS propio, con los tokens de la casa. Las preguntas salen de lib/offer-marco.ts y de `funnels-simples.md` (la primera propia de cada canal). |
| 5 | **Sin nada todavía**: el chat a pantalla completa, con las preguntas justas para armar «Tu negocio», ni una más: qué quieres vender, a quién, qué logra tu cliente gracias a ti, cuánto vas a cobrar, si ya le vendiste a alguien y una del canal elegido (cuánto puedes poner en anuncios, cuántas veces por semana puedes publicar o cuántos videos puedes grabar por mes). Con eso aparece «Tu negocio» al lado: **tu oferta en borrador**, con lo que le falta para vender, y **tu plan para empezar** con la cara de cada canal (los primeros videos, las primeras publicaciones o el primer anuncio, marcados como idea). Después, la recomendación. | El chat solo mientras pregunta; después, el chat plegado y «Tu negocio» al lado. | Las cinco primeras son las del arranque y la guía de Offer (`PIEZAS_DEL_ARRANQUE`, `PREGUNTAS_GUIA`); la de si ya vendió, de programa-meta-ads-the-net-lab · 11 y 12 (sin producto probado no se compra tráfico). Lo que le falta sale de las dimensiones del marco de Offer (promesa, certeza, razón para decidir). |

## Lo que la maqueta simula

- El negocio es **Federico Cristofari**, un competidor que ya está en el Competitor Spy del ws 9 (`competidor=20`). Sus 232
  piezas, sus números, su funnel de hoy (aplicación + llamada) y su oferta (46/100, lo más flojo: precio y cobro) son los que
  dejó el Spy el 11/11.
- **Sus anuncios no están en el Spy**: los 18 anuncios de la película y los tres de la pestaña Anuncios son de ejemplo, con
  textos de sus publicaciones. Los PDF de la oferta también son de ejemplo. Sus videos, reels, vistas y fechas son de verdad.
- Las miniaturas de la película van con el texto de cada pieza: el visor de Artifacts no deja cargar imágenes de YouTube ni de
  Instagram. En la app, las de YouTube se ven con su imagen.

## Lo que falta decidir

- **Quién paga leer tu propio negocio.** Cuesta lo mismo que leer un competidor: Apify más la IA del análisis. Es plata, y se
  pregunta una vez, en palabras de producto, antes de programarla.
- **Dónde se pliega el chat** después de la recomendación, y qué se ve al lado cuando ya hay un funnel elegido.
- **Prospección** quedó afuera: su lectura no se puede hacer.
- **Newsletter** no está entre los tres canales. Entra después, como funnel, con su lista y cómo se anota la gente.

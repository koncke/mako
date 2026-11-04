# Relevo — Competitors Spy en la nube (pedido de Martín del 4/11/2026)

Lo escribe el chat de la nube que trabaja los 14 puntos. Se actualiza en cada etapa. **La nube no llega a Apify, a Google
ni a la base**: todo lo de acá se probó con dobles y respuestas armadas con la forma del servicio. Lo que dice «sin
probar» hay que mirarlo en el negocio de prueba (ws 3) una vez desplegado.

## Cómo se sube

Cada etapa va a su rama `punta/spy-<nombre>` encima de `origin/main`; `.github/workflows/punta.yml` la chequea y, si da
verde, llega sola a `main`.

## Por punto

| # | Qué pidió | Estado | Rama | Sin probar contra el servicio |
|---|---|---|---|---|
| 1 | La barra principal busca igual que el «+», con las redes separadas | Hecho: la barra abre el buscador (y «/» o ⌘K); grupos Instagram · YouTube · TikTok · Sitio web con su logo | `punta/spy-busqueda` | Mirarlo en pantalla, escritorio y teléfono |
| 2 | Mensajes mientras tarda, y buscar también en YouTube por nombre | Hecho: «Esto puede tardar unos 20 segundos.» → «Con su @ exacto es más rápido.»; YouTube por nombre sale de Google | `punta/spy-busqueda` | Cuánto tarda de verdad una corrida de Google de dos páginas |
| 3 | Por nombre, los mejores resultados (las cuentas grandes) | Hecho: Google (ordena por popularidad y trae los seguidores) + el buscador de Instagram, ordenado por seguidores; las 5 primeras se completan en UNA corrida | `punta/spy-busqueda` | Que la descripción de Google traiga «492K Followers» como se espera; que el lector de perfiles acepte 5 usuarios en una corrida |
| 4 | Un link de Instagram = el @ exacto; un link de YouTube trae la foto | Hecho: con o sin https y con `?igsh=`; el canal se lee con `channels.list` (foto, nombre, suscriptores), y su foto es la cara del competidor si no tiene Instagram | `punta/spy-busqueda` | La foto del canal desde la clave de YouTube de la plataforma |
| 12 | El @ sin la arroba también se busca, y más rápido | Hecho: «den.borgg» ya no es un sitio; con la clave de Spy, Apify va primero (antes esperaba a Meta, hasta 12 s) | `punta/spy-busqueda` | El tiempo real del actor por @ |
| 5 | Sacar los textos que sobran de la ficha | Hecho: sin las franjas de «Lo que publica…», sin el pie «Lo que se pudo leer…», sin «La etapa la calcula MaKo» | `punta/spy-ficha` | Mirarlo en pantalla |
| 6 | Sus otras redes, automáticas y con criterio | Hecho: se buscan solas al abrir la ficha (una vez por semana); lo que se enlaza, o tiene la misma foto y el mismo nombre, se suma con «Deshacer»; lo dudoso se pregunta con su foto y el porqué. Sin IA en este paso (§12 del diseño) | `punta/spy-ficha` | La búsqueda completa contra Google y Apify; que la foto del candidato se baje (CDN de Meta) |
| 11 | Sin «Con qué abre», «Sigue a la vista», «Probado»; la IA analiza sola; «Agregar Instagram» en el desplegable; nombres de orden que se entiendan | Hecho: la IA DEL NEGOCIO lee sola las piezas nuevas en segundo plano, «Analizando…» en cada tarjeta; desplegable de tipos (Reels, Carruseles e imágenes, Videos de YouTube, Shorts) con «Agregar su Instagram/YouTube»; orden «Más vistas» / «Más reciente» | `punta/spy-ficha` | Que 3 tandas de 30 piezas terminen en los 300 s de la ruta con la IA de un negocio real |
| 13 | Su web, analizada sola | Hecho: el sitio sale de la descripción de su canal o de su bio y se lee con su funnel en la misma lectura; el botón que queda es «Copiar su sitio» | `punta/spy-ficha` | — |
| 14 | Antes de la animación, sólo la estrella; miniaturas cargadas antes | Hecho: `CargandoMako` solo mientras se lee y se bajan TODAS las miniaturas (hasta 8 s); después la animación; la miga, las pestañas y sus redes al terminar | `punta/spy-ficha` | Mirarlo en pantalla con un competidor de Instagram |
| 8 | Traer muchos más reels y videos, todos si se puede | Hecho: Instagram por una corrida larga de Apify (300 la primera vez, lo nuevo cada semana) que no se espera; YouTube hasta 500 videos la primera vez; la ficha lee hasta 2.000 piezas y dibuja de a 60 | `punta/spy-todo` | Las corridas largas contra Apify (empezar, mirar, leer el dataset) |
| 10 | Todos los anuncios de la Biblioteca | Armado y APAGADO (`ANUNCIOS_POR_APIFY = false`): un actor de Apify sobre la Biblioteca pública, sin la sesión de nadie (los riesgos de cada camino, en el diseño §14). Falta medir el actor una vez: `scripts/probar-anuncios-apify.mjs` | `punta/spy-todo` | Todo: la forma de la respuesta del actor no se pudo leer desde la nube |
| + | (Cerebro, 4/11) Un apartado para las miniaturas de YouTube con su título | Hecho: pestaña «Miniaturas», de la más vista a la menos | `punta/spy-ficha` | — |
| + | (Cerebro, 4/11) La caricatura, sola y en segundo plano | Hecho: la IA del negocio describe la cara, la foto sube a Flow y la imagen vuelve a nuestro Storage; la tarjeta la usa antes que la foto. Necesita la extensión conectada y Google Flow abierto en ese navegador (como el AI Avatar) | `punta/spy-caricatura` | Toda la caricatura: la IA mirando la foto y el puente tomando el pedido |

## Cambios de cupo y de costo (lo decidí yo; está en `docs/diseno-competitors-spy.md` §11)

- Lecturas con la clave de Spy: 40 → **150 por día** (~US$0,39 el peor día), con 30 reservadas para agregar.
- Búsquedas por nombre: **cupo propio de 60 corridas** (30 búsquedas, US$0,65 el peor día). Antes compartían el de las
  lecturas y con tres búsquedas el negocio se quedaba sin poder agregar a nadie.
- Lo paga cada negocio con su clave. Si querés otros números, son dos constantes en `lib/instagram-perfil.ts`.

## Migraciones que faltan aplicar

Ninguna todavía.

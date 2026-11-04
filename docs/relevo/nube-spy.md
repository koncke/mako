# Relevo — Competitors Spy en la nube (pedido de Martín del 4/11/2026)

Lo escribe el chat de la nube que trabaja los 14 puntos. Se actualiza en cada etapa. **La nube no llega a Apify, a Google
ni a la base**: todo lo de acá se probó con dobles y respuestas armadas con la forma del servicio. Lo que dice «sin
probar» hay que mirarlo en el negocio de prueba (ws 3) una vez desplegado.

## Estado (4/11/2026)

**Los 14 puntos están en `main`**, por etapas: `punta/spy-busqueda` (1, 2, 3, 4, 12), `punta/spy-ficha` (5, 6, 11, 13,
14), `punta/spy-caricatura`, `punta/spy-todo` (8, 10) y `punta/spy-detalle` (7, 9). Cada una pasó `punta.yml` en verde.

**Segunda vuelta, también en `main`:** `punta/spy-buscar-yt`, `punta/spy-cadena`, `punta/spy-caricatura-cola`,
`punta/spy-sugeridos`, `punta/spy-contenido`, `punta/spy-oferta` (el Funnel con su oferta) y `punta/spy-detalle-guion` (el
detalle de cada pieza con su guion). Los tres rojos que reportó el Cerebro sobre `punta/spy-oferta` (run 41826292011)
quedaron arreglados antes de entrar: `cuenta-revision-escrituras` (las rutas nuevas, `oferta` y `transcribir`, van como
**cortadas**), `red-primera-semana` (`soloDelNegocio` apaga el crédito y la red de la plataforma sin cortar la función) e
`integracion-sin-salir` (los «Conectar» son el modal de la casa, `BotonIntegracion`).

Lo que espera a Martín:
1. Mirar en el ws 3, con un competidor real, el gráfico, la pestaña Funnel con su oferta y el detalle de una pieza con su
   guion («Transcribiendo…» y después el texto).
2. Prender los anuncios: correr una vez desde la PC `scripts/probar-anuncios-apify.mjs` y, si los trae bien y el costo cabe,
   cambiar `ANUNCIOS_POR_APIFY` a `true` (diseño §14).
3. El guion de los videos de YouTube (abajo, «Decisiones que esperan a Martín»).

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
| 7 | El detalle de cada competidor como el video: todo en un gráfico, uno por tipo de contenido | Hecho: pestaña «Gráfico», la primera; desplegable Contenido corto · Contenido largo · Carruseles e imágenes · Anuncios · Su web; números arriba, filtro de redes, cada miniatura en su día y sus vistas (escala log), entrando volando desde una columna; «¿Qué formatos le funcionan?» con la mediana de cada formato y la lectura escrita por el código. Sin «Anatomía del guion» ni retención: no hay datos públicos (diseño §15) | `punta/spy-detalle` | Mirarlo en pantalla con un competidor real; que la IA del negocio devuelva el formato |
| 9 | «Copiar estructura» de un reel, un YouTube, un carrusel o una web | Hecho: tocar una miniatura o una tarjeta abre su detalle con «Copiar estructura», que arma una página del Copywriter del tipo que corresponde (con su estructura y su texto citado); sin el Copywriter, el texto queda copiado. La web va al Web Generator («Copiar su sitio») | `punta/spy-detalle` | La página nueva del Copywriter en producción |
| + | (Cerebro, 4/11) Un apartado para las miniaturas de YouTube con su título | Hecho: pestaña «Miniaturas», de la más vista a la menos | `punta/spy-ficha` | — |
| + | (Cerebro, 4/11) La caricatura, sola y en segundo plano | **Reemplazado por la cola del Runner** (segunda vuelta, abajo): el camino de la IA del negocio + Flow se borró | `punta/spy-caricatura` → `punta/spy-caricatura-cola` | — |

## Segunda vuelta (Martín probó en producción, 4/11/2026)

| Qué pidió | Estado | Rama | Sin probar contra el servicio |
|---|---|---|---|
| Buscar en YouTube con un nombre de varias palabras, sin @, con @ y por link | Hecho: los videos que trae Google se leen como su canal (`videos.list`), el nombre prueba su @ en YouTube y el grupo de YouTube dice qué pasó si no trae a nadie | `punta/spy-buscar-yt` | Una búsqueda real de «Victor Heras» |
| Den Borg con 12 de 500, sin su YouTube ni su web | Hecho: la traída larga avanza sola cada hora (`/api/cron/spy-todo`), una corrida vacía se vuelve a pedir mañana y la pantalla dice por qué no trajo todo; sus otras redes salen en cadena (lo que enlaza su bio y su página de enlaces → su mismo usuario → Google sólo si falta), y su web sale de adentro de beacons/linktr.ee | `punta/spy-cadena` | beacons.page real; la forma de los ítems de error de Apify; el cron en Vercel |
| La caricatura la hace el Runner con Canva (Martín: «levantar un ticket para generar esa imagen») | Hecho: al leer un competidor con su foto ya en nuestro Storage queda pendiente en `spy.caricaturas`; el Runner la lista y la guarda con dos scripts (contrato abajo). Sin la caricatura, la tarjeta muestra su foto sin cartel ni spinner. Se borró la rama de la IA del negocio + Flow (motor, ruta y bucle de la pantalla) | `punta/spy-caricatura-cola` | Los scripts contra la base de verdad: la primera prueba es Den Borg (ws 9, competidor 17) |
| Sugeridos: los competidores de la plataforma en todos los negocios | Hecho: bloque «Sugeridos» con «Sumar» (copia lo ya leído: no gasta la clave del cliente; sin anuncios ni oferta); en la API, `ver_sugeridos` y `sumar_sugerido`. Sólo los del negocio de la plataforma, nunca los de otro cliente | `punta/spy-sugeridos` | Verlo en pantalla con los de verdad: un negocio cualquiera tiene que ver a los del 9 (Den Borg, Víctor Heras…) y sumarlos sin que suba el uso de su Apify |
| Logos de cada red en toda la tab, y «¿En qué publica?» por red y formato | Hecho: el mismo logo del buscador en las miniaturas del gráfico, sus filtros, el detalle y el reparto; el reparto por red (con logo) y por formato, sin «100% videos»; se fue «Cada miniatura es un video» | `punta/spy-contenido` | — (dibujado con datos de prueba en escritorio y teléfono) |
| Dos pestañas («Contenido» y «Funnel»), selector adentro del gráfico, proporción real de cada miniatura, sin «Revisar ahora» ni textos que narran, la criatura sin tarjeta blanca | Hecho | `punta/spy-contenido` | La ficha con un competidor de verdad: que «Funnel» aparezca sólo con web u oferta |
| La foto real de perfil en la ficha del competidor (Sofía Contreras) | Hecho: la ficha abierta muestra su foto de perfil al lado del nombre; la lista sigue con la caricatura (criterio: la caricatura es la cara de la tab, la foto es la persona) | `punta/spy-contenido` | — |
| «Funnel»: sus webs solas y su OFERTA con el analizador de Offer | Hecho: debajo de su web, el diagnóstico de Offer (las 9 notas, la tesis, lo que hace bien y el puntaje que calcula el código), leído solo al abrir un competidor con web (/api/competitor-spy/oferta), sin botón y con la criatura mientras lee. Con la IA del negocio, sin crédito ni red de la plataforma (`soloDelNegocio`); habla de él en tercera persona (`bloqueOfertaDeOtro`). Una vez y listo: sólo vuelve a la IA si su web cambió. En la API, `su_oferta_con_notas` | `punta/spy-oferta` | Con un negocio real: que el modelo hable en tercera persona y lo que trae una web de verdad |
| El detalle de cada pieza rehecho, con su transcripción y un botón «Copiar estructura» mejor | Hecho: quién lo publicó (su foto y sus seguidores), sus números con «frente a su mediana», su estructura, su GUION y su texto; «Hacer uno así» con la estrella de MaKo en el pie. El guion de un reel se pide solo al abrir (Apify trae su video fresco, UNA publicación con la clave de Spy y un tope de 40 por día; lo escucha la IA del negocio), con «Transcribiendo…». YouTube: no (abajo) | `punta/spy-detalle-guion` | Que el actor devuelva `videoUrl` con `directUrls` de UN reel, y que la IA de un negocio escuche ese mp4 |

## Tercera vuelta (Martín revisó con Den Borg, 4/11/2026)

| Qué pidió | Estado | Rama | Sin probar contra el servicio |
|---|---|---|---|
| «Escribí tal cual @herasmedia y no me trajo al perfil» | Hecho: «Usar @x» lee su perfil (causa medida por el Cerebro) | `punta/spy-medidos` (en `main`) | — |
| «No pude buscar sus otras redes ahora»: sacar el texto y ver por qué | Hecho: Google por Apify tardaba más de 45 s; la corrida se empieza asíncrona, se anota y se retoma sin pagar otra; sin texto en pantalla | `punta/spy-medidos` (en `main`) | Una búsqueda real que tarde más de 35 s |
| Que la traída larga no se coma el crédito de Apify | Hecho: lee el crédito del mes, deja US$2 de reserva y usa a lo sumo un cuarto del resto; sin crédito se le dice sólo al admin | `punta/spy-medidos` (en `main`) | La respuesta real de `/v2/users/me/limits` |
| «Agregar YouTube» con un modal feo y sin búsqueda | Hecho: el mismo buscador, con su nombre y sólo esa red | `punta/spy-ficha-diseno` | — |
| Volver a todos los competidores, el ⋯ arriba a la derecha | Hecho | `punta/spy-ficha-diseno` | — |
| La grilla de sus piezas a todo el ancho, sin scroll infinito; un bloque al lado de los formatos | Hecho: por páginas de filas enteras; «Lo que mejor le fue» cierra el riel | `punta/spy-ficha-diseno` | — |
| Los anuncios dentro de Contenido | Hecho: un formato más del desplegable | `punta/spy-ficha-diseno` | — |
| La animación al entrar: tarjetas que se acomodan y van al gráfico | Hecho: el mismo gesto del gráfico, saliendo de una grilla ordenada (~1,6 s) | `punta/spy-ficha-diseno` | Mirarla en pantalla |
| Más rápido; medir antes y después | Hecho en la vista de prueba (3,9 s → 3,2 s hasta el gráfico; 2.369 → 1.664 elementos): números y método en docs/hallazgos-competitors-spy.md | `punta/spy-ficha-diseno` | **Medirlo en producción con Den Borg**: la vista de prueba no tiene el CDN de Meta |
| Anuncios por su Instagram o el nombre del negocio, verificados | Hecho: el enlace busca su nombre corto o su @ (nunca una página de enlaces) y un anuncio es suyo sólo por su Página o por mandar a SU web | `punta/spy-anuncios` | Si la frase exacta de la Biblioteca encuentra a la Página por su nombre |
| Funnel: la oferta y el funnel que usa arriba, con evidencia de un catálogo; sus webs con su vista previa y un desplegable de páginas | Hecho: el tipo de funnel con sus citas (Den Borg → evento presencial), la oferta rediseñada arriba, «Sus páginas» al final con la vista previa del Web Generator; por API en `que_esta_haciendo` | `punta/spy-funnel-tipo` | Lo que dice con competidores reales; los formatos nuevos del catálogo en el análisis de piezas (pendiente) |
| Los formatos de «lo que le funciona» con una investigación de todos los tipos | Hecho: los 19 del catálogo, la IA recibe qué es cada uno, y sin IA se lee del texto con una frase clara | `punta/spy-formatos` | Volver a analizar con la IA lo ya analizado (no se manda solo) |
| El recorrido que señala lo nuevo | Pendiente | — | — |
| «Sus páginas» bloqueada (Beacons de Den Borg, 403 de Cloudflare): «que no se bloquee, y que funcione todo» | Hecho en parte: sin cartel técnico (la carga de la casa y después «Abrir»), y el desafío de un antibots ya no se lee como la página. **NO hecho:** leerla con un navegador de Apify. El clasificador de permisos lo frenó por evadir la verificación de un antibots; lo decide Martín | `punta/spy-paginas-bloqueadas` | La pantalla con la página real (desde la nube no se llega a Beacons) |

### La cola de caricaturas: el contrato de los dos scripts (para el Runner)

Los dos corren en la PC, con la base de producción y la clave de servicio del clon:

```bash
node --env-file=<clon>/.env.local --import tsx scripts/spy-caricaturas-pendientes.mjs
```

Imprime un JSON con `pendientes` (`[{ ws, id, foto }]`: sólo eso, sin nombre ni nada traído de afuera; la foto es una URL
pública de nuestro Storage), `rendidas` (`[{ ws, id, foto, fallos, motivo }]`: fallaron 3 veces y ya no se intentan) y
`masVieja` (desde cuándo espera la pendiente más vieja). Una persona que miran varios negocios sale una sola vez. Sólo lee.

```bash
node --env-file=<clon>/.env.local --import tsx scripts/spy-caricatura-guardar.mjs <ws> <id> <archivo>
```

Sube la imagen (JPG, PNG o WebP; cuadrada, de 128 px o más, hasta 2 MB) a `spy-miniaturas/spy/caricatura/<red>-<usuario>`
y la marca lista en ese competidor **y en la misma persona (misma red y mismo usuario) de cualquier otro negocio**: no se
genera otra. Un negocio que agrega después a la misma persona la recibe al leerla, sin entrar a la cola. El tamaño se lee
del archivo: el conector de Canva entrega 200 × 200 y eso alcanza (la tarjeta mide ~250 px; las fotos de Instagram ya
llegaban en 150 o 320).

```bash
node --env-file=<clon>/.env.local --import tsx scripts/spy-caricatura-guardar.mjs <ws> <id> --fallo "<motivo>"
```

Anota que Canva no pudo. No se reintenta en cadena: vuelve a la lista al día siguiente, y a los 3 fallos queda en
`rendidas`. **Sin Canva conectado en la cuenta de Claude del Runner no se anota nada**: la pendiente espera, sin error y
sin cartel en la pantalla, y lo único que lo delata es `masVieja` creciendo (para el super admin).

**La receta** (medida por ti el 4/11 con Den Borg, ~30 s): `upload-asset-from-url` con la foto → `generate-image` con
`imageReferences` y `SQUARE_1_1` → `get-generate-image-job` hasta `SUCCESS` → `get-assets` con el media id. El prompt es
el aprobado (docs/hallazgos-ops-center.md), pero «the man» no va fijo: género, pelo, barba, anteojos, piel, gesto, prenda
lisa y color de fondo los completa el Runner mirando la foto (Den Borg es una mujer).

**La primera prueba:** Den Borg del ws 9 (competidor 17), con la imagen que ya generaste:
`spy-caricatura-guardar.mjs 9 17 <archivo>`. Tiene que decir «Marcada en N competidor(es)» y la tarjeta mostrarla al
recargar Spy.

### Qué medir en la base de producción (te lo pido, Cerebro): el competidor 13 del ws 11, que quedó en 12

Todo es lectura. Con eso se sabe cuál de las tres causas le tocó (la corrida nunca se recogió, terminó vacía, o no hay clave):

```sql
-- 1) Su traída larga: corrida, dataset y cuándo se pidió / terminó (entrada "13" → "instagram")
select value from app_settings where workspace_id = 11 and key = 'spy.todo';
-- 2) ¿El negocio tiene la clave de Spy?
select count(*) from credenciales where workspace_id = 11 and clave = 'APIFY_INSTAGRAM_TOKEN';
-- 3) Su @ y qué hay guardado, por fuente
select instagram, youtube_id, landing_url from spy_competidores where id = 13;
select canal, fuente, count(*) from spy_piezas where competidor_id = 13 group by 1, 2;
```

Y con el `run` y el `dataset` de (1), contra Apify con la clave de ese negocio: `GET /v2/actor-runs/<run>` (`status`,
`stats.itemCount`) y `GET /v2/datasets/<dataset>/items?limit=1` (si el primer ítem trae `error` / `errorDescription`, Instagram
no le dio nada: la cadena nueva lo vuelve a pedir al otro día y lo dice en pantalla). Si (1) no tiene entrada "13", la traída
nunca se pidió: con el cron, la pide sola en la próxima hora.

**Lo que paga el cron:** cada negocio, con su clave de Spy, lo mismo que pagaría abriendo la ficha: como mucho 6 corridas largas
por día (ahora contadas en la base, `spy.todo.dia`), cada una con su techo en dólares, y una por competidor por semana.

## El teléfono

Competitors Spy no tiene pantalla propia en el teléfono (`app/m/`): está `EN_CAMINO` en `lib/movil-rutas.ts` desde antes de este
pedido, y un teléfono ve la cubierta de «se usa en la computadora». Lo nuevo (el gráfico, el detalle, «Copiar estructura») se
probó a 390 px en Chromium con datos inventados: entra sin scroll de costado, con 90 miniaturas como mucho. Cuando se escriba la
pantalla del teléfono, monta `GraficoSpy` tal cual.

## Cambios de cupo y de costo (lo decidí yo; está en `docs/diseno-competitors-spy.md` §11)

- Lecturas con la clave de Spy: 40 → **150 por día** (~US$0,39 el peor día), con 30 reservadas para agregar.
- Búsquedas por nombre: **cupo propio de 60 corridas** (30 búsquedas, US$0,65 el peor día). Antes compartían el de las
  lecturas y con tres búsquedas el negocio se quedaba sin poder agregar a nadie.
- Lo paga cada negocio con su clave. Si quieres otros números, son dos constantes en `lib/instagram-perfil.ts`.

## Decisiones que esperan a Martín

- **El guion de los videos de YouTube.** No hay una forma permitida: `captions.download` pide ser el dueño del canal y bajar
  el video va contra los términos de YouTube. La única salida es un actor de Apify que lee los subtítulos (con la clave de
  Spy del negocio), y eso extiende a YouTube lo que se decidió «sólo para Spy» sobre Instagram. Hasta que lo decida, el
  detalle de un video de YouTube muestra su descripción.

## Migraciones que faltan aplicar

Ninguna. Lo nuevo que se guarda vive en `app_settings` del negocio (`spy.todo`, las corridas largas; `spy.todo.dia`, cuántas
empezó hoy; `spy.caricaturas`, las caricaturas; `spy.oferta.<id>`, la oferta de cada competidor, que se borra con él; `spy.transcripcion.<competidor>.<pieza>`, el guion de
cada reel, que se borra con él; `spy.transcripciones.dia`, cuántos videos se pidieron hoy) y en las columnas que ya existían (`spy_piezas.analisis` lleva ahora su `formato`, dentro del mismo jsonb).

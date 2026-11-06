# Hallazgos — Carruseles (la biblioteca de ejemplos)

Dónde vive: `lib/carruseles/biblioteca*.ts`, `scripts/carruseles-biblioteca.mts`, tablas `carruseles_biblioteca_*` (migraciones 0392, 0393 y 0404).
El rediseño del 6/11/2026: `app/image-editor/carruseles/ExplorarCarruseles.tsx` (la pantalla), `lib/carruseles/cta.ts` (el filtro CTA),
`lib/carruseles/anuncios.ts` (los anuncios de Spy), `lib/carruseles/replica*.ts` + `app/api/image-editor/carruseles/replicar/route.ts`
(«Editar» un ejemplo). Capturas: `docs/carruseles/rediseno-2026-11-06/`.

## Traer un carrusel puntual: por su link, nunca por el perfil (5/11/2026)

**Síntoma:** teníamos 245 links de carruseles buscados. Leer a sus creadores por perfil costó US$4,71 y trajo 1.007 carruseles, con 1 solo de los 245.

**Lo obvio era leer más posts por perfil, y estaba mal.** Los carruseles que se buscan son los que funcionaron, y suelen ser viejos: no están entre los últimos posts. Subir el tope compra más carruseles ajenos, no el buscado.

**La regla:** con el link en la mano se pide el post, a ~US$0,0025 cada uno. Así salieron 244 de 245. El actor de Instagram de Apify, con esta entrada y de a 40 links por lectura:

```json
{ "directUrls": ["https://www.instagram.com/p/XXX/"], "resultsType": "posts", "resultsLimit": 1, "addParentData": false }
```

El perfil queda para explorar a un creador, no para encontrar una pieza.

## Sin dato no es «no»: el filtro gratis tiraba a Hormozi y a Leila (5/11/2026)

**Síntoma:** el filtro `(laminas ?? 0) >= 3 && parece_contenido === true` descartó 582 de 1.344 piezas, entre ellas 11 de las 13 de `leilahormozi` y 6 de las 11 de `hormozi`.

**Lo obvio era que esas piezas no servían.** En realidad, 457 de las 582 cayeron porque **faltaba el dato**, no porque fuera malo: 338 con `parece_contenido` en null y 119 con `laminas` en null. El lector no siempre trae la cantidad de láminas, y el clasificador deja null cuando no se anima a decidir (un texto corto, o una pieza sin texto). Mirados a ojo, 363 de esos 457 sirven: entre ellos, los textos estilo tuit de Alex Hormozi y Leila, de lo mejor de la biblioteca.

**La regla:** `?? 0` y `=== true` convierten «no sé» en «no». Lo que falta se mira; se descarta sólo con un dato en contra. Tampoco el «no» del clasificador alcanza: de 67 con `parece_contenido` en false y 3 láminas o más, 40 servían.

**Mirar hojas de miniaturas con un agente: el criterio decide más que el modelo.** La primera pasada, con «¿sirve de plantilla?», descartó 130 de 762. La segunda, con «ante la duda, sirve; sólo se va lo obvio» y ejemplos de falsos descartes, se quedó con 99 de esos 130. Las portadas con foto de fondo y una frase son las que más se pierden («Your business idea might already be your hobby»). Antes de esconder, revisar a ojo la lista de descartes en una hoja propia, rotulada con su clave: la posición contada dentro de una hoja se puede correr.

## Esconder y deshacer (5/11/2026)

`dejo_de_verse_en` esconde (`lib/carruseles/biblioteca-servidor.ts:87`). Volver a leer una pieza no la revive: el `upsert` por `ref` de `scripts/carruseles-biblioteca.mts` no toca esa columna.

El 5/11 se escondieron 210 (152 mirados a ojo y 58 de dos láminas, que no alcanzan para copiar una estructura). Quedan 1.378, con los 244 de Top Carousels. Para deshacer: `update carruseles_biblioteca_piezas set dejo_de_verse_en = null where dejo_de_verse_en::date = '2026-11-05'` (la fecha sale del `now()` de esa única corrida). La lista con el motivo de cada una está en la PC: `C:/dev/cerebro-herramientas/tickets/carruseles-escondidos-2026-11-05.json`.

## Top Carousels: su biblioteca no se recorre, ni con la sesión de Martín (5/11/2026)

Sus términos del 7/10/2026 prohíben entrar con herramientas automáticas, bajar carruseles en cantidad y republicar la biblioteca, y avisan que pueden cerrar la cuenta sin devolver el dinero. `robots.txt` veda `/explore` y `/api/`, y deja a los agentes `/llms.txt` y `/llms-full.txt`. Tener la sesión abierta no cambia nada.

**La regla:** los carruseles se leen de Instagram, a partir de los @ y links que pase Martín o de su texto público para agentes. Sus puntajes no se copian. Si hiciera falta más, tienen un conector oficial (`https://topcarousels.com/mcp`, plan Pro; el permiso lo da Martín).

## «Editar» un ejemplo: se copia el diseño, la IA del negocio escribe (6/11/2026)

**Vive en:** `lib/carruseles/replica.ts` (puro: el prompt, la lectura, el documento) y `lib/carruseles/replica-servidor.ts`.

Martín: «que todos los carruseles sean EDITABLES, guiándote por "replicate" del Web Generator». Lo que se copia de un ejemplo
es dónde va cada texto, cuántas láminas, los colores y si hay una persona; las palabras, nunca: la IA del negocio escribe las
suyas con su contexto y su voz (`contextoDelNegocio`, `vozDelNegocio`), y donde el ejemplo tiene una persona va la foto del
cliente (su cara de marca o su último look de AI Avatar), subida a «Subidos» del Image Editor.

- **Lee las láminas con visión, y por eso hace falta tenerlas.** Hasta el 6/11 la biblioteca guardaba sólo la portada. La 0404
  suma `laminas_imagenes` y el comando `laminas` del script las trae por link. Sin láminas, «Editar» arma igual el diseño con
  una guía en cada lámina y lo dice («todavía no tiene sus láminas guardadas»): nunca un error.
- **Corre con la IA del negocio** (`leerDocumentoIA` adentro de `conSuIADelNegocio`). Sin IA, el mismo diseño con guías y el
  botón «Conectar mi IA», que abre el modal de /integraciones en la tab.
- **Se ve construyéndose:** la ruta manda NDJSON (`leer`, `escribir`, una línea por lámina, `fin`), copiado del «Replicar» del
  Web Generator, y la pantalla revela las láminas de a una con `useRevelado`.
- **Lo que el modelo devuelve se vuelve a validar** (`leerReplica`): roles, colores, cantidad de láminas, y un JSON roto se
  repara con `parseJsonObject`. Sin ningún texto, cae a las guías.

## El filtro CTA: la palabra la decide un patrón, no un modelo (6/11/2026)

**Vive en:** `lib/carruseles/cta.ts`, con `tests/carruseles-cta.test.ts` (textos con la forma real de los pies de Instagram).

- **Lo obvio era buscar «comenta» y quedarse con la palabra siguiente, y estaba mal.** «Comenta tu opinión», «comenta si te
  pasó» y «comenta abajo» no piden una palabra. Lo que la delata es que viene DESTACADA (entre comillas, en mayúsculas o
  después de «la palabra») o que trae una promesa («y te la mando»). Una palabra común en minúsculas («si», «abajo») queda
  afuera salvo que venga destacada.
- **Se busca sobre el texto sin tildes pero del mismo largo**, y la palabra se recorta del ORIGINAL: así sale «GUÍA», no «GUIA».
- **Gana el último pedido del texto**: el CTA va al final del pie.
- **Para lo guardado se calcula con `reclasificar`** (gratis: no le pide nada a Apify), y lo guardado gana sobre lo calculado.

## Los anuncios en la misma tab: sólo los de Spy del negocio (6/11/2026)

**Vive en:** `lib/carruseles/anuncios.ts`.

Los anuncios salen de Competitors Spy, de las cuentas que sigue ESE negocio y con SU clave de Apify (el actor
`apify~facebook-ads-scraper`). La biblioteca de ejemplos de la plataforma no tiene anuncios: los términos de Meta no dejan
pasarle a un tercero lo que se recolecta (docs/hallazgos-competitors-spy.md). La señal de «funciona» son los días al aire (un
anunciante no paga semanas por un anuncio que no vende): fuera de la UE la Biblioteca no da gasto ni resultados, así que no
se inventa un outlier. Sin la fecha de inicio, no se afirma un cero.

### Espiar anuncios: las fuentes, comparadas (6/11/2026)

⚠️ La nube no pudo abrir facebook.com, apify.com, foreplay.co ni tryatria.com: los precios y reglas salen de fuentes
secundarias y hay que verificarlos antes de pagar nada.

| Fuente | Qué da | Precio | Términos | Veredicto |
|---|---|---|---|---|
| API oficial de Meta (`ads_archive`) | Anuncios comerciales SÓLO si llegaron a la UE o el Reino Unido; gasto sólo en políticos | Gratis, con verificación | La única oficial | No sirve para negocios de LATAM |
| Apify (actores de la Biblioteca de Meta) | Imagen, texto, fechas y estado; varía por actor | US$0,2–0,75 cada mil anuncios | Meta prohíbe pasarle a un tercero lo recolectado | **Ya está en Spy**, con la clave de cada negocio. Para una biblioteca de anuncios de la plataforma, no |
| Foreplay | +100 millones de anuncios, API con 10.000 créditos al mes | US$49–459 al mes | Reventa: sin dato; el plan Enterprise menciona compartir con marca blanca | Lo más limpio a escala, con permiso por escrito |
| Atria | +25 millones, API REST (`/open/v1/ad-library/search`) | US$129–159 al mes | Reventa: sin dato | Alternativa a Foreplay, mismas preguntas |
| AdSpy, BigSpy, Minea, PiPiAds | Para uso propio | US$9–149 al mes | Sin API confirmada | No son una fuente para MaKo |

**La recomendación:** ya quedó armado lo que se puede con lo que MaKo tiene: los anuncios que Spy trae de las cuentas que
sigue cada negocio, en la misma tab, con su filtro y ordenados por días al aire. Una biblioteca de anuncios para TODOS
(ejemplos que no sean de las cuentas que sigue el negocio) necesita una cuenta paga de Foreplay o Atria a nombre de MaKo
y su permiso escrito para mostrarles los datos a nuestros clientes: lo decide Martín. No se armó nada de eso.

## Trampas que salieron armando el rediseño (6/11/2026)

- **`text-overflow: ellipsis` no hace nada en un `inline-flex`.** El chip «Comenta «PLAN»» salía cortado en «Comenta ‹», sin
  los tres puntos. Va `display: inline-block` + `white-space: nowrap`, y la fila de cifras con `flex-wrap` para que el chip
  baje entero.
- **«Editar» desalineado entre tarjetas de la misma fila:** el gancho ocupa uno o dos renglones. El pie crece (`flex: 1`) y
  las acciones van al fondo (`margin-top: auto`).
- **El encabezado del teléfono apilaba una pastilla por renglón** con las medidas de la computadora. En el teléfono son más
  chicas y «Búsquedas guardadas» dice «Búsquedas».
- **`scripts/tsc-acotado.mjs` en la nube contestó «NO SE PUDO CHEQUEAR (código undefined)»** sin correr el tsc. Se chequeó
  con su mismo tsconfig (`armarTsconfig`) llamando a `node_modules/typescript/bin/tsc -p` directo.
- **Un test que dibuja una pantalla con server actions:** `registerHooks` con un `data:` como destino del `resolve` no carga en
  CJS. El reemplazo va en un archivo de verdad (`tests/_carruseles-acciones-de-mentira.ts`).
- **El guard del voseo frena al detector del CTA** («mandame», «envíanos» son lo que escribe el creador): va en
  `FUERA_DE_ALCANCE` de `tests/puente-panel-copy.test.ts` con su porqué.

## Sin hacer

- **Lo que entre de ahora en adelante no pasa por esta curaduría:** una lectura nueva queda visible sin que nadie la mire. El filtro no puede ser el de arriba.
- **La lectura por links no está en el script oficial:** vivió en una copia temporal, ya borrada. La entrada de arriba es lo que hay que sumarle a `scripts/carruseles-biblioteca.mts`.
- 1 de los 245 links sin leer, y 26 creadores de la lista sin leer.
- Los 32 temas de hashtag siguen prendidos, sin decidir si conviene apagarlos. Traen de todo.
- Series y duplicados sin marcar (por ejemplo, las partes de «you can find anything on the internet», o muchas de meal prep de una misma cuenta).
- **Las capturas de Top Carousels no llegaron** (`docs/carruseles/referencia-top-carousels/` no está en ninguna rama, y la
  nube no abre su sitio): la pantalla se copió de la descripción del pedido. Cuando estén, se ajustan los valores (tamaños,
  colores, espacios) contra ellas, con sus números.
- **La 0404 sin aplicar y las láminas sin traer:** hasta entonces la tarjeta muestra la portada y «N láminas», y «Editar» arma
  con guías. Los comandos, en `docs/relevo/nube-carruseles-rediseno.md`.
- **«Editar» de punta a punta con un carrusel real** no se probó: la nube no ve la base ni las claves. Se hace en el ws3.
- **Las fotos de la gente en una lámina** (que no son el cliente) quedan como un recuadro con su guía: generarlas con la IA de
  imagen del avatar es el paso siguiente.


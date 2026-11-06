# Hallazgos — Carruseles (la biblioteca de ejemplos)

Dónde vive: `lib/carruseles/biblioteca*.ts`, `scripts/carruseles-biblioteca.mts`, tablas `carruseles_biblioteca_*` (migraciones 0392, 0393 y 0404).
El rediseño del 6/11/2026: `app/image-editor/carruseles/ExplorarCarruseles.tsx` (la pantalla), `lib/carruseles/cta.ts` (el filtro CTA),
`lib/carruseles/anuncios.ts` (los anuncios de Spy), `lib/carruseles/replica*.ts` + `app/api/image-editor/carruseles/replicar/route.ts`
(«Editar» un ejemplo). Capturas: `docs/carruseles/rediseno-2026-11-06/`.
El feedback de producción del 6/11/2026 (tarde): `lib/carruseles/variedad.ts`, `lib/thumbnails/` (la tab Thumbnails) y la portada de
Image (`app/image-editor/ruta.ts`). Capturas: `docs/carruseles/capturas-2026-11-06/`.

## «Tu IA no contestó ahora»: el camino de respaldo era más débil que el principal (6/11/2026)

**Síntoma:** Martín apretó «Editar» en un carrusel de la biblioteca y leyó «Tu IA no contestó ahora», con el modal en blanco.

**Lo obvio era que su IA estaba caída, y no.** El carrusel no tenía láminas guardadas y su portada no estaba en nuestro bucket,
así que a la IA no le llegaba ninguna imagen y se iba por el camino de «sólo texto». Ese camino llamaba a `chatCheap`, que
**no prueba el Claude del negocio** y corta la respuesta en 512 tokens (un carrusel de 7 láminas en JSON pide varios miles). El
camino con imágenes sí usaba la cascada entera. O sea: el respaldo era la política real para todo carrusel sin láminas, y era
el más débil de los dos. Y el modal quedaba en blanco porque el camino de las guías no mandaba sus láminas a la pantalla: sólo
el de la IA lo hacía.

**La regla:** el camino de respaldo llama a la MISMA puerta que el principal (acá `chatCheapCascade`, con el mismo tope de
salida), y todo camino que termina en un diseño lo muestra igual (`mostrar(doc)`). Un aviso de falla nombra la causa que dejó
la cascada (cuota, clave, demora, saturación) y de quién es; «no contestó» no es una causa. Lo que no se pudo probar en la nube
(la IA real) queda con su comando: `scripts/carruseles-probar-editar.mts`.

**Vive en:** `lib/carruseles/replica-servidor.ts` (`replicarEjemplo`), `lib/carruseles/replica.ts` (`avisoSinIA`, `vuelveASinVer`).

## «Puros de DenBorg»: el orden por outlier concentra en una cuenta (6/11/2026)

**Síntoma:** con el filtro CTA y «Mayor outlier», la primera pantalla era toda de una sola creadora.

**Lo obvio era que ella hace más carruseles, y no.** Una cuenta con muchos carruseles fuertes gana todos los primeros lugares de
un orden por número. El filtro (que además se sacó) sólo achicaba el universo y lo hacía más visible.

**La regla:** la variedad es de la PRESENTACIÓN, no de los datos: en cada tramo de 12 tarjetas, como mucho 2 de la misma cuenta,
moviendo lo mínimo (`conVariedad`). No se reparte cuando se pidió ver una cuenta (por la lista o por @). ⚠️ El test de «con
cuenta elegida no se reparte» tiene que elegir DOS cuentas: con una sola, repartir no cambia nada y el test da verde con el bug.

**Vive en:** `lib/carruseles/variedad.ts`, `lib/carruseles/explorar.ts` (`filtrarCarruseles`), `lib/thumbnails/explorar.ts`.

## Anuncios en video en una pantalla de imágenes: la fuente lo decía y se tiraba (6/11/2026)

**Síntoma:** en «Anuncios» había muchos videos, y la pantalla es para copiar imágenes.

**La causa:** el actor de Apify manda `snapshot.displayFormat` (VIDEO, IMAGE, CAROUSEL…) y al guardar se tiraba; `medio` (mig
0391) sólo se escribía para Instagram. Es la misma historia que la 0391 con los carruseles: el dato estaba y no se guardaba.

**La regla:** ahora se guarda `medio` también en los anuncios (`medioDeAnuncio`), y el explorador no muestra ni cuenta un video
(`esAnuncioEnVideo`). Sin `medio`, la única pista es la miniatura del CDN de Meta en la carpeta de cuadros de video (`/t15.`).
⚠️ Una miniatura ya copiada a nuestro bucket pierde esa pista: lo guardado antes se corrige en la próxima lectura de Spy.

**Vive en:** `lib/spy-todo-reglas.ts`, `lib/spy-medio.ts`, `lib/spy.ts` (`guardarMedios`), `lib/carruseles/anuncios.ts`.

## Thumbnails: la YouTube Data API sí, y el múltiplo espera el trámite (6/11/2026)

**El pedido:** miniaturas top del mercado, «estoy seguro que debe haber una API o un repo». La comparación entera está en
`docs/carruseles/thumbnails.md`. Lo que gobierna código nuevo:

- **La fuente es la API oficial con la clave de la plataforma**; raspar youtube.com o comprar el catálogo de 1of10/ViewStats no
  (Términos de YouTube; reventa).
- **Un número derivado de las vistas no se muestra sin la enmienda III.L** (`ENMIENDA_III_L`), aunque `multiplosDe` ya lo
  calcule: la tarjeta muestra las vistas, el orden de entrada es «Más vistas» y el filtro del múltiplo no aparece.
- **Lo leído vence a los 30 días** (`vigente`, `podar`) y la imagen no se guarda: se dibuja la de `i.ytimg.com`.
- **`search.list` tiene su balde de 100 llamadas por día**: se usa una por rubro e idioma, con tope en el script.

**Vive en:** `lib/thumbnails/`, `app/image-editor/carruseles/Thumbnails.tsx`, `scripts/thumbnails-biblioteca.mts`, mig 0409.

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

## Sólo lo que le sirve a un dueño de negocio: el modelo se pasa de estricto (6/11/2026)

Martín: «solo quiero carruseles que le sirvan a dueños de negocio». Se escondieron 388 de 1.378 leyendo el pie con un modelo barato. Quedan 990, de 331 cuentas, y la que más tiene llega a 16.

- **Lo obvio era aplicar lo que dijo el modelo, y sobraba.** En una segunda pasada volvieron 35 de negocios reales: noticias de un rubro, café educativo, premios, casos de empresa, marca personal, nutrición de profesionales. Y 13 que había dejado pasar se escondieron a mano. La regla es la de arriba: con duda, queda, y los descartes se miran antes de aplicar.
- **Una cuenta entera, sólo si Martín la nombra** (`victorianpoetry`).
- **Primero limpiar, después leer láminas.** El comando `laminas` saltea lo escondido. Se hizo al revés y 169 de las 770 láminas pagadas eran de carruseles que después se escondieron. Costo medido: US$2,27 por 840 links, unos US$0,0027 cada uno.
- **El modelo:** `gemini-3.5-flash-lite` contesta 400 si se le manda `thinkingConfig`. Los otros cortes de Gemini están en `docs/hallazgos-ia.md`.
- **Para deshacer:** `update carruseles_biblioteca_piezas set dejo_de_verse_en = null where id = any(<ids>)`, con los `piezas[].id` de `C:/dev/cerebro-herramientas/tickets/carruseles-escondidos-2026-11-06.json`, que trae el motivo de cada una.

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

## El pulido del 6/11/2026: lo que no era lo obvio

**Vive en:** `lib/carruseles/{cta,clasificar,replica,documento,explorar}.ts`, `app/image-editor/carruseles/{ExplorarCarruseles,CarruselAbierto,FiltrosCarruselModal,Deslizador}.tsx`. Capturas: `docs/carruseles/pulido-2026-11-06/`. El banco para volver a mirar: `scripts/banco-carruseles/` (el componente real en Chromium con datos inventados; `node scripts/banco-carruseles/build.mjs`, `servir.cjs` y `capturar.mjs`; `replica-html.mts` dibuja lo que arma «Editar»).

- **«Sin tipo» no se arregla ampliando las reglas.** Lo obvio era sumar portugués, alemán e inglés al clasificador. Se hizo (listas con sustantivos de los tres idiomas, «Como + infinitivo», «So … du», «How to», paso a paso, antes/después, mito, opinión impopular y tres puntos numerados) y movió **40 de 1.253** (quedan 1.213). El pie casi nunca DICE el tipo: son textos de una idea, de una receta, de una opinión personal. El resto sólo se resuelve mirando las láminas (visión, con la IA del negocio, cuando estén traídas) o con la portada que lee Instagram. Se probó una regla «frase» (pie corto, sin hashtags ni números) y se descartó: de 66 candidatos, la mitad eran «Comment “WIN” to get…» o «New episode… out now». Sigue en `reclasificar` (gratis) mirar cuántos quedan.
- **El «gritado» del CTA se mide por palabras, no por letras.** «Envía RELEVANCIA por DM» tiene 13 de 21 letras en mayúsculas (61 %) y se leía como un pie gritado: la palabra clave desaparecía. Ahora cuenta palabras enteras en mayúsculas sobre el total y sólo desde 5 palabras.
- **Un DM sin palabra no es un CTA.** El verbo suelto («envía», «manda», «escribe», «send», «text») sólo cuenta si la misma frase dice por dónde (DM, mensaje, privado, inbox) y trae una palabra; «Send me a DM» devolvía «DM» como palabra clave. «DM» y «MD» nunca son la palabra.
- **«Editar» salía feo por la capa del diseño, no por la IA.** Las tres causas estaban en `documentoDeReplica`: la letra venía del TIPO de MaKo (la «lista» es DM Serif Display), los tamaños eran los tímidos que devuelve un modelo (0,02 a 0,03 del ancho: 22 a 32 px) y, sin foto del cliente, dibujaba un recuadro gris «Tu foto». Ahora la IA elige una `letra` (sans, gruesa, condensada, serif, manuscrita, mono) que se traduce a una familia REAL del editor, los textos se reacomodan para llenar la lámina con un solo factor (la jerarquía no cambia) y sin foto no hay recuadro. El camino con guías (`documentoDeCarrusel`) también: el titular y el cuerpo toman la letra más grande que entra y el bloque se centra.
- **El estimador de alto sobra a propósito.** `altoEstimado` cuenta 0,58 del tamaño por carácter (una letra gruesa es ancha): con 0,52 los titulares en Montserrat 800 se salían de la lámina. El motor del editor vuelve a medir al abrir, así que sobrar sólo deja un poco de aire.
- **Sin láminas guardadas no es «sin diseño».** De 1.470 carruseles, 1.275 no tienen láminas. Antes caían a las guías; ahora la IA del negocio escribe la versión con la portada (visión) y el pie (sólo para entender el tema), y si ni la portada se pudo bajar, con el pie solo (`chatCheap` adentro de `conSuIADelNegocio`). Las guías quedan sólo para «sin IA».
- **`.mk-modal__cuerpo > *` pone padding y filete a cada hijo directo.** Una pantalla de dos partes dentro de un `<Modal>` tiene que ser UN solo hijo (`.abierto`/`.filtrosModal`), si no, cada columna queda con su raya. Para el celular se sumó `completaEnCelular` a `app/_ui/Modal` (pantalla completa a ≤ 640 px, con `:has()` para sacarle el margen al fondo).
- **El «Editar» de una tarjeta tiene que sobrevivir a no tener mouse.** Al pasar el mouse aparece junto a parecidos y guardar; sin mouse (`@media (hover: none)` y el teléfono) queda un «Editar» liviano en el pie. Un guardado se ve siempre (`:has(.icono[data-guardado])`).
- **El «tema» de Top Carousels no existe en nuestros datos.** El modal de filtros tiene tipo y «Ocultar tipos» (lista, tutorial, storytime…), que es lo que hay. Un tema (finanzas, salud, marketing…) pediría clasificar cada carrusel; no se inventó.
- **«Parecidos» es de lo que ya está en pantalla:** mismo tipo, palabras en común del gancho y del pie, y a igual parecido el que más rindió (`parecidosA`); «creadores parecidos» son los que comparten sus tipos (`creadoresParecidos`). No es una búsqueda semántica: sin nada en común, no hay.
- **La nube y la PC no corren el `tsc`:** el pulido se probó con los tests del área y el banco; el typecheck lo corre GitHub al subir.

## Sin hacer

- **El tipo de 1.213 carruseles** sigue vacío: sólo las láminas (o la portada leída) lo dirían. `lib/carruseles/clasificar.ts`.
- **El «tema»** (finanzas, salud…) no se clasifica. Pedirá una pasada de IA por carrusel.
- **Las capturas de Top Carousels ya llegaron** (`docs/carruseles/referencia-top-carousels/`) y los valores gruesos (4 columnas, modal en dos partes, filtros con deslizadores, colores del múltiplo) se ajustaron; faltan los finos (medidas exactas) contra un monitor real.
- **Lo que entre de ahora en adelante no pasa por esta curaduría:** una lectura nueva queda visible sin que nadie la mire. El filtro no puede ser el de arriba.
- **La lectura por links no está en el script oficial:** vivió en una copia temporal, ya borrada. La entrada de arriba es lo que hay que sumarle a `scripts/carruseles-biblioteca.mts`.
- 1 de los 245 links sin leer, y 26 creadores de la lista sin leer.
- Los 32 temas de hashtag siguen prendidos, sin decidir si conviene apagarlos. Traen de todo.
- Series y duplicados sin marcar (por ejemplo, las partes de «you can find anything on the internet», o muchas de meal prep de una misma cuenta).
- **Salud y nutrición, café y déficit de atención** quedaron a la vista por la duda. Si Martín lo quiere más estricto, es lo próximo en esconder.
- **Láminas, medido el 6/11:** 744 de 912 carruseles visibles las tienen. De los otros, 111 sin leer (`laminas` cortó «al techo» con US$0,54 de un tope de 1,50, sin mirar por qué) y 57 que el actor no dio.
- **«Editar» de punta a punta con un carrusel real** se probó en producción el 6/11: abre el diseño de 8 páginas, pero «Tu IA no contestó ahora» y sale la guía con miniaturas vacías. Causa sin encontrar (`lib/carruseles/replica.ts:387`), encargada al chat de Carruseles.
- **Las fotos de la gente en una lámina** (que no son el cliente) quedan como un recuadro con su guía: generarlas con la IA de
  imagen del avatar es el paso siguiente.


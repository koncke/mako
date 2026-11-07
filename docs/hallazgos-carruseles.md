# Hallazgos — Carruseles (la biblioteca de ejemplos)

Dónde vive: `lib/carruseles/biblioteca*.ts`, `scripts/carruseles-biblioteca.mts`, tablas `carruseles_biblioteca_*` (migraciones 0392, 0393 y 0404).
El rediseño del 6/11/2026: `app/image-editor/carruseles/ExplorarCarruseles.tsx` (la pantalla), `lib/carruseles/cta.ts` (el filtro CTA),
`lib/carruseles/anuncios.ts` (los anuncios de Spy), `lib/carruseles/replica*.ts` + `app/api/image-editor/carruseles/replicar/route.ts`
(«Editar» un ejemplo). Capturas: `docs/carruseles/rediseno-2026-11-06/`.
El feedback de producción del 6/11/2026 (tarde): `lib/carruseles/variedad.ts`, `lib/thumbnails/` (la tab Thumbnails) y la portada de
Image (`app/image-editor/ruta.ts`). Capturas: `docs/carruseles/capturas-2026-11-06/`.

## Revisar lo que entró sin que nadie lo mire: el banco no mide ancho y la referencia no mide píxeles (7/11/2026)

Dos revisiones encargadas: el paquete del 6/11 contra lo que Martín pidió, y la pantalla contra las capturas de Top Carousels.
Las dos chocaron con el mismo problema: **el material con el que se dio por verificado no podía verificar eso.**

### «Cuatro columnas en 1440» era del banco, no de la app

**Síntoma:** el pendiente decía «ya ajustado: 4 columnas en 1440» y `docs/carruseles/capturas-2026-11-06/01-portada-1440.png` lo
muestra. En la app real, con la barra lateral desplegada, son **tres**.

**Lo obvio era que el CSS estaba mal, y no: el CSS está bien y lo que miente es el BANCO.**
`scripts/banco-carruseles/capturar.mjs` dibuja la pieza SOLA (sin la barra lateral de 244 px) y arranca Chrome con
`--hide-scrollbars`. Son dos descuentos de ancho que la app sí tiene, y ninguno se ve en la captura.

**Medido** (Chrome 152, con `getComputedStyle` sobre la grilla real): `scrollbar-width: thin` ocupa **10 px** (`auto`, 15).
A 1440 con la barra fija quedan `1440 − 244 (barra) − 10 (scroll de .raiz) − 64 (padding de .col)` = **1122 px** de contenido,
y cuatro columnas de `minmax(268px, 1fr)` con 20 px de gap piden **1132**. Faltaban **10 px: justo la barra de scroll**. Con la
barra plegada (68 px, que es el default desde `mk-nav-fija-v2`) sí entran cuatro de 299 px, y en el banco también: por eso
nadie lo vio. A 1366 y a 1280 con la barra fija eran tres desde siempre; de 1536 para arriba, cuatro.

**Las reglas:**
- **Una captura del banco no mide ancho.** Lo que depende del ancho —cuántas columnas entran, qué se corta, qué se apila— se
  mide con el ancho REAL: viewport − barra lateral (244 desplegada, 68 plegada) − la barra de scroll del contenedor que
  scrollea − el padding de la columna. El banco sirve para el aspecto, no para el calce.
- **Un `auto-fill` que entra JUSTO no entra.** 1132 de 1132 es cero margen: una barra de scroll, un borde o 2 px más de padding
  lo bajan una columna entera. El mínimo se elige con lugar de sobra.

**Arreglo:** `minmax(258px, 1fr)` (`app/image-editor/carruseles/explorar.module.css`, `.grilla`). A 1440 con la barra quedan
cuatro de 265 px —que es, además, la proporción de la referencia— y **no cambia nada en el resto**: a 1920, con la barra
plegada y sin barra siguen siendo cuatro de 299, y a 1280 con la barra siguen siendo tres.

### Las capturas de referencia no sirven para comparar medidas

**Síntoma:** el pendiente pide «los detalles de tamaño, letras y espacios» contra `docs/carruseles/referencia-top-carousels/`.

**Lo obvio era medir las dos capturas y comparar píxel contra píxel, y no se puede.** Las de la referencia están
**redimensionadas a 768 px de ancho** (cinco de las seis a 768×480) y **nadie anotó el ancho del navegador**. Los JPG no traen
EXIF con el tamaño original, sólo un perfil ICC. Con la MISMA imagen, la pastilla del múltiplo mide 26 px si la ventana era de
1440 y 22 px si era de 1207, y las dos lecturas son igual de defendibles.

**Lo que sí se puede, y es lo que quedó medido** (sobre `tarjetas.jpg`, en fracción del ancho de la tarjeta, que es
escala-invariante; de MaKo, en píxeles reales de `01-portada-1440.png`, que es 1:1):

| | Referencia | MaKo (tarjeta de 299 px) | A la proporción de la referencia |
|---|---|---|---|
| Portada | 142 × 177 px = 4:5 | 4:5 | ✔ igual |
| Gap entre columnas | 7,4 % de la tarjeta | 20 px = 6,7 % | 22 px |
| Pastilla del múltiplo (alto) | 14 px = 9,9 % | 22 px = 7,4 % | ~30 px |
| Cap del titular | 7 px = 4,9 % | 10 px (fuente 13,5) = 3,3 % | cap ~15 px → fuente **~20 px** |

O sea: **la tarjeta de MaKo es más ancha en relación con su texto**, y es lo único grueso que separa las dos pantallas.
Subir el titular es decisión de diseño (no se tocó).

**La regla: una captura de referencia se guarda con el ancho del navegador escrito al lado** (en el LEEME o en el nombre del
archivo). Sin ese número no es una referencia de medidas, es un dibujo. Lo mismo vale para las nuestras: las de
`capturas-2026-11-06/` dicen 1440 en el nombre y por eso se pudieron medir 1:1.

### Y dos de los diez pedidos no se podían ver en las capturas

- **`09-anuncios-1440.png` es el cartel de vacío**: el banco no tiene anuncios, así que «en anuncios trajiste un montón de
  videos» nunca se miró con datos. Lo que pasa en producción ya está medido más abajo («El arreglo cubrió la fuente que NO
  trajo ni un anuncio»): el filtro de video **saca 0 de los 300 anuncios guardados**, así que lo que Martín vio sigue ahí.
- **«Muchos no tengo el botón para desplazar a la derecha»** quedó arreglado para el teléfono (las flechas ya no dependen de
  pasar el mouse), pero la causa de «muchos» es otra: sin láminas guardadas no hay nada que pasar, y eran 168 de 912 el 6/11.
  Esa tarjeta muestra una etiqueta «N láminas» cuyo texto flotante repetía la etiqueta; ahora dice por qué no hay flecha.

## «Llega al techo» con un tercio gastado: el techo lo ponía el crédito y la cuenta era de reservas (6/11/2026)

**Síntoma:** `laminas` paró diciendo «Llega al techo: corta acá» con **US$0,54 gastados de un tope pedido de US$1,50**. De la
salida no se podía saber si faltaba crédito o si era un límite nuestro, y por eso nadie lo revisó.

**Lo obvio era que el tope de US$1,50 estaba mal puesto, y no.** Eran dos cosas, y ninguna se decía:

1. **El techo efectivo no era el pedido: lo ponía el crédito.** `techoConCredito` devuelve `min(pedido, libre − reserva)` y
   nada más, así que un techo de US$0,70 (crédito) y un techo de US$0,70 (pedido) se imprimen igual. Medido el 6/11 a la
   tarde: la clave de Spy tenía **US$1,98 libres de US$10 y la reserva de Spy son US$2 → el techo era US$0,00**, y el script
   decía «Puede gastar hasta US$0.00» sin agregar que no había con qué.
2. **Lo que se comparaba contra el techo era la suma de los TECHOS de cada tanda, no el gasto.** Cada tanda de 40 links lleva
   su `maxTotalChargeUsd` con un margen del 1,5× sobre el precio de lista (US$0,14) para que Apify no la corte a mitad, y ese
   número inflado se acumulaba como si fuera plata gastada. Apify cobra **lo que LLEGA**, a US$0,0027 por link medido: 40 links
   son US$0,11, no US$0,14. Con un techo de US$0,70 leía 200 links de 400 cuando pagaba 254 — y **una tanda que no trae nada
   (carruseles borrados o privados) descontaba su techo igual**: se podía cortar «al techo» sin haber gastado un centavo.

**La regla:**
- **Cuando una corrida para, dice por qué, con el número, y qué lo destraba.** «No hay crédito libre (quedan US$X, la reserva
  es US$Y)» se arregla cargando crédito; «llegué al tope que me pediste (US$Z)» se arregla con `--techo-usd`; «se terminaron
  las tandas» no se arregla, y «Apify dijo que no queda crédito» se arregla cargando crédito. Son cuatro cosas distintas y
  «al techo» las dice todas iguales. El porqué se imprime también **en seco**, antes de gastar: ahí es donde se revisa.
- **El margen de un techo por tanda no es gasto.** Contra el techo de la corrida va el precio MEDIDO (`USD_POR_LINK_MEDIDO`,
  US$0,0027), no el de lista (US$0,0023, que subestima la factura) ni el de lista con margen. El margen vive sólo en el
  `maxTotalChargeUsd` de la tanda, y ese techo se recorta a lo que queda para que no pueda gastar de más.
- **La última tanda se recorta a los links que caben**, no se descarta entera.
- **Una sola regla para el plan y para la corrida** (`siguienteTanda`): en seco se alimenta con el gasto probable y en vivo con
  lo que Apify ya cobró. Dos cuentas paralelas es cómo se llega a que el seco y lo real no coincidan.
- ⚠️ **Y un «no queda crédito» que dice APIFY a mitad de la corrida NO es el techo.** Al empezar, el techo podía tener lugar de
  sobra (motivo `'pedido'`): si ese corte se cuenta como techo, el renglón final dice «llegué al tope que me pediste» sobre un
  tope que no se tocó — el mismo mensaje equivocado, por el otro lado. Es un corte propio (`'apify'`), y el que decide qué
  renglón sale es la función pura, no una bandera en el script: una bandera no se puede probar sin gastar crédito.

**Vive en:** `lib/carruseles/biblioteca.ts` (`motivoDelTecho`, `siguienteTanda`, `planDeTandas`, `porQueParo`),
`scripts/carruseles-biblioteca.mts` (`laminas`), con `tests/carruseles-techo.test.ts`.

⚠️ **Y la trampa del entorno que lo tapaba:** `techoConCredito` devolviendo **0** no es un error, es un número válido. El
script seguía su curso, entraba al bucle y la primera tanda cortaba «al techo». Un tope que vale cero parece un tope cumplido.

## Cargar la biblioteca de Thumbnails: el 6% de los canales se quedaba con un tercio de la vidriera (6/11/2026)

**Qué se hizo.** La biblioteca de Thumbnails estaba **vacía en producción** (0 canales, 0 miniaturas: la pestaña decía que no estaba cargada) y se cargó desde la PC con los pasos de [thumbnails.md](../carruseles/thumbnails.md): `descubrir` (12 búsquedas, las 12 permitidas del balde de 100 por día de toda la app) → **93 canales** → `leer` → **1.784 videos**, ~93 unidades de cuota.

**Lo que apareció al mirar lo cargado, y no se ve en los totales.** El orden de entrada es «Más vistas» (el múltiplo espera el trámite III.L), y los doce primeros que vería un dueño de negocio eran: un video en hindi sobre 8 small businesses, otro de 23 minutos sobre lo que hizo Lula, **el avión eléctrico más grande del mundo** (de Y Combinator), los autos eléctricos chinos en India y «He Earns ₹25 Crores Daily». De doce, cuatro útiles.

**La causa, medida:** `search.list` encuentra un canal por UNA consulta y después se leen sus **últimos 20 videos, sea de lo que sean**. Un canal de negocios publica cualquier cosa, y las vistas crudas **no son comparables entre mercados**: los canales del mercado indio tienen una escala de vistas que aplasta a todo lo demás. Son **5 de 90 canales y el 6% de las miniaturas (100 de 1.743), pero 4 de los 12 primeros**.

**Lo que se hizo con eso:** se excluyeron esos 5 (`@dhavalkataria1211`, `@wintwealthyt`, `@growthstorystudio`, `@navan.jaiswal`, `@adityaarorathefaadguy`) con el motivo escrito, más 3 que no le sirven a un dueño de negocio o no tienen señal: música para manifestar (`@musicaexpansiva`), un canal con un video de 6 vistas y otro con tope de 306. Quedan **85 canales y 1.643 miniaturas**.

⚠️ **Esto es un parche, no el arreglo.** Excluir a mano no escala: cada `leer` mensual trae videos nuevos del mismo tipo. **El arreglo de fondo es ordenar por el múltiplo** (vistas ÷ la mediana del canal), que es justo lo que normaliza mercados distintos — y es lo que espera la enmienda III.L de YouTube. Mientras no se firme, la vidriera la decide una métrica que no se puede comparar.

⚠️ **Y dos trampas al medirlo, las dos mías, las dos silenciosas.** (1) `thumbnails_videos.canal_id` es el id **numérico** de `thumbnails_canales`, no el id de YouTube (que en la tabla de canales **también** se llama `canal_id`): unir por el campo equivocado da 0 videos por canal y **no da error**. (2) El tipo `Thumbnail` **no tiene** campo de imagen —la URL se arma del id del video con `imagenDeVideo()`—, así que un chequeo de «¿cuántas saldrían en blanco?» contra un campo inexistente contesta «todas». Casi reporté 1.743 miniaturas en blanco que estaban perfectas.

**Medido de nuevo el 6/11 a la noche, y los totales de arriba ya eran viejos:** `estado` contra producción dice **79 canales activos, 14 excluidos y 1.520 miniaturas visibles** (la curaduría siguió después de escribir esto). El número de un documento es una FOTO: antes de repetirlo, `estado`. Ver [una-medicion-tiene-fecha].

## El cron que no existía: «una vez por mes» es la cadencia equivocada para un vencimiento de 30 días (6/11/2026)

**El síntoma que nadie iba a ver hasta que lo viera un cliente.** Sin la enmienda III.L de YouTube, lo que se guarda de su API (títulos, vistas) **vence a los 30 días**: la pantalla no muestra lo leído hace más (`vigente`, `DIAS_VIGENTE = 30`) y la regla obliga a borrarlo (`podar`). El documento lo dejaba como un paso a mano —«cada mes: `leer` de nuevo y `podar --de-verdad`»— y **no había ningún cron**. La galería no se rompe: se va vaciando, tarjeta por tarjeta, hasta el cartel de «todavía no está cargada».

**Lo que el pendiente pedía estaba mal, y es el hallazgo.** Cuatro de los dieciocho encargos de Thumbnails decían «agendar una vez por mes». Un cron mensual el día 1 **no alcanza**: entre el 1 de enero y el 1 de febrero pasan **31 días**, así que lo leído el 1 de enero vence el 31 y la galería aparece vacía un día entero antes de que el cron la salve. Y con una sola oportunidad por vencimiento, **cualquier** corrida que falle (la cuota de YouTube, un 403, el deploy caído) la vacía igual, sin red. **La regla que queda: una tarea que renueva algo con vencimiento corre al menos DOS veces por vencimiento, no una.** Acá quedó semanal (`55 6 * * 0`): cuatro oportunidades por vencimiento, y releer es barato (~3 unidades de las 10.000 diarias por canal, unas 240 por corrida).

**Dónde vive, y por qué no son dos copias.** `lib/thumbnails/renovar.ts` tiene el trabajo (releer + podar), `app/api/cron/thumbnails-renovar/route.ts` lo llama desde Vercel y `scripts/thumbnails-biblioteca.mts` llama **la misma función** en `leer` y `podar`. Antes el trabajo vivía sólo en el script: un cron que lo copiara habría quedado como la segunda copia que se separa y nadie sabe cuál es la que corre.

**Tres decisiones que no se ven en el diff:**

- **Releer ANTES de podar.** Al revés, una corrida que falla al leer borra lo vencido y deja la galería **más** vacía de lo que estaba. Y sin clave de YouTube no hace nada de las dos cosas (fail-closed): una poda sin lectura es pérdida neta.
- **El cron NO descubre canales.** `descubrir` usa `search.list`, que tiene un balde de **100 llamadas por día para TODA la app** — el mismo del que come Competitors Spy. Un cron automático se lo comería y dejaría a Spy sin búsquedas. Descubrir sigue siendo a mano.
- **La clave es la de la PLATAFORMA**, nunca la del negocio: la biblioteca es global (mig 0409, sin `workspace_id`), así que llenarla con la cuota de un cliente es gastarle su balde para la vidriera de todos. Por lo mismo no va por `correrPorWorkspace`: un solo trabajo, como `/api/cron/spy-poda`.

⚠️ **Y una trampa del entorno que costó un run de Actions.** El mensaje de «sin clave» decía «no releí ni **podé** nada»
— el pretérito de PODAR, que es de lo que habla la función. `tests/puente-panel-copy.test.ts` (el guarda de voseo del repo,
que barre 6.009 archivos) lo lee como el *vos* de «poder» (→ «puede»), porque son la misma palabra escrita, y da rojo: «El
producto se usa en México: la interfaz va en español neutro». No es un falso positivo que convenga excepcionar: **un mensaje
sobre podar no puede usar su propio verbo en primera persona**, y la salida es escribirlo impersonal («no se relee ni se poda
nada»). La misma colisión existe con «anoté/anotá», «corté/cortá» y «miré/mirá». El guarda no distingue —no puede—, así que
la regla práctica es: en un texto que sale del repo, el pretérito de primera persona de un verbo de la primera conjugación es
indistinguible de un imperativo voseante, y conviene evitarlo.

⚠️ **Lo que el cron NO arregla, y conviene no confundirlo:** la cadencia que se arregló acá es la de **que no se vacíe**, no la de la curaduría. Cada relectura trae videos nuevos de los mismos canales **sin que nadie los mire** (el mismo agujero que la biblioteca de carruseles: ver «Sin hacer»). El cron hace que la galería nunca esté vacía; que lo que haya sirva a un dueño de negocio sigue dependiendo del múltiplo y del trámite III.L.

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

## «Editar» probado con la IA REAL: el arreglo estaba bien y el que mentía era el ARNÉS (6/11/2026)

**Síntoma:** cuatro encargos distintos del 6/11 (ids 8, 109, 190, 384) decían lo mismo: el arreglo de «Editar» está escrito y
nunca se probó con una IA de verdad. Se corrió el comando (`scripts/carruseles-probar-editar.mts`) contra la base y las claves
de producción, cinco veces, con la IA real.

**Funciona.** Un carrusel con sus 10 láminas, uno sin láminas con la portada en el CDN de Instagram (el caso exacto que falló)
y una miniatura de YouTube: los tres abren el diseño con los textos del negocio, las letras del editor, sin recuadros grises y
sin el aviso de «no contestó». La portada que sólo vive en `scontent-…cdninstagram.com` llega a la IA (`fetchSeguro`): «1 de 9
láminas». Lo que no funcionaba era otra cosa, y son tres cosas distintas:

**1. Lo obvio era que faltaba correr el comando, y no: el comando no probaba el arreglo.** El modo EN SECO (el que no gasta ni
guarda, el que la documentación manda usar) devolvía en el camino de guías **antes** de armar el documento. O sea, justo el
arreglo del 6/11 —que sin IA las láminas guía se manden a la pantalla, para que el modal no quede en blanco— era invisible
para el único arnés que existía: la corrida imprimía cero láminas y nadie podía ver si estaban bien. **La regla: un modo de
prueba sólo puede dejar de ESCRIBIR; si saltea un paso del armado, no prueba ese paso.** Ahora el seco arma el documento igual
(`crearCarruselDesdeReferencia(..., { seco })`) y la corrida del ws3 imprime sus 7 láminas con sus guías.

**2. El ws 3 NO TIENE NINGUNA IA CONECTADA, así que `--ws 3` no prueba la IA: prueba el camino SIN IA.** Medido: `susClaves(3)`
devuelve `[]` y `provsDe` da 0 proveedores para los cuatro. Y está bien que no use la de la plataforma (cada negocio paga su
IA), así que la corrida termina en guías con «Conecta tu Claude, tu GPT o tu Gemini» — correcto, pero no es la prueba. Para
probar la IA de verdad hay que correr en un workspace que tenga clave propia: el **ws 9** (Martín) tiene las tres. Las claves
por workspace, medidas el 6/11: ws 1, 9, 10, 11 con Claude; sólo Gemini en 13, 15, 17, 18, 19, 20; **el 3, ninguna**.

**3. El prompt le pedía al modelo no poner el @ del creador, y el modelo lo cumplía inventando el del CLIENTE.** Las 10 láminas
del ws9 salieron firmadas «Martin Koncke» **y «@martinkoncke»**, un usuario que nadie cargó nunca (`marcaDelNegocio` devuelve
`usuario: null` siempre). El cliente publica un @ que no existe y nadie lo encuentra. Es el corolario de AGENTS.md → «Una
regla en un prompt no es una regla»: un handle no tiene redundancia, así que o lo pone el código o no va. La segunda capa es
`conElArrobaDelNegocio` (`lib/carruseles/replica.ts`), que saca todo `@usuario` que no sea el del negocio y no toca un mail
(ahí el `@` viene pegado a una letra).

**Y lo que el prompt NO resuelve, medido dos veces con la IA real:** un ejemplo que cuenta una HISTORIA de su autor se replica
inventándole una historia al cliente. Antes de la regla nueva, el carrusel `-895` salió con el Oscar y el padre muerto del
creador original firmados «Martin Koncke»; con la regla («sus hechos tampoco pasan»), los detalles ajenos se fueron, pero la
lámina 1 quedó en «A LOS 22 AÑOS, MARTIN KONCKE ANOTÓ SUS 10 METAS»: ni la edad ni la lista son datos de nadie. Una biografía
inventada no se puede detectar en el saneo, así que esta regla se queda en una sola capa a propósito y **queda decidir si un
ejemplo de tipo historia/storytime es replicable** (ver «Sin hacer»).

**El diseño que falló, leído de la base de producción** (`b31f62ec-5727-4ac7-bde7-2bb141bf0727`, el que Martín reportó):
creado el 6/11 a las 13:46 UTC —una hora y media ANTES del commit del arreglo (`02ce9b6e3`, 15:11)— en el **ws 9, el de
Martín, que tiene las tres claves cargadas**. Son 8 páginas de GUÍAS («Tu gancho con un número», «Tu punto número 1»…), con
las letras del editor (Inter y Montserrat) y sin ningún recuadro de «Tu foto». O sea: el aviso «Tu IA no contestó» no salió por
falta de IA —la tenía— sino porque el camino de respaldo cortaba la respuesta en 512 tokens, que es exactamente lo que se
arregló. El síntoma reportado y el diagnóstico coinciden, y el mismo caso corrido hoy en el ws 9 devuelve el diseño con los
textos del negocio.

**Y el arreglo YA ESTÁ EN PRODUCCIÓN, contra lo que decía el encargo** (que se había escrito mirando el deploy de las 11:05
UTC, anterior al commit). Medido contra la API de Vercel el 6/11: el deploy de producción vigente es `cce171fab` (6/11, 17:57
UTC) y tiene `02ce9b6e3` —el commit del arreglo, 15:11 UTC— como ancestro; los de las 11:05 y 13:13 UTC no lo tenían. **La
regla: «está desplegado» no se deduce de la hora de un deploy, se pregunta si el commit es ANCESTRO del que está servido**
(`git merge-base --is-ancestor <arreglo> <sha del deploy>`, con el sha que da `api.vercel.com/v6/deployments?target=production`
y el `VERCEL_API_TOKEN` del `.env.local`). La fecha engaña de los dos lados: la del commit es la del autor y la del deploy es
la de la compilación.

**El tiempo, que es el riesgo que queda:** cinco corridas dieron 21,6 s · 33,4 s · 143,4 s · 149,3 s · **276,9 s**, contra el
`maxDuration = 300` de la ruta (cuyo comentario decía «de 20 a 90 s»). La causa, con la red instrumentada: `gemini-flash-latest`
no contesta y **se come el timeout entero de 120 s**, y después el respaldo (`gemini-flash-lite-latest`) contesta en 8 s. Dos
cuelgues así y el stream de Vercel se corta sin mandar el `fin`: la pantalla queda esperando para siempre, que es exactamente
el síntoma que Martín reportó. No se tocó el plazo (los pedidos que SÍ contestan tardan 2 a 9 s, pero no hay medición de uno
con 10 láminas por llamada).

**Vive en:** `lib/carruseles/replica-servidor.ts` (`replicarEjemplo`, el modo seco), `lib/carruseles/crear-servidor.ts`
(`crearCarruselDesdeReferencia`, `seco`), `lib/carruseles/replica.ts` (`conElArrobaDelNegocio`, el prompt),
`app/api/image-editor/carruseles/replicar/route.ts` (`maxDuration`). Lo prueba `tests/carruseles-editar.test.ts` con su hijo:
el PRIMER test que ejecuta el orquestador (los 21 de `tests/carruseles-replica.test.ts` son de las funciones puras, y estaban
todos en verde mientras «Editar» fallaba en producción).

## «Puros de DenBorg»: el orden por outlier concentra en una cuenta (6/11/2026)

**Síntoma:** con el filtro CTA y «Mayor outlier», la primera pantalla era toda de una sola creadora.

**Lo obvio era que ella hace más carruseles, y no.** Una cuenta con muchos carruseles fuertes gana todos los primeros lugares de
un orden por número. El filtro (que además se sacó) sólo achicaba el universo y lo hacía más visible.

**La regla:** la variedad es de la PRESENTACIÓN, no de los datos: en cada tramo de 12 tarjetas, como mucho 2 de la misma cuenta,
moviendo lo mínimo (`conVariedad`). No se reparte cuando se pidió ver una cuenta (por la lista o por @). ⚠️ El test de «con
cuenta elegida no se reparte» tiene que elegir DOS cuentas: con una sola, repartir no cambia nada y el test da verde con el bug.

**Vive en:** `lib/carruseles/variedad.ts`, `lib/carruseles/explorar.ts` (`filtrarCarruseles`), `lib/thumbnails/explorar.ts`.

## Dos partes del mismo carrusel ocupaban dos lugares de la grilla (6/11/2026)

**Síntoma:** «El cliente ve el mismo contenido repetido y pierde lugares de la grilla que podrían traer ejemplos nuevos»: las
partes de una misma serie, una abajo de la otra.

**Lo que NO lo arregla:** el reparto por variedad (la entrada de arriba). Reparte por CUENTA, y dos partes de un mismo carrusel
son de la misma cuenta **y** del mismo contenido: entran las dos igual, una en cada tramo.

**Lo obvio era comparar el pie, y está mal.** Medido sobre las 990 piezas visibles: agrupar por «las primeras 8 palabras de
contenido del pie, del mismo creador» daba 7 grupos y **5 eran falsos**. Lo que se repite no es el contenido: es el pie de
fábrica del creador — su pitch fijo (@thesenuka lo pega igual en 4 carruseles distintos), su CTA de siempre («Comment "WIN" to
get a free scaling roadmap», @hormozi, en dos carruseles de 13 y de 9 láminas), su firma de entrada (@vilmanunez abre todos los
pies con «Sígueme y haz clic en el link de la bio») o un «Save this!» con hashtags. Sacarle la oración del CTA antes de
comparar tampoco alcanza: quedan los pitch y las firmas. **Y los pies de dos partes de la misma serie no se parecen entre sí**:
«Part 1 broke the internet… so here's Part 2» y «You thought you understood the coffee menu. Then part 3 happened» son la misma
serie y no comparten una frase. O sea: el pie se parece cuando NO es el mismo contenido, y no se parece cuando SÍ lo es.

**La regla** (`lib/carruseles/duplicados.ts`, con su «qué cubre y qué no» como `clasificar.ts`). Mismo creador y una de dos:

- **La serie numerada:** los dos pies traen una marca de parte (`parte|part|pt|teil` + número). La clave es el CREADOR, no el
  texto. ⚠️ Con una excepción medida: **dos partes con el MISMO número son series distintas** (una serie tiene una sola parte
  2) y las dos se quedan — @heygurlceo tiene dos «pt 2» al mismo tiempo, apps y carreras, y sin eso se comía una.
- **El mismo pie entero, las mismas láminas y el mismo día:** la misma publicación dos veces. Las tres condiciones juntas, por
  lo de arriba.

**Medido con el código que subió:** de 912 carruseles en la grilla hoy saca **4** (3 por serie, 1 por el mismo pie); si
volvieran las 598 escondidas, **8 de 1.470** (5 por serie, 3 por el mismo pie), entre ellas las partes 8 y 9 de «meals you
should make instead of eating out» de @success.recipes, que es uno de los ejemplos del pedido.

**«Día 3», «Week 1», «Episodio 2» se probaron como marca de serie y se descartaron:** en los pies reales casi nunca marcan una
serie, marcan un plan adentro del texto («Days 1-3: no running», «Week 2: …») o un repaso («week 1: greet people, week 2: …»).
Aportaban 3 falsos y CERO duplicados. ⚠️ **Y la trampa al medirlo: la marca se lee con la PUNTUACIÓN puesta.** Normalizando
primero (que es lo natural para comparar textos), «First marathon done. Days 1-3» y «…la parte. 2 cosas que aprendí» quedan
como «days 1» y «parte 2», y aparecieron 4 series de mentira que no existen.

**Lo que NO cubre:** el mismo TEMA de un creador (las de meal prep de una misma cuenta son carruseles distintos del mismo
rubro: eso lo acota la variedad), dos series numeradas distintas y a la vez (se toman como una, salvo lo del número), y lo que
no tiene pie (Spy lo borra a los 30 días: sin texto no se afirma nada).

**No esconde nada de la base** (eso es `dejo_de_verse_en` y lo decide una pasada a ojo): es de la PRESENTACIÓN, como la
variedad. Se aplica a la grilla ya ordenada —queda la que mejor rindió— y **no** se aplica cuando se pidió ver una cuenta (por
la lista o por @) ni en «Guardados», así que la parte que se corrió se ve entera tocando a su creador.

⚠️ **Y lo primero que cazó la regla fue una fixture de nuestro propio test.** `tests/carruseles-pantalla.test.ts` contaba
«Ver 2 carruseles» en el modal de filtros con dos tarjetas que eran el MISMO carrusel con otro id y otro tipo: mismo pie,
mismas láminas, mismo día. El rojo era correcto y el arreglo fue darle su propio pie al segundo, no aflojar la regla. Una
fixture copiada con `{...base, id: otro}` es un duplicado perfecto, y de ahora en más una pantalla que CUENTA tarjetas se
prueba con contenidos distintos.

**Vive en:** `lib/carruseles/duplicados.ts`, `lib/carruseles/explorar.ts` (`filtrarCarruseles`: juntar y después repartir, en
ese orden, para que el reparto sea sobre contenidos distintos), con `tests/carruseles-duplicados.test.ts`.

## Anuncios en video en una pantalla de imágenes: la fuente lo decía y se tiraba (6/11/2026)

**Síntoma:** en «Anuncios» había muchos videos, y la pantalla es para copiar imágenes.

**La causa:** el actor de Apify manda `snapshot.displayFormat` (VIDEO, IMAGE, CAROUSEL…) y al guardar se tiraba; `medio` (mig
0391) sólo se escribía para Instagram. Es la misma historia que la 0391 con los carruseles: el dato estaba y no se guardaba.

**La regla:** ahora se guarda `medio` también en los anuncios (`medioDeAnuncio`), y el explorador no muestra ni cuenta un video
(`esAnuncioEnVideo`). Sin `medio`, la única pista es la miniatura del CDN de Meta en la carpeta de cuadros de video (`/t15.`).

**Vive en:** `lib/spy-todo-reglas.ts`, `lib/spy-medio.ts`, `lib/spy.ts` (`guardarMedios`), `lib/carruseles/anuncios.ts`.

### El arreglo cubrió la fuente que NO trajo ni un anuncio (6/11/2026, tarde)

**Lo obvio era que el dato llega por Apify y que «se corrige en la próxima lectura de Spy». Las dos cosas estaban mal**, y
medirlo contra producción lo dio vuelta. De los **300 anuncios guardados** (`spy_piezas`, canal «anuncios»):

| Lo que se creía | Lo medido el 6/11/2026 |
|---|---|
| El `medio` lo trae el `displayFormat` de Apify | **Los 300 entraron con `fuente: 'recorrido'`**: los leyó la EXTENSIÓN de Chrome (`lib/spy-captura.ts`), que nunca llenó `medio`. Por Apify no entró ninguno. |
| La miniatura del CDN (`/t15.`) delata al video | **La regla acierta en 0 de 300.** 297 ya tienen la miniatura copiada a nuestro bucket (la del CDN vence: mig 0361), 2 quedaron en `/t39.` (imagen) y 1 sin miniatura. |
| Se corrige solo en la próxima lectura de cada cuenta | **279 de los 300 ya tienen `dejo_de_verse_en`**: un anuncio que bajó no vuelve a aparecer en una lectura de la Biblioteca. Una lectura nueva completa 21, no 300. |

**Y no hay ninguna otra pista**, buscada campo por campo: 0 con `analisis`, 0 con `duracion`, 0 con `plataformas`, 0 con
`laminas`, 0 con un `m:ss` en el texto (el reloj del video lo saca `RE_TIEMPO_DE_VIDEO` antes de guardar el copy), y la
lectura cruda tampoco quedó: `spy_lecturas_canal` acepta el canal «anuncios» en su `check` pero **nadie escribe ahí** —
`lib/spy-captura-db.ts` lo dice en su cabecera («lo leído de Meta es de quien lo leyó»). Son 0 filas. Así que de 300
anuncios guardados, **de 298 no se sabe y hoy no hay forma de saberlo sin volver a leer**.

**Lo que SÍ decía la fuente y se tiraba, otra vez.** `extension/spy-leer.js` manda un token `['v', poster]` por cada
`<video>` dibujado, y la Biblioteca escribe el reloj del video sobre el creativo («0:15», «0:00 / 1:28»). El servidor usaba
el token `'v'` sólo como miniatura de respaldo y el reloj sólo para limpiarlo del copy: las dos señales se leían, ninguna se
anotaba. Ahora `anuncioDe` devuelve `medio: 'video'` con cualquiera de las dos (`medioDeLaTarjeta`).

**Las reglas que quedan:**
- **Antes de decir «lo arregla la próxima lectura», mirar POR DÓNDE entraron las filas que ya están.** `fuente` lo dice en una
  consulta. Arreglar la fuente equivocada se ve igual en el diff y no cambia nada en la pantalla.
- **«Se corrige en la próxima lectura» sólo vale para lo que la próxima lectura va a volver a traer.** Con `dejo_de_verse_en`
  escrito, no vuelve: hay que contar cuántas filas están vivas antes de prometerlo.
- **Un «no sé» no se muestra como «es imagen».** `anunciosDe` ponía `medio: 'imagen'` fijo en cada tarjeta: ésa era la
  mentira del contador del encargo. Ahora la tarjeta lleva el medio que SE SABE (`medioGuardadoDeAnuncio`, `null` incluido),
  el contador dice «N sin saber si son video» (`anunciosSinSaber`) y hay un filtro para dejarlos afuera
  (`soloConfirmados`, `?conf=1`) — pero **apagado por defecto**, porque esconderlos sería el error simétrico (ver «Sin dato
  no es "no"»): 298 anuncios buenos tirados por un dato que falta.
- **No se afirma «imagen» por ausencia de señal de video.** Una tarjeta cuyo `<video>` todavía no se dibujó muestra sólo su
  portada como imagen, y ahí «imagen» sería exactamente el bug que esto arregla. Se afirma «video» con señal positiva y lo
  demás queda en `null`.

**Qué lo destraba, y no cuesta un centavo:** otro recorrido de la Biblioteca de Anuncios de esos competidores con la
extensión (que ahora sí guarda el medio). **No necesita crédito de Apify** — que además es US$0,00 libre contra la reserva de
Spy. Con el filtro «Activos e inactivos» de Meta también vuelven los 279 que bajaron.

**Vive en:** `lib/spy-captura.ts` (`medioDeLaTarjeta`, `anuncioDe`), `lib/carruseles/anuncios.ts`
(`medioGuardadoDeAnuncio`, `anunciosSinSaber`), `lib/carruseles/explorar.ts` (`soloConfirmados`),
`lib/carruseles/explorar-servidor.ts`, `app/image-editor/carruseles/{ExplorarCarruseles,FiltrosCarruselModal}.tsx`, con
`tests/spy-captura.test.ts` y `tests/carruseles-anuncios.test.ts`.

⚠️ **Y la trampa al PROBARLO:** el anuncio del fixture de `tests/spy-captura.test.ts` trae las dos señales a la vez (el reloj
y el token del `<video>`), así que **sacar la línea del token `'v'` daba CERO rojos**. Cuando dos señales alcanzan por
separado, el caso que prueba cada una tiene que traer una sola.

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

**Y desde el 6/11/2026 es un comando del script oficial: `links`** (antes vivía en una copia temporal, ya borrada). Toma uno
o varios links en la línea de comandos o con `--archivo lista.txt` (uno por renglón), y en seco dice cuántos son, cuáles no
entendió, cuáles ya están y cuánto puede costar. Lo que apareció armándolo, y que no es obvio:

- **Un link se reduce a su `ref` (el shortcode), y ese ref tiene que ser EL MISMO que saca `piezasDeApify`** del permalink que
  devuelve el actor: si no, la misma pieza se guarda dos veces (el upsert va por `ref`). Por eso `linkDeInstagram` normaliza
  `/p/`, `/reel/`, `/reels/`, `/tv/`, con o sin `www`, con o sin protocolo y con la cola `?igsh=…` del botón «Copiar enlace».
  ⚠️ **Y la trampa al probarlo:** con la barra antes del `?` (`…/p/XXX/?igsh=1`) un ref mal recortado se corta igual en la
  barra. El caso que de verdad prueba la regla es el link **sin** barra (`…/p/XXX?igsh=1`); con el otro, romper el recorte a
  propósito daba 0 rojos.
- **Un shortcode suelto no se acepta.** Sin el dominio no hay forma de saber si «DAbC_1-xyz» es un link, un nombre de cuenta o
  una palabra: adivinarlo es gastar plata en una corrida que no trae nada.
- **El creador de un link suelto va con `fuente: 'tema'`,** o sea no se lee entero: de su cuenta no se midió nada, sin su
  mediana no hay outlier, y lo que no se midió no se dice.
- **Si el actor no dice de quién es la publicación (`ownerUsername`), la fila no se puede guardar:** sin creador no hay
  `cuenta_id`. Antes eso quedaba como un número en un total; ahora se dice link por link, junto con los que el actor no
  devolvió (borrados, privados, o el link mal copiado).
- **Un link ya guardado no se vuelve a pagar** (se dice cuántos eran; `--de-nuevo` lo fuerza). Y si está **escondido**
  (`dejo_de_verse_en`), el comando avisa que **leerlo de nuevo no lo revive** y deja el SQL para que se vea: el upsert por
  `ref` no toca esa columna.

**Vive en:** `lib/carruseles/biblioteca.ts` (`linkDeInstagram`, `planDeLinks`), `scripts/carruseles-biblioteca.mts`
(`links`, y `guardarLeidas`, que es el guardado que ahora comparte con `leer`: una sola copia de las seis cosas que hay que
hacer bien para que PostgREST no rechace la fila entera), con `tests/carruseles-por-link.test.ts`.

⚠️ **Y la regla de método que dejó: en el camino que no se puede EJECUTAR, el único control es el tipado.** El comando sólo
corre de verdad gastando crédito de Apify, y con el techo en US$0,00 ese camino no se ejecutó ni una vez: un `TS2552` (usar
`entradaDeUnaPublicacion` en `links` sin traerlo) pasó todas las pruebas en seco y todos los tests. En este script **cada
comando trae sus piezas por dentro** (`const { … } = await imp(…)`), y eso **no es un import del módulo**: lo que usan dos
comandos se trae en los dos. Lo cazó el `tsc` entero de la punta; el acotado de la PC no corrió (la guardia de RAM lo negó
cinco veces, con 0,8 a 2,1 GB libres de los 3 que pide) y **el pre-push, cuando no tiene RAM, avisa y deja subir** a propósito.
**O sea: un comando nuevo que no se puede correr no está probado hasta que la punta da verde.** No se da por hecho antes.

## Dos formas de pedir lo mismo, con dos respuestas distintas: el filtro de largo (6/11/2026)

**Síntoma:** no se veía. El explorador tenía DOS filtros de largo de carrusel —el desplegable viejo (`largo`: 2 a 4, 5 a 7, 8+)
y el deslizador de láminas del modal «Filtros» (`lamMin`/`lamMax`)— y la pantalla ya sólo mostraba el deslizador. El viejo
seguía vivo en el tipo, en la URL y en la búsqueda guardada.

**Lo obvio era borrarlo, y estaba mal:** `?largo=cortos` está en links copiados y en búsquedas guardadas del negocio. Borrarlo
de golpe hace que un link viejo cambie de resultado **en silencio** (pasa a no filtrar nada y muestra 912 en vez de 180).

**Y el hallazgo que no se veía: los dos filtros NO respondían lo mismo.** `enLargo` hacía `if (c.laminas == null) return false`
—o sea tiraba todo lo que no dice cuántas láminas tiene— y el deslizador lo deja («sin dato no es "no"», la entrada de acá
abajo). Son **79 de 990** las piezas sin ese dato (8 %): `?largo=cortos` las escondía todas y el deslizador 2–4 las muestra.
No era una duplicación inocente: eran dos reglas distintas con la misma cara.

**La regla:** una sola fuente de verdad, el deslizador de láminas. `largo` queda como **alias de ENTRADA** y nada más
(`ALIAS_LARGO_CARRUSEL` en `lib/carruseles/opciones.ts`): al leer la URL se traduce a `lamMin`/`lamMax` y desde ahí no existe
más. Así el link viejo sigue dando un resultado sensato, con la regla buena, y no hay un segundo filtro con su propia lógica.
Lo que diga el deslizador gana: el alias sólo entra si el link no trae `lmin` ni `lmax`. Una búsqueda guardada con `largo` se
re-sanea a `lmin=2&lmax=4` la primera vez que se lee, así que el alias se va solo.

**Vive en:** `lib/carruseles/opciones.ts` (`ALIAS_LARGO_CARRUSEL`), `lib/carruseles/explorar.ts` (`filtrosDeQuery`,
`rotuloLaminas`), `app/image-editor/carruseles/FiltrosCarruselModal.tsx`. Lo prueba `tests/carruseles-explorar.test.ts`: que
`?largo=cortos` y el deslizador en 2–4 devuelvan EXACTAMENTE la misma lista, con una pieza sin láminas adentro.

⚠️ **Y la regla de método: un filtro retirado de la pantalla no está retirado.** Mientras siga en el tipo de los filtros y en
la URL, sigue filtrando para quien tenga el link —y con la lógica de cuando se escribió, que puede ser anterior a la regla que
el área ya aprendió. Sacarlo es sacarlo del TIPO; para los links viejos se deja una traducción de entrada, no una copia.

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

## Un ejemplo nuevo no se ve hasta que alguien lo mira (6/11/2026)

**El agujero, que estaba anotado en «Sin hacer» y nadie había cerrado:** la biblioteca la curó una persona a mano (598
escondidas de 1.588 entre el 5 y el 6/11), pero **lo que trajera la próxima lectura iba a aparecerle al cliente sin que nadie
lo mirara**. Medido el 6/11: las 1.588 entraron el 4 y el 5/11, así que el agujero todavía no se había materializado.

**Lo obvio era filtrar automático, y ya estaba medido dos veces que no sirve** (las dos en este documento): el modelo barato
se pasó de estricto (35 de 388 escondidos volvieron) y el filtro gratis `(laminas ?? 0) >= 3 && parece_contenido === true`
tiraba 457 piezas de las que 363 servían. Así que no hay filtro: hay un **estado**, y decide una persona.

**La regla:** `revisada_en` (mig 0411) en null = nadie la miró, y la biblioteca NO la muestra. El comando `revisar` del
script deja una hoja HTML con las miniaturas y sus ids, y aplica lo que la persona decida: `--aprobar`, o `--esconder` con su
motivo, que queda escrito en un JSON al lado de la hoja (la tabla no tiene columna para el motivo, y sin motivo no se puede
deshacer). GRATIS: no le pide nada a Apify.

**Cinco decisiones que no se ven en el diff:**

- **Es un estado APARTE de `dejo_de_verse_en`, no el mismo.** «La miramos y no sirve» y «nadie la miró» no son lo mismo, y
  los dos SQL de deshacer que viven en este documento salen de la FECHA de `dejo_de_verse_en`: mezclarlos los rompería.
- ⚠️ **El backfill de la migración no es opcional: sin él, aplicarla vacía la vidriera de golpe** (las 990 que hoy se ven
  pasarían a «sin mirar»). Las que ya están pasaron por la curaduría, así que la migración las marca. Una columna nueva con
  la regla «sólo se muestra lo que la tiene» siempre tiene que decidir qué pasa con lo que ya existe, y el default (null) es
  justo el que esconde todo.
- **El filtro va en memoria, NO en un `filtros` de PostgREST.** Una columna que todavía no existe haría fallar la lectura
  ENTERA (la misma trampa de la 0373 y de la 0391), y `estaRevisada` mira si la fila **trae** la columna, no si su valor es
  null: con la 0411 sin aplicar, todo se ve como antes. Verificado contra producción con el código nuevo y la migración sin
  aplicar: `carruselesDeLaBiblioteca()` devuelve los mismos 800 y una pieza suelta se abre igual.
- **El upsert de la lectura NUNCA manda `revisada_en`,** como tampoco manda `dejo_de_verse_en`: si lo mandara, releer una
  pieza ya aprobada la volvería a esconder. Lo fija un test sobre `filasDeLectura`.
- **`laminas` no paga lo que nadie miró.** Es el mismo error de «primero limpiar, después leer láminas» (169 de las 770
  láminas pagadas eran de carruseles que después se escondieron), sólo que ahora hay con qué filtrarlo.

**Vive en:** `supabase/migrations/0411_carruseles_revisada.sql` (**sin aplicar**: la aplica Martín o el Cerebro),
`lib/carruseles/biblioteca.ts` (`estaRevisada`, `sinRevisar`, `hojaDeRevision`), `lib/carruseles/biblioteca-servidor.ts`,
`scripts/carruseles-biblioteca.mts` (`revisar`; `estado` dice cuántas faltan), con `tests/carruseles-biblioteca.test.ts`.

⚠️ **Y una trampa del arnés de «probarlo rompiéndolo»:** el contador de rojos leía el resumen de `node --test` de la salida
capturada, y una aserción que falla comparando dos objetos grandes imprime un diff que **desborda el `maxBuffer` de
`execFileSync`** (1 MB): la salida vuelve cortada, sin el resumen, y la rotura se anota como «0 rojos» cuando el test la cazó
perfecto. Un «0 rojos» se confirma corriendo ESA rotura a mano antes de creerle.

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
  ⚠️ **Y barre TODOS los archivos, también la salida de un script de la PC que sólo lee Martín** (6/11/2026: un «Cargá crédito
  y volvé a correrlo» en `porQueParo` dejó la punta roja en «Tests afectados», 7 min 28 s después). El copy va en neutro
  siempre, aunque el único lector sea argentino. ⚠️ Y no caza todas las formas: «subí `--techo-usd`» pasó, porque «subí» es
  también el pretérito de «yo subir». Un verde del guard no es «está en neutro».

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

- **De la pasada contra la referencia (7/11/2026), lo que quedó anotado y NO se tocó** (es decisión de diseño o de producto):
  - **El chip del filtro activo.** La referencia muestra cuál filtro está prendido en una pastilla debajo de la barra («Outlier
    score 1×+»); MaKo sólo muestra cuántos hay, en el número del botón «Filtros». Sin abrir el modal no se sabe cuál es.
    `app/image-editor/carruseles/ExplorarCarruseles.tsx` (`filtrosActivos`).
  - **El tamaño del titular de la tarjeta:** 13,5 px; a la proporción de la referencia serían ~20 px (tabla de arriba).
  - **El modal de filtros:** 900 px de ancho y `min(88vh, 720px)` de alto, o sea 62,5 % × 80 % de una pantalla de 1440×900;
    la referencia usa ~80 % × ~96 %. `FiltrosCarruselModal.tsx`.
  - **Los deslizadores** muestran el valor DEBAJO de las puntas; la referencia lo muestra DENTRO de cada punta, y agrega un
    «Exact values» para escribirlo a mano. `Deslizador.tsx`.
  - **El orden de la fila que se desliza en el teléfono:** «Filtros» queda detrás del segmento y de las cuatro pastillas, o sea
    fuera de la pantalla a 390 px (se ve en `capturas-2026-11-06/10-portada-390.png`). Se puso así a propósito el 6/11 (la
    autocrítica: el segmento es lo que cambia la pantalla), pero deja el filtro escondido.
- **El tipo de 1.213 carruseles** sigue vacío: sólo las láminas (o la portada leída) lo dirían. `lib/carruseles/clasificar.ts`.
- **El «tema»** (finanzas, salud…) no se clasifica. Pedirá una pasada de IA por carrusel.
- **Las capturas de Top Carousels ya llegaron** (`docs/carruseles/referencia-top-carousels/`) y los valores gruesos (4 columnas, modal en dos partes, filtros con deslizadores, colores del múltiplo) se ajustaron; faltan los finos (medidas exactas) contra un monitor real.
- ~~**Lo que entre de ahora en adelante no pasa por esta curaduría:** una lectura nueva queda visible sin que nadie la mire.~~
  **Cerrado el 6/11/2026** con `revisada_en` (mig 0411) y el comando `revisar` (ver la entrada de arriba). **Lo que queda:**
  la migración **sin aplicar** (la aplica Martín o el Cerebro: `node scripts/apply-migration.mjs
  supabase/migrations/0411_carruseles_revisada.sql`) y que la pantalla de «Editar la biblioteca» todavía no muestra ni
  aprueba lo que está sin mirar — hoy eso se hace con el script (`app/image-editor/carruseles/`,
  `lib/carruseles/biblioteca-servidor.ts` → `bibliotecaParaEditar`).
- 1 de los 245 links sin leer, y 26 creadores de la lista sin leer. El comando `links` ya está (arriba), pero **no se pudo
  correr con `--de-verdad` ni una vez**: el techo del crédito es US$0,00. Lo probado es el camino en seco y las piezas puras.
- Los 32 temas de hashtag siguen prendidos, sin decidir si conviene apagarlos. Traen de todo.
- **Series y duplicados: hecho lo medible** (`lib/carruseles/duplicados.ts`, arriba). Lo que queda: el mismo TEMA de un
  creador (las de meal prep) NO se junta, porque son carruseles distintos del mismo rubro; juntarlos pide clasificar el tema, y
  eso no existe todavía. Y «you can find anything on the internet» ya no está en la base (0 piezas el 6/11): el ejemplo del
  pedido se fue con la curaduría del 6/11, no con esto.
- **Salud y nutrición, café y déficit de atención** quedaron a la vista por la duda. Si Martín lo quiere más estricto, es lo próximo en esconder.
- **Láminas, medido el 6/11:** 744 de 912 carruseles visibles las tienen. De los otros, 111 sin leer (`laminas` cortó «al techo» con US$0,54 de un tope de 1,50, sin mirar por qué) y 57 que el actor no dio.
- **«Editar» con la IA real: probado y funcionando** (6/11, cinco corridas; ver la entrada de arriba). Lo que quedó abierto es
  el **plazo**: una corrida llegó a 276,9 s contra el `maxDuration = 300` de `app/api/image-editor/carruseles/replicar/route.ts`,
  porque el modelo principal de Gemini se cuelga 120 s enteros. Si se pasa, el stream se corta sin `fin` y la pantalla espera
  para siempre. Las palancas: un presupuesto de tiempo para toda la cascada (hoy el plazo es por llamada, `lib/ai-cheap.ts`) o
  un plazo más corto para el primer modelo. Falta medir cuánto tarda un pedido de 10 láminas que SÍ contesta.
- **Un ejemplo que cuenta la historia de su autor no se puede replicar sin inventarle una historia al cliente** (medido con la
  IA real, carrusel `-895`): el prompt ya prohíbe copiar sus hechos y el modelo igual le arma una biografía al negocio. Es
  decisión de producto: o esos ejemplos no ofrecen «Editar» (el tipo ya se clasifica, `lib/carruseles/clasificar.ts`), o se le
  pide al dueño el dato que falta antes de escribir. No se puede tapar en el saneo.
- **El ws 3 («Cliente de Prueba») no tiene ninguna clave de IA**, así que el comando de prueba con `--ws 3` sólo ejercita el
  camino sin IA. Conectarle una es escribir en producción: pendiente del sí de Martín. Mientras tanto, la prueba con IA real va
  con `--ws 9`.
- **Del orquestador falta cubrir el camino de la MINIATURA** (`replicarEjemplo` con `que: 'thumbnail'`):
  `tests/carruseles-editar.test.ts` corre los seis casos del carrusel, y la miniatura sólo se probó a mano con la IA real
  (21,6 s, una lámina de 1280 × 720 con el gancho del negocio). Su camino en seco ya armaba el documento, así que ahí no vivía
  el bug, pero es la mitad del orquestador sin arnés.
- **Las fotos de la gente en una lámina** (que no son el cliente) quedan como un recuadro con su guía: generarlas con la IA de
  imagen del avatar es el paso siguiente.


## DECISIÓN de Martín: la IA replica, y lo único full editable es el TEXTO (7/11/2026)

**Lo que dijo, y es el norte de la tab:** «tiene que ser todo con IA… le vamos a pasar la referencia a la IA
para que haga algo similar. Es muy complicado que todo sea editable, las imágenes, los personajes, las
personas… lo más fácil es pedirle a alguien que lo replique, y de última concéntrate en que lo que sí sea full
editable sea el tema de los textos. Eso sí tiene que ser editable, porque cambia de dueño de negocio a dueño de
negocio: puedo tener un carrusel con la misma estética, con las mismas fotos, pero le cambio el texto, el CTA.»

**NO se construye:** edición por partes de la imagen. Nada de quitar o mantener personas una por una, elegir
qué paisaje queda, ni reemplazar a alguien por el avatar del cliente con un editor de elementos. Es trabajo
grande y está descartado. Si un encargo pide algo de eso, se vuelve a preguntar antes de escribir una línea.

**Al 7/11/2026 YA ESTÁ ASÍ, verificado contra el código** — esta entrada existe para que nadie lo rehaga ni se
desvíe, no porque falte algo:

- `lib/carruseles/replica-servidor.ts` lee las láminas, carga el Second Brain del negocio, su voz, su kit de
  marca y la foto del cliente, y **la IA DEL NEGOCIO** (su Claude, su GPT o su Gemini, nunca la de la
  plataforma) devuelve el diseño con sus textos.
- Son hasta **12 láminas con 8 textos cada una, en JSON**, que quedan editables en el Image Editor. No es una
  imagen plana: el texto vuelve como texto.
- Sin IA conectada igual sale un diseño editable, con la estructura del ejemplo y una guía por lámina.
- Busqué edición de personas, fondos o avatares en `app/image-editor/carruseles/` y `lib/carruseles/`: **no
  existe y nadie la está construyendo.** Los únicos «avatar» son la foto de perfil del competidor en los filtros.

⚠️ **Lo que a propósito NO hace, y conviene no «arreglarlo»:** la réplica **no reusa las fotos del original**.
Martín dijo «con las mismas fotos», pero las fotos del ejemplo son de un competidor, y ponerlas en el anuncio
de otro negocio es un problema de derechos, no una función que falte. Lo que se replica es **la estética y la
estructura**, con la marca y el avatar del negocio. Si alguna vez se decide reusarlas, es una decisión legal,
no técnica.

**Vive en:** `lib/carruseles/replica-servidor.ts` · `lib/carruseles/replica.ts` ·
`app/image-editor/carruseles/EditarCarrusel.tsx` · memoria `carruseles-ia-replica-solo-textos-editables`.

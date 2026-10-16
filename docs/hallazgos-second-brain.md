# Hallazgos — Second Brain (el grafo del negocio)

El mapa de lo que MaKo entendió del negocio del cliente: `lib/cerebro-grafo.ts` (qué nodos
hay), `lib/cerebro-layout.ts` (dónde va cada uno), `lib/cerebro-modelo.ts` (la forma) y
`app/second-brain/Grafo.tsx` (el dibujo).

## Lo que más muerde acá

0. **«Se ve parecido» no es verificable, y dos veces seguidas el dibujo pareció bien y
   estaba mal.** Antes de tocar el grafo, correr `node scripts/medir-grafo.mjs <html>`.
   [→](#las-doce-métricas-que-deciden-si-se-parece)

1. **El diagnóstico obvio era el equivocado: el problema no era el motor de dibujo, eran
   los datos.** [→](#un-árbol-no-se-dibuja-como-una-red-por-más-física-que-le-pongas)
2. **Las dos razones para no usar un force layout son falsas**, y costaron una versión
   entera. [→](#las-dos-objeciones-al-force-layout-que-no-se-sostienen)
3. **d3-force es determinista pero siembra por ÍNDICE del array** — insertar un dato en el
   medio le cambia el mapa a todo el mundo, sin que nada avise. [→](#es-determinista-pero-siembra-por-índice-y-eso-alcanza-para-arruinarlo)
4. **`onWheel` de React no puede `preventDefault`** en react-dom 19: el zoom anda y la
   página scrollea al mismo tiempo. [→](#onwheel-de-react-no-puede-frenar-el-scroll)
5. **`opacity: 0` en SVG no ahorra nada.** [→](#opacity-0-en-svg-cuesta-lo-mismo-que-dibujarlo)
6. **`var(--mono)` no está definido** en ningún `:root`, y se usa 38 veces. [→](#varmono-no-existe-y-se-usa-38-veces)

---

## «Pregúntale a MaKo» es el Second Brain: la clave se queda, y lo de antes se lee (16/10/2026)

Tanda 2 de la etapa 2 (docs/diseno-mako-ai-native.md).

- **La entrada de la barra cambió de nombre, no de clave.** Se llama «Second Brain», lleva a `/second-brain` y su clave
  sigue siendo `mako`. De esa clave cuelgan el chat del teléfono, la bandeja (`/mako/pendientes`), Inbox y la puerta
  del chat (`puedeVerKey('mako')`): cambiarla los apagaba a todos, sin un error.
- **Una entrada por persona.** Al admin que ya ve «Second Brain» en Analyze, el Sidebar no le dibuja la de abajo.
- **El título de la pestaña ahora lleva la marca** («MaKo - Second Brain»): «Pregúntale a MaKo» ya la traía en el
  nombre y por eso no la sumaba. No es un bug.
- **«Antes»: los chats de /mako, de sólo lectura**, con SU regla de quién ve qué: el admin, los del workspace; los demás,
  los suyos (lib/chat-mako-indice.ts, la regla de chart-insights). Son de un chat sin herramientas: no se continúan, se
  sigue en uno nuevo. `/mako` y `/mako-doer` redirigen con `rutaConWs`.
- **La API lee los chats de la persona sin que la persona sea un parámetro.** `listar_chats_mako` y `hilo_chat_mako`
  (canal `app`) toman la conversación del turno de su clave de canal (`app:<id>`), y de ahí la base `mako-movil:<persona>`
  de su `chart_key`. Un `id` de otra persona no existe. Así no hizo falta sumar la persona al `Ctx` de todas las
  operaciones.

**SIN HACER:**
- Retirar `/api/mako-doer`: su única pantalla era `MakoDoerTab`, que se fue. `tests/mako-doer-plazo.test.ts` todavía
  lo nombra.
- En el teléfono, la fila «Second Brain» (el chat, `/m/mako`) y la del Mapa (`/m/second-brain`, sólo admin) son dos
  hasta la tanda 3.

**Vive en:** `app/_components/nav.ts` (`MAKO_NAV`) · `app/_components/Sidebar.tsx` · `lib/chat-mako-indice.ts` ·
`lib/api-mako/areas/mako.def.ts` · `app/mako/page.tsx`

## El Second Brain es un chat: dos puertas, y el Mapa sólo cuando se pide (16/10/2026)

**El pedido.** Martín, por el coordinador: «Termina con todo, faltan mis pedidos del Second Brain»; la etapa 2 de
`docs/diseno-mako-ai-native.md`. Primera tanda: `/second-brain` pasa a ser el chat con MaKo, con la cara del Centro de
Operaciones (barra de chats, conversación, caja con micrófono, la tarjeta que se confirma), y el grafo es «Mapa».

- **Dos puertas, las dos en el servidor.**
  - **El chat es de todos los que tienen MaKo** (closer y setter incluidos): `requireRolWs(['closer', 'setter'], { nav: 'mako' })`,
    la misma clave del chat del teléfono.
  - **El Mapa es del admin con la tab en su capa**: `esAdminDeTab('second-brain')` (`lib/puerta-admin-tab.ts`), la MISMA
    regla de las rutas del Second Brain, sin una copia. A quien no le toca no se le calcula.
- **El Mapa se calcula sólo cuando la URL lo pide** (`?panel=mapa`, o un `?area=` de los links de siempre).
  `construirCerebro()` son 21 lecturas, y el chat no las necesita para el primer dibujo.
- **La ruta del chat no puede ir en `app/api/second-brain/`.** Esa carpeta es sólo del admin por test
  (`tests/puerta-admin-tab.test.ts`), y un closer recibiría 403. Va en `app/api/mako/chat`, con la puerta de MaKo
  (`personaDelRequest`).
- **El jefe «Second Brain» son las conversaciones del teléfono** (`mako-movil:u<id>`): no hubo nada que migrar.
  - El jefe es la MÁS VIEJA, y las demás son sus sub-chats. Con la más reciente, el jefe saltaba de fila cada vez
    que se escribía en otra.
  - Un chat nuevo se crea con el primer mensaje, no al apretar «Nuevo chat».
- **Los sub-chats heredan el muñeco del jefe sólo si el jefe está en `EQUIPO`** (`lib/centro-munecos.ts`). Sin
  esa entrada, cada sub-chat salía con una forma y un color distintos. «Second Brain» es la gota.
- **Trampas del entorno que muerden a cualquier pantalla de acá:**
  - la capa superadmin tiene `userNavKeys: null`, así que pasa `requireCapa` con cualquier clave, pero el Sidebar
    no le dibuja la entrada;
  - la capa `pm` no tiene `second-brain`: ve el chat y no el Mapa.

**Vive en:** `app/second-brain/page.tsx` · `app/second-brain/ChatSecondBrain.tsx` · `app/api/mako/chat/route.ts` ·
`app/_chat/` · `lib/chat-mako-reglas.ts` · `tests/second-brain-chat.test.ts` · `tests/chat-mako-reglas.test.ts`

## Las doce métricas que deciden si se parece

**Síntoma.** Se rehace el grafo con d3-force, se mira, parece una nube. El dueño lo mira y
dice «sigue viéndose como un árbol». Dos rondas seguidas.

**Causa.** El ojo no distingue una nube de un anillo con ruido. Los números sí: la mediana de
distancia al centro daba **237** y el parámetro `anclaRadio` valía **230** — todo estaba
sentado sobre una circunferencia, y encima repartido en diez cuñas (11 de 36 sectores
angulares vacíos). Nada de eso se ve mirando; todo se ve midiendo.

**Regla.** `node scripts/medir-grafo.mjs <pagina.html>` antes y después de cualquier cambio.
Las que más mienten al ojo:

| Métrica | Umbral | Qué delata |
|---|---|---|
| CV del radio | ≥ 0,35 | si es bajo, es un **anillo** disfrazado de nube |
| Bins angulares vacíos | ≤ 4 de 36 | si es alto, hay **cuñas**: quedó radial |
| Hojas de grado 1 | ≤ 30% | un borde de hojas es **topología**, no física |
| Hub máx/medio | ≤ 4,5× | un hub grande dibuja un **asterisco** |
| Clustering | ≥ 0,15 | sin triángulos no hay **racimos** |
| Gris uniforme | **≥ 85%** | Obsidian es monocromo — ver abajo |

**Dos umbrales que escribí al revés la primera vez**, y valen como advertencia: puse «color
dominante ≤ 55%» cuando lo correcto es lo contrario (**≥ 85% del mismo gris**, porque en
Obsidian el color marca excepciones); y medí el hub como «% de nodos» cuando lo que importa
es la razón contra el grado medio. Un umbral mal puesto es peor que ninguno: da el visto
bueno a lo que está mal y suspende lo que está bien.

**Vive en:** `scripts/medir-grafo.mjs`

## El layout

### Un árbol no se dibuja como una red, por más física que le pongas

**Síntoma.** Se construye el grafo, se ve un organigrama radial. Se cambia a un layout de
fuerzas para que se parezca a Obsidian y sale… un diente de león. La sensación es que falta
calibrar las fuerzas, y no falta.

**Causa.** `cerebro-grafo.ts` emitía **una arista entrante por nodo**: 39 nodos, 38 aristas,
cero ciclos, ~20 aristas colgando de la raíz. Eso es un árbol con un hub. Los racimos de
Obsidian **emergen de enlaces laterales** —notas que se citan entre sí—; sin ellos no hay
topología que agrupar y cualquier simulación devuelve una estrella.

Lo que faltaba no había que inventarlo, ya estaba en los datos y se estaba tirando:
`RazonCelda.anguloImagen` y `.anguloVideo` guardan el id de un formato REAL, y se estaban
concatenando al texto del `detalle` en vez de dibujarse. Esa es la arista que cruza de un
segmento a otro (dos avatares distintos pueden elegir el mismo formato). Con eso más los
planos del panorama apuntando al dato del que hablan: **42 nodos y 51 aristas**.

**Regla.** Antes de tocar el renderer, medir `aristas.length > nodos.length − 1`. Si no se
cumple, es un árbol y ningún parámetro de física lo va a salvar. Y el corolario general: la
arista tiene que significar algo verificable — si no se puede escribir el `motivo` en una
frase, no va.

**Vive en:** `lib/cerebro-grafo.ts` (el bloque «LAS ARISTAS LATERALES») · `lib/razones.ts:47`

### Las dos objeciones al force layout que no se sostienen

La primera versión evitó la simulación por tres razones. Dos son falsas, y conviene que
queden refutadas por escrito o la próxima sesión las repite:

- **«Tiembla para siempre».** No. d3 baja `alpha` con `alphaDecay = 1 − 0.001^(1/300)` y el
  loop se corta en `alphaMin = 0.001`. Y acá ni siquiera se enciende el timer: `.stop()` y
  después `.tick()` a mano, así que el resultado es estático por construcción. Obsidian hace
  exactamente lo mismo — su worker se auto-agenda solo mientras `alpha > 0.001` (~300 ticks
  ≈ 5 s) y su renderer se apaga a los 60 frames sin cambios.
- **«Es aleatorio».** No en d3-force v3. El único azar es `jiggle`, y usa un LCG de **semilla
  fija** creado por simulación (`src/lcg.js`), no `Math.random`. Verificado con un test que
  pisa `Math.random` y comprueba que el dibujo sale idéntico. El mito viene de v1/v2.
- **«d3 muta los objetos que le pasás».** Esta **sí** es cierta, y es la regla que gobierna
  `cerebro-layout.ts`: se le pasan copias planas desechables de nodos **y aristas**.
  `forceLink` además reemplaza los strings `source`/`target` por referencias al objeto nodo,
  así que sin copiar, la segunda corrida recibe una entrada distinta a la primera.

**Vive en:** `lib/cerebro-layout.ts` · `tests/cerebro-layout.test.ts`

### Es determinista, pero siembra por ÍNDICE — y eso alcanza para arruinarlo

**Síntoma.** El usuario sube un documento al Archivero y su mapa entero cambió de forma. No
falló nada.

**Causa.** `initializeNodes()` solo inventa posiciones si vienen `NaN`, y cuando las inventa
usa una espiral de filotaxis indexada por la **posición en el array**
(`radius = 10·√(0.5+i)`). Insertar un nodo en el medio corre la semilla de todos los
posteriores.

**Regla.** Sembrar `x`/`y` **antes** de simular, derivados de un hash del `id` (los ids ya son
estables: `doc:<uuid>`, `campo:oferta_nombre`, `raz:<uuid>`…), y alrededor del ancla de su
**área**, para que un nodo nuevo nazca en su barrio en vez de cruzar el mapa mientras se
acomoda.

Y una segunda capa que hace falta igual: **ordenar los arrays por id antes de simular**. El
orden cambia el orden de acumulación en el quadtree, y la suma de floats no es asociativa —
el desvío medido era de 0,5 px, invisible pero real, y suficiente para que el test de
determinismo falle. Ordenar lo cierra.

**Vive en:** `lib/cerebro-layout.ts` (`semilla()` y el `.sort()` de `layoutCerebro`)

### Agrupar por categoría con fuerzas ES volver al radial

**Síntoma.** Se saca el layout radial, se pone d3-force, y el resultado sigue leyéndose como
sectores.

**Causa.** Se conservó un `forceX`/`forceY` hacia un ancla POR ÁREA (`strength 0,08`,
`radio 230`), pensando que mantendría los racimos juntos. Diez anclas repartidas en círculo
son diez imanes en un anillo: la simulación hace exactamente lo que se le pidió. Medido, la
relación pico/valle de densidad por corona daba 4,5× con 0,08 y **seguía en 4,2× con 0,04** —
bajar la fuerza no compra nada, porque el problema es la geometría de las anclas, no su
intensidad.

**Regla.** Obsidian tiene **una sola** fuerza posicional: `forceX(0)/forceY(0)` al ORIGEN con
strength 0,1. Los racimos emergen de la topología. Si hacen falta racimos por categoría, la
solución no es una fuerza: es **meter la categoría como NODO** y unir sus miembros a ella —
que es lo que hace Quartz con los tags. El racimo lo produce `forceLink`, gratis, y como sale
de la topología no deja anillos ni cuñas. Efecto medido acá: hojas 47,6% → 2%, densidad
1,21 → 1,74, clustering 0,09 → 0,15, bins vacíos 10 → 3, CV del radio 0,30 → 0,39.

**Vive en:** `lib/cerebro-layout.ts` (`RECETA.centro`) · `lib/cerebro-grafo.ts` (el bloque
«Las ÁREAS como nodos»)

### En Obsidian el color significa «esto es una excepción»

**Síntoma.** El grafo se ve como un muro de oro y no se parece a Obsidian por más que la
física esté bien.

**Causa.** Se usó el color para codificar la autoría de cada nodo — dorado si lo dedujo MaKo,
gris si lo escribió el usuario — y como MaKo deduce casi todo, **37 de 42 nodos quedaban
dorados**. En Obsidian pasa lo contrario: `getFillColor()` cae en `--graph-node` (un único
gris, `--text-muted`) para **toda** nota normal, y el color solo aparece en el nodo activo, un
tag, un adjunto o un link roto. Incluso los seis «grupos de color» configurables tienen
fallback CSS al mismo gris hasta que el usuario elige uno a mano.

**Regla.** El color codifica **excepciones, no categorías**. Acá quedaron tres nodos de color
sobre cincuenta: la raíz, el Norte y el cuello. La autoría no se perdió — vive en el panel
lateral y en la ficha del nodo, que es donde se pregunta por ella. Y de paso desactiva sola la
alarma del antipatrón «cripto o casino»: el dorado vuelve a significar algo.

Dos corolarios del mismo `app.css`, que también estaban al revés:
- **El nodo es un círculo PLANO**: sin borde, sin sombra, sin gradiente, sin punteado. El
  «todavía no existe» de Obsidian es el mismo círculo relleno con `opacity: 0.5`, no un aro.
- **La arista NO es translúcida**: va a alpha 1 y lo que la hace tenue es el color, a dos
  escalones del fondo (#3f3f3f sobre #1e1e1e). Un gris claro bajado de opacidad se ve lavado.
  De ahí sale el token `--sidebar-line`.
- **La etiqueta no tiene halo** ni contorno ni bold, y van TODAS: el fade es por zoom
  (`clamp(log2(k)+1, 0, 1)`), que a zoom 1 vale 1. Mostrar 13 de 42 era otra cosa distinta.

**Vive en:** `app/second-brain/Grafo.tsx` (`rellenoDe`) · `app/globals.css` (`--sidebar-line`)

### Los parámetros SON el dibujo

Cambiar `alphaDecay` de 0,022764 a 0,0228 —1,6·10⁻⁴ de diferencia— corre nodos 10 px;
ponerlo en 0,04 los corre 253 px. Enfriar más rápido **no es «menos convergido», es otro
layout**. Por eso viven juntos en `RECETA`, versionados, y la versión entra en la huella.

Dos que no son obvios: `forceCenter` **no se usa** (mueve `node.x` directo en vez de la
velocidad y pelea con los nodos pineados — 46 px de deriva medidos); y el `strength` de
`forceLink` se deja en el default `1/min(grado)`, que en una topología con hub ya evita solo
que las aristas de la raíz aplasten el centro. Pisarlo es el error clásico.

**Vive en:** `lib/cerebro-layout.ts` (`RECETA`)

---

## El dibujo

### `onWheel` de React no puede frenar el scroll

**Síntoma.** El zoom funciona y la página scrollea al mismo tiempo.

**Causa.** react-dom 19 registra `wheel`, `touchstart` y `touchmove` en el contenedor raíz
con `{ passive: true }`. Un handler pasivo no puede llamar a `preventDefault()`.

**Regla.** `ref.current.addEventListener('wheel', h, { passive: false })` en un `useEffect`,
con su `removeEventListener` en el cleanup. Más `touch-action: none` en el `<svg>` para el
táctil, que es CSS y decide antes de que el listener exista.

**Vive en:** `app/second-brain/Grafo.tsx`

### El transform del zoom no puede ser un prop

**Síntoma.** El mapa salta hacia atrás en momentos aparentemente aleatorios.

**Causa.** Si el `transform` se escribe con `setAttribute` (para no re-renderizar a 60 fps)
**y además** se pasa como prop de JSX, el próximo render de React lo pisa con el valor viejo
del vdom.

**Regla.** O una cosa o la otra, nunca las dos. Acá: `setAttribute` dentro de un `rAF`, y a
`useState` va solo `kPaso` (la escala redondeada a cuartos), que cambia ~15 veces en todo el
recorrido del zoom en vez de 60 por segundo.

**Vive en:** `app/second-brain/Grafo.tsx`

### `opacity: 0` en SVG cuesta lo mismo que dibujarlo

Medido con 1.000 etiquetas: visibles 38,4 ms/frame · `opacity=0` **38,0 ms** ·
`visibility:hidden` 33,9 · `display:none` 12,4 · fuera del DOM 9,8.

**Regla.** La etiqueta que el nivel de detalle apaga **no se renderiza** (render condicional).
Copiar el fade de Obsidian/Quartz literal deja el costo intacto: ellos pueden porque su
renderer es PixiJS y una textura con alpha 0 se saltea el draw.

**Vive en:** `app/second-brain/Grafo.tsx` (el `useMemo` de `etiquetas`)

### `var(--mono)` no existe, y se usa 38 veces

**Síntoma.** Un texto que se escribió para verse monoespaciado se ve con la tipografía normal,
y nadie lo nota porque no rompe nada.

**Causa.** `--mono` está definido **solo** dentro de `.cono` (`app/conocimientos/CursoPortal.tsx`).
En cualquier otro lado `var(--mono)` no resuelve y cae al font heredado, en silencio.

**Regla.** Para mono, importar `MONO` de `app/_ui/tokens.ts`. Las 38 apariciones de
`var(--mono)` fuera de `.cono` son deuda: la que se toque, se corrige.

**Vive en:** `app/_ui/tokens.ts:19` · `app/conocimientos/CursoPortal.tsx:435`

---

## La física viva del cliente

### Reponer las fuerzas del servidor para arrastrar rearma el mapa solo

**Síntoma.** Se agrega arrastre con el patrón canónico de d3 (`alphaTarget(0.3).restart()`)
y el mapa se mueve **58 px de mediana a los 120 ticks sin que nadie toque nada**; 83 px a los
300; y al soltar no vuelve (72 px de deriva final).

**Causa.** Un layout parado en `alphaMin = 0.001` **no está en equilibrio de fuerzas**: sigue
cayendo, 300 veces más lento. Reinyectarle alpha lo hace correr otra vez. Bajar el
`alphaTarget` mitiga y no cierra (0,05 todavía deja 20 px).

**Regla.** La simulación del cliente es **otra receta**, en `app/second-brain/fisica.ts`, y
tiene exactamente dos fuerzas: `forceCollide(60).strength(0.7)` y un **resorte a su casa**
(`forceX/forceY` hacia la posición que mandó el servidor, `strength 0.30`). **Sin
`forceManyBody` y sin centro**, que son las que rearman el mapa. Con eso nace en reposo
exacto (0,00 px al despertarla) y todo vuelve a su lugar en ~1 s.

El diagnóstico obvio —«usá el drag de los ejemplos de d3»— es el equivocado.

Y al soltar, `fx/fy` van a `null`: el nodo **no** queda clavado donde lo soltaste. Es lo que
hace Obsidian, y acá es más importante todavía, porque la posición *significa* algo (la
calculó el servidor con la topología): dejarla movida sería mentir.

**Vive en:** `app/second-brain/fisica.ts`

### Una animación CSS sobre `transform` le gana al `transform` que escribe JS

**Síntoma.** Se agrega la flotación y los nodos dejan de responder a la física: quedan
clavados. Sin error, sin warning, y **el mapa parece vivo porque flota**.

**Causa.** En la cascada, las declaraciones de una animación están por encima de los estilos
de autor normales, incluido el inline y el `setAttribute`.

**Regla.** Un dueño por grupo, anidados: el de afuera lleva la **posición** (la escribe la
física), el del medio la **flotación** (CSS), el de adentro el **pop** de entrada (CSS).

**Vive en:** `app/second-brain/Grafo.tsx` (`cbg-flota` / `cbg-pop` / `cbg-cuerpo`)

### Sobre el lienzo oscuro solo hay dos tokens de color usables

Contraste WCAG sobre `--sidebar` #14161B, contra el gris base `--sidebar-text` (6,55:1):
`--on-sidebar` 16,6 · `--mako-lite` 11,8 · `--mako` 9,5 · `--primary-weak` 9,4 · **`--good`
5,2 · `--bad` 4,3 · `--primary` 4,0 · `--warn` 3,6**.

**Regla.** Todo lo que esté por debajo de 6,55 se lee como **menos** importante que un nodo
normal: un nodo «marcado» con `--primary` se ve menos que uno sin marcar. Sobre superficie
oscura el azul de MaKo es **`--primary-weak`**, que es el par simétrico de `--mako-ink` (que
existe por el motivo inverso, dorado sobre fondo claro).

Y bajo deuteranopía (~6% de los hombres), medido con la matriz de Viénot: **`--mako` y
`--warn-fill` colapsan en el mismo color** (1,14:1). Hoy es tolerable porque son dos nodos de
cincuenta, separados por posición y etiqueta. **No se puede agregar una tercera clase dorada
o naranja.**

### El color de Obsidian es opt-in y viene apagado

Sus seis slots `.graph-view.color-fill-1…6` valen `var(--text-muted)`: **el mismo gris que un
nodo normal**. El sistema está cableado entero y no pinta nada hasta que el usuario define un
grupo — y el grupo lo define una **consulta**, no una categoría del esquema.

**Regla.** Monocromo por defecto, color opt-in, con tope. Acá quedó un solo grupo
(«Resaltar lo que escribiste tú», `--primary-weak`). Las diez áreas **no** reciben color: ya
están resueltas por topología (el nodo de área) y por el filtro del panel.

### El parser del panorama descartaba 5 de 6 secciones, y solo en un workspace

**Síntoma.** El grafo del workspace del dueño tenía 1 nodo de panorama en vez de 6, y las
cuatro aristas laterales de `PANORAMA_APUNTA_A` tampoco se disparaban.

**Causa.** `seccionesPanorama()` buscaba seis títulos **literales** con `indexOf`. El panorama
ya guardado de ese workspace lo escribió una versión anterior con otro molde
(`# DESCRIPCIÓN DEL NEGOCIO`, `# AVATAR`, `# DOLORES`, `# NICHOMERCADO`): coincidía uno solo.

**Regla.** El comentario decía «el generador GARANTIZA que las seis están». Es cierto para lo
que se genere de ahora en más, **no para lo que ya está en la base**. Un parser que lee datos
históricos parte por estructura (encabezado) y mapea sinónimos, nunca por literales.

**Vive en:** `lib/cerebro-grafo.ts` (`seccionesPanorama`, `PLANO_CANONICO`)

### El drag nativo del navegador se come el paneo

**Síntoma.** «Al hacer clic, en lugar de desplazarse, parece que intenta agarrar una imagen.»

**Causa.** Tres a la vez: (1) arrastrar sobre un nodo o una etiqueta dispara el
drag-and-drop **nativo**, que muestra el fantasma y cancela los pointer events; (2) el
`setPointerCapture` estaba sobre `e.target` —el `<circle>`— y el primer re-render de React lo
reemplaza, así que la captura se pierde a mitad del gesto; (3) `onPointerLeave` cortaba el
arrastre al salirse del borde con el botón apretado.

**Regla.** `user-select: none` + `-webkit-user-drag: none` + `preventDefault` en `dragstart`,
la captura **sobre el SVG**, y sin `onPointerLeave` (con la captura bien puesta, el puntero no
«sale»). Obsidian hace lo mismo en una línea: `interactiveEl.addEventListener('mousedown', e => e.preventDefault())`.

**Vive en:** `app/second-brain/Grafo.tsx`

### `setPointerCapture` retargetea los eventos, y el `onClick` del nodo no dispara nunca

**Síntoma.** Se agrega el arrastre y deja de poder hacerse clic en un nodo para fijarlo y leer
su detalle. No hay error: el clic simplemente no pasa nada.

**Causa.** `setPointerCapture` sobre el `<svg>` redirige **todos** los eventos siguientes —
incluido el `click` — al elemento que capturó. El `onClick` del `<circle>` deja de recibirlos.
Y la captura sobre el `<svg>` es correcta y necesaria (sin ella el paneo se corta: ver arriba),
así que no se puede revertir.

**Regla.** Con captura de puntero, el clic se resuelve en el **`pointerup`**: si el gesto no
superó el umbral de arrastre, es un clic, y se sabe sobre qué elemento empezó porque se guardó
en el `pointerdown`. Cualquier `onClick` de un hijo del elemento que captura es código muerto.

**Vive en:** `app/second-brain/Grafo.tsx` (`soltar`)

### Una flotación chica no se lee como flotar: se lee como que el texto tiembla

**Síntoma.** Los nodos «flotan mal», y sobre todo el texto: se ve tembloroso y sucio.

**Causa.** Con una amplitud de ~2 px de pantalla, el desplazamiento es sub-pixel y el navegador
**re-rasteriza la tipografía en cada frame**. Eso no se percibe como movimiento, se percibe
como ruido.

**Regla.** Dos cosas juntas: amplitud suficiente para que el movimiento sea intencional (acá
16 unidades de mundo, ~8 px de pantalla, con períodos de 7,1 s y 11,3 s), y `will-change:
transform` en el grupo que se anima, que lo promueve a su propia capa del compositor — así el
texto viaja como una imagen en vez de redibujarse. Sin lo segundo, subir la amplitud mejora
pero no limpia.

**Vive en:** `app/second-brain/Grafo.tsx` (`cbg-flota-x` / `cbg-flota-y`)

### Un radio de colisión grande es seguro SI dura solo el gesto

La regla de arriba dice que el radio de colisión del cliente no puede superar la separación
mínima en reposo (37) o la colisión pelea contra la casa para siempre. **La excepción es el
nodo que se está arrastrando**: mientras dura el gesto tiene `fx/fy`, así que no se mueve él —
mueve a los demás. Al soltar vuelve a su radio normal y todos regresan. Por eso
`colisionRadioArrastre` puede ser 150 sin romper nada, y es lo que hace que el mapa se abra al
paso del nodo en vez de empujar solo al que tiene pegado.

### La paleta del grafo no puede salir de los tokens semánticos

Los `--grafo-*` de `app/globals.css` existen porque sobre `#14161B` los semánticos de la app
quedan **por debajo** del gris base de un nodo: `--primary` 3,98:1, `--good` 5,24, `--bad`
4,25, contra 6,55 de `--sidebar-text`. Un nodo «marcado» con ellos se ve *menos* importante
que uno sin marcar. La paleta del grafo es claro-desaturada y se distingue por **tono**, no por
brillo. Diez es el techo: pasada esa cantidad una paleta cualitativa deja de leerse.

### La trampa que llega con la simulación viva: el hover que no se apaga

Cuando el grafo se mueve debajo de un cursor quieto, **`pointerout` no se dispara nunca** y el
nodo queda resaltado para siempre. Obsidian lo resuelve recalculando el hover **por frame**,
por distancia. Hoy acá no muerde porque durante el arrastre el resaltado es el nodo
arrastrado (el mismo `dragNode || highlightNode` de Obsidian), pero cualquier movimiento
autónomo que se agregue lo despierta.

### `forceCollide` cachea los radios: el radio de arrastre nunca existió

**Vive en:** `app/second-brain/fisica.ts` · **Se prueba con:** `scripts/probar-solape.mjs`

**Síntoma.** El dueño: «al arrastrar un nodo incluso puedo solaparlo con otro, eso no
debería pasar». Y era literal: medido con Playwright, arrastrando el nodo más conectado
del ws 11 a través del mapa, los círculos llegaban a pisarse **5,9 px**.

**El diagnóstico obvio era el equivocado.** Todo apuntaba a que la colisión era
demasiado blanda (`strength 0.7`) o a que el nodo iba clavado con `fx/fy` y por eso la
fuerza no podía correrlo. Las dos lecturas son ciertas *en abstracto* y las dos llevan a
tocar lo que no era: subir la fuerza a 1 tensa el reposo (el pad de 8 ya está contra su
techo, ver más arriba) y cambiar el clavado por un resorte hace que el nodo arrastrado
se quede atrás del cursor.

**Causa real.** `forceCollide` **no evalúa el radio por tick**. Lo calcula una sola vez,
en su `initialize()`, y lo guarda en un array
(`node_modules/d3-force/src/collide.js:74`). Ese `initialize()` corre cuando la fuerza se
registra en la simulación — momento en el que `agarrado` vale `null`. O sea que el
accessor

```ts
(d) => (d === agarrado ? FISICA.colisionRadioArrastre : d.r + FISICA.colisionPad)
```

se resolvía **una vez y para siempre por la rama normal**. `colisionRadioArrastre: 380`
—la constante que existe justamente para que «el mapa se abra a su paso»— **nunca se
aplicó una sola vez**. El nodo arrastrado empujaba con radio 8, como cualquier otro.

Lo peor del caso: la constante estaba ahí, documentada, con su comentario explicando por
qué vale 380. Leer el código daba la impresión de que el comportamiento existía.

**Arreglo.** Llamar a `.radius()` con el mismo accessor vuelve a correr `initialize()`
(línea 96 del mismo archivo). Es API pública y es el único gancho que hay. Se llama al
agarrar y al soltar.

**Medido, mismo escenario:** hueco mínimo entre bordes de **−5,9 px** (solape) a
**+89,9 px**. Con el radio vivo, el clavado con `fx/fy` es lo correcto y no hay que
tocarlo: d3 reparte la corrección **por el cuadrado de los radios**, así que con 380
contra 18 el vecino se lleva el 99,8% del empujón y el arrastrado no se frena.

**La regla que queda, y aplica a `manyBody`, `link` y `radial` igual:** **un accessor de
d3-force que dependa de estado que cambia no se recalcula solo.** Si el valor tiene que
cambiar durante la vida de la simulación, hay que re-inicializar la fuerza a mano. Un
accessor que lee una variable mutable *parece* reactivo y no lo es — y falla en silencio,
por la rama que estaba activa cuando se registró.

### Dos trampas de medición de este grafo, que dan números falsos

Las dos hacen que una prueba honesta reporte un defecto que no existe:

1. **Medir antes de que termine la entrada.** Los nodos entran con retardos escalonados
   de hasta 700 ms. Leer la posición «inicial» apenas aparece el SVG captura un fotograma
   de la animación, no la casa del nodo, y toda esa diferencia reaparece después como
   «deriva al soltar». En la misma corrida: 15,6 px de deriva midiendo temprano contra
   14,0 esperando a que asiente, y el hueco mínimo saltó de 46,8 a 89,9.
2. **La deriva al soltar NUNCA da cero, y no tiene que dar cero.** Los nodos **flotan**
   con 16 unidades de amplitud, que a la escala del encuadre son ~10 px. Un ~14 es el
   flote. Lo que habría que mirar es un 100+.

Y una tercera, para tocar el DOM del grafo desde una prueba: el primer `<circle>` de
`.cbg-cuerpo` es el **área de toque transparente** y es más grande que el nodo. Medir con
ese da solapes que no se ven. El que se dibuja es el segundo. El id sale de
`data-nodo`, que existe solo para esto: las clases son todas iguales y la posición la
reescribe el rAF, así que sin él no hay forma de seguir a UN nodo entre dos frames.

## La pantalla: hacer que el grafo sea el protagonista

### El `aspect-ratio` hacía que el lienzo creciera justo donde no entraba

**Vive en:** `app/second-brain/Grafo.tsx` (el bloque `<style>`)

**Síntoma.** El dueño mandó una captura: se veía el tercio de arriba del grafo.

**El diagnóstico obvio era el equivocado.** Se midió el layout primero y estaba bien:
43 nodos, separación mínima 96 unidades, ninguno fuera del encuadre. La conclusión
tentadora era «el lienzo es grande, hay que scrollear». Falso: el svg tenía
`aspect-ratio: 4/3` con `height: auto`, o sea que **el alto se derivaba del ancho**. En
1920 con la sidebar plegada eso da 1444×1083 sobre un viewport de 900. El lienzo crecía
**justo en el monitor donde más espacio hay**, que es exactamente al revés.

**Regla.** Un lienzo dentro de una página saca su alto del VIEWPORT, nunca del ancho:
`clamp(420px, calc(100svh - 280px), 760px)`. Y `svh`, no `dvh`: en mobile `dvh` cambia
cuando se esconde la barra del navegador, el lienzo se redimensiona a mitad del scroll
y el re-encuadre da tirones.

El 280 sale de MEDIR, no de estimar. La primera versión restaba 240 —sumando a mano el
padding, el header y la barra— y la grilla de abajo quedaba **9 px por debajo del
pliegue**: la pantalla terminaba justo donde terminaba el lienzo y mentía diciendo que
no había nada más. Con 280 asoman 31-41 px de la primera fila de tarjetas.

⚠️ Y NUNCA `height: 100vh` en el `<main>`: `flex: 1` implica `flex-basis: 0%` y le gana
al `height`, el main colapsa. Ya está documentado, pero acá reaparece la tentación.

### Bajar el lienzo SIN arreglar el encuadre lo empeora: son un solo cambio

**Vive en:** `app/second-brain/Grafo.tsx` (`ajustar()`)

`layoutCerebro` devuelve un encuadre **CUADRADO** (`lado`) y el `<svg>` no declaraba
`preserveAspectRatio`, o sea `xMidYMid meet`: el cuadrado entra por el lado **chico**.
Con el lienzo 4:3 eso ya desperdiciaba el 25% del ancho; con un lienzo apaisado de
1762×760 desperdiciaría el 60%. Bajar el alto sin tocar esto deja el grafo MÁS chico
que antes.

La salida es encuadrar **en el cliente** contra la caja medida (`ResizeObserver`),
usando el bbox real de los nodos con su radio. Medido después: el bbox ocupa el 92-95%
del lado corto en 1440×900, 1920×1050 y 1366×768, y el grafo entra entero en las tres.

Es una función y **tres** usos: el encuadre inicial, el botón «Ajustar a la vista» y el
centrado del buscador y de las conexiones.

⚠️ El re-encuadre automático se apaga en cuanto el usuario toca el zoom
(`tocoElZoom`). Re-encuadrarle el mapa a alguien mientras lo está mirando es peor que
dejárselo descuadrado.

### Tres bugs que solo aparecen cuando se cambia el encuadre

**Vive en:** `app/second-brain/Grafo.tsx`

1. **El paneo iba lento y nadie lo había notado.** `const escala = encuadre.lado /
   caja.width`. Con `meet` el factor real lo fija el lado **chico**, así que en un
   lienzo 4:3 el mapa se arrastraba al **75% de la velocidad del dedo** — lo justo para
   sentirse raro y no lo bastante para reportarlo. En un lienzo apaisado habría bajado
   al 40%. Fix de una línea: `Math.min(caja.width, caja.height)`. La rueda y el
   pellizco NO lo tenían: pasan por `aMundo()`, que usa la matriz real del SVG.
2. **`K_MIN`/`K_MAX` eran absolutos contra k=1**, que era el zoom de arranque cuando el
   mapa entraba por `preserveAspectRatio`. Con el encuadre nuevo el arranque puede ser
   k=1,8 y el usuario **no podía alejarse**. Pasan a ser relativos a `kFit`. No lo ve
   el typecheck: se ve como «el zoom se traba».
3. **El porcentaje mentía.** Salía de `kPaso`, que está cuantizado a cuartos
   (`Math.round(k*4)/4`), así que el mapa recién encuadrado marcaba **89%** sin que
   nadie hubiera tocado nada — se lee como que arranca mal puesto. Ahora sale del zoom
   real; 100% es el encuadre.

Y el mismo `kFit` hace falta en ESTADO además de en un ref: el fade de etiquetas se
calcula en el render y un ref no re-renderiza.

### El color del área Norte era el mismo dorado que «tu Norte»

**Vive en:** `app/globals.css` (los tokens `--grafo-*`)

`--grafo-norte` valía `#F2B01E`, que es **exactamente** `--mako`. El nodo `fase` se
pinta con `--mako` por `destacado`, y sus cuatro vecinos del área Norte con
`--grafo-norte`: el único nodo dorado con significado del mapa quedaba
**indistinguible** de cuatro nodos comunes. Y bajo deuteranopía `--mako` y
`--warn-fill` colapsan entre sí (1,14:1), con lo cual esa zona tenía tres clases que
para ~6% de los hombres eran dos.

**La regla que queda:** ningún área puede usar `--mako` ni `--warn-fill`. Esos dos
tonos están tomados por «tu Norte» y «tu cuello de botella», que se pintan por ESTADO,
no por área. `--grafo-norte` pasa a `#BFC8DC`.

### Datos que se calculaban, viajaban al browser y no los leía nadie

**Vive en:** `lib/cerebro-grafo.ts` → `app/second-brain/Grafo.tsx`

- **`AristaCerebro.motivo`.** Escrito con cuidado en las ~14 llamadas a `unir()` —«Este
  segmento compra por esta razón», «Un plano del panorama que MaKo escribió»—, con un
  tipo que dice literalmente «es lo que se lee al pasar por encima; si no se puede
  escribir, la arista no va». `grep motivo app/second-brain/` daba **cero**. El panel
  mostraba «5 conexiones» y tiraba los cinco motivos. Ahora es la lista.
- **`cerebro.vacias`.** El panel decía «Quedan N áreas sin construir» sin poder
  nombrarlas, porque no leía el array que se las estaba mandando. Y el número estaba
  **mal**: usaba `cuenta.pendientes`, que incluye el nodo RAÍZ, así que en un workspace
  nuevo decía «11 áreas» y áreas hay diez. No se arregló la frase: se borró el
  consumidor, porque cada tarjeta de área ya dice «Vacía» por su cuenta.

**La regla:** antes de agregar un dato al grafo, `grep` los que ya viajan. Salen gratis
y valen más que un área nueva.

### El `server-only` volvió a morder, y con el mismo disfraz

**Vive en:** `lib/cerebro-modelo.ts` (`AUTORIA_TEXTO`)

Para no copiar la tabla de «lo dedujo MaKo / lo escribiste tú», se la exportó desde
`lib/vault.ts` y se la importó en `Grafo.tsx`. **Typecheck verde, página 500**:
`vault.ts` lleva `server-only` y `Grafo` es un componente de cliente.

Es el mismo error que ya está documentado más arriba en este documento, cometido de
nuevo por una razón buena (no duplicar). La conclusión no es «no compartas»: es que el
lugar común de las dos orillas tiene que ser un módulo **puro**. `AUTORIA_TEXTO` vive
en `cerebro-modelo.ts`, que no importa nada justamente para eso.

### El README de adentro del ZIP contaba mal, y nada lo podía mirar

**Vive en:** `lib/vault-modelo.ts` (`readme`) · **Se prueba con:** `tests/vault.test.ts`

**Síntoma.** Se exporta el vault del ws 11 y se abre. El README dice «01 Norte — … (5
archivos)» y la carpeta tiene **3**. Todas las carpetas estaban infladas en uno; la del
Norte, en dos.

**Causa.** `readme()` contaba con su propio filtro escrito a mano —solo
`autoria !== 'pendiente'`— mientras `construirVault()` descarta además la RAÍZ y los
nodos de ÁREA, que son andamiaje del grafo y no archivos. Norte se iba de dos porque
ahí vive también la raíz. Dos filtros para la misma pregunta, y el que se usaba para
contar no era el que decidía qué se escribía.

**Por qué sobrevivió tanto.** `lib/vault.ts` llevaba `server-only`, así que **ningún
test lo podía importar**: no había una sola prueba sobre el único artefacto que el
cliente se lleva y abre en otro programa. Se descubrió abriendo el ZIP a mano, no
leyendo el código ni corriendo la suite.

**Regla.** Es la misma que AGENTS.md fija para los guards destructivos y para el
catálogo de modelos, y acá se paga otra vez: **lo que hay que poder testear no vive
detrás de `server-only`.** La proyección pura se mudó a `lib/vault-modelo.ts` (sin la
marca) y `lib/vault.ts` quedó como la puerta que la reexporta, así que los
importadores de siempre no cambian y la guarda de bundle se mantiene.

Y la regla de fondo: **un índice que cuenta distinto que la carpeta que describe es
peor que no tener índice.** Si dos lugares cuentan lo mismo, uno llama al otro.

### Lo que quedó sin hacer, medido

- **El grafo deja ~370 px de aire vacío a cada lado.** Es geométrico: el layout del
  servidor produce un bbox cuadrado (551×623 medido en el ws 11) y el lienzo es
  apaisado (1282×620). El grafo llena la ALTURA al 94% y no puede llenar el ancho. La
  única salida es un layout elíptico de ~2:1 tocando `RECETA` en
  `lib/cerebro-layout.ts`, y el costo es alto: **cambia el mapa de todos los clientes**
  e invalida la línea base de `scripts/medir-grafo.mjs`. No es un ajuste, es otro
  layout. Decisión del dueño.
- **Las etiquetas se pisan en el racimo más denso.** Y ojo con el arreglo fácil:
  atenuarlas todas (bajar el techo de `alphaEtiqueta`) las hace más difíciles de leer
  **sin resolver el solape**. Se probó y se revirtió. La salida real es no dibujar una
  etiqueta cuando su caja choca con otra ya dibujada.
- **El layout se recalcula en CADA carga** (`force-dynamic` + `revalidate: 0`) y
  `lib/cerebro-layout.ts` ya devuelve la `huella` para poder cachearlo. ⚠️ Este punto
  decía que persistirlo era un prerrequisito del funnel; se midió y era falso — ver
  «CORRECCIÓN: persistir el layout NO era un prerrequisito» más abajo. Sigue siendo lo
  correcto cuando un workspace real pase de 80 nodos.
- ~~**El funnel todavía no está en el grafo**~~ — HECHO, junto con el arreglo del canal
  del que dependía. Ver «El funnel adentro del grafo» más abajo y la entrada del canal
  en `docs/hallazgos-crm.md`.
- **El brief entra al grafo por cuatro listas hardcodeadas** (`CAMPOS_NORTE`,
  `CAMPOS_OFERTA`, `CAMPOS_CLIENTE`, `CAMPOS_MARCA` en `lib/cerebro-grafo.ts`) mientras
  `getSchema()` lee el esquema VIVO del workspace. O sea: se le agrega un campo al
  brief de un cliente, el cliente lo contesta, el dato alimenta los prompts… y **no
  existe** en el mapa que dice «todo lo que MaKo sabe de tu negocio». Sin error y sin
  aviso. Es el molde exacto del bug del parser del panorama.

## El funnel adentro del grafo

### `scripts/medir-grafo.mjs` se quedó ciego y no lo dijo

**Vive en:** `scripts/medir-grafo.mjs`

**Síntoma.** Se corre el verificador después de sumar el funnel y devuelve `nodos 0`,
`densidad Infinity`, `NaN` en cuatro métricas y finalmente un `TypeError`.

**Causa.** Su parser pedía `<circle cx="…" cy="…" r="…" fill="…">`. Cuando el dibujo pasó
a mover los nodos con un `transform` en el `<g>` que los envuelve, los círculos se
quedaron sin `cx`/`cy` y la expresión dejó de matchear. **No falló: informó cero.**

**Por qué importa más de lo que parece.** Este script existe porque, textual en este
mismo documento, «la casa dio por bueno DOS VECES un grafo que estaba mal porque se veía
parecido». Un verificador que devuelve 0 en silencio es peor que no tenerlo: da la pinta
de haber corrido. Y estuvo roto desde el rediseño del dibujo hasta que alguien lo usó de
verdad — o sea que las capturas intermedias se aprobaron a ojo, que es exactamente lo que
venía a impedir.

**Regla.** El parser ahora sale con error explícito si lee 0 nodos, en vez de seguir y
escupir `NaN`. Y saca el id de cada nodo de `data-nodo`, así que la próxima vez que el
marcado cambie el mensaje dice dónde mirar. **Una herramienta de verificación que puede
devolver «todo bien» sobre una entrada vacía no es una herramienta de verificación.**

### Qué entra del funnel y qué no: 17 etapas no son 17 nodos

**Vive en:** `lib/cerebro-grafo.ts` (el bloque «El FUNNEL»)

`generateFunnel` produce 17 etapas para high-ticket, 11 para simple y directa. No entran
todas:

- **Fuera las tres salidas fijas** (Perdido · Descalificado · No responde). Son catálogo
  de MaKo: bit a bit iguales en las cuatro plantillas y en todos los workspaces. Es la
  misma regla que ya excluye los 14 formatos de la biblioteca — «el catálogo de MaKo no
  es del cliente».
- **Fuera «Nutrición - Manual»**, y este es el motivo más fuerte: `generateFunnel` la
  coloca siempre pero **no emite ni una transición hacia ella ni desde ella**. Sería el
  único nodo huérfano del mapa. Colgarla del área sería peor: parecería conectada sin
  significar nada.

Quedan 13 en high-ticket y en vsl, 7 en simple y directa. Y **no son las mismas entre
plantillas**: `directa` genera «No pagó» y no genera «No Show R1». Eso es justamente lo
que hace que el funnel valga como dato del negocio y no como decoración.

### Las transiciones vienen DUPLICADAS por par, y `unir()` no deduplica

**Vive en:** `lib/cerebro-grafo.ts`

`generateFunnel` emite ida **y** vuelta entre los mismos dos nodos: `agenda → No Show R1`
y `No Show R1 → agenda`, `facturando → No pagó` y la vuelta. Medido: 5 pares duplicados
en high-ticket, 4 en vsl, 3 en simple, 1 en directa.

Un par duplicado rompe cuatro cosas distintas, todas silenciosas: mete **dos resortes** en
`forceLink` —ese par queda al doble de tensión y se pega en el dibujo—, dibuja dos líneas
una encima de la otra, **infla la densidad que mide el verificador** (cuenta líneas, no
pares) y hace que el panel cuente dos veces al mismo vecino. Se funden por par **no
ordenado**, juntando los dos motivos en una frase.

**Regla general:** `unir()` no deduplica. Cualquier fuente que pueda emitir la relación
en los dos sentidos tiene que fundirse antes de entrar.

### El nodo de área NO se lleva las etapas de nutrición, y sin esa excepción el hub se rompe

**Vive en:** `lib/cerebro-grafo.ts` (el bloque «Las ÁREAS como nodos»)

El bloque de áreas cuelga todo nodo real de su área. Aplicado al funnel —13 etapas, todas
en `norte`— le lleva el grado de `area:norte` de 5 a 22 y la convierte en el nodo más
conectado del mapa, por encima de la raíz: **el hub pasa a 5,5× contra el umbral de 4,5×**.

La excepción es que solo cuelgan de su área las etapas de la fila **Activo**. Y no es un
parche métrico: el racimo del funnel ya lo hace **su propia cadena**, que es para lo único
que existe el nodo de área. Con eso el hub queda en 3,5×.

⚠️ Esta excepción **deroga** la regla del bloque de áreas y por eso lleva su comentario al
lado. Sin él se lee como un olvido, alguien lo «arregla», y el hub vuelve a 5,5× sin que
nada avise: el typecheck no lo ve y **no hay ningún test que mida topología**.

### El antes y el después, medido — incluido lo que empeoró

Sobre el ws 11, con `scripts/medir-grafo.mjs`:

| | sin funnel | con funnel |
|---|---|---|
| nodos · aristas | 50 · 87 | 61 · 105 |
| densidad | 1,74 | 1,72 ✓ |
| hojas | 2% | 7% ✓ |
| hub | 3,4× | 3,5× ✓ |
| clustering | 0,15 | **0,21** ✓ |
| componentes | 1 | 1 ✓ |
| CV del radio | 0,39 | 0,41 ✓ |
| bins vacíos | 4/36 | 6/36 (ver la corrección abajo) |

El clustering sube un 40%: era el objetivo, el funnel es la única cadena que tiene el
negocio.

⚠️ **CORRECCIÓN, y la escribo porque el error lo cometí acá.** Esta entrada decía que
«los bins vacíos se pasan del umbral» y lo dejaba anotado como una deuda del layout. Las
dos mitades están mal:

1. **El umbral ≤4 es estadísticamente imposible de cumplir con pocos nodos.** Es un
   problema de coleccionista de cupones: con `n` ángulos **uniformes** sobre 36 bins,
   E[vacíos] = 36·(35/36)^n. Simulado con 60.000 corridas: n=42 → mediana **11** ·
   n=61 → 6 · n=80 → 4 · n=100 → 2. O sea que a n=61 el umbral suspende a un grafo
   perfectamente isótropo, y **solo se vuelve alcanzable a partir de n≈78**.
2. **El «caso radial» que este umbral vino a cazar daba 11/36 con 42 nodos — que es
   exactamente la mediana del azar.** La métrica nunca cazó nada. Lo que sí detectó el
   layout radial fue el **CV del radio** (0,30).

Medido después con el test de Rayleigh, que **no depende de n**: ws11 R₁=0,095 p=0,58 ·
R₂=0,186 p=0,12 · R₁₀=0,044 p=0,89. Los tres armónicos importan —el 1.º cazaría «todo
corrido hacia un lado», el 2.º una elipse, y el 10.º es justamente el que cazaría las
DIEZ CUÑAS del layout radial viejo— y ninguno dispara. El grafo de hoy es angularmente
**indistinguible de isótropo**.

**La regla que queda, y vale para cualquier umbral que se escriba de nuevo: un umbral
que cambia de veredicto según cuántos datos tenga el cliente no es un umbral.** Antes de
fijar uno, simulá el modelo nulo. Este suspendía a los clientes chicos y aprobaba a los
grandes, y en el medio nos hizo escribir una deuda que no existía.

### CORRECCIÓN: persistir el layout NO era un prerrequisito

**Vive en:** `lib/cerebro-layout.ts`

Una versión anterior de este documento afirmaba que sumar el funnel «cruza los ~80 nodos
donde la tabla mide 300 ms» y que **persistir el layout dejaba de ser opcional antes de
agregarlo**. Es falso, y las dos mitades lo son:

- la aritmética no cierra — 43 + 13 = 56, no cruza 80;
- y el tiempo tampoco. Medido con `layoutCerebro` real: **43 nodos 117 ms · 50 → 112 ms ·
  58 → 141 ms · 68 → 167 ms · 80 → 215 ms · 100 → 270 ms · 150 → 451 ms**. El funnel
  cuesta ~30 ms por carga.

La lección no es sobre el funnel: es que **un número heredado de otro documento no es una
medición**. Persistir sigue siendo lo correcto cuando un workspace real pase de 80 nodos
—la `huella` ya se calcula y no la consume nadie—, pero no bloqueaba esto.

### Lo que quedó sin hacer acá

- **No hay ningún test que mire la topología del grafo**, y no se puede escribir hoy:
  `lib/cerebro-grafo.ts` lleva `server-only`, así que ningún test lo puede importar. Es
  el mismo agujero que ya se pagó con `lib/vault.ts` y el README que contaba mal, y la
  salida ya está probada: mover la parte pura a un módulo sin la marca. Mientras tanto,
  todo lo medido acá se puede romper en un commit posterior sin una sola señal roja.
- **Cambiar el pipeline cambia los ids de los nodos** (`etapa:<key>`) y por lo tanto la
  huella del layout: el mapa entero se reacomoda cada vez que el cliente toca el editor
  del funnel. El camino incremental de `layoutCerebro` (el parámetro `previo`) existe,
  está testeado y no lo llama nadie — este es el primer caso de uso que lo justifica.
- **El área Norte pasó a ser el 21% del mapa** (`gris uniforme` la reporta como color
  dominante). Es consecuencia directa de que el funnel viva ahí. Se ve bien porque
  `--grafo-norte` es un gris azulado desaturado, pero si algún día se le sube la
  saturación, un quinto del lienzo se pinta de un solo tono.

## El lienzo: lo que se ve y lo que se toca

### Las etiquetas se dibujaban a 4,32 px y el zoom NO las agrandaba

**Vive en:** `app/second-brain/Grafo.tsx` (el `font-size` de `.cbg-et` y `--u`)

El CSS declaraba `font-size: calc(12px / var(--k,1))`. Parece correcto y no lo es: el
`<g>` se escala **dos veces** —por el zoom del paneo (`--k`) y por la escala del
viewBox— y el CSS compensaba solo la primera. El `/k` se cancelaba y el neto era
**12 × 0,36 = 4,32 px CONSTANTES a cualquier zoom**. Medido a k=1,16 y a k=4,40: 4,32 px
las dos veces.

Lo grave no es el tamaño: es que **acercarse no servía para nada**, y ese es el único
mecanismo con el que Obsidian hace legible un racimo denso.

⚠️ **Y arreglar el tamaño SOLO deja la pantalla peor.** Con el texto a su tamaño real
aparecen 17 pares de etiquetas pisadas que la ilegibilidad venía tapando. Los dos
cambios son uno: tamaño + descarte por colisión en orden de grado descendente. Por
render condicional, nunca con `opacity: 0` — este documento ya midió que un nodo
invisible cuesta lo mismo que uno dibujado.

Los factores de la caja salen de **medir la real en el navegador**: el alto renderizado
de una etiqueta de 12 px es **16 px**, porque la caja incluye el interlineado. Con el
1,15 estimado quedaban 10 pares pisados.

**Medido, ws11 a 1440×900:** al encuadre 39 de 61 etiquetas y **0 pares pisados**;
acercado, 61 de 61 y **0 pares**. Que es el comportamiento de Obsidian.

### El centro de lo visible NO es «medio ancho visible»

**Vive en:** `app/second-brain/Grafo.tsx` (`irA`)

El viewBox es **cuadrado** y entra con `xMidYMid meet`: se escala por el lado corto y se
**centra** en el largo, o sea que lo visible se extiende más allá del viewBox por los dos
costados en partes iguales. El centro es el del viewBox, no `encuadre.x + anchoVisible/2`.

Con la fórmula mal, el nodo quedaba **317 px a la derecha** del centro. `ajustar()` ya lo
hacía bien; `irA` no — así que el buscador venía «centrando» nodos y dejándolos corridos
desde antes de que existiera el vuelo de cámara. La regla: cuando dos funciones calculan
lo mismo, la que se escribió después no se deduce, se copia de la que ya funciona.

### Dos trampas de popover que invalidan los patrones de la casa dentro del lienzo

**Vive en:** `app/components/Dropdown.tsx` (`portalTo`) · `app/second-brain/Grafo.tsx`

1. **La pantalla completa mata el portal.** Cuando un elemento entra al *top layer* con
   `requestFullscreen()`, **todo lo que esté fuera de ese subárbol deja de pintarse** —
   incluido un portal a `document.body`. El menú se abre, existe en el DOM, responde al
   teclado… y no se ve. Sin error y sin warning. Por eso `Dropdown` tiene `portalTo`.
2. **El `overflow: hidden` del marco mata el popover absolute**, que es el otro patrón de
   la casa. Entre las dos, adentro de un lienzo con pantalla completa no sirve ninguno de
   los dos por defecto.

### El recorte cortaba texto sin dejar forma de verlo

**Vive en:** `app/second-brain/Grafo.tsx`

El clamp recortaba por **líneas** (`WebkitLineClamp: 6`) y el botón «Leer todo» se
decidía por **caracteres** (`> 320`). Entre los ~270 y los 320 caracteres el texto se
cortaba y **no había ningún botón** para verlo entero: se perdía, en silencio.

**La regla:** el que recorta y el que ofrece ver más tienen que mirar **la misma
señal**. Si uno mide líneas y el otro caracteres, hay una banda donde el contenido
desaparece.

## Los datos del grafo

### El hueco no estaba donde parecía: catálogo disfrazado de dato del cliente

**Vive en:** `lib/cerebro-grafo.ts`

Contra el pedido «faltan muchísimos datos», el inventario de las 67 tablas por workspace
dio tres categorías, y la que engaña **no es el volumen**:

- **VOLUMEN** (13.217 mensajes de WhatsApp en un cliente, 6.151 eventos de VSL, 1.187
  leads): obvio, y ni agregados aportan un nodo. Cuántos leads hay parados en una etapa
  es un **dato de esa etapa**, no un nodo aparte.
- **CATÁLOGO DE MAKO DISFRAZADO**: las once secuencias de nutrición de tres workspaces
  distintos son la **misma semilla bit a bit**, y las categorías del tablero son
  literalmente el catálogo. Parecen datos del negocio y son los nuestros. Por eso de las
  secuencias entran **solo las activas**.
- **ACTIVIDAD, no conocimiento**: lo que el negocio está probando es la salida de otra
  pantalla.

**El criterio que quedó:** una fuente entra cuando trae **al menos una arista lateral por
nodo que suma**; si no puede, entra **agregada en un solo nodo**; si ni siquiera se le
puede escribir el `motivo`, no entra. Las aristas laterales son el ingrediente escaso —
sin ellas el grafo vuelve a ser un árbol y ninguna física lo salva.

Y el tope no es el tiempo: **es el porcentaje de hojas**. Los 22 términos del glosario
serían 22 hojas de grado 1 de un saque, ~21% del mapa colgando de un solo lugar. Por eso
van agregadas.

### Un área suelta del resto NO es un bug, y «arreglarlo» rompió un umbral real

**Vive en:** `lib/cerebro-grafo.ts` (el comentario del bloque de áreas)

Al sumar las fuentes nuevas, un workspace que nunca contestó el quiz de personalidad
quedó con su área «Voz y cara» flotando suelta: sin el nodo `voz` que recibiera las
aristas, los cinco nodos nuevos colgaban solo de su área. El verificador pasó de 1
componente a 2 — **con cero huérfanos**, así que el chequeo de huérfanos no lo hubiera
visto nunca.

Se tendió un puente del nodo de área a la raíz. **Se revirtió**, por dos razones medidas:

1. `scripts/medir-grafo.mjs` **no marca `componentes` como falla**, y su propio comentario
   dice que «las islas son parte del look de Obsidian». No había nada que arreglar.
2. El puente le suma radios a la raíz: el hub de un workspace real pasó de **4,3× a 4,6×**
   contra un umbral de 4,5×. El arreglo de un no-problema rompió un umbral que sí existe.

Y la isla **dice algo cierto**: esa parte del negocio todavía no se conecta con el resto.

### El detalle del nodo era un string plano, y por eso el copy era pobre

**Vive en:** `lib/cerebro-modelo.ts` (`datos`, `cuerpo`)

El síntoma que se reportó fue «los textos están muy resumidos». La causa raíz es que
`NodoCerebro.detalle` era **un solo string** y todos los productores lo armaban con
`.join(' · ')`. Con un campo único, cada uno tenía que elegir entre **tirar datos** o
escribir un renglón corrido ilegible — y eligieron tirar. Se descartaban campos reales en
**11 de los 17** tipos de nodo.

El peor caso era el Norte: `FaseDef` tiene **quince campos** y el nodo mostraba **uno**.
Qué funnel corresponde, cómo repartir la inversión, qué no conviene hacer todavía: todo
escrito, viajando al browser, sin leerse.

**La regla:** cuando un campo de texto recibe información que tiene ESTRUCTURA, la
estructura se pierde en el primer `join`. Un nodo tiene tres campos con tres trabajos —
la frase que lo define, los pares nombre/valor, y la prosa larga — y el ZIP lleva los
tres, o el archivo dice menos que la pantalla.

### Un producto dado de baja se dibujaba como vigente

**Vive en:** `lib/cerebro-grafo.ts` · `lib/productos.ts`

`construirCerebro` llama `listProductos()` sin argumento y `soloActivos` es `false` por
defecto. En una pantalla cuyo argumento entero es «esto es tuyo y está al día», eso no es
una omisión: **es información falsa**. Ahora lo dice en sus datos.

## Lo que quedó sin hacer

- **La búsqueda por IA** del plan no se trajo: con 60-100 etiquetas a la vista no se
  justifica el costo por consulta. Tendría caso para buscar por el CONTENIDO de los
  detalles («dónde dice cuánto cobro»), que es semántico y no textual. Vive en
  `app/plan/board/BuscadorTareas.tsx` + `/api/plan-buscar`.
- **El brief sigue entrando por cuatro listas hardcodeadas** (`CAMPOS_NORTE`,
  `CAMPOS_OFERTA`, `CAMPOS_CLIENTE`, `CAMPOS_MARCA` en `lib/cerebro-grafo.ts`) mientras
  `getSchema()` lee el esquema vivo. Hoy es **latente** —ningún workspace tiene esquema
  propio— pero la UI de /onboarding ya tiene `addField`: el primer cliente que agregue un
  campo lo activa en silencio. Es el molde del bug del parser del panorama.
- **El local graph** (re-encuadrar sobre el vecindario a 2 saltos al fijar) es la
  alternativa BARATA al layout elíptico y resolvería el 56-67% de lienzo vacío sin tocar
  `RECETA` ni cambiarle el mapa a todos los clientes. Vecindario medido a 2 saltos: 14
  nodos, 23-25% del mapa, que es también el default de Obsidian.
- **`gris uniforme ≥ 85%` viene en ✗ en los cuatro workspaces** y nadie lo mira: el
  código pinta las diez áreas y el documento afirma lo contrario. Hay que elegir una de
  las dos y renombrar el check. Vive en `scripts/medir-grafo.mjs` y `app/globals.css`.
- **La `huella` del layout sigue sin consumidor** y se recalcula en cada carga. No urge
  —medido, 141 ms con 58 nodos— pero el camino incremental de `layoutCerebro` (el
  parámetro `previo`) existe, está testeado y no lo llama nadie.
- **`ang:<anguloId>`** (el ángulo de los guiones) quedó sin implementar: replicaría el
  mecanismo de `fmt:` que ya funciona. 🚨 Al hacerlo, NUNCA unirlo con `fmt:` — son tres
  catálogos con nombres parecidos y espacios de ids distintos, y una arista con un id que
  no matchea simplemente no se dibuja, en silencio.

### El panel no estaba mal diseñado: un selector abierto lo rompía

**Vive en:** `app/second-brain/Grafo.tsx` (la clase `.cbg-mapa`)

**Síntoma.** «Está MUY mal diseñado el detail de cada nodo.»

**Causa.** `.cbg svg { width: 100% }` estaba escrito para el lienzo, pero matchea **todos**
los `<svg>` de adentro del componente — incluidas las flechas de 13×13 de cada conexión
del panel y el chevron de «Leer todo». **Un `width:100%` de una hoja de estilos le gana
al atributo `width="13"`**, porque los atributos de presentación tienen la especificidad
más baja que existe.

Medido a 1500×950: la flecha computaba **270 px**, se quedaba con 270 de los 286 de la
fila, y dejaba el texto de la conexión en **cero** — desbordaba y partía una palabra por
renglón. El `scrollHeight` del panel era **1463 px sobre una caja de 644**. Después:
flecha 13, texto 235, panel **510 — entra entero**.

**La regla:** un selector de dos partes adentro de un componente que además contiene
íconos es un selector **abierto**. El lienzo se **nombra** con una clase; nunca
`.componente svg`.

⚠️ Y el orden importa: si se rediseña el panel sin arreglar esto primero, la mejora se le
atribuye al rediseño y la regla no queda escrita en ningún lado.

### Filtrar apagaba los nodos y dejaba intacta la telaraña

**Vive en:** `app/second-brain/Grafo.tsx` (`visible()`)

Con un filtro puesto: 47 de 67 nodos atenuados… y **las 119 líneas y las 49 etiquetas
seguían a opacidad plena**. Se apagaban los puntos y quedaba la telaraña, que es el ~70%
de la tinta de la pantalla — por eso «no parecía filtrar».

**Causa:** tres criterios distintos para tres cosas que son la misma pregunta. El de las
aristas miraba el nodo en foco y el área, e ignoraba el filtro de autoría y la búsqueda.

**La regla:** **un solo predicado, tres consumidores** — el nodo, sus aristas (se dibuja
solo si sus DOS puntas pasan) y su etiqueta. Y el descarte por colisión se calcula sobre
lo que PASA el filtro: al filtrar se libera espacio y aparecen más nombres, que es lo que
uno espera.

### La jerarquía gobierna el zoom, y el fade viejo hacía lo mismo peor

**Vive en:** `app/second-brain/Grafo.tsx` (`entraPorNivel`)

Las cinco carpetas madre nunca pierden el título; las áreas se van al alejarse a la mitad;
los datos, apenas uno se aleja. Encima sigue el descarte por colisión.

Se **quitó** el fade de Obsidian (`clamp(log2(zoom)+1)`) y conviene saber por qué para no
reponerlo: hacía el mismo trabajo con menos información. Superpuestos se anulaban — el
fade apagaba **todo** por debajo del encuadre, incluidas las carpetas madre, que son
justamente las que no tienen que desaparecer nunca.

Y una trampa: el umbral usaba `kPaso`, que está **cuantizado a cuartos** para el fade. Con
eso el encuadre caía del lado equivocado y el mapa arrancaba con 13 nombres de 72. El
umbral usa el zoom real.

### Desaparecer no es `opacity: 0` — hay que desmontar, pero después

**Vive en:** `app/second-brain/Grafo.tsx` (`saliendo`)

La animación de salida es la de entrada al revés y más corta (240 ms contra 420): al
filtrar uno quiere ver el resultado, no la despedida. El nodo **se desmonta** al terminar
— quedarse en `opacity: 0` cuesta lo mismo que dibujarlo, y eso ya está medido más arriba
en este documento.

El patrón: una lista de «los que se están yendo» que mantiene el nodo montado con una
clase mientras dura la animación, con el temporizador **cancelable** — desfiltrar a mitad
de camino tiene que devolverlo, no dejarlo a medias.

### El marco topea su ASPECTO, no su ancho

**Vive en:** `app/second-brain/Grafo.tsx` (`.cbg-marco`)

El alto salía del viewport (correcto) pero el ancho se tomaba todo, así que **cuanto más
grande el monitor, más buzón**: 2,07:1 en 1440 y **3,16:1 en 2560**, con el grafo llenando
46% y **31%** del ancho. A lo alto llenaba 92-95% en las cinco tallas medidas, o sea que
el problema nunca fue el alto.

Con `max-width: calc(var(--cbg-alto) * 1.6)`: 1,6:1 en las dos, llenando 60% y 61%. El
grafo **dibujado** no cambia de tamaño —lo fija el alto—: cambia el encuadre, que es lo
que se ve. No toca el layout del servidor ni la línea base de `medir-grafo`.

### Un área con exactamente UN dato caía por un hueco entre dos reglas

**Vive en:** `lib/cerebro-grafo.ts`

El nodo de área no se crea con menos de 2 miembros, y el nodo `falta:` solo se crea cuando
el área tiene CERO. **Un área con exactamente uno no recibe ninguno de los dos** y
desaparece del mapa. No falla nada y no hay error: medido, faltaba al menos un área en los
cuatro workspaces.

No se baja el umbral —un nodo de área con un miembro tiene grado 1, o sea una hoja nueva, y
es el mecanismo que ya rompió una métrica—. Lo resuelve la jerarquía: **el padre adopta a
los huérfanos**, uniéndose directo a los miembros sueltos de las áreas que no llegaron a
tener nodo propio.

### La barra de búsqueda: lo que se porta y lo que no

**Vive en:** `app/second-brain/BuscadorCerebro.tsx` · `lib/buscar-cerebro.ts` ·
`app/api/second-brain/buscar/route.ts`

Es la barra del tablero (`app/plan/board/BuscadorTareas.tsx`) portada al mapa. Se **porta**
y no se reusa tal cual porque aquella recibe y devuelve campos de una TAREA; lo que sí se
comparte es lo que importa: el matcheo sale de `coincide`, así que las dos búsquedas se
comportan igual ante las mismas palabras.

Tres detalles del original que valen y que es fácil perder al portar:

- **El ✦ de MaKo aparece SOLO con algo escrito.** Un botón de IA siempre visible invita a
  apretarlo sin necesidad, y cada apretada es una llamada al modelo.
- **La flechita va en SVG, no como el carácter «⌄».** Ese glifo se dibuja pegado al techo
  de su caja, así que por más que el botón centre con flex se ve corrido hacia arriba. Un
  path se centra de verdad y además gira al abrir.
- **El chip dice DÓNDE se está buscando.** Sin él, ampliar a «el contenido» hace aparecer
  el triple de resultados y parece que el buscador se rompió.

**Lo que NO se portó, con su razón:** el tablero recorta el detalle a 120 caracteres por
tarea porque con 500 tareas el prompt se iba a 58k tokens. Acá el mapa tiene 60-120 nodos:
el detalle entra ENTERO y recortarlo perdería justo lo que hace útil la búsqueda
semántica.

**Y una trampa propia del lienzo, que el tablero no tiene:** el marco lleva
`overflow: hidden` (un panel `absolute` se recorta) y puede entrar en pantalla completa
(un portal a `document.body` deja de pintarse, sin error). Por eso el portal del panel es
parametrizable — el mismo problema que ya obligó a agregarle `portalTo` al Dropdown.

**El contador y el dibujo salen del mismo cálculo, y eso hubo que arreglarlo:** al ampliar
los campos, el contador decía 14 y el mapa seguía mostrando 5, porque `campos` no estaba
en las dependencias del montaje. Un contador que no coincide con lo que se ve es peor que
no tenerlo.

**⚠️ Deuda (16/09/2026): la búsqueda «por significado» vive entera adentro de la ruta.** El
prompt (`SYSTEM`) y la lógica —armar la lista de nodos, llamar a la cascada, filtrar los ids
contra los reales— están inline en `app/api/second-brain/buscar/route.ts`, y el prompt no es
editable desde /configuraciones. Por eso no pudo sumarse a la API de MaKo:
`buscar_en_segundo_cerebro_por_significado` quedó afuera, anotado en la cabecera de
`lib/api-mako/areas/negocio.def.ts`. Un segundo canal que encuentra la lógica en una ruta la
copia o no la ofrece. Para que exista, primero va a `lib/` con el prompt editable (skill
`add-editable-prompt`), y la ruta pasa a llamarla.

## El vault: el segundo cerebro como carpetas y archivos

### El veredicto del modelo: proyección y exportación, NO almacenamiento

El pedido fue «trabajalo como lo hace Obsidian, que son carpetas y archivos». Se hizo
como **proyección** (el árbol navega) y **materialización** (el ZIP se lo lleva). Las
filas siguen siendo filas.

**Por qué no se mudó todo a markdown, con la cicatriz ya pagada en este repo:** el
panorama es el ÚNICO dato del second brain que hoy se guarda como markdown, y es el
único que perdió el 83% de su contenido sin que nada avisara (ver el parser, arriba).
Mover `productos` —con el que el CRM cierra ventas y calcula MRR— a `.md` repite ese
experimento sobre las filas que sostienen el negocio: se pierden el JOIN, la suma, las
RLS por `workspace_id` y la concurrencia de dos personas editando lo mismo.

**Y la distinción que destraba «la info que pones es muy limitada»:** no es un problema
de almacenamiento, es de **cobertura**. `construirCerebro()` hace doce lecturas y el
sistema tiene ~70 tablas por workspace. Cambiar el motor de guardado suma cero archivos.
De ahí sale la separación que antes no existía: el **grafo** dibuja identidad y se queda
chico y legible · el **árbol** navega todo y puede tener miles de archivos · el **ZIP**
se lleva el árbol entero. Eran la misma cosa y no lo son.

**Vive en:** `lib/vault.ts` · `app/api/second-brain/exportar/route.ts`

### Dos nodos con el mismo id: el bug que encontró el export y que rompía el grafo

**Síntoma.** El ZIP salía con dos archivos menos de los que decía. Ninguna excepción.

**Causa.** `canonPlano` mapea sinónimos al mismo nombre para que las aristas laterales
encuentren su destino aunque el panorama esté guardado con un molde viejo. Pero dos
secciones **distintas** del mismo panorama pueden caer en el mismo canónico —«NICHO O
MERCADO ESPECÍFICO» y «NICHO Y MERCADO» van las dos a «NICHO Y MERCADO»—, y ahí quedan
**dos nodos con el mismo `id`**.

Eso no rompe el parser: rompe **todo lo que indexa por id**. Las claves de React, el
`Map` de posiciones del layout, el destino de las aristas. Y en silencio.

**Regla.** Cualquier función que derive un id de un texto normalizado necesita una
guarda de unicidad al lado. Y el detector barato es el export: **si dos nodos producen
la misma ruta de archivo, hay dos nodos con el mismo id.** Fue un ZIP con dos archivos
de menos lo que sacó a la luz un bug del grafo.

**Vive en:** `lib/cerebro-grafo.ts` (`idsPanorama`)

### Un enlace `[[wiki]]` roto es peor que ninguno

**Síntoma.** El vault salía con enlaces a «Norte» y al nombre del negocio, que no
existen como archivo.

**Causa.** Los vecinos de un nodo se enlazan todos, pero la raíz es el README y los
nodos de área son la carpeta: ninguno de los dos es un archivo. En Obsidian un enlace
que no resuelve se pinta como un **nodo fantasma**, así que el export ensuciaba el grafo
con cosas que no existen — el opuesto exacto de lo que viene a mostrar.

Y el enlace tiene que usar el nombre **ya desambiguado**: cuando dos nodos se llaman
igual (hoy pasa con «Oferta», que existe como campo y como plano del panorama) el
segundo archivo se llama «Oferta 2», y un `[[Oferta]]` en su vecino resuelve al primero.
Un link que apunta a un archivo REAL pero equivocado es la peor forma de estar roto.

**Regla.** Los nombres se resuelven en una primera pasada sobre TODOS los nodos, y los
cuerpos se escriben en una segunda. Y el chequeo que hay que correr: **cero enlaces que
no resuelvan** — verificado en los cuatro workspaces reales (56 a 74 enlaces cada uno).

**Vive en:** `lib/vault.ts` (`construirVault`, las dos pasadas)

## Lo que quedó sin hacer

- **El reporte de sesiones sigue siendo solo de Claude Code**: el hook es un `Stop` de
  `.claude/settings.json`, así que desde la app de Claude la skill funciona pero no
  reporta. El texto del consentimiento lo nombra bien, pero conviene revisarlo si la
  integración se sigue generalizando. Vive en `lib/agente-consentimiento-texto.ts`.
- **Un test es INTERMITENTE en este clon**: en dos corridas dio `1 fail` y en cinco
  seguidas dio limpio, sin poder capturarse cuál. Coincide con que la otra cuenta estuvo
  agregando tests (476 → 502 en una sesión). No es de Grafo.tsx ni de FiltroMapa.tsx,
  que no tienen test propio.

- **El visor de documentos sigue pintando blanco sobre el lienzo oscuro**: el `<iframe>`
  de un PDF y el fondo de una `<img>` los pinta el navegador y no se pueden tematizar
  desde acá. Vive en `app/second-brain/Grafo.tsx` (`.cbg-visor`).
- **`scripts/medir-grafo.mjs` no mide contraste**, ni de arista ni de etiqueta contra el
  fondo. En claro no importaba; con el lienzo oscuro es el chequeo que faltaría para que
  la herramienta no pueda decir «todo bien» sobre un mapa ilegible.
- **El regex de «nodos de acento» del mismo script es `/mako|warn/`**: un acento pintado
  con `--primary` no lo cuenta, y sobre oscuro `--primary` da 3,3:1 (ilegible). Ampliar el
  regex, no el umbral.

- **La versión oscura del lienzo** quedó pendiente y es un cambio de CUATRO variables, no
  de cada regla: `--cbg-fondo`, `--cbg-texto`, `--cbg-tenue` y `--cbg-linea` en `.cbg`
  (`app/second-brain/Grafo.tsx`). Todo lo demás ya las consume.
- **El detalle y el navegador comparten la columna**: al fijar un nodo, el navegador de
  áreas desaparece. Se decidió así para que la columna no salte, pero significa que para
  volver a la lista hay que soltar el nodo. Vive en `app/second-brain/Grafo.tsx`.

- **Persistir el layout** (`getSetting`/`setSetting` con la `huella` que ya calcula
  `cerebro-layout.ts`). Hoy se recalcula en cada carga: con 42 nodos son ~40 ms y no se nota,
  pero **arriba de ~80 nodos hay que persistirlo** (100 nodos ≈ 300 ms, 300 ≈ 1,45 s).
- **El efecto del onboarding**: `layoutCerebro` ya acepta `previo` y el test comprueba que
  los nodos viejos se mueven poco, pero nadie lo llama con eso todavía. Falta el camino
  incremental (pinear los viejos → `alpha(0.35).tick(90)` → despinear → `alpha(0.12).tick(60)`)
  y la interpolación de 700 ms en el cliente.
- **Histéresis del encuadre**: hoy se recalcula siempre, así que el mapa entero «respira»
  cuando entra un nodo. Debería conservarse mientras el bbox nuevo entre en el guardado.

Relacionado: [hallazgos-onboarding.md](hallazgos-onboarding.md) (de dónde salen los nodos, y
la trampa de importar un módulo con `server-only` desde un componente cliente).

### Las tarjetas de abajo eran la navegación en competencia con el mapa

**Vive en:** `app/second-brain/AreasHub.tsx` · `app/second-brain/Grafo.tsx` (`.cbg-nav-*`)

**Síntoma.** «Al pasar el cursor por una de las tarjetas de abajo, se comienza a mover la
pantalla de arriba abajo, es como que se bugea el grafo.»

**Causa.** No era el grafo. Cada tarjeta hacía `onResaltar(a.id)` en `onMouseEnter`, y ese
estado vivía en `VistaCerebro` —el padre de las DOS mitades—, así que rozar una tarjeta
re-renderizaba el árbol entero, y con él volvía a correr el `useEffect` de `AreasHub` que
hace `scrollIntoView({behavior:'smooth'})`. El síntoma aparecía en el mapa; la causa estaba
en un `onMouseEnter` a dos componentes de distancia.

**La regla.** Un estado compartido que lo enciende el HOVER es una animación de scroll a
60 fps esperando a que alguien mueva el mouse. Si un hover tiene que hablar con otro
componente, que hable por CSS (`:hover` en un ancestro común) o que no hable.

**Lo que quedó.** Las once tarjetas se fueron enteras y la lista de áreas pasó a la columna
de la derecha del mapa. El diagnóstico de fondo era el mismo que ya había echado a las once
tabs: **once cajas del mismo tamaño repitiendo lo que el mapa dibuja, puestas justo debajo
del mapa, son una segunda navegación que le compite.** En la columna se ven MIENTRAS se
mira el mapa, en vez de después.

### Una animación CSS no se repite porque le cambies la clase

**Vive en:** `app/second-brain/Grafo.tsx` (el `key` del `<g className="cbg-pop">`)

**Síntoma.** «SIEMPRE que se van o entran los nodos, con la animación de entrada y de
salida. No que simplemente aparezcan en el lugar.» La salida se veía; la vuelta no.

**Causa.** Una `animation` corre **al montar** el elemento. Agregarle y sacarle la clase
`.cbg-fuera` alcanza para que arranque la de salida (la clase TRAE una animación nueva),
pero al volver no hay animación nueva que traer: `cbg-in` ya estaba declarada desde el
montaje y ya terminó. El nodo aparecía plantado en su lugar.

**El arreglo, y dónde va.** `key={saliendo.has(n.id) ? 'fuera' : 'dentro'}` en el `<g>`
interno: al cambiar la key React desmonta y remonta, y la animación arranca de cero. Va en
el `<g>` **interno** y no en el de afuera a propósito — ese tiene el `transform` que
reescribe el rAF y los refs de la física, y remontarlo hace saltar al nodo a su posición
del server.

**El segundo error, más silencioso.** El retardo escalonado (`i * 12 ms`) salía del puesto
del nodo en el mapa ENTERO. Un filtro que deja 8 nodos podía darle al último el puesto 55:
**660 ms de lienzo vacío** antes de que apareciera, que se lee como que el filtro no hizo
nada. El ranking se calcula ahora sobre lo montado.

### Un filtro que es tres controles no es un filtro

**Vive en:** `app/second-brain/Grafo.tsx` (el estado `filtro`)

Había un desplegable de autoría, otro de «Ir a» y una pastilla de área que aparecía sola al
tocar un nodo. Tres controles para la misma pregunta —«¿qué parte del mapa estoy
mirando?»— se leen como tres filtros **combinables**, y no lo eran. Ahora es **un** estado,
una cadena con prefijo (`autor:` · `carpeta:` · `area:`), y de ahí sale todo: elegir una
sección apaga la carpeta sin que nadie tenga que acordarse de apagarla, porque no hay dos
estados que puedan contradecirse.

Y el icono de embudo fijo en el disparador no es decoración: el rótulo del botón es el
valor elegido («56 datos»), así que sin el icono el control se lee como un contador. Se le
agregó `icono` al `Dropdown` de la casa en vez de dibujar uno propio acá.

### Un `<div hidden>` de React deja la página sin hidratar y sin error

**Vive en:** cualquier verificación con `mcp__Claude_Browser__*`

El panel del navegador embebido, cuando no está a la vista, deja el documento en
`visibilityState: 'hidden'`. El HTML llega entero —se pueden contar 66 nodos con
`querySelectorAll`— pero el árbol queda adentro de un `<div hidden>` que React nunca
revela, así que **nada está hidratado**: los clicks no hacen nada, `getBoundingClientRect`
devuelve 0 y no hay un solo error en la consola. Las tres pistas mienten a la vez.

Se reconoce por `document.querySelector('body > div').hasAttribute('hidden') === true` con
`__reactFiber$` presente en la raíz y **ausente** en cualquier nodo de adentro.

**Para verificar interacción, Playwright** (`scripts/probar-solape.mjs` es el molde), que
corre en un Chromium visible de verdad. El navegador embebido sigue sirviendo para leer
CSS computado y medidas si se le saca el `hidden` a mano.

⚠️ Y el Chrome real puede estar viendo **otro servidor** en el mismo `localhost:3000`: acá
había un Service Worker de otro proyecto (`gym-shell-v2`) sirviendo su propio 404 mientras
`curl` contra el mismo puerto contestaba 307 correctamente. Si Chrome da 404 en una ruta
que `curl` resuelve, mirá `navigator.serviceWorker.getRegistrations()` antes que la ruta.

### El lienzo blanco contradecía la paleta que él mismo usaba

**Vive en:** `app/globals.css:65-96` (`--grafo-*`) · `app/second-brain/Grafo.tsx`

Las once `--grafo-*` traen escrito, desde que se crearon, que son «una paleta CUALITATIVA
que **solo vive adentro del lienzo oscuro del grafo**», y cada tono está justificado
midiendo contraste **contra #14161B**. La ronda anterior pintó el lienzo de blanco y nadie
—yo incluido— releyó ese comentario: `#BFC8DC` sobre blanco da **1,5:1**. Los nodos se
veían porque el ojo perdona, no porque el color funcionara.

**La regla:** antes de cambiarle el FONDO a algo, grepear los tokens que ese algo pinta
encima. Un token con un comentario que dice «sobre X» es un contrato, no una nota.

Medido sobre el fondo nuevo (#22262E), las once quedan entre **7,8:1 y 9,8:1** — todas por
encima de AAA. El oscuro no fue una variante: fue volver a la premisa.

### Una pantalla oscura se hace redefiniendo tokens, no reglas

**Vive en:** `app/globals.css` (`[data-tema="oscuro"]`) · `app/_components/TemaOscuro.tsx`

El inventario contó **40 usos de tokens claros** (`var(--surface)`, `var(--ink)`,
`var(--faint)`…) repartidos entre `Grafo.tsx`, `BuscadorCerebro.tsx` y `AreasHub.tsx`.
Tocarlos uno por uno era garantizar que el próximo se olvidara. Redefinidos en un scope,
los 40 se dan vuelta solos y el que agregue el 41 no tiene que saber que existe un tema.

Tres cosas que sí hay que hacer a mano, porque **no** son «el mismo token con otro valor**:

1. **Los tokens que existen PARA un fondo.** `--mako-ink` (#8F6709) está definido como «el
   dorado bajado de luminosidad para que se LEA sobre fondo claro». En oscuro da 2,97:1.
   No se inventa un cuarto dorado: en el scope apunta a `--mako`.
2. **Las relaciones invertidas.** La arista encendida era `--dim` (gris oscuro) y la
   apagada `--border-strong` (casi blanco). Sobre oscuro **la apagada pasaba a ser lo más
   brillante de la pantalla**. Dos tokens nuevos (`--cbg-arista`, `--cbg-arista-viva`)
   mantienen «encendida = más contraste» en los dos temas.
3. **`--focus-ring`** traía un halo interno de `var(--surface)`, que en claro es blanco.
   Sobre oscuro pintaba un aro blanco puro. El halo es el FONDO, no la superficie.

**Y en oscuro las superficies SUBEN de luminosidad, no bajan.** `--sidebar-2` (#1E212A)
parece la elevación natural y es **más oscuro** que el fondo del lienzo: 1,06:1.

### El `<script>` inline del tema no es un duplicado del `useEffect`

**Vive en:** `app/_components/TemaOscuro.tsx`

Un `useEffect` corre después de hidratar: entre el primer pintado y esa línea hay un flash
blanco a pantalla completa. El script inline corre mientras el navegador todavía parsea.
Y el efecto sigue haciendo falta para lo que el script no cubre: volver a la ruta por
navegación de cliente, donde no hay documento nuevo. El **cleanup** es la tercera pata —
sin él, ir de /second-brain a /plan deja el tablero entero oscuro.

### El estado vacío del filtro era inalcanzable porque la raíz siempre pasa

**Vive en:** `app/second-brain/Grafo.tsx` (`esDato`, `datosVisibles`)

`montados.length === 0` nunca se cumplía: el nodo raíz pasa el filtro por diseño (sin él
las áreas cuelgan de la nada), así que el mínimo alcanzable era **1**. Filtrando por una
sección vacía quedaba el nodo raíz solo en el lienzo, sin un mensaje que dijera qué pasó —
y el `NoResults` estaba escrito y montado.

El mismo error contaminaba el «N de M»: decía **66 de 66** mientras la barra decía «56
datos», dos números para la misma cosa. Los dos salen ahora de `esDato`.

**La regla:** cuando una colección tiene elementos de ANDAMIO que están exentos del filtro,
ningún conteo de cara al usuario puede salir de la colección cruda.

### El dorado no es «esto elegiste»

**Vive en:** `app/second-brain/Grafo.tsx` (`.cbg-nav-fila[aria-pressed]`)

La fila marcada del navegador se pintaba con `--mako-bg` y la carpeta activa con
`--mako-ink`. En la regla de color de la casa el dorado significa **MaKo** («acá intervino
la inteligencia») y el azul significa **vos actuás** (selección, foco). Una fila marcada
porque el usuario la tocó pintada de dorado dice que la eligió MaKo. Es el mismo error que
ya se pagó cuando `--grafo-norte` valía exactamente `--mako`.

En un lienzo oscuro esto además tiene un costo extra: el §7.4 lista «interfaz de cripto o
casino por **exceso de negro y dorado**» entre los seis antipatrones.

### GOTCHA: el CSS compilado va atrás del archivo

**Vive en:** cualquier edición de `app/globals.css` con el dev server arriba

Se editó `globals.css`, se reinició el server, y la regla nueva **no estaba** en el chunk
servido — ni por `curl` ni en el navegador. El diagnóstico obvio (y equivocado) fue
«Tailwind está tirando mi regla»: es plausible, porque el archivo pasa por
`@import "tailwindcss"` y tiene un `@theme inline` que sí se come cosas.

Era **latencia de compilación**. La prueba que lo aisló en un paso: meter una variable
sonda tonta (`--tema-sonda: 7px`) adentro de `:root` y preguntar por ella en el navegador.
Si la sonda tampoco aparece, el archivo no se recompiló; si aparece y tu regla no, ahí sí
el problema es la regla. Con el arranque en OneDrive esto puede tardar más de lo que uno
espera antes de dar por muerta una hipótesis.

### `Pagina` no tiene full-bleed, y `100vw` no es el reemplazo

**Vive en:** `app/_ui/Pagina.tsx:27-63`

`ancho="completo"` saca el `maxWidth` pero **conserva el padding** de 34/44 px, y el
`style` está tipado sin `maxWidth`/`width`/`margin*`: el compilador rechaza el ancho. Para
sangrar de verdad hay que anular ese padding con márgenes negativos CONOCIDOS
(`margin-inline: -44px; padding-inline: 44px`) en el hijo.

⚠️ El truco de `left:50% + width:100vw + translateX(-50%)` que usa la landing
(`app/vsl/_detalle/FeatureDetail.tsx:391`) **no se puede copiar adentro de la app**: ahí el
sidebar está escondido y el `<main>` ocupa el viewport, pero en una pantalla interna el
`<aside>` se lleva 68 px del flujo, así que `100vw` sobresale y mete scroll horizontal en
toda la página — la misma falla que AGENTS.md ya documenta para las barras de gráfico.

En este rediseño no hizo falta ninguna de las dos: si la página ENTERA es del color del
lienzo, no hay banda que sangrar.

### Claude y Anthropic son dos marcas, y estaban cambiadas

**Vive en:** `app/_components/icons.tsx` (`RafagaClaude`) · `app/_components/ServicioVisual.tsx` (`ic-claude` / `ic-anthropic`)

El repo tenía los DOS logos y los usaba al revés donde importaba. `ic-anthropic` es el
logotipo de la EMPRESA (la «A\»); la ráfaga de once radios es la marca del PRODUCTO. La
integración con la que el cliente habla llevaba el logo de la empresa, y la ráfaga —que
ya existía, bien dibujada— se usaba en **un solo lugar** de todo el repo: el avatar del
historial de `/admin/dev`.

**La regla:** el tile de una integración lleva la marca de **con qué** te conectás. Con la
API key te conectás con Anthropic (ahí el logotipo está bien); con la skill te conectás
con Claude.

Y el dibujo no se copió: `RafagaClaude` devuelve el `<g>` sin el `<svg>` de afuera, así
que el mismo path sirve como componente y como `<symbol>` de `BrandDefs`. Dos copias de
una marca ajena garantizan que una quede vieja.

### «Claude Code» nombraba la puerta, no lo que hay adentro

**Vive en:** `lib/integraciones-catalogo.ts` · `lib/servicio-slides.ts` · `app/_components/TutorialAgente.tsx` · `lib/agente-skill.ts`

La integración se llamaba «Claude Code» y su tutorial abría con «¿Programás con Claude
Code?». La skill es **un archivo de texto**: funciona en cualquier Claude que lea skills,
y el que la usa no está programando — está escribiendo un anuncio o decidiendo un precio.
El nombre y el copy dejaban afuera a la mayoría de los clientes.

**Y la skill se había quedado corta con su propio código.** Su `description` —lo que
decide cuándo el modelo la activa— hablaba solo del plan, cuando ya expone el contexto
completo del negocio (`/api/agente/contexto`, seis bloques) y tres secciones grandes bajo
demanda (razones, panorama, productos). Una skill cuya descripción no nombra la mitad de
lo que sabe hacer es una skill que no se activa cuando hace falta: el modelo lee la
descripción, no el código.

**La regla:** cuando se le agrega una capacidad a una skill, se toca **la descripción del
frontmatter** en el mismo commit. El cuerpo lo lee el modelo cuando ya decidió usarla; la
descripción es lo único que lee para decidir.

### El exportador no sabía nada del filtro, y su conteo tenía tres copias

**Vive en:** `lib/vault-modelo.ts` (`esArchivo`) · `app/api/second-brain/exportar/route.ts` · `app/second-brain/ExportarCerebro.tsx`

El mapa filtra por carpeta, sección, autoría y búsqueda; el ZIP solo sabía de áreas. Se
podía dejar el mapa en 15 datos y bajar 52.

Dos decisiones que valen para el próximo:

1. **Se manda el RESULTADO, no los criterios.** La ruta recibe la lista de ids visibles,
   no el filtro. Mandar los criterios obligaba a reimplementar en el servidor el
   predicado que ya existe en el navegador —tres dimensiones más dos búsquedas— y dos
   implementaciones de «qué se ve» divergen. Este archivo ya pagó ese bug entre el README
   y las carpetas.
2. **`esArchivo` es ahora la única condición.** Estaba escrita tres veces con tres
   redacciones: en `construirVault`, en `conteoPorArea` y en el filtro del README. El
   síntoma histórico fue «5 archivos» en una carpeta con 3. El test que lo blinda
   (`tests/vault.test.ts`) compara el número del README contra los archivos reales de
   cada carpeta, y es el que hay que correr ante cualquier cambio acá.

**Y el nombre del ZIP salía de los IDS.** Los ids siguen siendo `norte` y `panorama` —
vocabulario interno renombrado en pantalla dos rondas atrás — y aparecían tal cual en
`segundo-cerebro-…-norte-panorama-documentos-….zip`, con la última palabra cortada al
medio por un `slice(0, 40)`. Un id no es un nombre: si sale a la cara del usuario, sale
del `nombre` del catálogo.

### El `animationDelay` en línea se lo come CUALQUIER animación

**Vive en:** `app/second-brain/Grafo.tsx` (el `<g className="cbg-pop">`)

**Síntoma.** «La animación de salida no funciona, no desaparecen, se bugean.» Segunda
ronda del mismo síntoma: la primera causa (el frame de más del `useEffect`) estaba
arreglada y medida, y aun así se veía mal.

**Causa.** El retardo escalonado de la ENTRADA —`animationDelay: i*12ms`, hasta 700 ms—
está puesto en el `style` del elemento, y un `animation-delay` no pertenece a una
animación: se aplica a la que esté corriendo. Cuando el nodo pasaba a salir, su
`cbg-out` heredaba el mismo retardo. Y el desmontaje corta a los 260 ms: **todo nodo con
más de 260 ms de retardo nunca empezaba su fade** — se quedaba a opacidad plena y
desaparecía de golpe. Como la mayoría de los que se van caen en ese rango, la salida
parecía no existir.

**La regla.** Un `animation-delay` inline es un delay para el ELEMENTO, no para la
animación que uno tenía en mente. Si el mismo elemento corre dos animaciones en momentos
distintos, el retardo se decide por estado. Y el temporizador que desmonta tiene que ser
`retardo máximo + duración`, nunca solo la duración.

Medido después: 66 nodos montados con 47 saliendo, opacidad 1,00 → 0,00 en 11 frames, y
recién ahí el desmontaje a 19.

**Lo que este bug enseña sobre el anterior:** la primera medición —«la cuenta de nodos no
baja de 66 en ningún frame»— era correcta y estaba incompleta. Verificaba que los nodos
siguieran MONTADOS, no que se estuvieran VIENDO animar. Un nodo montado a opacidad 1
durante toda su «salida» pasa ese chequeo. La medición ahora mira la opacidad.

### Un filtro y un exportador que preguntaban lo mismo de dos maneras

**Vive en:** `lib/cerebro-filtro.ts` · `app/second-brain/ExportarCerebro.tsx`

El mapa filtraba por carpeta, sección y autoría con un desplegable de drill-down; el
exportador preguntaba con diez casillas de área. Coincidía **una** de las tres
dimensiones, así que «bajame lo que dedujo MaKo en Oferta» no se podía expresar: la
autoría no existía del lado del ZIP.

Lo que quedó, y el orden importa:

1. **El predicado salió a `lib/cerebro-filtro.ts`**, sin `server-only`. Vivía adentro de
   un componente de 1.700 líneas, o sea que la única regla que decide qué dato EXISTE
   para el usuario no la podía importar ningún test. Ahora tiene ocho.
2. **El exportador monta el MISMO componente de filtro**, no uno parecido. El que
   aprendió a filtrar el mapa ya sabe exportar.
3. **Su filtro es una COPIA** (`clonarFiltro`), sembrada con la del mapa. Un modal que
   reescribe la pantalla que lo abrió deja al usuario en otro lado al cancelar. Y los
   `Set` tienen que ser propios: `FILTRO_VACIO` es una constante compartida y sus Sets
   son mutables — usarla como estado inicial de dos pantallas las ata entre sí.
4. **El modal muestra el ÁRBOL que va a salir**, no un número. Un filtro dice qué NO
   entra; en una descarga lo que importa es qué SÍ.

**La asimetría del andamiaje, que es lo que el test blinda:** la raíz, las carpetas madre
y los nodos de área SÍ se apagan al filtrar por carpeta o sección —dejarlos dibujados es
no haber filtrado— pero quedan EXENTOS de la autoría, porque no tienen autoría propia y
sacarlos deja las etiquetas flotando sin racimo. Leyendo el código no se nota; en un test
son tres líneas.

### La skill se instalaba en el lugar de desarrollador

**Vive en:** `lib/agente-skill.ts` (`AGENTE_SKILL_PATH_USUARIO`) · `app/_components/TutorialAgente.tsx`

**Síntoma.** El dueño pegó la skill en su Claude Code y le contestó: «No hay ninguna skill
`mako-plan` instalada — ni en el proyecto ni en tu carpeta global `~/.claude/skills` (ahí
solo están las de `hyperframes-*` y `media-use`)», y le ofreció crearla él.

**Nada estaba roto**, y por eso costaba verlo: Claude reconoció el texto, dedujo que era
una skill y ofreció el lugar correcto. El tutorial funcionaba **porque el modelo lo
arregló**, no porque estuviera bien.

**Las dos causas, y las dos son de producto:**

1. **La ruta era de PROYECTO.** `.claude/skills/…` existe solo adentro de esa carpeta. Es
   la respuesta de desarrollador. Un cliente de MaKo no tiene «un proyecto»: abre Claude
   donde sea y espera que sepa de su oferta. La que corresponde es la GLOBAL del usuario
   (`~/.claude/skills/…`), que además es donde el propio Claude Code busca — lo dice en su
   mensaje de error, que es de dónde salió el diagnóstico.
2. **El flujo pedía un gesto que nadie hace.** «Creá el archivo y pegá la skill adentro»
   contra lo que la gente hace de verdad, que es pegar el texto en el chat.

**Lo que quedó, y es la parte reusable:** el texto de la skill **arranca explicando qué
hacer con él**. Si te lo pegan en un chat, la primera sección dice que todavía no está
instalada, dónde va y que después siga con lo que estaban haciendo. Pegarlo ES instalarlo,
sin depender de que el modelo adivine.

**La regla:** un artefacto que se entrega por copiar-y-pegar tiene que llevar adentro sus
instrucciones de instalación. El tutorial de la app lo lee quien lo copia; el que lo
recibe es otro —una persona en otra máquina, o un modelo— y ese solo tiene el texto.

## Abrir un área por URL: el `?area=` y el `useRef` que lo hacía inútil

Otras pantallas mandan al cerebro a hacer algo concreto —el selector de oferta del CRM manda
a crear una— y hasta ahora aterrizaban en el mapa entero, o sea en «buscala vos». `?area=` lo
abre: `VistaCerebro` inicializa `abierta` con el valor de la URL, validado contra `AREAS`
(un valor cualquiera no abre nada).

**Lo que casi lo deja decorativo:** el efecto que scrollea al panel tiene una guarda que
saltea la corrida de montaje —existe porque sin ella la página arranca scrolleada abajo— y
esa guarda se come justo el único caso del deep link. La cura es que la guarda mire el
estado de montaje en vez de ser una constante: `useRef(abierta === null)`. Con algo ya
abierto al montar, el scroll de la primera corrida es EL que se quería.

Es la familia de «escribir la salida no es ofrecerla»: el `?area=` compilaba, el panel se
abría, y el que llegaba desde otra pantalla quedaba igual de perdido que antes.

**Vive en:** `app/second-brain/VistaCerebro.tsx` · `app/second-brain/AreasHub.tsx` ·
*2026-09-26*

## Las reglas del mapa salieron de Grafo.tsx: el teléfono las lee igual (16/10/2026)

El Second Brain del teléfono (app/m/second-brain) necesitaba contar los datos de cada área, pintar cada punto
y saber qué documento se puede mirar, y esas reglas vivían ADENTRO de Grafo.tsx (`'use client'`, ~1.950
líneas): `porArea`, `grados`, `rellenoDe`, `urlPreview`, `esImagen`, `sePuedeVer`. Lo mismo con la subida
del Archivero (los tres pasos de `analizar`, ACCEPT y el rótulo de «Analizar») en app/onboarding/Archivero.tsx.
Un módulo de cliente no se puede llamar desde el server ni importar sin llevarse la pantalla entera, así que
se mudaron a **lib/cerebro-areas.ts** y **lib/archivero-subida.ts** (puros) y escritorio pasó a importarlas.

- **El conteo de «Tu negocio» no cuenta estructura ni pendientes** (`esEstructura`: raíz, `n1:`, `area:`):
  un «3 datos» que incluye lo que falta miente. Un área sin datos no aparece en el conteo: quien dibuja
  escribe «falta», nunca un 0.
- **La ruta de la vista previa va SIN `?ws=`** (`rutaVistaDocumento`) y la pega quien la usa
  (`conWs(…, wsDeBusqueda(location.search))` en escritorio, `useWs()` en el teléfono): un `<iframe>` o un
  `<a target=_blank>` no pasan por el parche de fetch, y el super-admin mirando a un cliente recibía «Archivo
  no encontrado».
- **Un nodo `falta:<área>` es un pendiente con el nombre del área** (lib/cerebro-grafo.ts:936-950): listado
  adentro de su área duplica el vacío. El teléfono lo saca de la hoja del área y lo deja en la búsqueda.

Lo que fija que no vuelva la copia: tests/m-second-brain.test.ts (Grafo.tsx con su `porArea` a mano, con la
ruta de la vista previa escrita o Archivero.tsx con su fetch a /upload-url dan 10 / 1 cada uno).
⚠️ Archivero.tsx conserva su normalización del link pegado (en main se llama `urlDelLink`, 607ceb205): no se
pasó a `normalizarUrlArchivero` para no pisar ese renombre.

**Vive en:** lib/cerebro-areas.ts · lib/archivero-subida.ts · app/second-brain/Grafo.tsx ·
app/onboarding/Archivero.tsx · app/m/second-brain/modelo.ts · tests/m-second-brain.test.ts · *2026-10-16*

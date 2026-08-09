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
| **bins vacíos** | **4/36** ✓ | **6/36** ✗ |

El clustering sube un 40% —era el objetivo: el funnel es la única cadena que tiene el
negocio— y **los bins vacíos se pasan del umbral**. Se probó la variante mínima (solo la
fila Activo, 4 etapas) y también da 5/36: la línea base ya estaba **exactamente en el
límite**, así que cualquier agregado la pasa. Queda anotado en vez de disimulado. Para
referencia: el caso radial que este umbral vino a cazar daba 11/36.

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

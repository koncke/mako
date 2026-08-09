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

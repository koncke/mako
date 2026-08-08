# Hallazgos — Second Brain (el grafo del negocio)

El mapa de lo que MaKo entendió del negocio del cliente: `lib/cerebro-grafo.ts` (qué nodos
hay), `lib/cerebro-layout.ts` (dónde va cada uno), `lib/cerebro-modelo.ts` (la forma) y
`app/second-brain/Grafo.tsx` (el dibujo).

## Lo que más muerde acá

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

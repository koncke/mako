// =============================================================================
// El lienzo: el gesto, el encuadre y la vista
// =============================================================================
// `app/_components/Lienzo.tsx` es el chrome compartido de las dos pantallas tipo
// flujo (la conversación con un lead y el aviso de MaKo). Lo que este archivo
// persigue no es qué se dibuja —eso es de cada flujo— sino las cuatro trampas que
// un lienzo tiene y una lista no, las cuatro medidas en el navegador.
//
// Segunda tanda (08/10/2026, parte L): el efecto del panel ganó la rama APAISADA. Roto con
// `const prox = false` (el panel apaisado no corre la vista en vertical): 15 pasan / 1 falla.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vistaConPanel, vistaAlCerrarPanel, encuadreInicial, ZOOM_LEGIBLE } from '../lib/lienzo-grafo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
/** ⚠️ Un guard que busca el nombre de lo que NO tiene que estar se acusa a sí mismo
 *  por el comentario que explica por qué no está. Ya pasó tres veces en este repo. */
const sinComentarios = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const LIENZO = '../app/_components/Lienzo.tsx';
// ── El lienzo, por fuente ───────────────────────────────────────────────────

test('El lienzo NO usa HTML5 drag-and-drop', () => {
  // Acá no se transporta nada: se mueve un valor continuo. Y el arrastre nativo
  // trae la foto que dibuja el SO, el congelamiento de rAF y el auto-scroll que
  // sólo vive adentro de `dragover` — tres problemas que un lienzo no necesita.
  const src = leer(LIENZO);
  assert.ok(!/draggable=|onDragStart|setDragImage|dataTransfer/.test(src), 'volvió el drag-and-drop nativo');
  assert.match(src, /setPointerCapture/, 'el gesto tiene que capturar el puntero');
});

test('⚠️ El nodo del clic se anota en el pointerDOWN, no al soltar', () => {
  // `setPointerCapture` retargetea todo lo que sigue al elemento que capturó, así
  // que en el `pointerup` el `e.target` ES EL CONTENEDOR. Buscar el nodo ahí
  // devuelve null siempre, y tocar un paso no abre nada — con el handler
  // leyéndose perfecto. Medido en el navegador antes de arreglarlo.
  //
  // Probado rompiéndolo: volviendo a leer `e.target` en el pointerup → 1 fallo,
  // 17 pases. Y antes que eso, medido en el navegador: con `e.target`, tocar un
  // paso dejaba `aria-pressed` en false y no abría nada.
  const src = leer(LIENZO);
  const abajo = src.slice(src.indexOf('function onPointerDown'), src.indexOf('function onPointerMove'));
  const arriba = src.slice(src.indexOf('function onPointerUp'));
  assert.match(abajo, /closest\('\[data-nodo\]'\)/, 'el nodo dejó de anotarse en el pointerdown');
  assert.ok(!/e\.target[\s\S]{0,80}data-nodo/.test(arriba.slice(0, 700)),
    'el pointerup volvió a leer e.target: con la captura puesta, eso es el contenedor');
});

test('El movimiento no pasa por setState', () => {
  // Un setState por `pointermove` redibuja el grafo entero 60 veces por segundo.
  // ⚠️ SIN SUS COMENTARIOS. El propio comentario que explica esta regla dice la
  // palabra «setState», así que el guard se acusaba a sí mismo — el modo de falla
  // que esta casa ya tiene escrito para las guardas que leen fuente.
  const src = leer(LIENZO).replace(/^[ 	]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const mover = src.slice(src.indexOf('function onPointerMove'), src.indexOf('function onPointerUp'));
  // ⚠️ LA ÚNICA EXCEPCIÓN (décima tanda, general 2: el lazo atenúa lo no elegido MIENTRAS se arrastra): lo que
  // toca el lazo va al estado, pero SÓLO cuando cambia el conjunto (entra o sale una tarjeta), nunca por píxel.
  // Se exige esa forma exacta, con su guarda, y se la saca antes de buscar cualquier otro set.
  const LAZO = 'if (clave !== lazoClave.current) { lazoClave.current = clave; setLazoVivo(ids); }';
  assert.ok(mover.includes(LAZO), 'lo que toca el lazo va al estado sin la guarda de «cambió el conjunto»');
  assert.ok(!/set[A-Z]/.test(mover.replace(LAZO, '')), 'el paneo volvió a pasar por el estado de React');
  assert.match(mover, /pintar\(\)/);
});

test('La vista la gobierna el transform: el scroll del contenedor se anula', () => {
  // `overflow: hidden` no impide un scroll POR CÓDIGO (un `scrollIntoView`, el foco
  // de un input fuera de cuadro, el buscar-en-página). Medido en el navegador: un
  // nodo a 1652 px se «movió» 330 px con el transform intacto — o sea que la
  // matemática del paneo y lo que se ve dejan de coincidir, y el clic cae al lado.
  const src = leer(LIENZO);
  assert.match(src, /onScroll=\{[\s\S]{0,120}scrollLeft = 0/, 'volvió el scroll fantasma del contenedor');
});

test('Reencuadrar es una DECISIÓN, no algo que pase en cada render', () => {
  // `ResizeObserver.observe()` dispara al suscribirse, así que cualquier cosa que
  // reinstale el observer vuelve a centrar y deshace el paneo que la persona acaba
  // de hacer. Se lee como que el lienzo «rebota solo».
  const src = leer(LIENZO);
  assert.match(src, /encuadrado\.current === firma/, 'se perdió la guarda del encuadre');
  assert.match(src, /encuadrar\(true\)/, 'el botón Centrar tiene que poder forzarlo');
});

test('El alto del lienzo sale del VIEWPORT, no de una proporción', () => {
  // Con `aspect-ratio` el lienzo medía 1444×1083 sobre un viewport de 900: crecía
  // justo en el monitor donde más espacio hay.
  // El alto es una PROP con default, para que cada flujo pueda pedir el suyo — pero el
  // default sigue saliendo del viewport, que es lo que evita que el lienzo crezca justo
  // en el monitor donde más espacio hay.
  const src = leer(LIENZO);
  assert.match(src, /alto = 'min\(\d+svh/, 'el alto por default dejó de salir del viewport');
  assert.match(src, /minHeight: alto/, 'el alto dejó de llegar al contenedor');
  assert.ok(!/aspectRatio/.test(src), 'un lienzo no se dimensiona por proporción');
});

test('⚠️ UN CLICK EN UN PORTAL NO ES UN GESTO DEL LIENZO', () => {
  // Los eventos de React bubblean por el árbol de REACT; `closest()` camina el DOM.
  // Todo `createPortal` a `body` —el menú de `Dropdown`, un `Confirm`, un popover
  // anclado— es hijo de React del panel del editor y hermano del contenedor en el DOM,
  // así que el click llega al `onPointerDown` del lienzo y el `data-no-pan` del panel
  // es INVISIBLE para el guard.
  //
  // Medido con Playwright el 30/09/2026: abrir el desplegable de la unidad del CRON y
  // elegir «semana» CERRABA el panel del nodo — sin un error, sin un POST, con la
  // opción bien clickeada. El desplegable se leía como roto y lo que estaba mal era el
  // guard del lienzo.
  const src = leer('../app/_components/Lienzo.tsx');
  const h = src.slice(src.indexOf('function onPointerDown'), src.indexOf('function onPointerMove'));
  assert.match(h, /caja\.current\?\.contains\(e\.target as Node\)/,
    'sin esto, un click en cualquier portal deselecciona el nodo');
  // Y va ANTES del otro guard: el orden es lo que hace que el portal no dependa de que
  // alguien se acuerde de marcar algo.
  //
  // ⚠️ SIN COMENTARIOS, o el guard se acusa a sí mismo: el párrafo de arriba nombra el
  // atributo que busca. Es la tercera vez que pasa en este archivo.
  const hs = sinComentarios(h);
  assert.ok(hs.indexOf('.contains(') < hs.indexOf('no-pan'),
    'el guard del DOM quedó después del de la marca: el portal vuelve a pasar');
});

// ── La vista cuando se abre y se cierra el panel de un nodo ────────────────
// ⚠️ PROBADAS ROMPIENDO LAS DOS FUNCIONES, 04/10/2026. Cuatro roturas se cazan: sacar el
// `return null` del nodo que ya se ve → 1 fallo · no correr nada → 3 · devolver la vista
// aunque la persona haya paneado en el medio → 1 · no devolverla nunca, o sea el código
// de antes del arreglo → 2.
//
// ⚠️ Y LA QUINTA SALIÓ CIEGA, POR DÓNDE VIVE: pisar el `antes` en cada corrimiento
// —adentro de `Lienzo.tsx`— dio CERO fallos, porque estos tests componen las dos
// funciones a mano y no montan el componente. O sea que prueban que la cuenta está bien
// y no que el lienzo la haga así. Para eso está el guard de cableado de más abajo, que
// esa misma rotura sí caza (1 fallo).
//
// El caso que las hizo existir, medido en el navegador: con el panel ya en 460 px, abrir
// el nodo del disparador corría el grafo 443 px y la tarjeta WHATSAPP quedaba en x=1485
// de una ventana de 1600 — cortada por el borde, y sin volver al cerrar el panel.
const PANEL = 460, MARGEN = 12;
const LIBRE = PANEL + MARGEN * 2;   // 484

test('un nodo que YA se ve no mueve la vista', () => {
  assert.equal(vistaConPanel({ k: 1, tx: 500, ty: 0 }, 28, PANEL, MARGEN), null);
  assert.equal(vistaConPanel({ k: 1, tx: LIBRE - 28, ty: 0 }, 28, PANEL, MARGEN), null,
    'justo en el borde del panel ya se ve: no se toca');
});

test('el nodo tapado se corre hasta quedar al lado del panel, sin tocar el zoom', () => {
  for (const k of [0.4, 1, 2.4]) {
    const v = vistaConPanel({ k, tx: 0, ty: 7 }, 28, PANEL, MARGEN);
    assert.ok(v, `con k=${k} tendría que haberse corrido`);
    assert.equal(v.k, k, 'correr el lienzo no le cambia el zoom a nadie');
    assert.equal(v.ty, 7, 'ni lo mueve en vertical');
    assert.equal(Math.round(v.tx + 28 * v.k), LIBRE, 'el nodo tiene que quedar justo al lado del panel');
  }
});

test('⚠️ al cerrar, el lienzo DEVUELVE lo que el panel se llevó', () => {
  const antes = { k: 1, tx: 0, ty: 0 };
  const aplicada = vistaConPanel(antes, 28, PANEL, MARGEN)!;
  assert.deepEqual(vistaAlCerrarPanel(aplicada, aplicada, antes), antes);
});

test('⚠️ pero NO si la persona paneó o hizo zoom en el medio: esa vista es suya', () => {
  const antes = { k: 1, tx: 0, ty: 0 };
  const aplicada = vistaConPanel(antes, 28, PANEL, MARGEN)!;
  assert.equal(vistaAlCerrarPanel({ ...aplicada, tx: aplicada.tx + 120 }, aplicada, antes), null, 'paneó');
  assert.equal(vistaAlCerrarPanel({ ...aplicada, k: 1.4 }, aplicada, antes), null, 'hizo zoom');
  // Y si no hubo corrimiento, no hay nada que devolver.
  assert.equal(vistaAlCerrarPanel(antes, antes, antes), null);
});

test('⚠️ abrir un SEGUNDO nodo no pierde la vista original', () => {
  // Es el caso del lienzo: el `antes` se guarda una vez. Si cada corrimiento lo pisara,
  // volver dejaría la vista del nodo anterior y no la de la persona.
  const antes = { k: 1, tx: 0, ty: 0 };
  const uno = vistaConPanel(antes, 28, PANEL, MARGEN)!;
  const dos = vistaConPanel(uno, -400, PANEL, MARGEN)!;   // un nodo que quedó a la izquierda
  assert.notDeepEqual(dos, uno, 'el segundo nodo tenía que correr más');
  assert.deepEqual(vistaAlCerrarPanel(dos, dos, antes), antes);
});

test('⚠️ y el LIENZO usa las dos, y guarda el `antes` UNA sola vez', () => {
  // Un guard de CABLEADO: los tests de arriba no montan el componente, así que pisar el
  // `antes` en cada corrimiento les da verde. Lo que se fija acá es la expresión que
  // decide, no el cuerpo que cuelga de ella.
  const src = leer(LIENZO);
  const ef = src.slice(src.indexOf('if (!caja.current) return;'), src.indexOf('const nodoSel ='));
  // 2.000 desde el 08/10 (revisión, lienzo-4): el efecto ganó el tope derecho del corrimiento
  // y su comentario; el recorte mide ~1.800 con los saltos CRLF de un worktree. 2.600 desde la
  // segunda tanda: ganó la rama del panel APAISADO (`vistaConPanelAbajo`); mide ~2.250.
  // 2.900 desde la sexta tanda: ganó la pastilla de la espera que va en una flecha (`posicionDePildora`);
  // mide ~2.700.
  assert.ok(ef.length < 2900, `el recorte del efecto mide ${ef.length}: está mirando otra cosa`);
  assert.match(ef, /const prox = apaisado\r?\n\s+\? vistaConPanelAbajo\(vista\.current, n, \{/, 'el panel apaisado no corre la vista en vertical');
  assert.match(ef, /antes: corrimiento\.current\?\.antes \?\? vista\.current/,
    'el lienzo pisa el `antes` en cada corrimiento: volver deja la vista del nodo anterior');
  assert.match(ef, /vistaAlCerrarPanel\(vista\.current, c\.aplicada, c\.antes\)/,
    'al cerrar el panel ya no se devuelve la vista');
  assert.match(ef, /if \(!seleccion\) \{/, 'la vuelta cuelga de que NO haya selección');
});

test('⚠️ el ＋ del medio respeta `sinMas`, y mide en píxeles de PANTALLA', () => {
  // Dos guards de cableado sobre la misma pieza, y los dos salieron de medir:
  //
  // · `sinMas` lo pone el grafo en la rama que SALTA (el «si no» de un condicional).
  //   Ignorarlo acá no rompe ningún test del grafo —lo probé: 0 fallos— y deja un ＋ que
  //   inserta en la otra rama.
  // · Y la zona vive adentro de la capa transformada, así que sus 28 px son 28 × k:
  //   medido en el navegador con el lienzo al 22%, la zona daba 6 px y el ＋ adentro 5,
  //   o sea inalcanzable. El `scale` inverso la deja igual a cualquier zoom.
  const src = leer(LIENZO);
  const i = src.indexOf('EL ＋ DE LA FLECHA');
  assert.ok(i > 0, 'se fue el bloque del ＋ de la flecha');
  const bloque = src.slice(i, src.indexOf('{grafo.aristas.map', i));
  // Una `sinMas` `quitable` (la de «Si responde», 10/10/2026) lleva su papelera, nunca el ＋.
  assert.match(bloque, /\(a\.sinMas && !\(onQuitarFlecha && a\.quitable\)\)\) return null/, 'el ＋ del medio dejó de respetar `sinMas`');
  assert.match(bloque, /const conMas = Boolean\(onAgregarTras && \(opcionesEn \|\| opcionesAgregar\)\) && !a\.sinMas;/);
  assert.match(bloque, /scale\(\$\{100 \/ zoomTxt\}\)/, 'la zona volvió a medirse en unidades del grafo');
});


// ── El encuadre inicial: legible y desde el principio (08/10/2026) ───────────────────
// ⚠️ PROBADO ROMPIÉNDOLO: sin el piso (`k = ajuste`) cae el primero (k = 0,3); anclando en
// el nodo 0 en vez de la entrada cae el segundo; sin descontar el inset de la lista cae el
// tercero. 3 roturas, 3 cazadas.


const nodoDe = (id: string, tipo: string, x: number, y: number) =>
  ({ id, tipo, titulo: id, icono: '', x, y, ancho: 252, alto: 76 }) as never;

test('un flujo ancho NO abre al 30 %: abre legible y con la entrada a la vista', () => {
  // Diez columnas de 370 px (el árbol de una secuencia de antes convertida), en una ventana chica.
  // El primer nodo del ARRAY está arriba de todo (y=0) y la entrada abajo (y=1200): anclar en el
  // nodo 0 dejaría la entrada fuera de la vista.
  const nodos = [nodoDe('m', 'mensaje', 28, 0), nodoDe('e', 'entrada', 28, 1200), ...Array.from({ length: 9 }, (_, i) => nodoDe(`n${i}`, 'mensaje', 398 + i * 370, 1200))];
  const v = encuadreInicial({ nodos, ancho: 3700, alto: 1300 }, { w: 1100, h: 500, insetIzq: 304 });
  assert.ok(v.k >= ZOOM_LEGIBLE, `abrió al ${Math.round(v.k * 100)} %`);
  // La ENTRADA (no el primer nodo del array) queda adentro del ancho útil y del alto.
  const xE = 28 * v.k + v.tx, yE = (1200 + 38) * v.k + v.ty;
  assert.ok(xE >= 304 && xE <= 1100 - 252 * v.k, `la entrada queda en x=${xE}`);
  assert.ok(yE >= 0 && yE <= 500, `la entrada queda en y=${yE}`);
});

test('un flujo que entra a un zoom legible se sigue centrando entero', () => {
  const nodos = [nodoDe('e', 'entrada', 28, 28), nodoDe('a', 'mensaje', 398, 28)];
  const v = encuadreInicial({ nodos, ancho: 700, alto: 140 }, { w: 1200, h: 600, insetIzq: 304 });
  assert.equal(v.k, 1);
  assert.equal(v.tx, 304 + (1200 - 304 - 700) / 2);
});

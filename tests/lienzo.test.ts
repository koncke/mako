// =============================================================================
// El lienzo: el gesto, el encuadre y la vista
// =============================================================================
// `app/_components/Lienzo.tsx` es el chrome compartido de las dos pantallas tipo
// flujo (la conversación con un lead y el aviso de MaKo). Lo que este archivo
// persigue no es qué se dibuja —eso es de cada flujo— sino las cuatro trampas que
// un lienzo tiene y una lista no, las cuatro medidas en el navegador.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.ok(!/set[A-Z]/.test(mover), 'el paneo volvió a pasar por el estado de React');
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

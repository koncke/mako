// =============================================================================
// EL RECORRIDO GUIADO: la lógica pura y lo que el componente no puede dejar de hacer
// =============================================================================
// «Elimina el recuadro de Configura tu curso… En su lugar haz el típico tutorial de app,
// donde se pone todo medio oscuro y salen flechas apuntándote a las acciones disponibles…
// Con botones de siguiente y uno para omitir tutorial» (07/10/2026, docs/diseno-curso-skool.md D7).
//
// Dos mitades:
//  · lib/recorridos.ts, EJECUTADA: qué paso se saltea, el «2 de 5», dónde va la tarjeta
//    según el lado y el borde de la ventana, el recorte, qué se guarda por persona.
//  · app/_ui/Recorrido.tsx y la ruta, por FUENTE: el registro en la pila de modales, el
//    Escape, el diálogo accesible, el z-index contra la sidebar y la barra de agencia. El
//    fuente se lee SIN comentarios (este archivo explica lo que se sacó y lo cita: un guard
//    sobre el texto con comentarios se acusaría a sí mismo) y con los `\r` normalizados.
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ, restaurando de memoria (nunca con git) y
// comparando el hash del archivo restaurado. Base: **27 pasan, 0 fallan**
// (`node --import tsx --test tests/recorrido.test.ts`). Medido el 07/10/2026:
//
//  #  Qué se rompió                                                          pasan/fallan  Qué cayó
//  1  `siguienteVisible` sin el `if (presentes[i])` (no saltea)              26 / 1   «se saltea»
//  2  `contadorDe` contando TODOS los pasos (total = pasos.length)           26 / 1   «el contador»
//  3  `posicionTarjeta` sin dar vuelta el lado (manda el pedido)             25 / 2   «se da vuelta» · «al costado»
//  4  `posicionTarjeta` sin encajar en la ventana (sin los dos `acotar`)     23 / 4   «borde» · «flecha» · «sin lugar» · «fuera de la pantalla»
//  5  la flecha sin el tope de la esquina (sin `acotar(punta, …)`)           26 / 1   «la flecha sigue al objetivo»
//  6  la flecha dibujada aunque la tarjeta tape al objetivo                  26 / 1   «sin lugar en ningún lado»
//  7  `perfilConVisto` partiendo de `{}` (borra el resto del perfil)         24 / 3   «conserva» · «dos veces» · «tope»
//  8  `vistoDeFuentes` creyéndole sólo al server (`servidor === true`)       26 / 1   «visto sólo SUMA»
//  9  el recorrido registrado SIN `anidada: true`                            26 / 1   «capa ANIDADA»
// 10  el Escape con `stopPropagation` en vez de `stopImmediatePropagation`    26 / 1   «Escape»
// 11  el Escape sin preguntar `esElDeArriba()`                               26 / 1   «Escape»
// 12  sin `role="dialog"`                                                    26 / 1   «diálogo accesible»
// 13  el z-index sin el piso (`const z = capa.z`)                            26 / 1   «por encima de la sidebar»
// 14  `objetivoEnDom` sin mirar `getClientRects` (un oculto cuenta)          26 / 1   «un objetivo oculto»
// 15  la ruta leyendo el workspace (`getWorkspaceActual`) además de la sesión 26 / 1  «por PERSONA»
// 16  un `useRef` detrás del `return null`                                   26 / 1   «ningún hook detrás»
// 17  un `#fff` en la hoja                                                   26 / 1   «los tokens»
// 18  `vistoActual` sin esperar al server (abre con `servidor` undefined)    26 / 1   «mientras no se sabe»
// 19  lo local leído también en el server (`getServerSnapshot`)              26 / 1   «el gancho decide»
// 20  el gancho abriendo con `!visto` (o sea también con `null`)             26 / 1   «el gancho decide»
//
// La 4 tumba cuatro porque encajar en la ventana es lo que sostiene a la flecha y a los
// dos casos de borde; la 7, tres, porque sin el perfil anterior también se pierden los
// recorridos ya vistos. Después de las 20: 27 / 0.
//
// ⚠️ REVISIÓN ADVERSARIAL (08/10/2026). Antes de tocar nada, SEIS roturas daban 27 / 0 —
// verde sobre el bug—, entre ellas la del foco que la cosecha de esta misma pista
// describe como un bug que ya mordió, y el backtick en la hoja que el comentario de la
// hoja decía que este archivo cuidaba. Más dos defectos de verdad: el respaldo local era
// por NAVEGADOR y no por persona (y se sincronizaba al server en la cuenta de otra), y la
// primera medida caía siempre al respaldo de 320×150 por medir con la capa en
// display:none. Base nueva: **34 pasan, 0 fallan**; cada fila, una rotura por vez con el
// mismo arnés (de memoria + hash):
//
//  #  Qué se rompió                                                          pasan/fallan  Qué cayó
//  A  el foco de la tarjeta con deps [indice] (sin `medida`)                 33 / 1   «el foco va a la tarjeta…»   (antes 27/0)
//  B  `scrollIntoView` sin el `if (scroll)`                                   33 / 1   «scrollIntoView SÓLO si…»    (antes 27/0)
//  C  un backtick en un comentario de la hoja                                 33 / 1   «la hoja no tiene backtick»  (antes 27/0)
//  D  la ruta da «guardado» sin mirar si el CAS devolvió la fila              33 / 1   «la ruta guarda por PERSONA» (antes 27/0)
//  E  sin devolver el foco al cerrar                                          33 / 1   «el foco va a la tarjeta…»   (antes 27/0)
//  F  el gancho con `soloLocal` le pega igual al server                       33 / 1   «el gancho lee… PERSONA»     (antes 27/0)
//  G  `claveLocal` ignorando a la persona                                     33 / 1   «lo local es POR PERSONA»
//  H  el gancho leyendo con la clave del navegador                            33 / 1   «el gancho lee… PERSONA»
//  I  `sincronizar` con la clave del navegador                                33 / 1   «el gancho lee… PERSONA»
//  J  el 503 del GET sin la huella                                            33 / 1   «la ruta manda la huella…»
//  K  la medida sin `visible` en las dependencias                             33 / 1   «se mide recién con la capa visible»
//  L  la medida sin la guarda `!visible`                                      33 / 1   «se mide recién con la capa visible»
//  M  `quienValido` aceptando cualquier texto                                 33 / 1   «lo local es POR PERSONA»
//  y re-corridas de la tabla de arriba, con el arnés de la revisión: la 9, la 13 y la 18,
//  33 / 1 cada una. Después de todas: 34 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FLECHA_MIN, MARGEN, PREFIJO_LOCAL, SEPARACION, TOPE_VISTOS, Z_PISO_RECORRIDO,
  anteriorVisible, claveLocal, contadorDe, idRecorridoValido, necesitaScroll, perfilConVisto, posicionTarjeta,
  primerVisible, quienValido, recorteDe, selectorDe, siguienteVisible, vistoActual, vistoDeFuentes, vistosDePerfil,
} from '../lib/recorridos';

const leer = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de un `//` abre un bloque falso). */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Los pasos: saltear, avanzar, retroceder, contar ───────────────────────────

test('un paso sin objetivo en la pantalla se saltea, para adelante y para atrás', () => {
  //            0      1      2     3      4      5
  const pres = [false, true, false, true, false, true];
  assert.equal(primerVisible(pres), 1, 'el primero que está, no el 0');
  assert.equal(siguienteVisible(pres, 1), 3, 'del 1 se salta el 2');
  assert.equal(siguienteVisible(pres, 3), 5);
  assert.equal(siguienteVisible(pres, 5), null, 'después del último no hay nada: es el «Listo»');
  assert.equal(anteriorVisible(pres, 5), 3, 'del 5 para atrás se salta el 4');
  assert.equal(anteriorVisible(pres, 1), null, 'antes del primero no hay «Atrás»');
  assert.equal(primerVisible([false, false]), null, 'sin ningún objetivo, no hay recorrido que mostrar');
  assert.equal(primerVisible([]), null);
});

test('el contador cuenta sólo los pasos que se muestran', () => {
  const pres = [true, false, true, true, false, true];
  assert.deepEqual(contadorDe(pres, 0), { n: 1, total: 4 });
  assert.deepEqual(contadorDe(pres, 2), { n: 2, total: 4 }, 'el paso 2 es el SEGUNDO que se ve, no el tercero');
  assert.deepEqual(contadorDe(pres, 5), { n: 4, total: 4 }, 'el último dice «4 de 4», no «6 de 6» ni «4 de 6»');
});

test('el selector escapa la comilla: un id mal escrito no puede tumbar el querySelector', () => {
  assert.equal(selectorDe('marca'), '[data-recorrido="marca"]');
  assert.equal(selectorDe('a"b'), '[data-recorrido="a\\"b"]');
  assert.equal(selectorDe('a\\b'), '[data-recorrido="a\\\\b"]');
});

// ── Dónde va la tarjeta ───────────────────────────────────────────────────────

const VENTANA = { ancho: 1000, alto: 800 };
const TARJETA = { ancho: 300, alto: 150 };

test('sin lado pedido va abajo, centrada en el objetivo, con la flecha en su centro', () => {
  const p = posicionTarjeta({ objetivo: { x: 100, y: 100, ancho: 200, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA });
  assert.equal(p.lado, 'abajo');
  assert.equal(p.y, 100 + 40 + SEPARACION, 'debajo del objetivo, a la separación');
  assert.equal(p.x, 50, 'centro del objetivo (200) menos media tarjeta (150)');
  assert.equal(p.flecha, 150, 'la punta cae en el centro del objetivo');
});

test('si el lado pedido no entra, se da vuelta al opuesto', () => {
  // Pedido arriba, pero arriba hay 100 - 14 - 12 = 74 px para una tarjeta de 150.
  const p = posicionTarjeta({ objetivo: { x: 100, y: 100, ancho: 200, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA, lado: 'arriba' });
  assert.equal(p.lado, 'abajo');
  // Y con lugar, se respeta.
  const q = posicionTarjeta({ objetivo: { x: 100, y: 500, ancho: 200, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA, lado: 'arriba' });
  assert.equal(q.lado, 'arriba');
  assert.equal(q.y, 500 - SEPARACION - TARJETA.alto);
});

test('al costado: pegado al borde derecho, la tarjeta se va a la izquierda y la flecha sigue al centro en Y', () => {
  const p = posicionTarjeta({ objetivo: { x: 900, y: 300, ancho: 80, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA, lado: 'derecha' });
  assert.equal(p.lado, 'izquierda');
  assert.equal(p.x, 900 - SEPARACION - TARJETA.ancho);
  assert.equal(p.y, 320 - 75, 'centrada en el centro del objetivo (320)');
  assert.equal(p.flecha, 75);
});

test('el borde de la ventana: un objetivo pegado a la izquierda no saca la tarjeta de la pantalla', () => {
  const p = posicionTarjeta({ objetivo: { x: 0, y: 100, ancho: 40, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA });
  assert.equal(p.x, MARGEN, 'encajada contra el margen, no en x negativa');
  // Y del otro lado.
  const q = posicionTarjeta({ objetivo: { x: 960, y: 100, ancho: 40, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA });
  assert.equal(q.x, VENTANA.ancho - MARGEN - TARJETA.ancho);
});

test('la flecha sigue al objetivo aunque la tarjeta se corra, y nunca sale por la curva de la esquina', () => {
  // Objetivo de 40 px a la izquierda: su centro (20) queda a 8 px del borde de la tarjeta.
  const p = posicionTarjeta({ objetivo: { x: 0, y: 100, ancho: 40, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA });
  assert.equal(p.flecha, FLECHA_MIN, 'a 8 px la punta saldría por la curva: se topa en FLECHA_MIN');
  const q = posicionTarjeta({ objetivo: { x: 960, y: 100, ancho: 40, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA });
  assert.equal(q.flecha, TARJETA.ancho - FLECHA_MIN);
});

test('sin lugar en ningún lado: va donde hay más, adentro de la ventana, y SIN flecha (taparía al objetivo)', () => {
  const ventana = { ancho: 400, alto: 300 };
  const p = posicionTarjeta({ objetivo: { x: 50, y: 100, ancho: 300, alto: 100 }, tarjeta: { ancho: 300, alto: 200 }, ventana });
  assert.equal(p.lado, 'abajo', 'abajo y arriba empatan (74 px): gana el primero del orden');
  assert.ok(p.y >= MARGEN && p.y + 200 <= ventana.alto - MARGEN, `la tarjeta tiene que quedar entera adentro (y=${p.y})`);
  assert.equal(p.flecha, null, 'la tarjeta está encima del objetivo: una flecha se señalaría a sí misma');
});

test('objetivo fuera de la pantalla (la persona scrolleó): la tarjeta y sus botones se quedan a la vista', () => {
  const p = posicionTarjeta({ objetivo: { x: 100, y: -600, ancho: 200, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA });
  assert.ok(p.y >= MARGEN, `con el objetivo arriba y afuera, la tarjeta no se puede ir con él (y=${p.y})`);
  assert.equal(p.flecha, null, 'sin objetivo a la vista no hay a quién señalar');
  const q = posicionTarjeta({ objetivo: { x: 100, y: 2000, ancho: 200, alto: 40 }, tarjeta: TARJETA, ventana: VENTANA });
  assert.ok(q.y + TARJETA.alto <= VENTANA.alto - MARGEN, `ni abajo y afuera (y=${q.y})`);
  assert.equal(q.flecha, null);
});

test('el recorte: el objetivo con aire, encajado en la ventana, y sin encajar si está afuera', () => {
  assert.deepEqual(recorteDe({ x: 100, y: 100, ancho: 200, alto: 40 }, VENTANA, 6), { x: 94, y: 94, ancho: 212, alto: 52 });
  assert.deepEqual(
    recorteDe({ x: -50, y: -20, ancho: 1200, alto: 900 }, VENTANA, 6),
    { x: 2, y: 2, ancho: 996, alto: 796 },
    'más grande que la pantalla: se encaja, o el aro queda afuera',
  );
  assert.deepEqual(recorteDe({ x: 100, y: 2000, ancho: 200, alto: 40 }, VENTANA, 6), { x: 94, y: 1994, ancho: 212, alto: 52 });
});

test('scrollIntoView sólo si el objetivo NO se ve entero, y desde arriba si es más alto que la pantalla', () => {
  assert.deepEqual(necesitaScroll({ x: 100, y: 100, ancho: 200, alto: 40 }, VENTANA), { scroll: false, bloque: 'center' });
  assert.equal(necesitaScroll({ x: 100, y: 780, ancho: 200, alto: 40 }, VENTANA).scroll, true, 'cortado abajo');
  assert.equal(necesitaScroll({ x: 100, y: -10, ancho: 200, alto: 40 }, VENTANA).scroll, true, 'cortado arriba');
  assert.equal(necesitaScroll({ x: 0, y: 0, ancho: 300, alto: 1400 }, VENTANA).bloque, 'start');
});

// ── Quién ya lo vio ───────────────────────────────────────────────────────────

test('el id de un recorrido es una clave: minúsculas, números y guiones', () => {
  assert.ok(idRecorridoValido('cs-curso'));
  assert.ok(!idRecorridoValido('CS Curso'));
  assert.ok(!idRecorridoValido('-curso'));
  assert.ok(!idRecorridoValido(''));
  assert.ok(!idRecorridoValido('a'.repeat(49)));
  assert.ok(!idRecorridoValido(42));
});

test('lo que se lee del perfil se sanea: un valor raro no se vuelve «visto»', () => {
  const perfil = { recorridos: { 'cs-curso': '2026-10-07T10:00:00.000Z', 'MAL ID': 'x', otro: 5, vacio: '' }, cargo: 'CEO' };
  assert.deepEqual(vistosDePerfil(perfil), { 'cs-curso': '2026-10-07T10:00:00.000Z' });
  assert.deepEqual(vistosDePerfil(null), {});
  assert.deepEqual(vistosDePerfil({ recorridos: ['cs-curso'] }), {}, 'un array no es el mapa');
});

test('marcar visto conserva el resto del perfil (el jsonb se reescribe entero)', () => {
  const perfil = { cargo: 'CEO', timezone: 'America/Mexico_City', notifInApp: { sonido: false }, recorridos: { viejo: '2026-01-01T00:00:00.000Z' } };
  const nuevo = perfilConVisto(perfil, 'cs-curso', '2026-10-07T10:00:00.000Z');
  assert.equal(nuevo.cargo, 'CEO');
  assert.equal(nuevo.timezone, 'America/Mexico_City');
  assert.deepEqual(nuevo.notifInApp, { sonido: false });
  assert.deepEqual(nuevo.recorridos, { viejo: '2026-01-01T00:00:00.000Z', 'cs-curso': '2026-10-07T10:00:00.000Z' });
  assert.equal((perfil.recorridos as Record<string, string>)['cs-curso'], undefined, 'no muta el objeto que recibe');
});

test('marcar dos veces no es un cambio: se queda la fecha de la primera vez', () => {
  const una = perfilConVisto({}, 'cs-curso', '2026-10-01T00:00:00.000Z');
  const dos = perfilConVisto(una, 'cs-curso', '2026-10-07T00:00:00.000Z');
  assert.deepEqual(dos.recorridos, { 'cs-curso': '2026-10-01T00:00:00.000Z' });
});

test('con el tope lleno se olvida el más viejo, nunca el que se acaba de marcar', () => {
  const recorridos: Record<string, string> = {};
  for (let i = 0; i < TOPE_VISTOS; i++) recorridos[`r-${i}`] = `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`;
  const nuevo = perfilConVisto({ recorridos }, 'cs-curso', '2025-01-01T00:00:00.000Z');
  const ids = Object.keys(nuevo.recorridos as Record<string, string>);
  assert.equal(ids.length, TOPE_VISTOS);
  assert.ok(ids.includes('cs-curso'), 'el recién marcado se queda aunque su fecha sea la más vieja');
  assert.ok(!ids.includes('r-0'), 'se fue el más viejo de los anteriores');
});

test('«visto» sólo SUMA: el server sin contestar no des-ve lo local, y lo local que el server no sabe se le manda', () => {
  assert.deepEqual(vistoDeFuentes(false, false), { visto: false, sincronizar: false }, 'nadie lo vio: se abre');
  assert.deepEqual(vistoDeFuentes(false, true), { visto: true, sincronizar: false }, 'lo vio en otra computadora');
  assert.deepEqual(vistoDeFuentes(true, null), { visto: true, sincronizar: false }, 'el server no contestó: manda lo local');
  assert.deepEqual(vistoDeFuentes(true, false), { visto: true, sincronizar: true }, 'se guardó local mientras el server fallaba');
  assert.deepEqual(vistoDeFuentes(false, null), { visto: false, sincronizar: false });
});

test('lo local es POR PERSONA: quien lo vio en un navegador compartido no se lo esconde (ni se lo marca) a otra', () => {
  const a = '0123456789abcdef';
  const b = 'fedcba9876543210';
  assert.notEqual(claveLocal('cs-curso', a), claveLocal('cs-curso', b), 'dos personas, dos claves');
  assert.notEqual(claveLocal('cs-curso', a), claveLocal('cs-curso'), 'la de la persona no es la del navegador');
  assert.equal(claveLocal('cs-curso', null), claveLocal('cs-curso'), 'sin persona (alumno, server mudo): la del navegador');
  for (const k of [claveLocal('cs-curso', a), claveLocal('cs-curso')]) assert.ok(k.startsWith(PREFIJO_LOCAL), `${k}: el evento storage mira el prefijo`);
  // Un id no lleva punto (`idRecorridoValido`), así que la clave del navegador de un id no
  // puede ser la de una persona con otro.
  assert.ok(!claveLocal('cs-curso').slice(PREFIJO_LOCAL.length).includes('.'));
  // El caso que esto arregla, con datos: A lo vio en este navegador; B entra, el server
  // dice que B no lo vio. Con la clave sola, B lo tenía «visto» y además se le mandaba al
  // server (`sincronizar`). Con la clave de la persona, a B se le abre y no se toca nada.
  const navegador = new Set([claveLocal('cs-curso', a)]);
  assert.deepEqual(vistoDeFuentes(navegador.has(claveLocal('cs-curso', b)), false), { visto: false, sincronizar: false });
  assert.deepEqual(vistoDeFuentes(navegador.has(claveLocal('cs-curso', a)), false), { visto: true, sincronizar: true }, 'lo de A sí se sincroniza para A');
  // La huella viene de la red: se valida antes de meterla en una clave.
  assert.ok(quienValido(a));
  for (const malo of ['0123456789ABCDEF', 'abc', `${a}.x`, null, undefined, 42]) assert.ok(!quienValido(malo), String(malo));
});

test('mientras no se sabe no se abre; para NO abrirlo alcanza una fuente, para abrirlo hay que esperar al server', () => {
  const base = { marcado: false, soloLocal: false };
  assert.equal(vistoActual({ ...base, marcado: true, local: false, servidor: false }), true, 'lo cerró en esta visita');
  assert.equal(vistoActual({ ...base, local: null, servidor: false }), null, 'hidratando: todavía no se leyó el navegador');
  assert.equal(vistoActual({ ...base, local: true, servidor: undefined }), true, 'con lo local alcanza para no abrirlo');
  assert.equal(vistoActual({ ...base, local: false, servidor: undefined }), null, 'sin respuesta del server NO se abre');
  assert.equal(vistoActual({ ...base, local: false, servidor: true }), true, 'lo vio en otra computadora');
  assert.equal(vistoActual({ ...base, local: false, servidor: false }), false, 'nadie lo vio: se abre');
  assert.equal(vistoActual({ ...base, local: false, servidor: null }), false, 'el server no sabe: decide lo local (el respaldo)');
  assert.equal(vistoActual({ marcado: false, soloLocal: true, local: false, servidor: undefined }), false, 'sin sesión no se espera a nadie');
});

// ── El componente, por fuente ─────────────────────────────────────────────────

const COMP = sinComentarios(leer('../app/_ui/Recorrido.tsx'));
/** El cuerpo de `Recorrido`, hasta la función que le sigue. Afirmado por largo: si mide otra cosa, lo dice. */
const RECORRIDO = (() => {
  const ini = COMP.indexOf('export function Recorrido(');
  const fin = COMP.indexOf('export function BotonRecorrido(', ini);
  assert.ok(ini >= 0 && fin > ini, 'no encontré el cuerpo de Recorrido');
  return COMP.slice(ini, fin);
})();
/** El manejador del teclado, entre su `const onKey` y su `addEventListener`. */
const TECLADO = (() => {
  const ini = RECORRIDO.indexOf('const onKey = (e: KeyboardEvent)');
  const fin = RECORRIDO.indexOf("document.addEventListener('keydown', onKey, true)", ini);
  assert.ok(ini >= 0 && fin > ini, 'no encontré el manejador del teclado');
  return RECORRIDO.slice(ini, fin);
})();
/** El efecto del teclado ENTERO, con su limpieza (que es la que devuelve el foco). */
const TECLADO_Y_CIERRE = (() => {
  const ini = RECORRIDO.indexOf('const onKey = (e: KeyboardEvent)');
  const fin = RECORRIDO.indexOf('}, [mostrando, esElDeArriba]);', ini);
  assert.ok(ini >= 0 && fin > ini && fin - ini < 4000, 'no encontré el efecto del teclado');
  return RECORRIDO.slice(ini, fin);
})();

test('el recorrido es una capa ANIDADA de la pila de modales (nunca apaga lo que señala)', () => {
  assert.ok(RECORRIDO.length > 3000 && RECORRIDO.length < 20000, `el recorte de Recorrido mide ${RECORRIDO.length}: está mirando otra cosa`);
  assert.match(RECORRIDO, /useCapaModal\(\s*mostrando\s*,\s*\{\s*anidada:\s*true\s*\}\s*\)/,
    'sin `anidada`, la pila escondería con display:none al modal de atrás, y con él a los objetivos');
  assert.match(RECORRIDO, /display:\s*capa\.visible\s*\?/, 'la capa respeta lo que decide la pila');
});

test('Escape omite el recorrido, sólo si es la capa de arriba, y frena a los otros listeners', () => {
  assert.match(TECLADO, /if\s*\(\s*!esElDeArriba\(\)\s*\)\s*return;/, 'sin la guarda, un Escape cerraría también el modal de atrás');
  const esc = TECLADO.slice(TECLADO.indexOf("e.key === 'Escape'"), TECLADO.indexOf("e.key !== 'Tab'"));
  assert.match(esc, /stopImmediatePropagation\(\)/, 'stopPropagation no frena a los otros listeners de document');
  assert.match(esc, /onCerrarRef\.current\('omitido'\)/);
  assert.ok(TECLADO.indexOf('esElDeArriba()') < TECLADO.indexOf("e.key === 'Escape'"), 'la guarda va ANTES del Escape');
  assert.match(RECORRIDO, /addEventListener\('keydown', onKey, true\)/, 'en captura, como todos los Escape de la casa');
});

test('es un diálogo accesible: role, aria-modal, título y foco atrapado', () => {
  assert.match(RECORRIDO, /role="dialog"/);
  assert.match(RECORRIDO, /aria-modal="true"/);
  assert.match(RECORRIDO, /aria-labelledby=\{tituloId\}/);
  assert.match(RECORRIDO, /<h2 id=\{tituloId\}/, 'el título que nombra el diálogo es el del paso');
  assert.match(TECLADO, /e\.key !== 'Tab'/, 'el Tab se queda adentro de la tarjeta');
  assert.match(RECORRIDO, /tabIndex=\{-1\}/, 'la tarjeta recibe el foco en cada paso');
});

test('por encima de la sidebar y de la barra de agencia (medido del fuente, no de una tabla)', () => {
  const zDe = (src: string, ancla: RegExp, que: string): number => {
    const m = sinComentarios(src).match(ancla);
    assert.ok(m, `no encontré el z-index de ${que}`);
    return Number(m![1]);
  };
  const sidebar = zDe(leer('../app/_components/Sidebar.tsx'), /<aside data-sidebar[^>]*?zIndex:\s*(\d+)/, 'la sidebar');
  const barra = zDe(leer('../app/_components/ImpersonationBanner.tsx'), /position:\s*'fixed',\s*top:\s*0,[^}]*?zIndex:\s*(\d+)/, 'la barra de agencia');
  const toast = zDe(leer('../app/_ui/Toast.tsx'), /position:\s*'fixed'[^}]*?zIndex:\s*(\d+)/, 'el toast');
  const confirm = zDe(leer('../app/_ui/Confirm.tsx'), /const Z_CONFIRM = (\d+);/, 'el confirm');
  assert.ok(Z_PISO_RECORRIDO > sidebar, `piso ${Z_PISO_RECORRIDO} ≤ sidebar ${sidebar}`);
  assert.ok(Z_PISO_RECORRIDO > barra, `piso ${Z_PISO_RECORRIDO} ≤ barra de agencia ${barra}`);
  assert.ok(Z_PISO_RECORRIDO < toast, `piso ${Z_PISO_RECORRIDO} ≥ toast ${toast}: un «Deshacer» quedaría tapado`);
  assert.ok(Z_PISO_RECORRIDO < confirm, `piso ${Z_PISO_RECORRIDO} ≥ confirm ${confirm}`);
  assert.match(RECORRIDO, /const z = Math\.max\(capa\.z, Z_PISO_RECORRIDO\)/, 'el piso se aplica');
  assert.match(RECORRIDO, /zIndex:\s*z\b/);
  assert.match(RECORRIDO, /createPortal\([\s\S]*document\.body\s*,?\s*\)/, 'en un portal: un ancestro con transform o sticky le recortaría el z-index');
});

test('un objetivo oculto es un objetivo ausente: no se dibuja una flecha a la nada', () => {
  const f = COMP.slice(COMP.indexOf('function objetivoEnDom('), COMP.indexOf('const presentesEnDom'));
  assert.ok(f.length > 50 && f.length < 800, `el recorte de objetivoEnDom mide ${f.length}`);
  assert.match(f, /getClientRects\(\)\.length > 0/, 'un nodo con display:none no tiene cajas: cuenta como que no está');
  assert.match(f, /catch\s*\{\s*return null;/, 'un selector inválido es «no está», no una excepción');
  // Y la navegación pasa por saltear: los botones y el arranque usan la lógica pura.
  assert.match(RECORRIDO, /primerVisible\(presentesEnDom\(/);
  assert.match(RECORRIDO, /siguienteVisible\(presentesEnDom\(pasosRef\.current\), indice\)/);
});

test('ningún hook detrás del primer return, y la hoja respeta el movimiento reducido y los tokens', () => {
  const primerReturn = RECORRIDO.indexOf('if (!mostrando || indice === null) return null;');
  assert.ok(primerReturn > 0, 'no encontré el return temprano');
  const despues = RECORRIDO.slice(primerReturn);
  assert.doesNotMatch(despues, /\buse(?:State|Effect|LayoutEffect|Ref|Callback|Memo|Id|CapaModal)\(/, 'un hook detrás de un return deja la pantalla en blanco (React #300)');
  const css = COMP.slice(COMP.indexOf('const CSS = '));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'sin colores sueltos: el velo y la tarjeta salen de los tokens');
  assert.match(COMP, /menosMovimiento\(\) \? 'auto' : 'smooth'/, 'el scroll tampoco anima con movimiento reducido');
});

test('el gancho decide con la lógica pura y lee lo local sin desfasar la hidratación', () => {
  const g = COMP.slice(COMP.indexOf('export function useRecorrido('), COMP.indexOf('const CSS = '));
  assert.ok(g.length > 500 && g.length < 6000, `el recorte de useRecorrido mide ${g.length}`);
  assert.match(g, /const visto = vistoActual\(\{/, 'la decisión es la de lib/recorridos.ts, no una copia');
  assert.match(g, /useSyncExternalStore\(suscribirLocal, \(\) => \(clave \? leerLocal\(clave\) : null\), \(\) => null\)/,
    'en el server lo local es «no sé» (null); leerlo en un useState daría otro HTML que el del server');
  assert.match(g, /const abierto = modo === 'abierto' \|\| \(modo === 'auto' && autoabrir && visto === false\)/,
    'se abre solo con un «false» explícito: con null (no se sabe) no');
});

test('el gancho lee y sincroniza lo local con la clave de la PERSONA, no con la del navegador', () => {
  const g = COMP.slice(COMP.indexOf('export function useRecorrido('), COMP.indexOf('const CSS = '));
  assert.match(g, /const clave = soloLocal \? claveLocal\(id\) : resp \? claveLocal\(id, resp\.quien\) : null;/,
    'con sesión, la clave lleva la huella que manda el server; sin ella, no se lee nada todavía');
  assert.match(g, /vistoDeFuentes\(leerLocal\(claveLocal\(id, quien\)\), enServidor\)\.sincronizar/,
    'sincronizar con la clave del navegador le marca al server lo que vio OTRA persona');
  assert.match(g, /const quien = quienValido\(j\.quien\) \? j\.quien : null;/, 'la huella viene de la red: se valida');
  assert.match(g, /if \(!soloLocal\) guardarEnServidor\(id\);/, 'el portal del alumno no tiene sesión: no le pega al server');
  assert.doesNotMatch(g, /leerLocal\(id\)|leerLocal\(claveLocal\(id\)\)/, 'ninguna lectura con la clave del navegador sin pasar por `clave`');
});

// ── Lo que el componente promete y la firma no muestra (revisión del 08/10/2026) ──
// Cada uno de estos daba VERDE roto antes de tener su test (ver la tabla de arriba).

test('la tarjeta se mide recién con la capa visible (en display:none mide 0×0 y cae al respaldo)', () => {
  assert.match(RECORRIDO, /const visible = capa\.visible;\s*useLayoutEffect\(\(\) => \{\s*if \(indice == null \|\| !visible\) return;/,
    'sin la guarda, el primer render (todavía fuera de la pila) mide la tarjeta en display:none');
  assert.match(RECORRIDO, /\}, \[indice, medir, visible\]\);/, 'y vuelve a medir cuando la capa se hace visible');
});

test('el foco va a la tarjeta cuando YA está medida (visibility:hidden no recibe el foco)', () => {
  assert.match(RECORRIDO,
    /useEffect\(\(\) => \{\s*if \(indice == null \|\| !medida\) return;\s*tarjetaRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*\}, \[indice, medida\]\);/,
    'con sólo [indice] el primer paso nace sin foco y el lector de pantalla no anuncia nada');
  assert.match(TECLADO_Y_CIERRE, /previo\?\.focus\?\.\(\{ preventScroll: true \}\)/, 'al cerrar, el foco vuelve a donde estaba');
});

test('scrollIntoView SÓLO si el objetivo no se ve entero (scrollea hasta los ancestros con overflow:hidden)', () => {
  assert.match(RECORRIDO, /const \{ scroll, bloque \} = necesitaScroll\(cajaDe\(el\.getBoundingClientRect\(\)\), ventanaActual\(\)\);\s*if \(scroll\) el\.scrollIntoView\(/);
});

test('la hoja no tiene ningún backtick adentro (una la cierra a la mitad)', () => {
  // Sobre el fuente CRUDO: sin comentarios, un backtick escrito en un comentario de CSS
  // (que es justo como se cuela) desaparecería antes de contarlo.
  const crudo = leer('../app/_ui/Recorrido.tsx');
  const hoja = crudo.slice(crudo.indexOf('const CSS = `'));
  assert.ok(hoja.length > 2000, `el recorte de la hoja mide ${hoja.length}: está mirando otra cosa`);
  assert.equal((hoja.match(/`/g) ?? []).length, 2, 'la hoja abre y cierra: cualquier otro backtick la parte');
  assert.match(hoja, /`;\s*$/, 'la hoja es lo último del archivo (si no, el conteo de arriba mira código ajeno)');
});

// ── La ruta ───────────────────────────────────────────────────────────────────

test('la ruta guarda por PERSONA (la sesión) y conserva el resto del perfil', () => {
  const r = sinComentarios(leer('../app/api/recorridos/route.ts'));
  assert.match(r, /getUsuarioActual\(\)/);
  assert.doesNotMatch(r, /getWorkspaceActual|getTenantDb/, 'el recorrido es de quien está frente al teclado, no del workspace que mira');
  assert.match(r, /perfilConVisto\(fila\.perfil, id, ahora\)/, 'el jsonb se arma desde el que había');
  assert.match(r, /\.eq\('updated_at', fila\.updated_at\)/, 'compare-and-set: otro escritor del perfil no se pisa');
  assert.match(r, /if \(Array\.isArray\(data\) && data\.length > 0\) return/,
    'el CAS escribió sólo si devolvió la fila: sin mirarlo, un choque se contesta «guardado» sin guardar');
  assert.match(r, /idRecorridoValido\(body\.id\)/, 'el id se valida antes de escribirlo como clave');
});

test('la ruta manda la huella de la persona en TODAS las respuestas del GET, el 503 incluido', () => {
  const r = sinComentarios(leer('../app/api/recorridos/route.ts'));
  const get = r.slice(r.indexOf('export async function GET()'), r.indexOf('const INTENTOS'));
  assert.ok(get.length > 200 && get.length < 2000, `el recorte del GET mide ${get.length}`);
  const respuestas = [...get.matchAll(/Response\.json\(\{[^}]*\}/g)].map((m) => m[0]);
  assert.equal(respuestas.length, 3, 'sin fila, con fila y el 503');
  for (const x of respuestas) assert.match(x, /\bquien\b/, `sin la huella, el respaldo del navegador vuelve a ser de todos: ${x}`);
  assert.ok(get.indexOf('let quien') < get.indexOf('try {'), 'se declara antes del try: el catch la tiene que poder nombrar');
});

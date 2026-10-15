// La Ticketera, el mazo (/tickets/decisiones): la cola, lo que viene marcado, el gesto, «Resuelta»,
// las rutas del teléfono, el guard y que contesta con la MISMA acción que la lista.
//
// Cada test se probó rompiendo la pieza que cuida (scratchpad/romper-mazo.mjs); el resultado de
// cada rotura va en el comentario del test, contra una base de 12 pases y 0 fallos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { colaInicial, marcadaInicial, porDecidir, puedeMandar, rotuloMandar, veredictoGesto, TICKETERA } from '../app/tickets/decisiones/reglas';
import { MazoDecisiones } from '../app/tickets/decisiones/Mazo';
import { OTRA, RESUELTA, type Decision } from '../app/admin/runway/decisiones';
import { rutaEscritorio, rutaMovil } from '../lib/movil-rutas';
import { esTrabajo } from '../app/m/_ui/cabecera';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGINAS = ['app/tickets/decisiones/page.tsx', 'app/tickets/decisiones/lista/page.tsx', 'app/m/tickets/decisiones/page.tsx', 'app/m/decisiones/page.tsx'];

let n = 0;
function dec(p: Partial<Decision> = {}): Decision {
  n += 1;
  return {
    id: n, ref: `d-${n}`, chat: 'Chat', pregunta: `¿Pregunta ${n}?`,
    opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }],
    destraba: null, contexto: null, recomendada: null, urgencia: 'criterio', href: null, orden: 100,
    respuesta: null, respuestaTexto: null, respondidaAt: null, recogidaAt: null, creadaAt: '2026-10-14T16:00:00Z',
    ...p,
  };
}
const responder = async () => ({ error: null, ok: true });
const deshacer = async () => ({ error: null, ok: true, yaRecogida: false });

// Rotura «sin el reparto por urgencia» (cola = las pendientes tal cual llegan) → 10 pases, 2 fallos
// (este y la tarjeta dibujada, que espera adelante lo que frena a un chat).
test('la cola: sólo lo pendiente, primero lo que frena a un chat y al final los avisos (que no se cuentan)', () => {
  const aviso = dec({ urgencia: 'aviso', orden: 1 });
  const criterio = dec({ urgencia: 'criterio', orden: 1 });
  const hecha = dec({ urgencia: 'bloquea', respuesta: 'A' });
  const cuesta = dec({ urgencia: 'cuesta', orden: 5 });
  const frena2 = dec({ urgencia: 'bloquea', orden: 20 });
  const frena1 = dec({ urgencia: 'bloquea', orden: 10 });
  const cola = colaInicial([aviso, criterio, hecha, cuesta, frena2, frena1]);
  assert.deepEqual(cola.map((d) => d.id), [frena1.id, frena2.id, cuesta.id, criterio.id, aviso.id]);
  assert.equal(porDecidir(cola), 4, 'un aviso no es una decisión');
});

// Rotura «la recomendada antes que lo contestado» → 11 pases, 1 fallo.
test('lo que viene marcado: lo ya contestado, escribir, la recomendada, la única opción, o nada', () => {
  assert.equal(marcadaInicial(dec({ recomendada: 'B', respuesta: 'A' })), 'A', 'vuelve con «Cambiar»: su respuesta');
  assert.equal(marcadaInicial(dec({ recomendada: 'B', respuesta: RESUELTA })), 'B', 'una «Resuelta» que vuelve no marca nada raro');
  assert.equal(marcadaInicial(dec({ opciones: [] })), OTRA, 'sin opciones se escribe');
  assert.equal(marcadaInicial(dec({ recomendada: 'B' })), 'B');
  assert.equal(marcadaInicial(dec({ opciones: [{ clave: 'A', texto: 'Entendido' }] })), 'A', 'un aviso con «Entendido»');
  assert.equal(marcadaInicial(dec()), null, 'dos opciones sin recomendada: la elige él');
  assert.equal(marcadaInicial(dec({ recomendada: 'Z' })), null, 'una recomendada que no está entre las opciones no se marca');
});

// Rotura «puedeMandar sin mirar el texto» (OTRA vacía se manda) → 11 pases, 1 fallo.
test('se manda sólo lo que el server aceptaría', () => {
  const d = dec();
  assert.equal(puedeMandar(d, null, ''), false);
  assert.equal(puedeMandar(d, 'A', ''), true);
  assert.equal(puedeMandar(d, 'C', ''), false, 'una opción que no existe');
  assert.equal(puedeMandar(d, OTRA, '   '), false, 'escrita y vacía');
  assert.equal(puedeMandar(d, OTRA, 'que lo vea Mau'), true);
  assert.equal(rotuloMandar(dec({ recomendada: 'A' }), 'A'), 'Aprobar');
  assert.equal(rotuloMandar(dec({ recomendada: 'A' }), 'B'), 'Mandar B');
  assert.equal(rotuloMandar(dec(), null), 'Elige una');
});

// Rotura «el tirón no cuenta» (sólo distancia, como el primero) → 11 pases, 1 fallo; y «tirar
// para atrás no la devuelve» (sin `vuelve`) → 11 pases, 1 fallo.
test('el gesto (px y px/s de motion): distancia O tirón para el mismo lado; arrepentirse la devuelve', () => {
  const ancho = 360; // umbral = max(100, 100,8) = 100,8 px
  assert.equal(veredictoGesto({ dx: 60, vx: 100, ancho }), null, 'corto y lento: vuelve con el resorte');
  assert.equal(veredictoGesto({ dx: 120, vx: 0, ancho }), 'derecha', 'lejos y quieto: cuenta');
  assert.equal(veredictoGesto({ dx: -120, vx: 0, ancho }), 'izquierda');
  assert.equal(veredictoGesto({ dx: 50, vx: 900, ancho }), 'derecha', 'corto pero RÁPIDO: cuenta igual que uno largo');
  assert.equal(veredictoGesto({ dx: -45, vx: -700, ancho }), 'izquierda');
  assert.equal(veredictoGesto({ dx: 30, vx: 2000, ancho }), null, 'un tirón sin salir del lugar no');
  assert.equal(veredictoGesto({ dx: 50, vx: -900, ancho }), null, 'un tirón para el otro lado no');
  assert.equal(veredictoGesto({ dx: 140, vx: -800, ancho }), null, 'lejos pero tirando para atrás: se arrepintió');
  assert.equal(veredictoGesto({ dx: 140, vx: -50, ancho }), 'derecha', 'un temblor para atrás no cancela');
  assert.equal(veredictoGesto({ dx: 100, vx: 0, ancho: 200 }), 'derecha', 'en una tarjeta angosta el piso es 100 px');
});

// Rotura «arrastre escrito a mano» (sin drag de motion) → 11 pases, 1 fallo; y «una transición de
// CSS sobre la tarjeta» → 11 pases, 1 fallo.
test('el gesto es el de la librería, y el CSS no le pelea el transform', () => {
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  assert.match(mazo, /from 'motion\/react'/);
  for (const prop of ['drag="x"', 'dragDirectionLock', 'dragElastic={1}', 'dragConstraints={{ left: 0, right: 0 }}', 'onDragEnd={alSoltar}']) {
    assert.ok(mazo.includes(prop), `falta ${prop}`);
  }
  assert.doesNotMatch(mazo, /setPointerCapture|onPointerMove|pointermove/, 'nada de física a mano');
  assert.match(mazo, /useTransform\(x, \[-320, 0, 320\], \[-16, 0, 16\]\)/, 'se inclina mientras se arrastra');
  const css = sinComentarios(leer('app/tickets/decisiones/mazo.css'));
  // El bloque con scroll de adentro corta el touch-action: sin esto el dedo no mueve la tarjeta
  // (pointercancel) y Chrome usa el gesto para volver atrás. Rotura «sin el pan-y del cuerpo» →
  // 11 pases, 1 fallo.
  assert.match(css, /\.mazo-cuerpo \{[^}]*overflow-y: auto[^}]*touch-action: pan-y/);
  for (const regla of css.matchAll(/([^{}]*\.mazo-carta[^{}]*)\{([^}]*)\}/g)) {
    assert.doesNotMatch(regla[2], /transition|transform\s*:/, `${regla[1].trim()} le pelea el transform a motion`);
  }
});

// Rotura «Resuelta manda una opción» (s === 'arriba' sin RESUELTA) → 11 pases, 1 fallo.
test('«Resuelta» sale sin elegir: manda RESUELTA y está en la franja del pulgar', () => {
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  assert.match(mazo, /const clave = s === 'derecha' \? marcada! : s === 'arriba' \? RESUELTA : null;/);
  assert.match(mazo, /onClick=\{\(\) => decidir\('arriba'\)\}/);
});

// Rotura «sin la fila del teléfono en rutaMovil» → 11 pases, 1 fallo.
test('en el teléfono, la MISMA URL sirve la página de /m: el mazo como pantalla de trabajo', () => {
  assert.equal(rutaMovil('/tickets/decisiones'), '/m/tickets/decisiones');
  assert.equal(rutaEscritorio('/m/tickets/decisiones'), '/tickets/decisiones');
  assert.equal(rutaMovil('/admin/runway'), '/m/tickets/decisiones', 'la entrada vieja va al mazo');
  assert.equal(rutaMovil('/tickets'), null, 'la tab de los clientes no se toca');
  assert.equal(esTrabajo('/m/tickets/decisiones'), true, 'sin la barra de abajo desde el HTML del server');
  assert.match(sinComentarios(leer('app/m/mas/page.tsx')), /titulo="Ticketera" href=\{RUTA_TICKETERA\}/);
  assert.match(leer('app/m/mas/page.tsx'), /const RUTA_TICKETERA = '\/m\/tickets\/decisiones'/, 'More entra directo al mazo');
});

// Rotura «sin el notFound del guard» → 11 pases, 1 fallo.
test('sólo el super admin: el guard va antes de leer, en las cuatro páginas', () => {
  for (const r of PAGINAS) {
    const src = sinComentarios(leer(r));
    const guard = src.indexOf('await getSesionAdmin()');
    const lee = src.indexOf('await leerDecisiones()');
    assert.ok(guard > 0 && lee > guard, `${r}: getSesionAdmin antes de leer`);
    assert.match(src.slice(guard, lee), /if \(!admin\) (notFound\(\)|redirect\()/, `${r}: sin sesión de admin no sigue`);
  }
});

// Rotura «la página del teléfono con una acción propia» → 11 pases, 1 fallo.
test('una sola fuente: las cuatro páginas contestan con la misma acción, y se llaman «Ticketera»', () => {
  for (const r of PAGINAS) {
    const src = sinComentarios(leer(r));
    assert.match(src, /import \{[^}]*responderDecision[^}]*\} from '@\/app\/admin\/runway\/acciones'/, r);
    assert.match(src, /responder=\{responderDecision\}/, r);
    assert.match(src, /titulo="Ticketera"/, `${r}: se llama Ticketera`);
  }
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  assert.doesNotMatch(mazo, /admin_decisiones|fetch\(/, 'el mazo no lee ni escribe por su cuenta');
  assert.match(sinComentarios(leer('app/admin/runway/page.tsx')), /redirect\(await rutaConWs\(TICKETERA\)\)/);
  assert.equal(TICKETERA, '/tickets/decisiones');
});

// Rotura «la salida y el rechazo sin esperarse» (pedido.then suelto) → 11 pases, 1 fallo.
test('un rechazo rápido no lo pisa la salida: el resultado se aplica después de que la tarjeta se fue', () => {
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  assert.match(mazo, /Promise\.all\(\[pedido, salida\]\)/);
});

// Rotura «rótulo fijo «Aprobar»» → 10 pases, 2 fallos (este y el de lo que se manda).
test('la tarjeta dibujada: pregunta, opciones, el ✓ dice qué manda, «Resuelta» y el cambio de vista', () => {
  const html = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: true, decisiones: [
      dec({ urgencia: 'criterio', pregunta: '¿Sin recomendada?', orden: 1 }),
      dec({ urgencia: 'bloquea', pregunta: '¿La primera?', recomendada: 'A', contexto: 'El porqué' }),
    ] },
    responder, deshacer,
  }));
  const frente = html.slice(html.lastIndexOf('<article'));
  assert.match(frente, /¿La primera\?/, 'adelante va lo que frena a un chat');
  assert.match(frente, /Recomendada/);
  assert.match(frente, /Ver detalle/);
  assert.doesNotMatch(frente, /El porqué/, 'el detalle arranca cerrado');
  assert.match(html, /<span>Después<\/span>/);
  assert.match(html, /<span>Resuelta<\/span>/);
  assert.match(html, /<span>Aprobar<\/span>/);
  assert.match(html, /<b>2<\/b> por decidir/);
  assert.match(html, /aria-current="page"[^>]*>Tarjetas</, 'el mazo es la vista que se está viendo');
  assert.doesNotMatch(html, /Capital|US\$|días/, 'nada de runway en la Ticketera');
  // Sin recomendada no viene nada marcado: el ✓ lo dice y queda apagado (no manda a ciegas).
  const sinReco = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: true, decisiones: [dec({ urgencia: 'bloquea', pregunta: '¿Sin recomendada?' })] },
    responder, deshacer,
  }));
  assert.match(sinReco, /aria-disabled="true"[^>]*><svg[\s\S]*?<span>Elige una<\/span>/);
});

// Rotura «sin el estado vacío» (return null) → 11 pases, 1 fallo.
test('sin nada pendiente lo dice, y la falla de lectura también', () => {
  const vacio = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: true, decisiones: [dec({ respuesta: 'A' })] },
    responder, deshacer,
  }));
  assert.match(vacio, /Nada por decidir/);
  assert.match(vacio, /Ver la lista/);
  const falla = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: false, faltaTabla: false, error: 'x' },
    responder, deshacer,
  }));
  assert.match(falla, /No se pudieron leer las decisiones/);
});

// =============================================================================
// «Volver»: Martín, 14/10/2026 — «arrastré sin querer una tarjeta y ya no tengo forma de volver»
// =============================================================================
// Rotura «Volver sólo en el aviso» (el botón de arriba sacado) → 15 pases, 1 fallo, contra una base de 16 y 0.
test('«Volver» vive arriba y SIEMPRE: apagado cuando no hay nada que traer, nunca escondido', () => {
  const html = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: true, decisiones: [dec({ urgencia: 'bloquea' })] },
    responder, deshacer,
  }));
  const volver = html.match(/<button[^>]*class="mazo-volver"[^>]*>/)?.[0] ?? '';
  assert.ok(volver, 'el botón de volver se dibuja al entrar, sin haber deslizado nada');
  assert.match(volver, /disabled/, 'arranca apagado: todavía no salió ninguna');
  assert.match(html, /<span>Volver<\/span>/, 'con su rótulo, no sólo el ícono');
});

// Rotura «deshacer sólo en la pantalla» (sin la llamada a `deshacer`) → 15 pases, 1 fallo.
test('volver una contestada la despega de la BASE; una «después» no, que nunca se guardó', () => {
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  const i = mazo.indexOf('const volver =');
  const cuerpo = mazo.slice(i, mazo.indexOf('const marcar =', i));
  assert.ok(i > 0 && cuerpo.length > 200 && cuerpo.length < 2000, `el cuerpo de volver mide ${cuerpo.length}`);
  assert.match(cuerpo, /if \(!u\.clave\) return;/, 'una «después» no tiene nada que deshacer en la base');
  assert.match(cuerpo, /void deshacer\(fd\)/, 'una contestada vuelve a estar pendiente');
  assert.match(cuerpo, /yaRecogida/, 'y si el chat ya la leyó, lo dice');
  // La acción y la escritura existen, y la escritura borra las TRES marcas de contestada.
  const acc = sinComentarios(leer('app/admin/runway/acciones.ts'));
  assert.match(acc, /export async function deshacerDecision/);
  assert.match(acc, /const admin = await getSesionAdmin\(\);[\s\S]{0,120}deshacerRespuesta/, 'el guard antes de escribir');
  const lib = sinComentarios(leer('lib/admin-decisiones.ts'));
  const upd = lib.slice(lib.indexOf('export async function deshacerRespuesta'));
  for (const campo of ['respuesta: null', 'respuesta_texto: null', 'respondida_at: null']) {
    assert.ok(upd.includes(campo), `falta ${campo}: la decisión seguiría contestada`);
  }
});

// Tres roturas, cada una 15 pases y 1 fallo: el desplazamiento de vuelta a +14 (asoma por abajo), el
// `transform-origin: 50% 110%` devuelto al CSS, y la franja del pulgar sin fondo.
test('la tarjeta de atrás asoma por ARRIBA: por abajo se metía detrás de los botones', () => {
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  const i = mazo.indexOf('function CartaAtras');
  const cuerpo = mazo.slice(i, mazo.indexOf('function CuerpoCarta', i));
  assert.match(cuerpo, /useTransform\(progreso, \[0, 1\], \[-\d+, 0\]\)/, 'el desplazamiento es NEGATIVO (hacia arriba)');
  const css = sinComentarios(leer('app/tickets/decisiones/mazo.css'));
  for (const regla of css.matchAll(/([^{}]*\.mazo-carta[^{}]*)\{([^}]*)\}/g)) {
    assert.doesNotMatch(regla[2], /transform-origin/, `${regla[1].trim()}: con el origen abajo, el borde de abajo caia fuera de la pila`);
  }
  // Y la franja del pulgar es opaca y va encima: la red para todo lo demás que se mueva ahí.
  const acciones = css.slice(css.indexOf('.mazo-acciones {'), css.indexOf('.mazo-btn {'));
  assert.match(acciones, /z-index: 5/);
  assert.match(acciones, /background: var\(--bg\)/);
});

// Rotura «la página del teléfono sin deshacer» → 15 pases, 1 fallo.
test('las dos páginas del mazo pasan el deshacer; la lista no lo necesita', () => {
  for (const r of ['app/tickets/decisiones/page.tsx', 'app/m/tickets/decisiones/page.tsx']) {
    const src = sinComentarios(leer(r));
    assert.match(src, /deshacerDecision/, `${r}: sin la acción, volver no despega la respuesta`);
    assert.match(src, /deshacer=\{deshacerDecision\}/, r);
  }
});

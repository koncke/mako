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
    assert.match(src, /import \{ responderDecision \} from '@\/app\/admin\/runway\/acciones'/, r);
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
    responder,
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
    responder,
  }));
  assert.match(sinReco, /aria-disabled="true"[^>]*><svg[\s\S]*?<span>Elige una<\/span>/);
});

// Rotura «sin el estado vacío» (return null) → 11 pases, 1 fallo.
test('sin nada pendiente lo dice, y la falla de lectura también', () => {
  const vacio = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: true, decisiones: [dec({ respuesta: 'A' })] },
    responder,
  }));
  assert.match(vacio, /Nada por decidir/);
  assert.match(vacio, /Ver la lista/);
  const falla = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: false, faltaTabla: false, error: 'x' },
    responder,
  }));
  assert.match(falla, /No se pudieron leer las decisiones/);
});

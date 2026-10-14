// El mazo de decisiones (/tickets/decisiones): la cola, lo que viene marcado, el gesto, la ruta
// del teléfono, el guard y que contesta con la MISMA acción que /admin/runway.
//
// Cada test se probó rompiendo la pieza que cuida (scratchpad/romper-mazo.mjs); el resultado de
// cada rotura va en el comentario del test, contra una base de 10 pases y 0 fallos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { colaInicial, marcadaInicial, puedeMandar, rotuloMandar, veredictoGesto } from '../app/tickets/decisiones/reglas';
import { MazoDecisiones } from '../app/tickets/decisiones/Mazo';
import { OTRA, type Decision } from '../app/admin/runway/decisiones';
import { rutaEscritorio, rutaMovil } from '../lib/movil-rutas';
import { esTrabajo } from '../app/m/_ui/cabecera';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

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

// Rotura «sin el reparto por urgencia» (cola = las pendientes tal cual llegan) → 8 pases, 2 fallos
// (este y la tarjeta dibujada, que espera adelante lo que frena a un chat).
test('la cola: sólo lo pendiente, primero lo que frena a un chat y al final los avisos', () => {
  const aviso = dec({ urgencia: 'aviso', orden: 1 });
  const criterio = dec({ urgencia: 'criterio', orden: 1 });
  const hecha = dec({ urgencia: 'bloquea', respuesta: 'A' });
  const cuesta = dec({ urgencia: 'cuesta', orden: 5 });
  const frena2 = dec({ urgencia: 'bloquea', orden: 20 });
  const frena1 = dec({ urgencia: 'bloquea', orden: 10 });
  const cola = colaInicial([aviso, criterio, hecha, cuesta, frena2, frena1]);
  assert.deepEqual(cola.map((d) => d.id), [frena1.id, frena2.id, cuesta.id, criterio.id, aviso.id]);
});

// Rotura «la recomendada antes que lo ya contestado» → 9 pases, 1 fallo.
test('lo que viene marcado: lo ya contestado, escribir, la recomendada, la única opción, o nada', () => {
  assert.equal(marcadaInicial(dec({ recomendada: 'B', respuesta: 'A' })), 'A', 'vuelve con «Cambiar»: su respuesta');
  assert.equal(marcadaInicial(dec({ opciones: [] })), OTRA, 'sin opciones se escribe');
  assert.equal(marcadaInicial(dec({ recomendada: 'B' })), 'B');
  assert.equal(marcadaInicial(dec({ opciones: [{ clave: 'A', texto: 'Entendido' }] })), 'A', 'un aviso con «Entendido»');
  assert.equal(marcadaInicial(dec()), null, 'dos opciones sin recomendada: la elige él');
  assert.equal(marcadaInicial(dec({ recomendada: 'Z' })), null, 'una recomendada que no está entre las opciones no se marca');
});

// Rotura «puedeMandar sin mirar el texto» (OTRA vacía se manda) → 9 pases, 1 fallo.
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

// Rotura «el tirón cuenta aunque vaya para atrás» (sin `vuelve`) → 9 pases, 1 fallo.
test('el gesto: distancia o tirón, para el mismo lado; arrepentirse la devuelve', () => {
  const ancho = 360; // umbral = max(96, 100,8) = 100,8 px
  assert.equal(veredictoGesto({ dx: 60, vx: 0.1, ancho }), null, 'corto y lento: vuelve');
  assert.equal(veredictoGesto({ dx: 120, vx: 0, ancho }), 'derecha', 'lejos y quieto: cuenta');
  assert.equal(veredictoGesto({ dx: -120, vx: 0, ancho }), 'izquierda');
  assert.equal(veredictoGesto({ dx: 50, vx: 0.9, ancho }), 'derecha', 'un tirón rápido ya fuera del lugar');
  assert.equal(veredictoGesto({ dx: 30, vx: 2, ancho }), null, 'un tirón sin salir del lugar no');
  assert.equal(veredictoGesto({ dx: 140, vx: -0.8, ancho }), null, 'lejos pero tirando para atrás: se arrepintió');
  assert.equal(veredictoGesto({ dx: 140, vx: -0.05, ancho }), 'derecha', 'un temblor para atrás no cancela');
  assert.equal(veredictoGesto({ dx: 100, vx: 0, ancho: 200 }), 'derecha', 'en una tarjeta angosta el piso es 96 px');
});

// Rotura «sin la fila del teléfono en rutaMovil» → 9 pases, 1 fallo.
test('en el teléfono, la MISMA URL sirve la página de /m, como pantalla de trabajo', () => {
  assert.equal(rutaMovil('/tickets/decisiones'), '/m/tickets/decisiones');
  assert.equal(rutaEscritorio('/m/tickets/decisiones'), '/tickets/decisiones');
  assert.equal(rutaMovil('/tickets'), null, 'la tab de los clientes no se toca');
  assert.equal(esTrabajo('/m/tickets/decisiones'), true, 'sin la barra de abajo desde el HTML del server');
});

// Rotura «sin el notFound del guard» → 9 pases, 1 fallo.
test('sólo el super admin: el guard va antes de leer, en las dos páginas', () => {
  for (const r of ['app/tickets/decisiones/page.tsx', 'app/m/tickets/decisiones/page.tsx']) {
    const src = sinComentarios(leer(r));
    const guard = src.indexOf('await getSesionAdmin()');
    const lee = src.indexOf('await leerDecisiones()');
    assert.ok(guard > 0 && lee > guard, `${r}: getSesionAdmin antes de leer`);
    assert.match(src.slice(guard, lee), /if \(!admin\) (notFound\(\)|redirect\()/, `${r}: sin sesión de admin no sigue`);
  }
});

// Rotura «la página del teléfono con una acción propia» → 9 pases, 1 fallo.
test('una sola fuente: las dos páginas contestan con la acción de /admin/runway', () => {
  for (const r of ['app/tickets/decisiones/page.tsx', 'app/m/tickets/decisiones/page.tsx']) {
    const src = sinComentarios(leer(r));
    assert.match(src, /import \{ responderDecision \} from '@\/app\/admin\/runway\/acciones'/, r);
    assert.match(src, /responder=\{responderDecision\}/, r);
  }
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  assert.doesNotMatch(mazo, /admin_decisiones|fetch\(/, 'el mazo no lee ni escribe por su cuenta');
});

// Rotura «la salida y el rechazo sin esperarse» (pedido.then suelto) → 9 pases, 1 fallo.
test('un rechazo rápido no lo pisa la salida: el resultado se aplica después de que la tarjeta se fue', () => {
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  assert.match(mazo, /Promise\.all\(\[pedido, salida\]\)/);
});

// Rotura «sin «Elige una» cuando no hay recomendada» (rótulo fijo «Aprobar») → 8 pases, 2 fallos
// (este y el de lo que se manda).
test('la tarjeta dibujada: pregunta, opciones, y el ✓ dice qué manda', () => {
  const html = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: true, decisiones: [
      dec({ urgencia: 'criterio', pregunta: '¿Sin recomendada?', orden: 1 }),
      dec({ urgencia: 'bloquea', pregunta: '¿La primera?', recomendada: 'A', contexto: 'El porqué' }),
    ] },
    responder: async () => ({ error: null, ok: true }),
    tablero: '/admin/runway',
  }));
  const frente = html.slice(html.lastIndexOf('<article'));
  assert.match(frente, /¿La primera\?/, 'adelante va lo que frena a un chat');
  assert.match(frente, /Recomendada/);
  assert.match(frente, /Ver detalle/);
  assert.doesNotMatch(frente, /El porqué/, 'el detalle arranca cerrado');
  assert.match(html, /Después/);
  assert.match(html, /<span>Aprobar<\/span>/);
  assert.match(html, /<b>2<\/b> por decidir/);
  // Sin recomendada no viene nada marcado: el ✓ lo dice y queda apagado (no manda a ciegas).
  const sinReco = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: true, decisiones: [dec({ urgencia: 'bloquea', pregunta: '¿Sin recomendada?' })] },
    responder: async () => ({ error: null, ok: true }),
    tablero: '/admin/runway',
  }));
  assert.match(sinReco, /aria-disabled="true"[^>]*><svg[\s\S]*?<span>Elige una<\/span>/);
});

// Rotura «sin el estado vacío» (return null) → 9 pases, 1 fallo.
test('sin nada pendiente lo dice, y la falla de lectura también', () => {
  const vacio = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: true, decisiones: [dec({ respuesta: 'A' })] },
    responder: async () => ({ error: null, ok: true }),
    tablero: '/admin/runway',
  }));
  assert.match(vacio, /Nada por decidir/);
  assert.match(vacio, /Ver el tablero/);
  const falla = renderToStaticMarkup(createElement(MazoDecisiones, {
    lectura: { ok: false, faltaTabla: false, error: 'x' },
    responder: async () => ({ error: null, ok: true }),
    tablero: '/admin/runway',
  }));
  assert.match(falla, /No se pudieron leer las decisiones/);
});

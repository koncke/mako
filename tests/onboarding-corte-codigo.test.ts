// =============================================================================
// El onboarding lo termina el CÓDIGO: con las tres piezas, «¡Gracias!»; y una pieza se pregunta dos veces (20/10/2026)
// =============================================================================
// Florencia (ws21, sesión 14 de offer_sesiones, 18/10): las tres piezas del arranque quedaron anotadas a las 22:43:34 y
// MaKo siguió 6 preguntas y 10 minutos más (escalera, ventas, prueba, plazo, primera semana); antes le había preguntado
// el precio 4 veces, con «Pero dame un ejemplo concreto» después de cada «depende». El «listo» del modelo se parseaba y
// nadie lo leía. docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)». La forma de abajo es la de esa sesión, sin sus
// datos.
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-corte.json del scratchpad; base 4/0): la ruta sin el cierre del código →
// 3/1 · el tope en 4 repreguntas → 3/1 · la ruta sin el tope → 3/1 · el server vuelve a esperar la pregunta abierta → 3/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CIERRE_DEL_ARRANQUE, conTopeDelArranque, mensajeDeCierreDelArranque, mergePiezas } from '../lib/offer-reglas';
import { faltanDelArranque, preguntaAbierta, type PiezasSabidas } from '../lib/offer-marco';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const m = (de: 'mako' | 'yo', texto: string, hora: string) => ({ de, texto, at: `2026-10-18T${hora}Z` });

// Lo que vende y a quién, anotados; el precio, no.
const DOS: PiezasSabidas = {
  cliente: { valor: 'Estudiantes que tienen que entregar su tesis', fuente: 'doc', at: '2026-10-18T22:37:11Z' },
  entregables: { valor: 'Acompañamiento de tesis por Meet', fuente: 'doc', at: '2026-10-18T22:38:10Z' },
};

test('con las tres piezas cierra el código, sin pregunta', () => {
  const tres = mergePiezas(DOS, { precio: '6 cuotas mensuales' }, 'chat', '2026-10-18T22:43:34Z');
  assert.deepEqual(faltanDelArranque(tres), []);
  const cierre = mensajeDeCierreDelArranque('x', '2026-10-18T22:43:35Z');
  assert.equal(cierre.texto, CIERRE_DEL_ARRANQUE);
  assert.ok(!('opciones' in cierre), 'el cierre no trae opciones');
  assert.equal(preguntaAbierta([cierre]), false, 'después del cierre, la etapa sigue al PDF');
});

test('el precio se pregunta dos veces: a la segunda respuesta sin anotar, queda «sin dato» y cierra', () => {
  const una = [m('mako', 'Me encanta. ¿Cuánto cobras y cómo te pagan?', '22:38:11'), m('yo', 'Depende del cliente', '22:39:20')];
  assert.equal(conTopeDelArranque(DOS, una, '2026-10-18T22:39:21Z'), DOS, 'a la primera, se vuelve a preguntar');
  const dos = [...una, m('mako', 'Entiendo. ¿Me das un ejemplo de cuánto cobras?', '22:40:00'), m('yo', 'Varía mucho, de verdad', '22:43:30')];
  const conTope = conTopeDelArranque(DOS, dos, '2026-10-18T22:43:34Z');
  assert.match(conTope.precio?.valor ?? '', /^sin dato/);
  assert.deepEqual(faltanDelArranque(conTope), [], 'con el precio «sin dato», el onboarding sigue');
  // Lo de antes de la última pieza anotada no cuenta: las preguntas por lo que vende ya se contestaron.
  const viejas = [m('mako', '¿Qué vendes?', '22:25:27'), m('yo', 'Tesis', '22:30:00'), m('mako', '¿Y a quién?', '22:31:00'), m('yo', 'A estudiantes', '22:36:00'), ...una];
  assert.equal(conTopeDelArranque(DOS, viejas, '2026-10-18T22:39:21Z'), DOS);
});

test('la ruta del turno aplica el tope y cierra por código en el onboarding', () => {
  const ruta = sinComentarios(leer('app/api/offer/route.ts'));
  assert.match(ruta, /const piezas = p\.arranque \? conTopeDelArranque\(fundidas, f\.mensajes, new Date\(\)\.toISOString\(\)\) : fundidas;/);
  assert.match(ruta, /const cierra = !!p\.arranque && faltanDelArranque\(piezas\)\.length === 0;/);
  assert.match(ruta, /const m = cierra \? mensajeDeCierreDelArranque\(randomUUID\(\), new Date\(\)\.toISOString\(\)\) : mensajeDeMako\(/);
});

test('el arranque pasa al PDF con las piezas, sin esperar a que el modelo deje de preguntar', () => {
  const srv = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  assert.match(srv, /loQueVende: !!sesion && faltanDelArranque\(sesion\.piezas\)\.length === 0,/);
  assert.doesNotMatch(srv, /preguntaAbierta\(/);
});

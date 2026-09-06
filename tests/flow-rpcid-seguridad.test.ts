// =============================================================================
// Un rpcid ROTA, así que nunca puede decidir un pedido que ESCRIBE
// =============================================================================
// Las operaciones que no llevan prompt —leer el saldo, sondear el estado, subir una
// imagen— no tienen ancla: no hay ningún texto nuestro que buscarles. Y en BOQ todos
// los pedidos van al mismo `/data/batchexecute`, así que lo único que las distingue
// es el `rpcids` del query.
//
// El problema: **un rpcid es del bundle de Google y rota.** Si fuera la llave, un id
// viejo podría matchear el pedido equivocado — y MaKo repetiría OTRA operación contra
// la cuenta de Google del cliente, gastando sus créditos en algo que nadie pidió.
//
// Por eso el rpcid sólo puede reconocer operaciones que **no escriben nada**. Las que
// generan van por su ancla, que no se puede confundir porque el texto lo escribimos
// nosotros. Este test fija esa frontera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPERACIONES, operacionDeLaClase, operacionDelCuerpo } from '../lib/flow-operaciones';

test('ninguna operación que CUESTA créditos se reconoce por rpcid', () => {
  // La invariante que protege la cuenta del cliente.
  for (const o of OPERACIONES) {
    if (!o.cuesta) continue;
    assert.deepEqual(
      [...o.rpcids], [],
      `${o.op} genera y cobra, y tiene rpcids: ${o.rpcids.join(', ')}.\n\n`
      + 'Un rpcid rota. Si Google reasigna ese id, MaKo repetiría el pedido equivocado\n'
      + 'contra la cuenta del cliente. Las que generan se reconocen por su ANCLA.',
    );
  }
});

test('las que se reconocen por rpcid no llevan captcha', () => {
  // El captcha marca las que Google trata como escritura. Es una segunda lectura de
  // la misma frontera, por si `cuesta` se editara sin pensar.
  for (const o of OPERACIONES) {
    if (!o.rpcids.length) continue;
    assert.equal(
      o.captcha, false,
      `${o.op} se reconoce por rpcid y lleva captcha: Google la trata como escritura.`,
    );
  }
});

test('`operacionDeLaClase` reconoce las medidas', () => {
  assert.equal(operacionDeLaClase('boq:nzlxg'), 'creditos');
  assert.equal(operacionDeLaClase('boq:jwpduf'), 'estado_clips');
  assert.equal(operacionDeLaClase('boq:ngNC2'), 'estado_clips');
});

test('un lote MEZCLADO no es ninguna operación', () => {
  // `boq:jwpduf,ngNC2` son las dos del sondeo: eso sí es el sondeo.
  assert.equal(operacionDeLaClase('boq:jwpduf,ngNC2'), 'estado_clips');
  // Pero un lote que mezcla el sondeo con otra cosa NO es el sondeo: es otra cosa
  // que lo contiene, y repetirla como si fuera el sondeo manda un pedido distinto.
  assert.equal(operacionDeLaClase('boq:jwpduf,YhhmEf'), null);
  assert.equal(operacionDeLaClase('boq:nzlxg,desconocido'), null);
});

test('no inventa sobre una clase que no conoce', () => {
  for (const c of ['boq:YhhmEf', 'boq:as29s', 'boq:noExiste', 'boq:', 'credits', '', 'boq']) {
    const r = operacionDeLaClase(c);
    assert.ok(
      r === null || OPERACIONES.some((o) => o.op === r && o.rpcids.length),
      `inventó ${r} para la clase ${JSON.stringify(c)}`,
    );
  }
  assert.equal(operacionDeLaClase('boq:YhhmEf'), null, 'reconoció por id una que genera');
});

test('el ancla le GANA al rpcid', () => {
  // El orden importa: el ancla no puede confundirse y el rpcid sí. Si alguna vez las
  // dos contestaran sobre el mismo cuerpo, tiene que ganar la que no rota.
  const clip = OPERACIONES.find((o) => o.op === 'generar_clip');
  assert.ok(clip?.frase);
  const cuerpo = new URLSearchParams({ 'f.req': JSON.stringify([[clip.frase]]) }).toString();
  assert.equal(operacionDelCuerpo(cuerpo)?.op, 'generar_clip');
  // Y la clase de ese mismo pedido no se reconoce por id, justamente.
  assert.equal(operacionDeLaClase('boq:YhhmEf'), null);
});

test('`detectable` es cierto: se puede reconocer de alguna forma', () => {
  // Un `detectable: true` sin ancla ni rpcid es una promesa que el código no cumple —
  // y produce exactamente el paso imposible que ya se reportó («ya subí la foto y nada»).
  for (const o of OPERACIONES) {
    if (o.como === 'ninguna') continue;
    const puede = !!o.token || o.rpcids.length > 0;
    assert.equal(
      o.detectable, puede,
      `${o.op} dice detectable=${o.detectable} y ${puede ? 'sí' : 'no'} se puede reconocer\n`
      + `(token: ${o.token || 'ninguno'} · rpcids: ${o.rpcids.join(', ') || 'ninguno'}).\n\n`
      + 'Un `detectable: true` sin forma de reconocerla deja a alguien repitiendo una\n'
      + 'acción que nunca se va a marcar.',
    );
  }
});

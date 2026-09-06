// =============================================================================
// Un 200 de BOQ no es un éxito, y decirlo así es mentirle a alguien
// =============================================================================
// ⚠️ ESTE TEST EXISTE PORQUE YA PASÓ, EN LA PANTALLA DEL DUEÑO. El popup dijo
// «Listo, lo verás en tu Flow» sobre un pedido que no creó nada. La causa: se miró
// `res.ok`, que es HTTP 200 — y BOQ manda el fallo ADENTRO del cuerpo.
//
// El repo ya tenía la regla escrita («los proveedores mandan el fallo adentro del
// 200», medida con Meta y con Evolution). Es la tercera vez, con un tercer
// proveedor.
//
// Y un ÉXITO FALSO es peor que un error tragado: no deja nada que investigar, y
// manda a la persona a buscar algo que nunca se pidió.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerRespuestaBoq } from '../lib/flow-boq-respuesta';

/** Una respuesta de BOQ con la forma real. */
function frame(rpcid: string, payload: string) {
  const p = JSON.stringify(payload).slice(1, -1);
  return `)]}'\n\n${64}\n[["wrb.fr","${rpcid}","${p}",null,null,null,"generic"]]`;
}

test('un frame con contenido SÍ es un éxito', () => {
  const r = leerRespuestaBoq(frame('YhhmEf', '["operacion/abc123"]'), 'YhhmEf');
  assert.equal(r.ok, true);
  assert.ok(r.ok && r.payload.includes('abc123'));
});

test('un frame de ERROR con HTTP 200 no es un éxito', () => {
  // Es el caso que produjo la mentira.
  const r = leerRespuestaBoq(`)]}'\n\n40\n[["er",null,"Quota exceeded",null,null,4]]`);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, 'ERROR_DE_GOOGLE');
  assert.match(!r.ok ? r.detalle : '', /Quota/);
});

test('el error GANA aunque venga junto a un frame bueno', () => {
  // BOQ puede mandar los dos. Quedarse con el primero que matchea es cómo se afirma
  // un éxito que no pasó.
  const mezcla = `)]}'\n\n90\n[["er",null,"reCAPTCHA failed"],["wrb.fr","YhhmEf","[1]",null,null,null,"generic"]]`;
  const r = leerRespuestaBoq(mezcla, 'YhhmEf');
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, 'ERROR_DE_GOOGLE');
});

test('un frame VACÍO no es un éxito', () => {
  // «Te escuché y no hice nada» es indistinguible de un ok si sólo se mira que el
  // frame exista.
  for (const vacio of ['', 'null', '[]']) {
    const r = leerRespuestaBoq(frame('YhhmEf', vacio), 'YhhmEf');
    assert.equal(r.ok, false, `dio ok con payload ${JSON.stringify(vacio)}`);
  }
});

test('un frame de OTRO rpcid no es un éxito', () => {
  // Significa que se repitió el pedido equivocado — y eso ya gastó un crédito.
  const r = leerRespuestaBoq(frame('nzlxg', '[42]'), 'YhhmEf');
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, 'SIN_FRAME');
  assert.match(!r.ok ? r.detalle : '', /nzlxg/);
});

test('una respuesta que no es de BOQ se nombra como tal', () => {
  // Una pantalla de bloqueo o un login llegan con 200 y HTML adentro.
  const r = leerRespuestaBoq('<!DOCTYPE html><html><body>Iniciar sesión</body></html>');
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.detalle : '', /bloqueo|login/i);
});

test('una respuesta vacía se nombra como tal', () => {
  for (const v of ['', '   ', null, undefined]) {
    const r = leerRespuestaBoq(v as unknown as string);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.motivo, 'VACIA');
  }
});

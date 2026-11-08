// =============================================================================
// Sin la duración, la ventana es un TECHO y no lleva piso (8/11/2026)
// =============================================================================
// Tres hallazgos confirmados de la revisión de `punta/nada-por-detras`, un solo origen:
//   · «"Un video corto se pide con su duración para tener piso": cuando YouTube no da la duración,
//      el piso sale de la ventana de 10 minutos y pide 6.000 caracteres»
//   · «Un guion COMPLETO se guarda diciéndole al cliente que puede estar incompleto, cuando YouTube
//      no dio la duración»
//   · «Un video cuya duración no se puede leer recibe el piso de 10 MINUTOS: cartel falso de "puede
//      faltar parte" y 2-4 pedidos a Gemini»
//
// Cuando YouTube no da la duración, `tramosDeYoutube` pide «de 0 a 10 minutos» para no pagar un
// video de horas a ciegas. Pero el video puede durar DOS minutos: ahí Gemini devuelve el guion
// COMPLETO —unos 1.200 caracteres— y quedaba debajo de un piso calculado sobre diez minutos
// (6.000). Resultado: el cliente leía «puede faltar parte» sobre un guion entero, y encima se
// reintentaba con cada modelo, pagando de más por un video que ya estaba transcripto.
//
// Correr: node --import tsx --test tests/guion-yt-tramo-tope.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): sacar `tope: true` del tramo sin
// duración → 2 / 1; calcularle el piso igual al tramo tope → 2 / 1; poner `tope` en TODOS los
// tramos (que dejaría sin piso a los que sí lo necesitan) → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tramosDeYoutube } from '../lib/spy-transcripcion';

// ⚠️ `lib/ai-cheap.ts` lleva `server-only`: desde un test de node se LEE, no se importa.
const aiCheap = readFileSync(join(process.cwd(), 'lib/ai-cheap.ts'), 'utf8');

test('sin la duración, el tramo viene marcado como TECHO', () => {
  const { tramos, cortado } = tramosDeYoutube(null);
  assert.equal(tramos.length, 1, 'uno solo: no se paga un video de horas a ciegas');
  assert.equal(tramos[0]?.tope, true, 'y marcado: la ventana no es un largo medido');
  assert.equal(cortado, null, 'y no se afirma que siga, porque no se sabe');
});

test('⚠️ pero un tramo de un video cuya duración SÍ se sabe no es techo: ése necesita su piso', () => {
  // Es la mitad que protege lo contrario: sin piso, un guion cortado por Gemini pasaría por entero.
  const { tramos } = tramosDeYoutube('PT30M');
  assert.ok(tramos.length > 1, 'un video largo se parte');
  assert.ok(tramos.every((t) => t && t.tope === undefined),
    'ninguno es techo: sus 10 minutos están medidos y el piso vale');
  const corto = tramosDeYoutube('PT4M');
  assert.deepEqual(corto.tramos, [null], 'uno corto va entero, sin tramo');
});

test('y quien calcula el piso respeta la marca', () => {
  assert.match(aiCheap, /tramo\.tope \? 0 : pisoDeGuionYt\(tramo\.hastaS - tramo\.desdeS\)/,
    'un tramo techo no lleva piso: calculárselo le exige 6.000 caracteres a un guion ya completo');
});

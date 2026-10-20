// =============================================================================
// Las preguntas con opciones del onboarding aceptan lo escrito: «Lo tomé como: …» (20/10/2026)
// =============================================================================
// Martín, en la llamada con Florencia del 18/10 (Fathom 864249059, [00:44:35]): «no te deja escribir cuando te da las
// opciones». En «¿Cuál es tu MAYOR cuello de botella hoy?» ella dijo que «no queda fijo, se va moldeando» y terminó
// eligiendo una; lo escrito recibía «Elige una de las opciones.». Pasaba igual en «¿qué resolver primero?».
// docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-escritas.json del scratchpad; base 3/0): la fase sin la opción más
// parecida → 2/1 · sin guardar lo escrito → 2/1 · sin el «Lo tomé como» → 2/1 · el interés sin la más parecida → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERESES, NO_ENTENDI_OPCION, leerRespuesta, mensajesDeArranque, opcionMasCercana,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';
import { PREGUNTAS } from '../lib/fase-diagnostico';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Florencia', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: true, terminado: false,
};
const iCuello = PREGUNTAS.findIndex((q) => q.id === 'cuello');
// Todo contestado hasta el cuello, en modo 'oferta' (el canal ya dicho).
const ANTES_DEL_CUELLO: EstadoArranque = {
  nombre: 'Florencia', negocio: 'Florencia Carballo', pdfOk: 'si', canal: 'llamadas',
  faseResp: PREGUNTAS.map((_, i) => (i < iCuello ? 0 : -1)),
};

test('la opción más parecida, por las palabras que comparten', () => {
  const cuello = PREGUNTAS[iCuello].opciones;
  assert.equal(opcionMasCercana('vendo cuando empujo yo, pero va cambiando', cuello), 2);
  assert.equal(opcionMasCercana('los que se interesan no agendan', cuello), 1);
  assert.equal(opcionMasCercana('hola', cuello), null);
});

test('el cuello escrito con sus palabras: se toma la opción, se guarda lo escrito y se dice «Lo tomé como»', () => {
  const r = leerRespuesta(ANTES_DEL_CUELLO, H, { texto: 'vendo cuando empujo yo, pero va cambiando' });
  assert.ok(r.ok, r.ok ? '' : r.error);
  if (!r.ok) return;
  assert.equal(r.patch.faseResp?.[iCuello], 2);
  assert.deepEqual(r.patch.escritas, { cuello: 'vendo cuando empujo yo, pero va cambiando' });
  const e2: EstadoArranque = { ...ANTES_DEL_CUELLO, ...r.patch };
  const todos = [...mensajesDeArranque(e2, H).antes, ...mensajesDeArranque(e2, H).despues];
  const i = todos.findIndex((m) => m.id === `arr-fase-${iCuello}-r`);
  assert.equal(todos[i]?.texto, 'vendo cuando empujo yo, pero va cambiando', 'se ve lo que escribió');
  assert.equal(todos[i + 1]?.texto, `Lo tomé como: «${PREGUNTAS[iCuello].opciones[2]}».`);
  assert.deepEqual(leerRespuesta(ANTES_DEL_CUELLO, H, { texto: 'hola' }), { ok: false, error: NO_ENTENDI_OPCION });
});

test('el interés escrito con otras palabras también entra', () => {
  const fin: EstadoArranque = { nombre: 'Florencia', negocio: 'Florencia Carballo', crmTipo: 'llamada', origen: 'Instagram' };
  const vende = { ...H, faseGuardada: true };
  const r = leerRespuesta(fin, vende, { texto: 'necesito ordenar lo mío, está todo desparramado' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.patch.interes, 'ventas', 'ninguna palabra clave: la opción más parecida');
  assert.equal(r.patch.escritas?.interes, 'necesito ordenar lo mío, está todo desparramado');
  const tocada = leerRespuesta(fin, vende, { opcion: 0, opcionTexto: INTERESES[0].label });
  assert.ok(tocada.ok && !tocada.patch.escritas, 'una opción tocada no es una respuesta escrita');
});

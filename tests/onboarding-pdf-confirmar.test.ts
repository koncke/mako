// =============================================================================
// El PDF de lo que vende: un mensaje corto que pregunta si está correcto (18/10/2026)
// =============================================================================
// Martín, punto 7: «el mensaje anterior al PDF es larguísimo... Debería ser algo como "Perfecto: ya tengo claro qué
// vendes. Te armé un PDF con tu oferta, está correcto?" Y ahí si responde que sí, continuar... Y si responde que NO,
// que faltan cosas o cosas que están mal, dile que está bien, que lo anotas para trabajarlo ahora dentro de la app y
// que ahora vamos a continuar para finalizar el onboarding». El turno de la IA que cierra dice sólo «¡Gracias!».
//
// ROTURAS (18/10/2026, arnés romper-pdf-ok.js del scratchpad; base 3/0): sin la etapa del PDF → 2/1 · el «no» se lee
// como «sí» → 2/1 · el turno de la IA vuelve a explicar → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { etapaDeArranque, mensajesDeArranque, leerRespuesta, PDF_PREGUNTA, PDF_OPCIONES, PDF_NO, type EstadoArranque, type HechosArranque } from '../lib/onboarding-arranque';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ayelen', nombreWorkspace: 'Cliente de Prueba', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: true, terminado: false,
};
const E: EstadoArranque = { nombre: 'Ayelen', negocio: 'Consultesis' };

test('con lo que vende, pregunta si el PDF está correcto, corto y con dos opciones', () => {
  assert.equal(etapaDeArranque(E, H), 'pdf');
  const { despues } = mensajesDeArranque(E, H);
  const m = despues[despues.length - 1];
  assert.equal(m.texto, PDF_PREGUNTA);
  assert.equal(m.tarjeta, 'pdf', 'sin el PDF al lado de la pregunta');
  assert.deepEqual(m.opciones, [...PDF_OPCIONES]);
  assert.ok(PDF_PREGUNTA.length < 100, 'el mensaje del PDF volvió a ser largo');
});

test('«sí» sigue; «no» se anota, MaKo dice que lo trabajan en la app, y sigue igual', () => {
  const si = leerRespuesta(E, H, { opcion: 0, opcionTexto: PDF_OPCIONES[0] });
  assert.deepEqual(si, { ok: true, patch: { pdfOk: 'si' } });
  const no = leerRespuesta(E, H, { texto: 'no, le faltan cosas' });
  assert.deepEqual(no, { ok: true, patch: { pdfOk: 'no' } });
  const tras = { ...E, pdfOk: 'no' as const };
  assert.equal(etapaDeArranque(tras, H), 'fase', 'un «no» no traba el onboarding');
  assert.ok(mensajesDeArranque(tras, H).despues.some((x) => x.id === 'arr-pdf-no' && x.texto === PDF_NO));
});

test('el turno de la IA que cierra lo que vende dice sólo «¡Gracias!»', () => {
  const ia = readFileSync(join(__dirname, '..', 'lib/offer-ia.ts'), 'utf8');
  const i = ia.indexOf('export const OFFER_ARRANQUE_SYSTEM_TEMPLATE = `');
  assert.match(ia.slice(i, ia.indexOf('`;', i)), /Ese turno dice SÓLO «¡Gracias!», sin otra frase ni pregunta/);
});

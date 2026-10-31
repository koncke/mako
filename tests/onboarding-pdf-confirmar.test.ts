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
import {
  etapaDeArranque, mensajesDeArranque, leerRespuesta, PDF_PREGUNTA, PDF_OPCIONES, PDF_NO, pdfConfirmarPregunta, PDF_FALTA, PDF_BIEN, PDF_SIN_DETALLE, notaDelPdf,
  type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ayelen', nombreWorkspace: 'Cliente de Prueba', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: false, terminado: false,
};
const E: EstadoArranque = { nombre: 'Ayelen', negocio: 'Consultesis' };
/** Como la pantalla: con la pregunta que contesta. */
const responder = (e: EstadoArranque, r: Respuesta) => leerRespuesta(e, H, { ...preguntaQueContesta(mensajesDeArranque(e, H)), ...r });

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
  assert.deepEqual(leerRespuesta(E, H, { texto: 'No' }), { ok: true, patch: { pdfOk: 'no' } }, 'un no suelto no hace falta confirmarlo');
  // Lo demás escrito pasa por el toque (quinta revisión, 21/10), y con «hay algo para corregir» queda como lo que MaKo dice
  // que anota (`pdfEscritas`, que el cierre vuelve `pdfNota`).
  const escrito = leerRespuesta(E, H, { texto: 'no, le faltan cosas' });
  assert.deepEqual(escrito, { ok: true, patch: { pdfEscritas: ['no, le faltan cosas'] } });
  const pend = { ...E, pdfEscritas: ['no, le faltan cosas'] };
  assert.deepEqual(responder(pend, { opcion: 1, opcionTexto: PDF_FALTA }), { ok: true, patch: { pdfOk: 'no' } });
  const tras = { ...E, pdfOk: 'no' as const };
  assert.equal(etapaDeArranque(tras, H), 'fase', 'un «no» no traba el onboarding');
  assert.ok(mensajesDeArranque(tras, H).despues.some((x) => x.id === 'arr-pdf-no' && x.texto === PDF_NO));
});

test('lo escrito que no es un sí o un no sueltos NO se lee con reglas: pasa por el toque y queda anotado (quinta revisión, 21/10)', () => {
  // Cuarta revisión: «Todo perfecto salvo el precio» era un sí. Quinta: con otras palabras («solo que», «lo único», «en vez
  // de», «corregí») seguía siendo un sí, y «No cambiaría nada» o «No está mal», un no. Sumar palabras no terminaba nunca.
  const correcciones = ['Todo perfecto salvo el precio, que es 500', 'Está bien, solo que el precio es 500', 'Perfecto, lo único: el precio son 500',
    'Perfecto! en vez de 997 son 500', 'Está bien, corregí el precio a 500', 'Bien, el precio en realidad es 500'];
  const bien = ['No le falta nada', 'No, todo bien', 'No cambiaría nada', 'No está mal'];
  for (const t of [...correcciones, ...bien]) {
    assert.deepEqual(leerRespuesta(E, H, { texto: t }), { ok: true, patch: { pdfEscritas: [t] } }, `«${t}» se decidió sin el toque`);
    const pend = { ...E, pdfEscritas: [t] };
    // Se dibuja lo que escribió, y la pregunta del toque —que lo repite— con sus dos opciones.
    const m = mensajesDeArranque(pend, H).despues;
    const i = m.findIndex((x) => x.id === 'arr-pdf');
    assert.equal(m[i + 1]?.texto, t);
    assert.equal(m[i + 2]?.texto, pdfConfirmarPregunta(t));
    assert.deepEqual(m[i + 2]?.opciones, [PDF_BIEN, PDF_FALTA]);
    assert.equal(etapaDeArranque(pend, H), 'pdf', 'sin el toque la etapa no avanza');
  }
  const pend = { ...E, pdfEscritas: [correcciones[1]] };
  assert.deepEqual(responder(pend, { texto: 'no' }), { ok: true, patch: { pdfOk: 'no' } });
  assert.deepEqual(responder(pend, { opcion: 0, opcionTexto: PDF_BIEN }), { ok: true, patch: { pdfOk: 'si' } });
  // Otra cosa escrita se SUMA (sexta revisión: pisaba la corrección) y se vuelve a preguntar.
  assert.deepEqual(responder(pend, { texto: 'El precio y la garantía' }), { ok: true, patch: { pdfEscritas: [correcciones[1], 'El precio y la garantía'] } });
  assert.deepEqual(leerRespuesta(E, H, { texto: 'Sí' }), { ok: true, patch: { pdfOk: 'si' } }, 'un sí suelto no hace falta guardarlo');
  // Se dibuja lo que escribió, no «Sí, está correcto».
  const conNota: EstadoArranque = { ...E, pdfOk: 'no', pdfEscritas: ['Todo perfecto salvo el precio, que es 500'] };
  const m = mensajesDeArranque(conNota, H).despues;
  assert.equal(m[m.findIndex((x) => x.id === 'arr-pdf') + 1]?.texto, 'Todo perfecto salvo el precio, que es 500');
  // Y queda anotado donde lo leen el super admin y la API de MaKo; un «no» sin nada escrito, también.
  const srv = readFileSync(join(__dirname, '..', 'lib/onboarding-arranque-server.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(srv, /const pdfNota = notaDelPdf\(e\);/);
  assert.equal(notaDelPdf(conNota), 'Todo perfecto salvo el precio, que es 500');
  assert.equal(notaDelPdf({ ...E, pdfOk: 'no' }), PDF_SIN_DETALLE, 'un «no» sin nada escrito no dejaba marca');
  assert.equal(notaDelPdf({ ...E, pdfOk: 'si', pdfEscritas: ['Todo perfecto'] }), null);
  assert.match(srv, /JSON\.stringify\(\{ origen: e\.origen \?\? null, interes: e\.interes \?\? null, at: new Date\(\)\.toISOString\(\), pdfNota \}\)/);
});

test('el turno de la IA que cierra lo que vende dice sólo «¡Gracias!»', () => {
  const ia = readFileSync(join(__dirname, '..', 'lib/offer-ia.ts'), 'utf8');
  const i = ia.indexOf('export const OFFER_ARRANQUE_SYSTEM_TEMPLATE = `');
  assert.match(ia.slice(i, ia.indexOf('`;', i)), /Ese turno dice SÓLO «¡Gracias!», sin otra frase ni pregunta/);
});

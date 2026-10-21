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
  // Lo escrito queda guardado (cuarta revisión, 21/10): con un «no», es lo que MaKo dice que anota.
  const no = leerRespuesta(E, H, { texto: 'no, le faltan cosas' });
  assert.deepEqual(no, { ok: true, patch: { pdfOk: 'no', escritas: { pdf: 'no, le faltan cosas' } } });
  const tras = { ...E, pdfOk: 'no' as const };
  assert.equal(etapaDeArranque(tras, H), 'fase', 'un «no» no traba el onboarding');
  assert.ok(mensajesDeArranque(tras, H).despues.some((x) => x.id === 'arr-pdf-no' && x.texto === PDF_NO));
});

test('una corrección escrita es un «no» y queda anotada; «no le falta nada» es un sí (cuarta revisión, 21/10)', () => {
  // Antes: «Todo perfecto salvo el precio» era un sí y la corrección se perdía; «No le falta nada», un no.
  for (const t of ['Todo perfecto salvo el precio, que es 500', 'Está bien, pero el cliente no es ese', 'Me gusta, aunque cambiaría la garantía']) {
    assert.deepEqual(leerRespuesta(E, H, { texto: t }), { ok: true, patch: { pdfOk: 'no', escritas: { pdf: t } } }, `«${t}»`);
  }
  for (const t of ['No le falta nada', 'no le falta nada, está perfecto', 'Nada que corregir']) {
    assert.deepEqual(leerRespuesta(E, H, { texto: t }), { ok: true, patch: { pdfOk: 'si', escritas: { pdf: t } } }, `«${t}»`);
  }
  assert.deepEqual(leerRespuesta(E, H, { texto: 'Sí' }), { ok: true, patch: { pdfOk: 'si' } }, 'un sí suelto no hace falta guardarlo');
  // Se dibuja lo que escribió, no «Sí, está correcto».
  const conNota: EstadoArranque = { ...E, pdfOk: 'no', escritas: { pdf: 'Todo perfecto salvo el precio, que es 500' } };
  const m = mensajesDeArranque(conNota, H).despues;
  assert.equal(m[m.findIndex((x) => x.id === 'arr-pdf') + 1]?.texto, 'Todo perfecto salvo el precio, que es 500');
  // Y queda anotado donde lo leen el super admin y la API de MaKo.
  const srv = readFileSync(join(__dirname, '..', 'lib/onboarding-arranque-server.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(srv, /const pdfNota = e\.pdfOk === 'no' \? e\.escritas\?\.pdf \?\? null : null;/);
  assert.match(srv, /JSON\.stringify\(\{ origen: e\.origen \?\? null, interes: e\.interes \?\? null, at: new Date\(\)\.toISOString\(\), pdfNota \}\)/);
});

test('el turno de la IA que cierra lo que vende dice sólo «¡Gracias!»', () => {
  const ia = readFileSync(join(__dirname, '..', 'lib/offer-ia.ts'), 'utf8');
  const i = ia.indexOf('export const OFFER_ARRANQUE_SYSTEM_TEMPLATE = `');
  assert.match(ia.slice(i, ia.indexOf('`;', i)), /Ese turno dice SÓLO «¡Gracias!», sin otra frase ni pregunta/);
});

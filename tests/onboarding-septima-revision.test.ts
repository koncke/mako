// =============================================================================
// La séptima revisión del Cerebro (689f75560, 21/10/2026): entró sin altos ni medios; los seis bajos
// =============================================================================
// docs/hallazgos-onboarding.md, «Con un nombre esperando, una palabra que es sí y también nombre no puede confirmar».
//   1. Con un nombre esperando, «Simón», «Vale», «Listo» o «Tal Cual» confirmaban el pendiente EQUIVOCADO: ahora se pregunta
//      cuál de los dos es (`siAlPendiente`, `PUEDE_SER_NOMBRE`), y el mismo nombre otra vez confirma.
//   2. Las cuotas ganaban a «semanales» y «anuales»: «8 cuotas semanales» proponía «Suscripción de 8 meses».
//   3. Al toque del PDF, «Ok», «Dale», «Nop», «👍» o «👎» se anotaban y se volvía a preguntar sin fin; la nota sin tope.
//   4. Un «no» después de «No me convence» no le decía a MaKo que pregunte qué.
//   5. «Su Lin» escrito otra vez con su toque pendiente volvía a preguntar.
//   6. El corte de 60 de la pregunta del PDF partía un emoji.
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NOMBRE_CONFIRMAR, NEGOCIO_CONFIRMAR, PDF_BIEN, PDF_FALTA, PDF_TOPE_ESCRITAS, SUMA_PDF, cobroDelPrecio, cortar, leerRespuesta, limpiarRespuesta,
  mensajesDeArranque, pdfConfirmarPregunta, siAlPendiente, siONoPelado, type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'ana@gmail.com', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: false, terminado: false,
};
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });
/** Un medio par UTF-16 suelto: lo que deja cortar un emoji por la mitad. */
const parSuelto = (s: string) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

test('1. con un nombre esperando, una palabra que es sí y también nombre no confirma: se pregunta cuál', () => {
  for (const t of ['Simón', 'Simon', 'Vale', 'Listo', 'Claro', 'Tal Cual', 'Genial', 'Sale', 'Bien']) assert.equal(siAlPendiente(t), 'duda', t);
  for (const t of ['Sí', 'Ok', 'Dale', 'Correcto', 'Está bien', 'Sí, está bien', 'Claro que sí', 'Eso es', 'Ajá', '👍']) assert.equal(siAlPendiente(t), 'si', t);
  // La persona: «¿Te llamo «Cómo Estás»?» + «Simón» guardaba «Cómo Estás» en usuarios.nombre.
  const nombre: EstadoArranque = { nombrePorConfirmar: { escrito: 'Hola, ¿cómo estás?', nombre: 'Cómo Estás' } };
  for (const t of ['Simón', 'Vale']) {
    const r = responder(nombre, { texto: t });
    assert.equal(r.ok, false, `«${t}» confirmó «Cómo Estás»`);
    assert.match(r.ok ? '' : r.error, new RegExp(`Escribe «Me llamo ${t}»\\. Si es «Cómo Estás», toca «${NOMBRE_CONFIRMAR[0]}»\\.$`));
  }
  assert.deepEqual(responder(nombre, { texto: 'Me llamo Simón' }), { ok: true, patch: { nombrePorConfirmar: { escrito: 'Me llamo Simón', nombre: 'Simón' } } });
  assert.deepEqual(responder(nombre, { texto: 'Ok' }), { ok: true, patch: { nombre: 'Cómo Estás', nombrePorConfirmar: undefined } });
  // El mismo nombre otra vez confirma, aunque sea una palabra de acuerdo.
  assert.deepEqual(responder({ nombrePorConfirmar: { escrito: 'Simón', nombre: 'Simón' } }, { texto: 'Simón' }), { ok: true, patch: { nombre: 'Simón', nombrePorConfirmar: undefined } });
  // El negocio: «¿Tu negocio se llama «Vendo ropa»?» + «Listo» guardaba «Vendo ropa».
  const negocio: EstadoArranque = { nombre: 'Ana', negocioPorConfirmar: { escrito: 'Vendo ropa', nombre: 'Vendo ropa' } };
  for (const t of ['Listo', 'Claro', 'Tal Cual', 'Simón', 'Vale', 'Genial']) {
    const r = responder(negocio, { texto: t });
    assert.equal(r.ok, false, `«${t}» guardó «Vendo ropa»`);
    assert.match(r.ok ? '' : r.error, new RegExp(`Escribe «Se llama ${t}»\\. Si es «Vendo ropa», toca «${NEGOCIO_CONFIRMAR[0]}»\\.$`));
  }
  assert.deepEqual(responder(negocio, { texto: 'Se llama Listo' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Se llama Listo', nombre: 'Listo' } } });
  assert.deepEqual(responder(negocio, { texto: 'Sí, está bien' }), { ok: true, patch: { negocio: 'Vendo ropa', negocioPorConfirmar: undefined } });
  assert.deepEqual(responder({ nombre: 'Ana', negocioPorConfirmar: { escrito: 'Listo', nombre: 'Listo' } }, { texto: 'Listo' }), { ok: true, patch: { negocio: 'Listo', negocioPorConfirmar: undefined } });
  // Sin nada esperando, se siguen proponiendo (quinta revisión).
  assert.equal(responder({ nombre: 'Ana' }, { texto: 'Listo' }).ok, true);
});

test('2. las cuotas que dicen otra periodicidad no son meses', () => {
  for (const p of ['8 cuotas semanales de USD 25', '4 pagos semanales de USD 100', 'USD 50 por semana, 12 pagos']) assert.equal(cobroDelPrecio(p).periodo, 'semanal', p);
  for (const p of ['2 cuotas anuales de USD 500', 'Membresía: 2 pagos anuales de USD 600']) assert.equal(cobroDelPrecio(p).periodo, 'anual', p);
  // Las cuotas sin otra periodicidad siguen ganando a lo anual (sexta revisión).
  assert.deepEqual(cobroDelPrecio('Programa anual: 12 cuotas de USD 99'), { tipo: 'suscripcion', meses: 12 });
  assert.deepEqual(cobroDelPrecio('Mentoría anual en 12 pagos mensuales de USD 100'), { tipo: 'suscripcion', meses: 12 });
});

test('3. al toque del PDF cuentan los sí y no de una palabra, y lo escrito tiene tope', () => {
  for (const t of ['Ok', 'Dale', 'Claro', 'Sip', 'sí sí', '👍', '👍🏻', '✅']) assert.equal(siONoPelado(t), 'si', t);
  for (const t of ['Nop', 'nel', 'no no', '👎']) assert.equal(siONoPelado(t), 'no', t);
  for (const t of ['Está perfecto', 'Me encanta', 'Sí, falta la garantía']) assert.equal(siONoPelado(t), null, t);
  const E: EstadoArranque = { nombre: 'Ana', negocio: 'Acme' };
  assert.deepEqual(responder({ ...E, pdfEscritas: ['Me encanta'] }, { texto: 'Ok' }), { ok: true, patch: { pdfOk: 'si' } });
  assert.deepEqual(responder({ ...E, pdfEscritas: ['Me encanta'] }, { texto: '👎' }), { ok: true, patch: { pdfOk: 'no' } });
  const lleno: EstadoArranque = { ...E, pdfEscritas: Array.from({ length: PDF_TOPE_ESCRITAS }, (_, i) => `cosa ${i}`) };
  // Pasado el tope, lo nuevo se suma a lo último (octava revisión: se descartaba diciendo «Ya lo anoté»), y no crece más
  // que una respuesta: tests/onboarding-octava-revision.test.ts.
  const r = responder(lleno, { texto: 'una más' });
  assert.deepEqual(r, { ok: true, patch: { pdfEscritas: ['cosa 0', 'cosa 1', 'cosa 2', 'cosa 3', `cosa 4${SUMA_PDF}una más`] } }, 'la nota seguía creciendo');
  const sinLugar = responder({ ...E, pdfEscritas: [...lleno.pdfEscritas!.slice(0, -1), 'x'.repeat(295)] }, { texto: 'una más' });
  assert.match(sinLugar.ok ? '' : sinLugar.error, new RegExp(`Toca «${PDF_BIEN}» o «${PDF_FALTA}»`));
  assert.deepEqual(responder(lleno, { opcion: 1, opcionTexto: PDF_FALTA }), { ok: true, patch: { pdfOk: 'no' } }, 'los botones siguen andando');
});

test('4. MaKo pregunta qué falta siempre que la nota no lo dice, no sólo con «sin detalle»', () => {
  const api = sinComentarios(leer('lib/api-mako/areas/negocio.run.ts'));
  assert.match(api, /encuesta\?\.pdfNota \? 'encuesta\.pdfNota: [^']*Si la nota no dice QUÉ falta o qué está mal \(«sin detalle», «No me convence», «Falta algo»\), pregúntale antes de corregir nada\.' : ''/);
  assert.doesNotMatch(api, /pdfNota === PDF_SIN_DETALLE/, 'volvió a depender de la marca exacta');
});

test('5. «Su Lin» escrito otra vez con su toque pendiente confirma', () => {
  const P: EstadoArranque = { nombrePorConfirmar: { escrito: 'Su Lin', nombre: 'Su Lin' } };
  for (const t of ['Su Lin', 'Sí, Su Lin', 'Sí, soy Su Lin']) {
    assert.deepEqual(responder(P, { texto: t }), { ok: true, patch: { nombre: 'Su Lin', nombrePorConfirmar: undefined } }, t);
  }
});

test('6. los cortes van por punto de código: un emoji no queda partido', () => {
  const escrito = 'Me encantó todo, solo que el precio es USD 497 y no USD 997🙏 y la garantía 60 días';
  assert.equal(Array.from(escrito).indexOf('🙏'), 59, 'el emoji tiene que caer en el corte');
  assert.ok(escrito.slice(0, 60).length === 60 && parSuelto(escrito.slice(0, 60)), 'el caso ya no parte el emoji con slice');
  assert.ok(!parSuelto(pdfConfirmarPregunta(escrito)), 'la pregunta del PDF parte el emoji');
  assert.ok(pdfConfirmarPregunta(escrito).includes('🙏…'));
  assert.ok(!parSuelto(limpiarRespuesta(`${'a'.repeat(299)}🙏`)), 'limpiarRespuesta parte el emoji');
  assert.equal(cortar('ab🙏c', 3), 'ab🙏');
});

// ROTURAS (21/10/2026, romper.js + roturas-septima.json del scratchpad; con sexta, quinta, pdf-confirmar,
// toque-que-confirma, preguntas, nombre-negocio y cierre-florencia; base 51/0), 14 de 14: sin la duda todo sí confirma →
// 48/3 · el nombre con pendiente lee con siONo → 50/1 · el negocio con pendiente lee con siONo → 48/3 · la duda del negocio
// no pregunta → 49/2 · el mismo negocio otra vez no confirma → 50/1 · las cuotas semanales son meses → 48/3 · las cuotas
// anuales son meses → 50/1 · el toque del PDF sólo con sí/no pelados → 50/1 · el 👎 no cuenta → 50/1 · el color de piel
// cuenta → 50/1 · la nota sin tope → 50/1 · MaKo pregunta sólo con la marca → 49/2 · «Su Lin» otra vez no confirma → 50/1 ·
// el corte parte el emoji → 50/1.

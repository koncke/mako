// =============================================================================
// La octava revisión del Cerebro (108b2f270, 21/10/2026): dos regresiones contra producción, y dos bajos
// =============================================================================
// docs/hallazgos-onboarding.md, «La duda es de la PALABRA SUELTA, no de la frase que empieza con ella».
//   1. [media] Con un nombre esperando, «Claro, así se llama», «Listo, es correcto» o «Genial, gracias» dejaron de
//      confirmar (en producción confirmaban), y el error mandaba escribir «Se llama Claro, así se llama».
//   2. [media] Lo semanal en CUALQUIER parte del precio ganaba a las cuotas: «3 cuotas mensuales de USD 300, con una
//      llamada semanal» decía «cobras por semana» y los 3 meses no se podían elegir. Ahora la periodicidad cuenta sólo
//      pegada al pago.
//   3. Las cuotas trimestrales, semestrales, bimestrales o quincenales se proponían como «Pago único» o como «Suscripción
//      mensual»: ahora se pregunta sin proponer.
//   4. Pasado el tope del PDF, lo escrito se descartaba y MaKo decía «Ya lo anoté».
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COBRO_MENSUAL, COBRO_UNICO, NEGOCIO_CONFIRMAR, PDF_BIEN, PDF_FALTA, PDF_TOPE_ESCRITAS, SI_ES_ESO, cobroDelPrecio, cobroSinPropuesta, leerRespuesta,
  mensajesDeArranque, notaDelPdf, siAlPendiente, type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'ana@gmail.com', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: true, terminado: false,
};
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });

test('1. la duda es de la palabra suelta: una frase de acuerdo que empieza con «Claro» o «Listo» confirma', () => {
  const frases = ['Claro, así se llama', 'Listo, es correcto', 'Claro, es mi negocio', 'Claro, sí', 'Genial, gracias', 'Bien, gracias', 'Listo, sí',
    'Vale, perfecto', 'Tal cual, así se llama', 'Claro, se llama así', 'Claro, es correcto'];
  for (const t of frases) assert.equal(siAlPendiente(t), 'si', t);
  const negocio: EstadoArranque = { nombre: 'Ana', negocioPorConfirmar: { escrito: 'Acme Studio', nombre: 'Acme Studio' } };
  for (const t of frases) assert.deepEqual(responder(negocio, { texto: t }), { ok: true, patch: { negocio: 'Acme Studio', negocioPorConfirmar: undefined } }, t);
  const nombre: EstadoArranque = { nombrePorConfirmar: { escrito: 'Soy Ana', nombre: 'Ana' } };
  for (const t of ['Claro, es correcto', 'Claro, así', 'Listo, sí', 'Bien, gracias', 'Vale, perfecto', 'Claro, sí', 'Genial, gracias']) {
    assert.deepEqual(responder(nombre, { texto: t }), { ok: true, patch: { nombre: 'Ana', nombrePorConfirmar: undefined } }, t);
  }
  // Sueltas, o sólo palabras que pueden ser nombre, siguen en duda, y el error propone sólo eso.
  for (const t of ['Claro', 'Listo', 'Tal Cual', 'Listo vale']) assert.equal(siAlPendiente(t), 'duda', t);
  const duda = responder(negocio, { texto: 'Claro' });
  assert.equal(duda.ok ? '' : duda.error, `«Claro», ¿es el nombre de tu negocio? Escribe «Se llama Claro». Si es «Acme Studio», toca «${NEGOCIO_CONFIRMAR[0]}».`);
});

test('2. la periodicidad cuenta sólo pegada al pago: la del servicio no le gana a las cuotas', () => {
  for (const [p, meses] of [
    ['3 cuotas mensuales de USD 300, con una llamada semanal', 3], ['Programa de 3 meses con sesiones semanales: 3 cuotas', 3],
    ['Mentoría con llamadas semanales, 6 cuotas', 6], ['USD 900 en 3 pagos, encuentros semanales', 3], ['12 cuotas mensuales; clases a la semana', 12],
    ['seguimiento semanal: USD 1.500 en 6 cuotas', 6], ['6 pagos mensuales de USD 250 (sesión semanal incluida)', 6],
    ['USD 2000, 10 cuotas, clases 2 veces por semana', 10],
  ] as const) assert.deepEqual(cobroDelPrecio(p), { tipo: 'suscripcion', meses }, p);
  // Y se propone con «Sí, es eso»: los 3 meses se pueden elegir.
  const h: HechosArranque = { ...H, cobroLeido: cobroDelPrecio('3 cuotas mensuales de USD 300, con una llamada semanal') };
  const e: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', pdfOk: 'si' };
  assert.deepEqual(responder(e, { opcion: 0, opcionTexto: SI_ES_ESO }, h), { ok: true, patch: { cobro: { tipo: 'suscripcion', meses: 3 } } });
  // Lo pegado al pago sigue contando (quinta, sexta y séptima revisión).
  for (const [p, periodo] of [
    ['8 cuotas semanales de USD 25', 'semanal'], ['USD 50 por semana, 12 pagos', 'semanal'], ['USD 99 por semana', 'semanal'], ['4 cuotas de USD 50 cada semana', 'semanal'],
    ['2 cuotas anuales de USD 500', 'anual'], ['Membresía anual USD 400', 'anual'], ['USD 1.200 por año', 'anual'], ['USD 400/año', 'anual'],
    ['2 pagos al año de USD 600', 'anual'], ['12 cuotas de USD 99 anuales', 'anual'],
  ] as const) assert.equal(cobroDelPrecio(p).periodo, periodo, p);
  assert.deepEqual(cobroDelPrecio('Programa anual: 12 cuotas de USD 99'), { tipo: 'suscripcion', meses: 12 });
  assert.deepEqual(cobroDelPrecio('USD 1.200 anuales, se puede pagar en 6 cuotas'), { tipo: 'suscripcion', meses: 6 });
});

test('3. una periodicidad sin camino propio no se propone: se pregunta', () => {
  for (const [p, periodo] of [['4 pagos trimestrales de USD 250', 'trimestral'], ['2 cuotas semestrales de USD 600', 'semestral'],
    ['6 pagos bimestrales', 'bimestral'], ['10 cuotas quincenales de USD 80', 'quincenal']] as const) {
    assert.deepEqual(cobroDelPrecio(p), { tipo: 'suscripcion', meses: null, periodo }, p);
    const h: HechosArranque = { ...H, cobroLeido: cobroDelPrecio(p) };
    const m = mensajesDeArranque({ nombre: 'Ana', negocio: 'Acme', pdfOk: 'si' }, h).despues.at(-1);
    assert.equal(m?.texto, cobroSinPropuesta(periodo));
    assert.deepEqual(m?.opciones, [COBRO_UNICO, COBRO_MENSUAL], `«${p}» se propuso`);
  }
  assert.match(cobroSinPropuesta('trimestral'), /cada tres meses/);
});

test('4. pasado el tope del PDF, lo nuevo se suma a lo último, y el error nunca dice que anotó', () => {
  const E: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', pdfEscritas: ['Me encanta', 'Perfecto', 'Todo bien', 'Está bien', 'Genial'] };
  assert.equal(E.pdfEscritas!.length, PDF_TOPE_ESCRITAS);
  const r = responder(E, { texto: 'Pero el precio es 200, no 997' });
  assert.ok(r.ok);
  const tras = { ...E, ...(r.ok ? r.patch : {}), pdfOk: 'no' as const };
  assert.match(notaDelPdf(tras) ?? '', /precio es 200/, 'la corrección tardía se perdía');
  const lleno: EstadoArranque = { ...E, pdfEscritas: ['a', 'b', 'c', 'd', 'x'.repeat(295)] };
  const sinLugar = responder(lleno, { texto: 'el precio es 200' });
  assert.equal(sinLugar.ok, false);
  assert.doesNotMatch(sinLugar.ok ? '' : sinLugar.error, /anot/i, 'dijo que anotó lo que no anotó');
  assert.match(sinLugar.ok ? '' : sinLugar.error, new RegExp(`Toca «${PDF_BIEN}» o «${PDF_FALTA}»`));
});

// ROTURAS (21/10/2026, romper.js + roturas-octava.json del scratchpad; con séptima, sexta, quinta, pdf-confirmar,
// toque-que-confirma, nombre-negocio y cierre-florencia; base 48/0), 9 de 9: la duda alcanza a la frase entera → 47/1 · lo
// semanal en cualquier parte gana → 47/1 · lo pegado al pago no cuenta → 46/2 · las cuotas con periodicidad son meses →
// 45/3 · lo anual pegado no cuenta → 44/4 · lo anual antes que las cuotas → 46/2 · sin los periodos nuevos → 47/1 · el tope
// descarta → 46/2 · el tope sin límite → 46/2. Y el diff contra producción (689f75560) con 269 casos (diff-prod.mts del
// scratchpad) sólo cambia lo pedido, más «Programa anual USD 1.500» (antes preguntaba, ahora propone «Pago único»).

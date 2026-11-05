// =============================================================================
// La novena revisión del Cerebro (82321e397, 21/10/2026): el cobro cambia de RED, no de regla
// =============================================================================
// docs/hallazgos-onboarding.md, «Cuatro vueltas de reglas sobre la periodicidad: la red es que estén todas las lecturas».
// La octava leía la periodicidad pegada al pago, y «1 a 1 semanal» o «3x semana» (un número pelado delante de la cadencia
// del servicio) volvieron a ganarle a las cuotas: la opción correcta, «Suscripción de 3 meses», desaparecía. Era la cuarta
// vuelta, y cada una movía casos de lugar. DECISIÓN del Cerebro: las opciones muestran SIEMPRE todas las lecturas («Pago
// único», «Suscripción mensual (sin fin)», y una «Suscripción de N meses» por cada N junto a cuotas, pagos, meses o
// mensualidades); la lectura sólo ordena y arma el «Entendí». Y de paso: la pregunta del PDF cambia al sumar pasado el tope.
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COBRO_MENSUAL, COBRO_UNICO, PDF_BIEN, cobroDelPrecio, cobroSinPropuesta, etiquetaCobro, leerRespuesta, mensajesDeArranque, opcionesDeCobro,
  pdfConfirmarPregunta, recomienda, SUMA_PDF, type Cobro, type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ana López', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: false, terminado: false,
};
const E: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', pdfOk: 'si' };
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });
const conPrecio = (precio: string): HechosArranque => ({ ...H, cobroLeido: cobroDelPrecio(precio), cobroOpciones: opcionesDeCobro(precio) });
const N = (meses: number): Cobro => ({ tipo: 'suscripcion', meses });

test('1. la opción que el producto puede guardar está siempre, aunque la lectura falle', () => {
  // [precio, la respuesta correcta]: las regresiones de la novena (un número pelado delante de la cadencia del servicio), las
  // de la octava, y las de siempre.
  const casos: [string, Cobro][] = [
    ['USD 997 en 3 cuotas mensuales, incluye 1:1 semanal', N(3)], ['Mentoría 1 a 1 semanal: 3 cuotas de USD 400', N(3)],
    ['Clases 2x semana: 3 cuotas mensuales de USD 80', N(3)], ['Sesiones 1:1 semanales, 6 cuotas de USD 200', N(6)],
    ['Mentoría con llamada 1:1 quincenal: 3 cuotas', N(3)],
    ['3 cuotas mensuales de USD 300, con una llamada semanal', N(3)], ['USD 2000, 10 cuotas, clases 2 veces por semana', N(10)],
    ['Programa anual: 12 cuotas de USD 99', N(12)], ['USD 1.200 anuales, se puede pagar en 6 cuotas', N(6)], ['Contrato de 12 meses pagando 6 cuotas mensuales de 150 USD', N(6)],
    ['USD 100 al mes durante 12 meses', N(12)], ['1.500 USD en un solo pago o 3 cuotas', N(3)], ['USD 1.200 de contado o en 12 cuotas con tarjeta', N(12)],
    // La décima: en letras, en una enumeración, con «x», una segunda N con la lectura semanal, «pagos» o «mensualidades» con
    // periodo, y una N mayor a 12. Los de «Pago único» o la mensual no van acá: están siempre, no pueden fallar.
    ['Tres cuotas mensuales de USD 300', N(3)], ['seis mensualidades de USD 100', N(6)], ['dos pagos de USD 500', N(2)], ['USD 300 por mes durante tres meses', N(3)],
    ['10 x USD 120 mensuales', N(10)], ['USD 120 mensuales x 10', N(10)], ['USD 900 en 3 o 6 cuotas', N(3)], ['Elegí 3, 6 o 12 cuotas', N(6)],
    ['Programa de 6 meses, USD 997 en 3 cuotas, con llamada 1:1 semanal', N(3)], ['Mentoría 1 a 1 semanal: 6 pagos de USD 200', N(6)],
    ['Clases 2x semana: 4 mensualidades de USD 80', N(4)], ['USD 4.800 en 24 cuotas, sesión 1:1 semanal', N(24)], ['USD 30 por mes, 48 cuotas, clase 1:1 semanal', N(48)],
  ];
  for (const [precio, correcta] of casos) {
    const ops = opcionesDeCobro(precio).map(etiquetaCobro);
    assert.ok(ops.includes(etiquetaCobro(correcta)), `«${precio}»: falta «${etiquetaCobro(correcta)}» en ${ops.join(' / ')}`);
  }
});

test('2. la lectura sólo ordena: va primera, nunca saca una opción; lo que el producto no cobra no recomienda', () => {
  for (const precio of ['USD 997', '6 cuotas mensuales de USD 100', 'USD 100 por mes', '8 cuotas semanales de USD 25', 'Membresía anual USD 400', 'Programa de 6 meses USD 1.800',
    'USD 1.200 en 12 cuotas, 12 meses de acceso, o de contado']) {
    const ops = opcionesDeCobro(precio);
    const etiquetas = ops.map(etiquetaCobro);
    assert.ok(etiquetas.includes(COBRO_UNICO) && etiquetas.includes(COBRO_MENSUAL), `«${precio}» sin las dos de siempre`);
    assert.equal(new Set(etiquetas).size, etiquetas.length, `«${precio}» repite una opción`);
    const leido = cobroDelPrecio(precio);
    if (recomienda(leido)) assert.equal(etiquetas[0], etiquetaCobro(leido), `«${precio}»: la leída no va primera`);
    else assert.deepEqual(etiquetas.slice(0, 2), [COBRO_UNICO, COBRO_MENSUAL], `«${precio}»: recomendó algo que el producto no cobra`);
  }
  // «Suscripción mensual» dice que no termina: se elegía creyendo que eran los meses de las cuotas.
  assert.match(COBRO_MENSUAL, /sin fin/);
});

test('3. la etapa cobro muestra todas, y el toque o un sí deciden', () => {
  // «1:1 semanal» ya no pega una periodicidad (un número pelado no es un monto, undécima revisión): se propone la de 3 meses.
  assert.deepEqual(cobroDelPrecio('USD 997 en 3 cuotas mensuales, incluye 1:1 semanal'), { tipo: 'suscripcion', meses: 3 });
  // Con una periodicidad de verdad pegada al pago, se dice, y la opción de las cuotas está y se toca.
  const h = conPrecio('USD 50 por semana, 3 cuotas de USD 200');
  const m = mensajesDeArranque(E, h).despues.at(-1);
  assert.equal(m?.texto, cobroSinPropuesta('semanal'), 'la periodicidad leída se dice');
  assert.deepEqual(m?.opciones, [COBRO_UNICO, COBRO_MENSUAL, 'Suscripción de 3 meses']);
  assert.deepEqual(responder(E, { opcion: 2, opcionTexto: 'Suscripción de 3 meses' }, h), { ok: true, patch: { cobro: { tipo: 'suscripcion', meses: 3 } } });
  assert.equal(responder(E, { texto: 'sí' }, h).ok, false, 'un sí no elige cuando no hay recomendada');
  // Con una lectura que el producto cobra, va primera y un sí la elige.
  const h2 = conPrecio('Programa de 6 meses: USD 1.800 de contado');
  const m2 = mensajesDeArranque(E, h2).despues.at(-1);
  assert.equal(m2?.texto, 'Entendí que cobras así: «Pago único». ¿Es así?');
  assert.deepEqual(m2?.opciones, [COBRO_UNICO, COBRO_MENSUAL, 'Suscripción de 6 meses']);
  assert.deepEqual(responder(E, { texto: 'sí' }, h2), { ok: true, patch: { cobro: { tipo: 'unico', meses: null } } });
  assert.deepEqual(responder(E, { texto: 'Suscripción de 6 meses' }, h2), { ok: true, patch: { cobro: { tipo: 'suscripcion', meses: 6 } } });
  assert.equal(responder(E, { texto: 'cobro por mes, creo' }, h2).ok, false, 'lo escrito no se vuelve a leer con reglas');
  // Ya elegido, queda dibujado lo que eligió.
  const tras = mensajesDeArranque({ ...E, cobro: { tipo: 'suscripcion', meses: 6 } }, h2).despues;
  assert.equal(tras[tras.findIndex((x) => x.id === 'arr-cobro') + 1]?.texto, 'Suscripción de 6 meses');
});

test('4. PDF: al sumar pasado el tope, la pregunta cambia, y un toque de una pestaña vieja no se acepta', () => {
  const larga = 'La garantía me parece bien explicada, aunque la reformularía un poco más corta';
  assert.ok(larga.length >= 60);
  const antes: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', pdfEscritas: ['a', 'b', 'c', 'd', larga] };
  const vio = preguntaQueContesta(mensajesDeArranque(antes, H));
  const r = responder(antes, { texto: 'Pero el precio es 200, no 997' });
  assert.ok(r.ok);
  const despues: EstadoArranque = { ...antes, ...(r.ok ? r.patch : {}) };
  const pregunta = mensajesDeArranque(despues, H).despues.at(-1)?.texto;
  assert.notEqual(pregunta, vio.pregunta, 'la pregunta quedó igual al sumar');
  assert.equal(pregunta, pdfConfirmarPregunta(`${larga}${SUMA_PDF}Pero el precio es 200, no 997`));
  assert.match(pregunta ?? '', /«Pero el precio es 200, no 997»/);
  assert.deepEqual(leerRespuesta(despues, H, { opcion: 0, opcionTexto: PDF_BIEN, ...vio }), { ok: false, error: 'La pregunta cambió.', cambio: true });
});

// ROTURAS (21/10/2026, romper.js + roturas-novena.json del scratchpad; con octava, séptima, sexta, quinta,
// toque-que-confirma, cierre-florencia y pdf-confirmar; base 45/0), 9 de 9: sin las N de las cuotas → 43/2 · la lectura saca
// opciones → 43/2 · lo que no se cobra recomienda → 41/4 · la etapa usa sólo dos opciones → 41/4 · el server no manda las
// opciones → 44/1 · leer no acepta las N → 41/4 · un sí elige sin recomendada → 43/2 · la mensual sin «sin fin» → 44/1 · la
// pregunta del PDF no cambia al sumar → 44/1. Y con las 204 frases de la sonda del Cerebro (medir-cobro.mts del
// scratchpad), la propuesta de producción está entre las opciones en las 204.

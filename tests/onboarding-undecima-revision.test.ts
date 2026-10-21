// =============================================================================
// La undécima revisión del Cerebro (1106e8c16, 21/10/2026): la entrada y la lectura, con el mismo extractor que la red
// =============================================================================
// docs/hallazgos-onboarding.md, «Pasar el texto a dígitos arrastra a las letras todo defecto que la lectura ya tenía».
//   1. [media] Un número en letras pegado a «(», «[», comillas o guion no se convertía.
//   2. [media, regresión] Con letras, «dos meses gratis» o «garantía de tres meses» se proponían como el fin de la
//      suscripción: los meses se PROPONEN sólo pegados a un cobro o al plazo del plan; los demás sólo suman la opción.
//   3. Señales explícitas de pago único («un pago de», «cuota única», «de por vida», «una vez») y negaciones dichas de otra
//      forma («no se paga en cuotas», «cuotas no») no se leían, y caían en la lectura por defecto o en la sin fin.
//   4. La lectura usa el MISMO extractor de N que la red (`nsDelPrecio`), y una N con moneda nunca es una N de cobro.
//   5. Un número pelado no es un monto: «1:1 semanal» o «3 x semana» no pegan una periodicidad al pago (novena).
//   6. Tests que faltaban: números con tilde, el lazo entre SUMA_PDF y limpiarRespuesta, y más de una suma en el PDF.
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COBRO_MENSUAL, COBRO_UNICO, PDF_TOPE_ESCRITAS, SUMA_PDF, cobroDelPrecio, etiquetaCobro, leerRespuesta, limpiarRespuesta, mensajesDeArranque,
  notaDelPdf, opcionesDeCobro, pdfConfirmarPregunta, precioEnDigitos, recomienda, type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ana López', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: true, terminado: false,
};
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });
const ops = (precio: string) => opcionesDeCobro(precio).map(etiquetaCobro);
const lee = (precio: string) => { const l = cobroDelPrecio(precio); return recomienda(l) ? etiquetaCobro(l) : null; };
const de = (n: number) => `Suscripción de ${n} meses`;

test('1. un número en letras pegado a cualquier cosa que no sea letra se convierte', () => {
  for (const [precio, n] of [['USD 1.800 (seis cuotas de USD 300)', 6], ['USD 1.800 [seis cuotas]', 6], ['«tres cuotas» de USD 300', 3], ['USD 900 -tres cuotas-', 3]] as const) {
    assert.equal(lee(precio), de(n), precio);
  }
  // Con tilde: «veintitrés», «dieciséis».
  assert.equal(precioEnDigitos('veintitrés cuotas'), '23 cuotas');
  assert.equal(lee('Dieciséis cuotas de USD 50'), de(16));
});

test('2. los meses se proponen sólo pegados a un cobro o al plazo del plan; los demás sólo suman la opción', () => {
  for (const precio of ['USD 99 al mes, con dos meses gratis', 'USD 49 mensuales, permanencia mínima de seis meses', 'USD 50 al mes, garantía de dos meses',
    'USD 99 al mes; mínimo tres meses', 'USD 30 por mes, tres meses gratis si pagás el año']) {
    assert.equal(lee(precio), COBRO_MENSUAL, `«${precio}»: se propuso como el fin de la suscripción`);
  }
  assert.ok(ops('USD 99 al mes, con dos meses gratis').includes(de(2)), 'la opción sigue estando');
  for (const [precio, n] of [['USD 500 por mes durante seis meses', 6], ['USD 100 mensuales por 12 meses', 12], ['Tres meses de USD 300', 3],
    ['cuotas de USD 99 por 10 meses', 10], ['USD 100 por mes, 12 meses', 12], ['Contrato de 12 meses, USD 100 por mes', 12], ['3 meses 1:1, USD 600/mes', 3]] as const) {
    assert.equal(lee(precio), de(n), precio);
  }
});

test('3. un pago único dicho de otra forma y lo periódico negado son señales', () => {
  for (const precio of ['Un pago de USD 900', '1 pago de USD 500', 'Una cuota de USD 500', 'Cuota única de USD 900', 'Pago total USD 300', 'Acceso de por vida',
    'USD 900, una vez', 'USD 300 por única vez', 'Precio único USD 300', 'Acceso vitalicio USD 297', 'Pago por adelantado, USD 1.500']) {
    assert.equal(lee(precio), COBRO_UNICO, precio);
  }
  for (const precio of ['No se paga en cuotas, USD 900', 'Sin opción de cuotas: USD 900', 'No manejo mensualidades, USD 900', 'USD 900, cuotas no', 'Sin cuotas mensuales, USD 997']) {
    assert.equal(lee(precio), COBRO_UNICO, precio);
  }
  // «Una vez al mes» es mensual, no una vez.
  assert.equal(lee('Una vez al mes, USD 100'), COBRO_MENSUAL);
  // El precio pelado sigue preguntando (décima).
  assert.equal(lee('USD 997'), null);
});

test('4. la lectura es la primera de la red, y una N con moneda nunca es una N de cobro', () => {
  for (const [precio, n] of [['10 x USD 120 mensuales', 10], ['USD 120 mensuales x 10', 10], ['Cuotas a 30, 60 y 90 días', 3], ['Cuotas: tres', 3], ['USD 330 x 3', 3]] as const) {
    assert.equal(lee(precio), de(n), precio);
    assert.equal(ops(precio)[0], de(n), precio);
  }
  assert.ok(!ops('USD 47 o 2 pagos de USD 27').includes(de(47)), 'el monto entró como N');
  assert.ok(!ops('€39 o 2 pagos de €21').includes(de(39)), 'el monto en euros entró como N');
  assert.ok(!ops('USD 15 x 4 clases').includes(de(4)), '«x 4 clases» es una cantidad');
  assert.ok(!ops('4 pagos trimestrales de USD 250').includes(de(3)), 'lo trimestral pegado al pago es la periodicidad, no una N');
  assert.ok(ops('Plan trimestral: USD 297/mes').includes(de(3)), 'un plan trimestral dura 3 meses');
  // «Programa de 4 meses: 4 cuotas»: la N de las cuotas gana a la de los meses.
  assert.equal(lee('Programa de 4 meses (16 semanas): 4 cuotas de USD 250'), de(4));
  assert.equal(lee('Garantía de 6 meses, 6 cuotas de USD 100'), de(6), 'la N de la garantía tapaba la de las cuotas');
});

test('5. un número pelado no es un monto: «1:1 semanal» o «3 x semana» no pegan una periodicidad', () => {
  assert.equal(lee('USD 1.500 en 12 cuotas mensuales, sesión 1:1 semanal'), de(12));
  assert.equal(lee('Entrenamiento 3 x semana, USD 100 por mes'), COBRO_MENSUAL);
  assert.equal(lee('Clases 2x semana, 3 cuotas'), de(3));
  // Lo pegado a un monto con moneda sigue contando.
  assert.equal(cobroDelPrecio('USD 50 por semana').periodo, 'semanal');
});

test('6. PDF: lo escrito nunca trae el separador de lo sumado, y dos sumas se cuentan y se anotan', () => {
  assert.ok(!limpiarRespuesta(`a${SUMA_PDF}b`).includes(SUMA_PDF), 'limpiarRespuesta deja pasar el separador: lo escrito podría partirse');
  const E: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', pdfEscritas: Array.from({ length: PDF_TOPE_ESCRITAS }, (_, i) => `cosa ${i}`) };
  const r1 = responder(E, { texto: 'el precio' });
  assert.ok(r1.ok);
  const e1: EstadoArranque = { ...E, ...(r1.ok ? r1.patch : {}) };
  const r2 = responder(e1, { texto: 'la garantía' });
  assert.ok(r2.ok);
  const e2: EstadoArranque = { ...e1, ...(r2.ok ? r2.patch : {}) };
  assert.equal(mensajesDeArranque(e2, H).despues.at(-1)?.texto, pdfConfirmarPregunta(`cosa 4${SUMA_PDF}el precio${SUMA_PDF}la garantía`));
  assert.match(mensajesDeArranque(e2, H).despues.at(-1)?.texto ?? '', /«la garantía» \(y 2 cosas más\)/);
  assert.equal(notaDelPdf({ ...e2, pdfOk: 'no' }), 'cosa 0 · cosa 1 · cosa 2 · cosa 3 · cosa 4 · el precio · la garantía');
});

// ROTURAS (21/10/2026, romper.js + roturas-undecima.json del scratchpad; con décima, novena, octava, séptima, quinta,
// toque-que-confirma y cierre-florencia; base 41/0), 15 de 15: el borde sólo después de la letra → 40/1 · los meses sueltos
// se proponen → 40/1 · los meses de regalo cuentan → 40/1 · sin los meses del plan → 40/1 · sin el pago único dicho de
// otra forma → 40/1 · la negación sólo como antes → 40/1 · la lectura con su propio parser → 39/2 · un monto entra como N →
// 40/1 · «x N clases» cuenta → 40/1 · lo trimestral pegado suma N → 40/1 · la N de cuotas no gana a la de meses → 5/1 (con
// «Garantía de 6 meses, 6 cuotas», que se sumó porque la primera pasada dio verde) · un número pelado pega periodicidad →
// 38/3 · «Sin cuotas mensuales» deja lo mensual → 39/2 · «USD 330 x 3» no cuenta → 40/1 · limpiarRespuesta deja pasar el
// separador → 40/1. Y medido con las 570 frases de la sonda del Cerebro (medir-criterio.mts): faltan 0, el «Sí» guarda mal
// 6 (producción 122), ninguno nuevo.

// =============================================================================
// Las respuestas escritas del diagnóstico de fase, con frases reales (20/10/2026, noche)
// =============================================================================
// La revisión del Cerebro de la punta 4eef10c7a encontró que los arreglos de la tarde (6f3e53d26) leían mal cifras y
// opciones, y lo leído se guarda en el diagnóstico con «Lo tomé como», sin forma de corregirlo:
//   · «Facturo 2 millones» caía en «$0 – $3.000»: `startsWith('mil')` también es true para «millones»;
//   · «entre 30 y 50 mil» promediaba 30 con 50.000, y «15 mil y tengo 4 clientes» se tomaba como un rango;
//   · «10 llamadas por semana» no se pasaba a mes;
//   · la negación borraba también las palabras de las OPCIONES: «tengo leads pero no cierran» caía en «Me sobra volumen»;
//   · «me compran directo en la web» se guardaba como «Conversaciones por chat».
// Las frases van en tuteo y en voseo, con números en letras, con puntos y en lunfardo («lucas», «palos»).
// lib/onboarding-arranque.ts → cifraDe, tramoDe, opcionMasCercana, canalDeTexto. docs/hallazgos-onboarding.md.
//
// ROTURAS (20/10/2026 noche, romper.js + roturas-noche.json del scratchpad, corridas junto con onboarding-nombre-negocio,
// cierre-florencia, offer-texto-largo, onboarding-recorte y onboarding-opcion-escrita; base 41/0): la negación borra como
// antes → 40/1 · lo negado vale lo mismo que una palabra suelta → 40/1 · millones por mil → 38/3 · el rango no comparte el
// multiplicador → 39/2 · una «y» cualquiera hace un rango → 39/2 · con cifras sueltas vale la primera → 39/2 · lo semanal
// no se pasa a mes → 40/1 · lo anual tampoco → 40/1 · sin los números en letras → 39/2 · «directo» vuelve a ser chat → 40/1
// · la web no es carrito → 40/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canalDeTexto, cifraDe, leerRespuesta, opcionMasCercana, tramoDe, type EstadoArranque, type HechosArranque } from '../lib/onboarding-arranque';
import { PREGUNTAS, VOLUMEN_POR_CANAL } from '../lib/fase-diagnostico';

const opcionesDe = (id: string) => PREGUNTAS.find((q) => q.id === id)!.opciones;
const FACTURACION = opcionesDe('facturacion');
const INVERSION = opcionesDe('inversion');
const PIEZAS = opcionesDe('creativos');
const CUELLO = opcionesDe('cuello');

const enTramo = (opciones: readonly string[], casos: Array<[string, number | null]>) => {
  for (const [frase, i] of casos) {
    assert.equal(tramoDe(frase, opciones), i, `«${frase}» (${cifraDe(frase)}) → ${i == null ? 'se vuelve a preguntar' : `«${opciones[i]}»`}`);
  }
};

test('facturación: millones, miles, letras, puntos y lunfardo, en tuteo y en voseo', () => {
  enTramo(FACTURACION, [
    // Los millones (la revisión: valían por mil).
    ['Facturo 2 millones', 4], ['más de 1 millón', 4], ['1,5 millones', 4], ['unos 2 millones de pesos', 4], ['2M', 4],
    ['Facturamos 2 palos por mes', 4], ['dos millones', 4], ['un millón y medio', 4], ['medio millón', 4],
    // Los miles, en cifras, en letras y en lunfardo.
    ['Facturo 15.000 al mes', 2], ['Unos 15.000 dólares', 2], ['$20.000 al mes', 2], ['5.000 USD', 1], ['50 mil', 3],
    ['cincuenta mil', 3], ['treinta y cinco mil', 3], ['50 lucas', 3], ['Facturás como 40 lucas por mes', 3],
    ['Ponele que 8 mil dólares', 1], ['15k', 2], ['mil dólares', 0], ['2.500', 0], ['dos mil quinientos', 0],
    ['más de 80.000', 4], ['Más de 100.000 dólares por mes', 4], ['unos 50.000 usd', 3],
    // Los rangos (la revisión: «mil» sólo al final daba el tramo de abajo).
    ['entre 30 y 50 mil', 3], ['de 30 a 50 mil', 3], ['entre 3 y 5 mil', 1], ['entre treinta y cincuenta mil', 3],
    ['Entre 20 y 25k', 2], ['entre 10.000 y 30.000', 2], ['10.000 - 30.000', 2], ['$10.000 - $30.000', 2],
    // Cifras sueltas: vale la que tiene plata o magnitud; con dos así, se pregunta de nuevo.
    ['Facturo 15 mil y tengo 4 clientes', 2], ['tengo 4 clientes y facturo 15 mil', 2],
    ['facturo 15.000 al mes, 180.000 al año', null],
    // Lo anual se pasa a mes; nada es nada; sin cifra, se pregunta.
    ['Facturo 120 mil al año', 2], ['Nada', 0], ['todavía nada', 0], ['Facturo un poco', null], ['muchísimo', null],
  ]);
});

test('inversión, piezas y volumen: lo diario y lo semanal se pasan a mes', () => {
  enTramo(INVERSION, [
    ['entre 10 y 15 mil', 3], ['1,5 millones', 4], ['$20 por día', 1], ['Invierto 5.000 por mes', 2], ['nada', 0],
    ['unos 500 dólares por semana', 1], ['Invertís como 3 lucas', 2], ['unos 20.000 en anuncios', 3],
  ]);
  enTramo(PIEZAS, [['2 por semana', 1], ['dos videos por semana', 1], ['3 por mes', 0], ['saco unos quince posts', 2]]);
  enTramo(VOLUMEN_POR_CANAL.llamadas.opciones, [['10 llamadas por semana', 2], ['unas 3 por día', 3], ['quince al mes', 1]]);
  enTramo(VOLUMEN_POR_CANAL.carrito.opciones, [['unas 3.000 ventas', 3]]);
});

test('el cuello: lo negado empareja con lo negado de la opción, y vale más que una palabra suelta', () => {
  const casos: Array<[string, number | null]> = [
    // La regresión de la revisión: daban «Me sobra volumen» por la palabra «leads».
    ['Tengo muchos leads pero no cierran', 1], ['Los leads no agendan', 1], ['Me llegan leads pero no se presentan a la llamada', 1],
    ['los que se interesan no agendan', 1], ['vendo cuando empujo yo, pero va cambiando', 2], ['no tengo seguimiento', 2],
    ['Me sobran leads pero son flojos', 4], ['no doy abasto', 3], ['hola', null],
  ];
  for (const [frase, i] of casos) assert.equal(opcionMasCercana(frase, CUELLO), i, `«${frase}»`);
  // Lo negado del dueño no empareja con lo mismo SIN negar: «no hago llamadas» no es «Llamada de venta».
  assert.equal(opcionMasCercana('no hago llamadas', ['Llamada de venta', 'Por chat']), null);
});

test('el canal: «directo» no es chat, y la web es carrito', () => {
  assert.equal(canalDeTexto('Me compran directo en la web'), 'carrito');
  assert.equal(canalDeTexto('Compran directo en mi página'), 'carrito');
  assert.equal(canalDeTexto('por mensaje directo'), 'conversaciones');
  assert.equal(canalDeTexto('No hago llamadas, vendo todo por chat'), 'conversaciones');
  assert.equal(canalDeTexto('por mi página de Instagram'), null, 'dos canales: se pregunta de nuevo');
});

test('y en el flujo: «Facturo 2 millones» guarda la fase más alta, no la más baja', () => {
  const H: HechosArranque = {
    modo: 'oferta', nombreCuenta: 'Florencia', nombreWorkspace: '', faseGuardada: false,
    canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: true, terminado: false,
  };
  const e: EstadoArranque = { nombre: 'Florencia', negocio: 'Florencia Carballo', pdfOk: 'si' };
  const r = leerRespuesta(e, H, { texto: 'Facturo 2 millones' });
  assert.ok(r.ok && r.patch.faseResp?.[0] === 4, r.ok ? JSON.stringify(r.patch) : r.error);
  const suelta = leerRespuesta(e, H, { texto: 'facturo 15.000 al mes, 180.000 al año' });
  assert.equal(suelta.ok, false, 'con dos cifras de plata no se adivina');
});

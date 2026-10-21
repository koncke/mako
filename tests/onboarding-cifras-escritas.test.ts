// =============================================================================
// Las respuestas escritas del diagnóstico de fase, con frases reales (20/10/2026 noche → 21/10/2026)
// =============================================================================
// La segunda revisión del Cerebro (punta 4eef10c7a) encontró que los arreglos de la tarde leían mal cifras y opciones:
// «Facturo 2 millones» caía en «$0 – $3.000» (`startsWith('mil')` es true para «millones»), «entre 30 y 50 mil» promediaba
// 30 con 50.000, «10 llamadas por semana» no se pasaba a mes, la negación borraba también las palabras de las OPCIONES y
// «directo» era chat. La tercera (8805b81aa) encontró que esos arreglos abrían otros agujeros: «2 palos» (pesos) leído en
// dólares, lo negado valiendo doble, «web» sola como carrito, «a la semana» suelto multiplicando lo mensual, «treinta y
// pico mil» y «cinco cifras» en «todavía nada».
// Desde el 21/10 lo que lee esto se CONFIRMA con un toque antes de guardarse (tests/onboarding-opcion-escrita.test.ts): un
// error de lectura cuesta un clic. Esta batería fija que la LECTURA sea buena con frases reales —tuteo y voseo, números en
// letras, con puntos y con espacios—, y que ante la duda no adivine (null: se muestran las opciones). Una cifra en pesos no
// se ubica en un tramo (los tramos son en dólares): `monedaLocal`.
// lib/onboarding-arranque.ts → cifraDe, tramoDe, opcionMasCercana, canalDeTexto, monedaLocal. docs/hallazgos-onboarding.md.
//
// ROTURAS (21/10/2026, romper.js + roturas-tercera.json del scratchpad, corridas con onboarding-opcion-escrita,
// onboarding-nombre-negocio y onboarding-cierre-florencia; base 24/0): lo escrito se guarda sin el toque → 18/6 · la
// confirmación sin «Sí, es eso» → 20/4 · corregir con otra opción guarda lo escrito igual → 23/1 · la cifra en pesos se
// ubica igual → 23/1 · «verdes» o «dólares» no salvan de los pesos → 22/2 · una sola palabra suelta alcanza → 23/1 · lo negado
// vale doble → 23/1 · la web sola vuelve a ser carrito → 23/1 · agendar no es llamada → 23/1 · lo semanal suelto multiplica
// → 23/1 · «pico», «tantos» y «cifras» se leen como cifra → 23/1 · una «y» con otra cantidad arma rango → 23/1 · un rango
// que baja se promedia → 23/1 · el precio por unidad pasa como total → 23/1 · el espacio no separa miles → 23/1 · el interés
// lee lo negado → 23/1 · una palabra de acuerdo reemplaza al nombre → 23/1 · «sisi» no es sí → 23/1 · «N pagos con tarjeta»
// es suscripción → 23/1. Una más («los verbos de relleno no cuentan») no la detectaba ningún test: ese código se sacó.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canalDeTexto, cifraDe, monedaLocal, opcionMasCercana, tramoDe } from '../lib/onboarding-arranque';
import { PREGUNTAS, VOLUMEN_POR_CANAL } from '../lib/fase-diagnostico';

const opcionesDe = (id: string) => PREGUNTAS.find((q) => q.id === id)!.opciones;
const FACTURACION = opcionesDe('facturacion');
const INVERSION = opcionesDe('inversion');
const PIEZAS = opcionesDe('creativos');
const CUELLO = opcionesDe('cuello');
const FUNNEL = opcionesDe('funnel');

const enTramo = (opciones: readonly string[], casos: Array<[string, number | null]>) => {
  for (const [frase, i] of casos) {
    assert.equal(tramoDe(frase, opciones), i, `«${frase}» (${cifraDe(frase)}) → ${i == null ? 'se vuelve a preguntar' : `«${opciones[i]}»`}`);
  }
};

test('facturación: millones, miles, letras, puntos y espacios, en tuteo y en voseo', () => {
  enTramo(FACTURACION, [
    // Los millones (la segunda revisión: valían por mil).
    ['Facturo 2 millones', 4], ['más de 1 millón', 4], ['1,5 millones', 4], ['2M', 4], ['dos millones de dólares', 4],
    ['un millón y medio', 4], ['medio millón', 4], ['2 palos verdes', 4],
    // Los miles, en cifras, en letras y con espacio (la norma de la RAE).
    ['Facturo 15.000 al mes', 2], ['Unos 15.000 dólares', 2], ['$20.000 al mes', 2], ['5.000 USD', 1], ['50 mil', 3],
    ['cincuenta mil', 3], ['treinta y cinco mil', 3], ['Ponele que 8 mil dólares', 1], ['15k', 2], ['mil dólares', 0],
    ['2.500', 0], ['dos mil quinientos', 0], ['15 000 euros al mes', 2], ['más de 80.000', 4], ['Más de 100.000 dólares por mes', 4],
    ['unos 50.000 usd', 3], ['Facturás como 40 mil por mes', 3],
    // Los rangos: la punta de abajo comparte el multiplicador; no es rango si baja o cuenta otra cosa.
    ['entre 30 y 50 mil', 3], ['de 30 a 50 mil', 3], ['entre 3 y 5 mil', 1], ['entre treinta y cincuenta mil', 3],
    ['Entre 20 y 25k', 2], ['entre 10.000 y 30.000', 2], ['10.000 - 30.000', 2], ['$10.000 - $30.000', 2],
    ['Facturo 15 mil y 4 clientes', 2], ['15 mil y 4 clientes por mes', 2], ['8 mil y 12 clientes', 1], ['15 mil y 4 de margen', 2],
    // Cifras sueltas: vale la que tiene plata o magnitud; con dos así, o con un precio por unidad, no se adivina.
    ['Facturo 15 mil y tengo 4 clientes', 2], ['tengo 4 clientes y facturo 15 mil', 2],
    ['facturo 15.000 al mes, 180.000 al año', null], ['Hago 10 ventas al mes de 2 mil', null], ['tengo 3 clientes de 2 mil cada uno', null],
    // Lo anual se pasa a mes; lo semanal o diario, sólo pegado a la cifra y si no dijo «mes».
    ['Facturo 120 mil al año', 2], ['Facturo 40 mil al mes, trabajo 3 días a la semana', 3],
    ['Facturamos 50 mil por mes, 6 días a la semana', 3], ['unos 15 mil al mes, atiendo 8 horas por día', 2],
    // Lo vago no es una cifra (la tercera revisión: caía en «todavía nada»).
    ['treinta y pico mil', null], ['veintitantos mil', null], ['cuarenta y tantos mil', null], ['20 y pico mil', null],
    ['facturo cinco cifras', null], ['seis cifras al año', null],
    // Nada es nada; sin cifra, se pregunta.
    ['Nada', 0], ['todavía nada', 0], ['Facturo un poco', null], ['muchísimo', null],
  ]);
});

test('la moneda: en pesos (o «lucas», «palos») no se ubica el tramo; con dólares o euros, sí', () => {
  for (const t of ['Facturamos 2 palos por mes', 'unos 2 millones de pesos', '50 lucas', 'Facturás como 40 lucas por mes',
    'facturo 800 mil pesos', '$ 2.000.000 ars', 'Invierto 1 millón de pesos al mes', 'Invertís como 3 lucas', '12 millones de pesos chilenos',
    'facturo 3 millones de pesos colombianos', '1 500 000 pesos', 'unos 30 mil mxn']) {
    assert.equal(monedaLocal(t), true, `«${t}» es en pesos`);
  }
  for (const t of ['2 palos verdes', '5.000 USD', 'Unos 15.000 dólares', '15 000 euros', 'Facturo 15.000 al mes', 'u$s 3.000']) {
    assert.equal(monedaLocal(t), false, `«${t}» no es en pesos`);
  }
});

test('inversión, piezas y volumen: lo diario y lo semanal se pasan a mes', () => {
  enTramo(INVERSION, [
    ['entre 10 y 15 mil', 3], ['1,5 millones de dólares', 4], ['$20 por día', 1], ['Invierto 5.000 por mes', 2], ['nada', 0],
    ['unos 500 dólares por semana', 1], ['Invertís como 3 mil dólares', 2], ['unos 20.000 en anuncios', 3],
  ]);
  enTramo(PIEZAS, [['2 por semana', 1], ['dos videos por semana', 1], ['3 por mes', 0], ['saco unos quince posts', 2]]);
  enTramo(VOLUMEN_POR_CANAL.llamadas.opciones, [['10 llamadas por semana', 2], ['unas 3 por día', 3], ['quince al mes', 1]]);
  enTramo(VOLUMEN_POR_CANAL.carrito.opciones, [['unas 3.000 ventas', 3]]);
});

test('el cuello y el funnel: hace falta evidencia, y lo negado no pisa el contenido', () => {
  const casos: Array<[readonly string[], string, number | null]> = [
    [CUELLO, 'los que se interesan no agendan', 1], [CUELLO, 'vendo cuando empujo yo, pero va cambiando', 2],
    [CUELLO, 'no tengo seguimiento', 2], [CUELLO, 'Me sobran leads pero son flojos', 4], [CUELLO, 'no doy abasto', 3],
    // Una sola palabra suelta («leads») o un empate: no se adivina, se muestran las opciones (la tercera revisión: caían en
    // «Me sobra volumen» o en «no me compra»).
    [CUELLO, 'Tengo muchos leads pero no cierran', null], [CUELLO, 'Tengo leads pero no me responden', null],
    [CUELLO, 'tengo interesados pero no compran', null], [CUELLO, 'Los leads se enfrían', null],
    [CUELLO, 'Me cuesta cerrar las ventas', null], [CUELLO, 'hola', null],
    [FUNNEL, 'no tengo seguimiento pero ya vendo', null], [FUNNEL, 'Ya vendo por anuncios pero sin sistema', 1],
  ];
  for (const [opciones, frase, i] of casos) assert.equal(opcionMasCercana(frase, opciones), i, `«${frase}»`);
  // Lo negado del dueño no empareja con lo mismo SIN negar: «no hago llamadas» no es «Llamada de venta».
  assert.equal(opcionMasCercana('no hago llamadas', ['Llamada de venta', 'Por chat']), null);
});

test('el canal: «web» sola no decide; agendar o llamar es llamada, escribir es chat, comprar en la web es carrito', () => {
  const casos: Array<[string, string | null]> = [
    ['Me compran directo en la web', 'carrito'], ['Compran directo en mi página', 'carrito'], ['pagan con el link de pago', 'carrito'],
    ['Entran a la web y me agendan', 'llamadas'], ['Desde la web agendan una reunión', 'llamadas'], ['Agendan por Calendly desde mi web', 'llamadas'],
    ['Llenan un formulario en mi web y los llamo', 'llamadas'], ['se registran en mi web y después los llamo', 'llamadas'],
    ['Me escriben desde mi página web', 'conversaciones'], ['Por mi página de Facebook me escriben', 'conversaciones'],
    ['por mensaje directo', 'conversaciones'], ['No hago llamadas, vendo todo por chat', 'conversaciones'],
    ['por mi página de Instagram', 'conversaciones'], ['tengo una web', null], ['les vendo por la página de Facebook', null],
  ];
  for (const [frase, canal] of casos) assert.equal(canalDeTexto(frase), canal, `«${frase}»`);
});

// =============================================================================
// Offer: «Los números» de la propuesta dicen cuáles estimó MaKo (17/10/2026, la mitad que quedó del «43», #888)
// =============================================================================
// En la Parte 2 del PDF de Código Inmobiliario la IA escribía márgenes y un «LTV:CAC estimado superior a 5 a 1» que
// nadie le dio: el prompt le pide esas cuentas (lib/offer-ia.ts, punto 11) y nada las revisaba (docs/hallazgos-offer.md
// → «El 43 de Código Inmobiliario» → Lo que quedó SIN hacer). El código no las puede CALCULAR (no tiene el costo de
// adquisición ni la retención), así que las MARCA: una línea con una cifra que el negocio no dio lleva
// «(estimado por MaKo)» y va a «Lo que propuso MaKo» (la decisión 10 de Martín del 12/10/2026). Lo que se fija:
//   1. `numeroDeLaPropuesta` (puro): qué se marca y qué no (lo del negocio, el precio, la cuenta a la vista, «[completar]»);
//   2. la propuesta armada (`parsePropuesta`) sale marcada y lo estimado está en «Lo que propuso MaKo»;
//   3. lo GUARDADO antes se lee marcado (`conclusionVisible`, la pantalla y el PDF), sin tocar la fila.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): los números al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARCA_ESTIMADO, conclusionVisible, numeroDeLaPropuesta, parsePropuesta } from '../lib/offer-reglas';
import { MARCA_COMPLETAR, type ConclusionOferta, type PiezasSabidas } from '../lib/offer-marco';

const AT = '2026-10-17T12:00:00.000Z';
const pieza = (valor: string) => ({ valor, fuente: 'chat' as const, at: AT });
const PIEZAS: PiezasSabidas = {
  cliente: pieza('Agentes inmobiliarios independientes de Mérida'),
  problema: pieza('No consiguen exclusivas'),
  resultado: pieza('Cerrar 2 exclusivas por mes y facturar 10.000 USD al mes'),
  precio: pieza('1.900 USD'),
  costo: pieza('380 USD por cliente'),
  ventas: pieza('Pagaron 21 personas'),
};

const LTV = 'LTV:CAC estimado superior a 5 a 1';
const NUMEROS = [
  'Margen bruto: 80%',                                    // lo calcula el código con el precio y el costo
  LTV,                                                    // nadie lo dio
  'Ventas por mes necesarias: 10.000 USD / 1.900 USD = 5', // la cuenta a la vista con el precio
  'Llamadas necesarias: 25',                              // nadie lo dio
  `% cobrado al firmar: ${MARCA_COMPLETAR}`,
];

const propuestaCruda = () => ({
  nombre: 'Exclusivas en 90 días', frase: 'Ayudo a agentes inmobiliarios a cerrar exclusivas con el Método Llave.',
  mensajes: { corto: 'Cierra exclusivas', largo: 'x', entrada: 'y' },
  paraQuien: { perfil: 'Agentes', minimo: 'Tener cartera', noEs: 'Quien recién empieza' },
  problema: { hoy: 'No cierran', despues: 'Cierran', obstaculos: ['Competencia'], yaProbo: 'Portales' },
  mecanismo: { nombres: ['Método Llave (propuesta)'], pasos: ['Uno', 'Dos', 'Tres'], distinto: 'Por zona' },
  ruta: [{ fase: 'Arranque', objetivo: 'La lista', hito: 'Semana 1' }],
  incluye: [{ nombre: 'Sesiones', beneficio: 'Guía semanal' }],
  formato: 'Grupal, 90 días', prueba: 'Alumnos que ya cierran.',
  garantia: { nombre: 'Garantía de exclusiva', condiciones: 'Hacer las tareas', plazo: '90 días', siNoCumple: 'Seguimos' },
  bonos: [{ nombre: 'Guiones', objecion: 'No sé qué decir', valor: 'Ahorra tiempo' }],
  inversion: { valorTotal: 'El valor de todo junto', precio: '1.900 USD', contado: '1.900 USD', plan: 'Dos pagos', comoDecirlo: 'Primero el valor.' },
  urgencia: 'x', escenarios: { mejor: 'Cierra', peor: 'Aprende' },
  ecuacion: [], numeros: NUMEROS, validar: [], siguiente: 'Mentoría',
});

test('1 · numeroDeLaPropuesta marca lo que el negocio no dio, y deja lo suyo, el precio, la cuenta a la vista y el hueco', () => {
  const permitidas = new Set(['1900', '380', '21', '10000', '80', '2']);
  assert.deepEqual(numeroDeLaPropuesta(LTV, permitidas), { texto: `${LTV} ${MARCA_ESTIMADO}`, estimado: true });
  assert.deepEqual(numeroDeLaPropuesta('Margen bruto: 80%', permitidas), { texto: 'Margen bruto: 80%', estimado: false });
  assert.equal(numeroDeLaPropuesta(NUMEROS[2], permitidas).estimado, false, 'la cuenta a la vista con cifras del negocio');
  assert.equal(numeroDeLaPropuesta('Ventas necesarias: 10.000 USD / 1.500 USD = 7', permitidas).estimado, true, 'con un precio que nadie dio, no');
  assert.equal(numeroDeLaPropuesta('Llamadas necesarias: 25', permitidas).estimado, true);
  assert.equal(numeroDeLaPropuesta(`Cobrado al firmar: ${MARCA_COMPLETAR}`, permitidas).estimado, false, 'un hueco ya dice que falta');
  assert.equal(numeroDeLaPropuesta(`Cobrado al firmar: 50% de ${MARCA_COMPLETAR}`, permitidas).estimado, false, 'con cifras y hueco, también');
  // Una vez: la marca no se repite al volver a pasar.
  const una = numeroDeLaPropuesta(LTV, permitidas).texto;
  assert.equal(numeroDeLaPropuesta(una, permitidas).texto, una);
});

test('2 · la propuesta armada sale con lo estimado marcado, y eso va a «Lo que propuso MaKo»', () => {
  const p = parsePropuesta(propuestaCruda(), PIEZAS);
  assert.ok(p);
  assert.equal(p.numeros[0], 'Margen bruto: 80%', 'el margen lo calcula el código con su precio y su costo');
  assert.equal(p.numeros[1], `${LTV} ${MARCA_ESTIMADO}`);
  assert.equal(p.numeros[2], NUMEROS[2]);
  assert.equal(p.numeros[3], `Llamadas necesarias: 25 ${MARCA_ESTIMADO}`);
  assert.equal(p.numeros[4], NUMEROS[4]);
  const numeros = p.propuestoPorMako.filter((x) => x.seccion === 'Números').map((x) => x.que);
  assert.deepEqual(numeros, [LTV, 'Llamadas necesarias: 25']);
});

test('3 · lo guardado antes se lee con la marca (la pantalla y el PDF), sin tocar la fila', () => {
  const guardada = {
    version: 1, at: AT, modelo: 'IA gratis del negocio',
    calculo: { total: 71, cuello: 'D8', lista: false, alertas: [], cifrasConFuente: true },
    diagnostico: { tesis: '', fuerte: '', fuertes: [], dimensiones: [], cambios: [] },
    propuesta: { ...propuestaCruda(), numeros: [...NUMEROS] },
  } as unknown as ConclusionOferta;
  const v = conclusionVisible(guardada, { piezas: PIEZAS, mensajes: [], documentos: [] });
  assert.equal(v.propuesta.numeros[1], `${LTV} ${MARCA_ESTIMADO}`);
  assert.equal(v.propuesta.numeros[0], 'Margen bruto: 80%');
  assert.equal(guardada.propuesta.numeros[1], LTV, 'no muta lo guardado');
  // Si el dueño dijo las llamadas en el chat, son suyas.
  const conMensaje = conclusionVisible(guardada, { piezas: PIEZAS, mensajes: [{ de: 'yo', texto: 'hacemos unas 25 llamadas' }], documentos: [] });
  assert.equal(conMensaje.propuesta.numeros[3], 'Llamadas necesarias: 25');
  // Sin nada que marcar, el mismo objeto.
  const limpia = { ...guardada, propuesta: { ...guardada.propuesta, numeros: ['Margen bruto: 80%'] } } as ConclusionOferta;
  assert.equal(conclusionVisible(limpia, { piezas: PIEZAS, mensajes: [], documentos: [] }), limpia);
});

// =============================================================================
// ROTURAS (17/10/2026). Arnés del scratchpad: reemplaza UNA ocurrencia exacta, corre este archivo, restaura DE MEMORIA
// y compara el sha256. Base: 3 / 0. pasan / fallan:
//   O1  sin marcar nada .......................................................... 0 / 3
//   O2  la cuenta a la vista también se marca .................................... 1 / 2
//   O3  el margen que calcula el código no cuenta como del negocio ............... 2 / 1
//   O4  aplicarReglasPropuesta no pasa por los números ........................... 2 / 1
//   O5  lo estimado no va a «Lo que propuso MaKo» ................................ 2 / 1
//   O6  lo guardado no se marca al leer .......................................... 2 / 1
//   O7  una línea con «[completar]» se marca (la primera versión del test no lo
//       veía: el hueco no tenía cifras; se sumó «50% de [completar]») ............. 2 / 1
// Restaurado: 3 / 0 (sha256 igual).
// =============================================================================

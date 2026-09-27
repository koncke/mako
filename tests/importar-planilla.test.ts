// =============================================================================
// El importador del CRM lee planillas de Excel
// =============================================================================
// Hasta el 27/09/2026 un .xlsx rebotaba con «guárdala como CSV» mientras un PDF
// ESCANEADO sí se leía, y el comentario que lo justificaba decía que hacía falta
// «una dependencia entera». Para entonces el lector ya estaba en el árbol
// (lib/office-a-texto, escrito para el importador del plan). Esto fija las tres
// cosas que hacen que no vuelva a pasar.
//
// Probado rompiéndolo, dos veces: volviendo a poner .xlsx entre los rechazados dan
// 3 pases y 1 fallo; haciendo que se quede con la PRIMERA hoja, 2 y 2. Con el
// código como está, 4 y 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTENSIONES_IMPORT,
  EXTENSIONES_PLANILLA,
  esPlanilla,
  esPlanillaLeible,
  filasDesdePlanilla,
  filasDesdeCsv,
  parseCsv,
  recalcular,
} from '../app/crm/leads-importar';

/** El formato EXACTO que devuelve `xlsxATexto`: celdas por TAB, una hoja por bloque.
 *  Medido el 27/09/2026 corriendo la función sobre un .xlsx armado a mano. */
const TEXTO_REAL = [
  '===== Hoja: Portada =====',
  'Resumen del mes',
  '',
  '===== Hoja: Leads =====',
  'Nombre\tEmail\tTelefono\tEmpresa',
  'Ana Gómez\tana@ejemplo.com\t5512345678\tAcme',
  'Luis Pérez\tluis@ejemplo.com\t5598765432\tGlobex',
  'Sin Contacto',
].join('\n');

test('un .xlsx entra al importador, y no por la IA', () => {
  assert.ok(EXTENSIONES_IMPORT.includes('.xlsx'), 'el selector de archivos tiene que ofrecerlo');
  assert.ok(esPlanillaLeible('lista de leads.xlsx'), 'el .xlsx se lee');
  assert.ok(!esPlanilla('lista de leads.xlsx'), 'y ya no se rechaza');
  // Los cerrados de verdad siguen afuera, con su mensaje: son los únicos que no se
  // pueden abrir sin una librería propietaria.
  for (const n of ['viejo.xls', 'binario.xlsb', 'de apple.numbers']) {
    assert.ok(esPlanilla(n), `${n} no se puede leer y tiene que seguir rechazado`);
    assert.ok(!esPlanillaLeible(n), `${n} no puede estar en los legibles`);
  }
  assert.equal(EXTENSIONES_PLANILLA.length, 3, 'si crece la lista de rechazados, alguien volvió a cerrar un formato que sí se lee');
});

test('las filas salen EXACTAS de la planilla, sin pasar por un modelo', () => {
  const r = filasDesdePlanilla(TEXTO_REAL);
  assert.equal(r.error, undefined, `no debería haber error: ${r.error}`);
  const filas = recalcular(r.filas);
  assert.equal(filas.length, 3, 'las tres filas de datos, incluida la que se va a descartar');
  // ⚠️ El email y el teléfono se comparan CARÁCTER POR CARÁCTER: son la razón por la
  // que este camino no puede ir por la IA. Un dígito cambiado entra al CRM, no
  // matchea su chat de WhatsApp ni su Calendly, y no se nota hasta que falta una
  // conversación (AGENTS.md, «un DATO EXACTO que pasa por un LLM deja de ser exacto»).
  assert.equal(filas[0].nombre, 'Ana Gómez');
  assert.equal(filas[0].email, 'ana@ejemplo.com');
  assert.equal(filas[0].telefono, '5512345678');
  assert.equal(filas[0].empresa, 'Acme');
  assert.equal(filas[1].telefono, '5598765432');
  // La fila sin contacto NO se esconde: se muestra atenuada con su motivo.
  assert.equal(filas[2].nombre, 'Sin Contacto');
  assert.equal(filas[2].motivo, 'sin-contacto');
});

test('gana la primera hoja CON encabezados, no la primera hoja', () => {
  // La hoja 1 de un archivo real es muchas veces una portada, un resumen o un
  // tablero. Quedarse con ella contestaba «no encontré una columna Nombre» sobre un
  // archivo que la tiene una pestaña más allá — un error verdadero sobre la pregunta
  // equivocada, que es la peor clase.
  const soloPortada = ['===== Hoja: Portada =====', 'Resumen del mes'].join('\n');
  assert.equal(filasDesdePlanilla(soloPortada).filas.length, 0, 'sin ninguna hoja usable no se inventa nada');
  assert.ok(filasDesdePlanilla(soloPortada).error, 'y se dice por qué');
  assert.equal(filasDesdePlanilla(TEXTO_REAL).filas.length, 3, 'con la portada delante, igual encuentra los leads');
});

test('el parser del CSV acepta el delimitador, y por default sigue siendo la coma', () => {
  // El TAB no se cableó adentro del parser: el CSV es el 99% de los casos y cambiarle
  // el default habría partido cada archivo de comas en una sola columna.
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a\tb\n1\t2', '\t'), [['a', 'b'], ['1', '2']]);
  // Y las comillas siguen funcionando con cualquier delimitador: un nombre con coma
  // adentro de una celda de planilla es lo normal («Gómez, Ana»).
  assert.deepEqual(parseCsv('"Gómez, Ana"\tacme', '\t'), [['Gómez, Ana', 'acme']]);
  assert.equal(filasDesdeCsv('Nombre,Email\nAna,ana@x.com').filas[0].email, 'ana@x.com');
});

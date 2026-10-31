// =============================================================================
// Importar con etiquetas: separar la base en ramas sin rehacerla adentro (31/10/2026)
// =============================================================================
// Leila (30/10): su CRM exportado de la Academia, separado en tres ramas para Black November. La columna del archivo o una etiqueta para toda la
// lista. En lote: importar no le escribe a nadie.
//
// Correr: node --import tsx --test tests/importar-etiquetas.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esColumnaEtiqueta, etiquetasDeCelda, filasDesdeCsv, leadsPorEtiqueta } from '../app/crm/leads-importar';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');

test('1. qué columna trae el segmento, por palabra entera', () => {
  for (const h of ['Etiqueta', 'etiquetas', 'Segmento', 'tags', 'Tag', 'Lista', 'Mi segmento']) assert.equal(esColumnaEtiqueta(h), true, h);
  for (const h of ['Stage', 'Etapa', 'Nombre', 'Listado de precios', 'Vintage']) assert.equal(esColumnaEtiqueta(h), false, h);
});

test('2. lo que dice la celda: varias, sin repetir, con tope', () => {
  assert.deepEqual(etiquetasDeCelda('Academia; Dueños | Academia'), ['Academia', 'Dueños']);
  assert.deepEqual(etiquetasDeCelda('  '), []);
  assert.deepEqual(etiquetasDeCelda(null), []);
  assert.equal(etiquetasDeCelda('a,b,c,d,e,f,g').length, 5);
  assert.equal(etiquetasDeCelda('x'.repeat(300))[0].length, 100);
});

test('3. el archivo la trae por fila, y una columna que no es no se lee', () => {
  const con = filasDesdeCsv('Nombre,Email,Segmento\nAna Ruiz,a@x.test,Academia\nLuz Díaz,l@x.test,\nEva Gil,e@x.test,"Academia, Dueños"');
  assert.deepEqual(con.filas.map((f) => f.etiquetas), [['Academia'], undefined, ['Academia', 'Dueños']]);
  const sin = filasDesdeCsv('Nombre,Email,Stage\nAna Ruiz,a@x.test,lead');
  assert.equal(sin.filas[0].etiquetas, undefined);
});

test('4. qué etiqueta va a qué leads: sólo lo que entró, y escrita distinto es una sola', () => {
  const filas = [{ id: 'a', etiquetas: ['Academia'] }, { id: 'b', etiquetas: ['academia', 'Dueños'] }, { id: 'c', etiquetas: ['Omitida'] }];
  const r = leadsPorEtiqueta(filas, [{ filaId: 'a', leadId: 1 }, { filaId: 'b', leadId: 2 }], null);
  assert.deepEqual([...r.entries()], [['Academia', [1, 2]], ['Dueños', [2]]]);
  const g = leadsPorEtiqueta(filas, [{ filaId: 'a', leadId: 1 }], 'Black November');
  assert.deepEqual(g.get('Black November'), [1], 'la de toda la lista');
  assert.deepEqual(g.get('Academia'), [1]);
  assert.equal(leadsPorEtiqueta(filas, [], 'X').size, 0, 'sin leads no se crea ninguna');
});

test('5. el server etiqueta en lote, sobre lo que entró, y un fallo no tumba la importación', () => {
  const a = leer('app/crm/actions.ts');
  assert.match(a, /etiquetarImportados\(leadsPorEtiqueta\(limpias, ids, etiquetaGeneral\), 'Importación'\)\.catch\(/);
  assert.match(a, /etiquetas: etiquetasDeCelda\(Array\.isArray\(f\?\.etiquetas\)/, 'lo que manda el navegador se sanea');
  const s = leer('app/crm/importar-server.ts');
  const f = s.slice(s.indexOf('export async function etiquetarImportados'), s.indexOf('export async function indiceContactos'));
  assert.match(f, /ponerEtiquetaLote\(ids, id, \{ autor \}\)/, 'en lote: no dispara automatizaciones');
  assert.doesNotMatch(f, /ponerEtiqueta\(/);
  assert.match(f, /claveNombre\(t\.nombre\) === claveNombre\(nombre\)/, 'la que ya existe no se duplica');
  assert.match(f, /!t\.archivada_at/);
  const m = leer('app/crm/ImportarLeadsModal.tsx');
  assert.match(m, /importarLeadsRevisadosAction\(filas, funnelId, etiqueta\.trim\(\) \|\| null\)/);
});

// =============================================================================
// «Exportar (CSV)» de la ficha del lead
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 10 del CRM): el «⋯» de la ficha exporta la hoja del lead. El CSV va en dos
// columnas (Campo, Valor), con la celda de la casa (lib/csv-celda.ts, la misma que el Dashboard) y el BOM.
//
// Correr: node --import tsx --test tests/ficha-exportar-lead.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, base 3/0): sin BOM → 2 / 1; sin el apóstrofo contra fórmulas en la celda → 2 / 1;
// el «⋯» sin la opción → 2 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { csvDelLead, nombreArchivoLead } from '../app/crm/lead-view/ficha/exportar-lead';

test('el CSV: BOM, encabezado, una fila por dato, sin las vacías, con comillas y sin fórmulas', () => {
  const csv = csvDelLead([['Nombre', 'María, la de "Ventas"'], ['Email', ''], ['Empresa', '=HYPERLINK("x")'], ['Lead', 412]]);
  assert.ok(csv.startsWith(String.fromCharCode(0xfeff)), 'sin BOM, Excel se come los acentos');
  const lineas = csv.slice(1).split('\r\n');
  assert.equal(lineas[0], 'Campo,Valor');
  assert.equal(lineas[1], 'Nombre,"María, la de ""Ventas"""');
  assert.equal(lineas[2], `Empresa,"'=HYPERLINK(""x"")"`, 'un texto que empieza con = no puede abrirse como fórmula');
  assert.equal(lineas[3], 'Lead,412');
  assert.equal(lineas.length, 5, 'la fila vacía (Email) no sale y el archivo termina en CRLF');
});

test('el nombre del archivo, sin tildes ni espacios', () => {
  assert.equal(nombreArchivoLead(412, 'María Pérez'), 'lead-412-maria-perez.csv');
  assert.equal(nombreArchivoLead(7, null), 'lead-7.csv');
});

test('el «⋯» de la ficha ofrece «Exportar (CSV)» y lo descarga', () => {
  const ficha = readFileSync('app/crm/lead-view/ficha/FichaPorBloques.tsx', 'utf8').replace(/\r\n/g, '\n');
  assert.match(ficha, /\{ value: 'csv', label: 'Exportar \(CSV\)', icono: 'descargar' \}/);
  assert.match(ficha, /else if \(v === 'csv'\) exportarCsv\(\);/);
});

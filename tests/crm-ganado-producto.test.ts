// =============================================================================
// «¿Qué compró?»: elegir el producto al cerrar en Ganado (24/10/2026)
// =============================================================================
// Decisión de Martín de agosto (memoria «productos-catalogo-crm»): elegir el producto al cerrar es OBLIGATORIO, con un «Otro /
// personalizado» para los casos sueltos, y el cierre hereda del producto el tipo de venta y el monto. `leads.producto_id`
// (mig 0117) existía y nadie lo escribía. Ahora: el asistente de mover a la etapa de cierre pregunta «¿Qué compró?» si el
// negocio tiene productos activos, completa lo que hereda y el server guarda el producto validado contra SU catálogo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('el asistente pregunta «¿Qué compró?» al cerrar (no en «Completar datos»), obligatorio, con «Otro / personalizado»', () => {
  const d = leer('app/crm/StageMoveDialog.tsx');
  assert.match(d, /if \(esCierre && !completarDatos && productos && productos\.length > 0\) p\.push\('producto'\);\n/, 'el paso no va primero en el cierre, o se pide sin catálogo');
  // El contrato ya no se pide al MOVER (27/10/2026, Martín: «Me sigue exigiendo CONTRATO, eso hay que eliminarlo»): sólo en
  // «Completar datos», cuando se piden las secciones del deal (tests/crm-feedback-27-10.test.ts).
  assert.match(d, /if \(completarDatos && necesitaDeal\) p\.push\('dealAuto'\);/, 'el contrato volvió a pedirse al mover');
  assert.match(d, /case 'producto': return productoElegido != null;/, 'se puede seguir sin elegir');
  assert.match(d, /<div style=\{\{ fontSize: 15 \}\}>Otro \/ personalizado<\/div>/);
  // Elegir uno completa lo heredado; el monto escrito a mano no se pisa.
  const elegir = d.slice(d.indexOf('const elegirProducto = '), d.indexOf('};', d.indexOf('const elegirProducto = ')));
  assert.match(elegir, /setVentaTipo\(p\.tipo === 'suscripcion' \? 'suscripcion' : 'unico'\);/);
  assert.match(elegir, /if \(!\(parseFloat\(monto\) > 0\) && p\.montoUsd\) setMonto\(String\(p\.montoUsd\)\);/, 'pisa el monto escrito a mano');
  // Lo que viaja: el id, o null para «Otro».
  assert.match(d, /\.\.\.\(pide\('producto'\) \? \{ productoId: productoElegido === 'otro' \? null : productoElegido \} : \{\}\),/);
  // El catálogo sólo para un cierre que se mueve.
  assert.match(d, /if \(!esCierre \|\| completarDatos\) return;\n\s+let vivo = true;\n\s+void productosParaCierreAction\(\)/);
  assert.match(d, /filas\.push\(\['Producto', /, 'el resumen no dice qué compró');
});

test('el server guarda el producto SÓLO si es del catálogo de este negocio, y lo deja en el historial', () => {
  const a = leer('app/crm/actions.ts');
  assert.match(a, /export type StageMoveData = \{\n(?:\s*\/\*\*[\s\S]*?\*\/\n)?\s*productoId\?: number \| null;/);
  const bloque = a.slice(a.indexOf('if (d.productoId !== undefined) {'), a.indexOf('// 5) Mover (updateLead'));
  assert.ok(bloque.length > 50, 'no encontré dónde se guarda el producto');
  assert.match(bloque, /const prod = d\.productoId == null \? null : catalogo\.find\(\(p\) => Number\(p\.id\) === d\.productoId\) \?\? null;/, 'guarda un id que no está en el catálogo');
  assert.match(bloque, /update\(\{ producto_id: prod \? Number\(prod\.id\) : null \}\)/);
  assert.match(bloque, /logLeadEvent\(id, 'Producto vendido', prod \? prod\.nombre : 'Otro \/ personalizado', autor\)/);
  const acc = leer('app/crm/producto-cierre-actions.ts');
  assert.match(acc, /await exigirSesion\(\);\n\s+try \{\n\s+return \(await listProductos\(true\)\)/, 'el catálogo sin sesión, o con los inactivos');
  assert.match(acc, /return \[\];\n\s+\}\n\}/, 'sin catálogo legible tira en vez de no ofrecer el paso');
});

// =============================================================================
// El Archivero · lo que un documento puede llenar del perfil según de QUIÉN habla (22/10/2026)
// =============================================================================
// ws13 (OF3, docs/hallazgos-offer.md): la propuesta de Código Inmobiliario a un prospecto dejó como «qué hace tu negocio»
// el negocio del prospecto. La extracción ahora dice de quién es el documento (`habla_de`) y el CÓDIGO decide qué
// llena: del negocio, todo; de un prospecto, la oferta y el cliente ideal pero no la identidad del negocio; de un
// proveedor, nada. Con documentos reales lo mide scripts/banco-archivero-quien.mts (antes y después del cambio).
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-quien.mjs en el scratchpad de la sesión). Los números,
// al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { camposSegunQuien, esHablaDe } from '../lib/archivero-registro';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const CAMPOS = { negocio_que_hace: 'Inmobiliaria y corretaje', oferta_nombre: 'Código Inmobiliario', oferta_ticket: 'USD 1.900', avatar_dolor: 'Portales caros' };

// rotura (un prospecto llena el «qué hace»): 1 fallo. rotura (un prospecto no llena nada): 1 fallo.
// rotura (un proveedor llena): 1 fallo. rotura (sin habla_de no llena): 1 fallo. rotura (sin normalizar): 1 fallo.
test('del negocio, todo; de un prospecto, la oferta y el cliente ideal sin la identidad; de un proveedor, nada', () => {
  assert.deepEqual(camposSegunQuien(CAMPOS, 'negocio'), CAMPOS);
  assert.deepEqual(camposSegunQuien(CAMPOS, 'prospecto'), { oferta_nombre: 'Código Inmobiliario', oferta_ticket: 'USD 1.900', avatar_dolor: 'Portales caros' });
  assert.deepEqual(camposSegunQuien(CAMPOS, 'proveedor'), {});
  assert.deepEqual(camposSegunQuien(CAMPOS, undefined), CAMPOS, 'un modelo que no lo dijo (o un prompt editado): como antes');
  assert.deepEqual(camposSegunQuien(CAMPOS, ' Prospecto '), camposSegunQuien(CAMPOS, 'prospecto'), 'con espacios o mayúscula, lo mismo');
  assert.deepEqual(camposSegunQuien(CAMPOS, ' Negocio '), CAMPOS, '«Negocio » es del negocio: llena todo');
  assert.deepEqual(camposSegunQuien(CAMPOS, 'PROVEEDOR'), {}, '«PROVEEDOR» es de un proveedor: no llena nada');
  assert.ok(!('negocio_que_hace' in camposSegunQuien(CAMPOS, 'cliente')), 'un valor raro no arriesga la identidad del negocio');
  assert.ok(esHablaDe('prospecto') && !esHablaDe('cliente'));
});

// rotura (el prompt no pide habla_de): 1 fallo. rotura (la extracción no filtra): 1 fallo.
test('la extracción pide `habla_de` y filtra con la regla del código (no con lo que el modelo deja en campos)', () => {
  const o = leer('lib/onboarding.ts');
  const tpl = o.slice(o.indexOf('export const ARCHIVERO_EXTRACT_TEMPLATE'), o.indexOf('\n', o.indexOf('export const ARCHIVERO_EXTRACT_TEMPLATE')));
  assert.match(tpl, /"habla_de": "negocio" \| "prospecto" \| "proveedor"/);
  assert.match(tpl, /"prospecto" si es material de venta del negocio cuyo TEMA es un prospecto/);
  assert.match(tpl, /NUNCA lo que hace el negocio ni su identidad/);
  assert.match(o, /const crudo = typeof parsed\.habla_de === 'string' \? parsed\.habla_de\.trim\(\)\.toLowerCase\(\) : '';\s*const hablaDe: HablaDe \| 'otro' \| null = !crudo \? null : esHablaDe\(crudo\) \? crudo : 'otro';\s*const campos = camposSegunQuien\(todos, hablaDe\);/);
  assert.match(o, /return \{ campos, razonamiento, sinIA: false, hablaDe \};/);
});

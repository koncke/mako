import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nombreVisible } from '../lib/lead-funnel-reglas';

/**
 * El CRM tiene nombre propio y el curso no lo hereda (13/10/2026).
 *
 * Martín: «desvincula lo que hace que se ponga automáticamente el nombre de ese CRM al nombre
 * de un curso, porque ahora ya no debería ser así, sino que los cursos deberían tener el
 * nombre de una OFERTA». Hasta hoy la pantalla mostraba el nombre del producto y renombrar el
 * CRM escribía el producto — el mismo campo con que se titula el curso.
 *
 * Verificado rompiéndolo (base 4/0): `nombreVisible` volviendo a preferir el producto, 1 fallo;
 * Customer Success volviendo a renombrar por `renombrarFunnel`, 1 fallo; la 0269 sin el
 * `exception when unique_violation`, 1 fallo.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('el nombre que se ve es el del CRM; el producto sólo tapa a «Funnel principal»', () => {
  assert.equal(nombreVisible({ nombre: 'Prospección', producto: 'Mentoría' }), 'Prospección', 'renombrar el CRM no se vería');
  assert.equal(nombreVisible({ nombre: 'Funnel principal', producto: 'VSL FUNNEL' }), 'VSL FUNNEL', 'el nombre de la migración no le dice nada a nadie');
  assert.equal(nombreVisible({ nombre: 'Funnel principal', producto: null }), 'Funnel principal');
  assert.equal(nombreVisible({ nombre: '  ', producto: 'Curso' }), 'Curso');
});

test('Customer Success renombra el PRODUCTO, no el CRM', () => {
  const cs = sinComentarios(leer('../app/customer-success/actions.ts'));
  const ini = cs.indexOf('export async function renombrarServicioAction');
  const fn = cs.slice(ini, cs.indexOf('\n}\n', ini));
  assert.ok(fn.length > 100, 'no encontré el renombre de Customer Success');
  assert.match(fn, /await renombrarProducto\(productoId, nombre\)/);
  assert.doesNotMatch(fn, /renombrarFunnel/, 'renombrar el producto volvió a renombrar el CRM');
});

test('renombrarProducto escribe sólo el producto', () => {
  const fn = sinComentarios(leer('../lib/funnels.ts'));
  const ini = fn.indexOf('export async function renombrarProducto');
  const cuerpo = fn.slice(ini, fn.indexOf('\n}\n', ini));
  assert.match(cuerpo, /\.from\('productos'\)\.update\(\{ nombre \}\)/);
  assert.doesNotMatch(cuerpo, /from\('funnels'\)/);
});

test('la 0269 copia el nombre que se veía y no choca con el índice único', () => {
  const sql = leer('../supabase/migrations/0269_funnel_nombre_propio.sql');
  assert.match(sql, /update funnels set nombre = r\.nuevo/);
  assert.match(sql, /exception when unique_violation then/, 'un nombre repetido en el negocio tiraría la migración entera');
});

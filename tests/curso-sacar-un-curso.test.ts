// =============================================================================
// La ficha del cliente deja SACARLE UN curso de su acceso (17/10/2026)
// =============================================================================
// docs/hallazgos-customer-success.md (feedback del 08/10): la ficha ya decía qué cursos le abre el acceso («No se le
// abrió este curso.»), pero no dejaba sacar uno: sólo «Quitar de este producto» (lo saca del kanban) o «Cortar
// acceso» (le cierra todo). La regla, pura, en `productosTrasQuitar` (lib/curso-invitar-reglas.ts).
//
// Verificado rompiéndolo (el archivo da 2 / 0): `productosTrasQuitar` sin expandir el `null` a sus productos → 1 / 1
// (el de la regla); el botón sin el `abiertos.length > 1` → 1 / 1 (el del cableado).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { productosTrasQuitar } from '../lib/curso-invitar-reglas';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

test('productosTrasQuitar: saca ése, un null pasa a ser «los suyos menos ése», y el último no se saca', () => {
  assert.deepEqual(productosTrasQuitar([3, 7, 9], [3, 7, 9], 7), { ok: true, productos: [3, 9] });
  // `null` abre TODOS sus productos (los del kanban): sacar uno deja la lista explícita de los demás.
  assert.deepEqual(productosTrasQuitar(null, [3, 7], 3), { ok: true, productos: [7] });
  const ultimo = productosTrasQuitar([7], [3, 7], 7);
  assert.equal(ultimo.ok, false);
  assert.match(!ultimo.ok ? ultimo.error : '', /Cortar acceso/);
  const ajeno = productosTrasQuitar([3, 9], [3, 7, 9], 7);
  assert.equal(ajeno.ok, false, 'un curso que no se le abrió no se «saca»');
});

test('el cableado: la acción pasa por la puerta y deja historial; el botón sólo con dos o más cursos abiertos', () => {
  const acc = leer('app/customer-success/curso-ficha-actions.ts');
  const f = acc.slice(acc.indexOf('export async function quitarCursoDelAccesoAction('), acc.indexOf('export async function desbloquearAction('));
  assert.match(f, /const p = await puerta\(leadId\);\s*if \(!p\.ok\) return p;/);
  assert.match(f, /await quitarCursoDelAcceso\(leadId, productoId\)/);
  assert.match(f, /await logLeadEvent\(leadId, 'Curso', /);
  const datos = leer('lib/curso-datos.ts');
  const q = datos.slice(datos.indexOf('export async function quitarCursoDelAcceso('));
  assert.match(q.slice(0, 1500), /productosTrasQuitar\(saneaProductos\(fila\.productos\), \(await productosDelCliente\(leadId\)\)\.productos, productoId\)/);
  const ficha = leer('app/customer-success/FichaCurso.tsx');
  assert.match(ficha, /\{abiertos\.length > 1 && \(\s*<Button[^>]*onClick=\{\(\) => setASacar\(/);
  assert.match(ficha, /onConfirm=\{\(\) => void sacar\(aSacar\.productoId\)\}/);
});

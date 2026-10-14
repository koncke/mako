// =============================================================================
// El curso se llama como su OFERTA, no como el CRM (13/10/2026)
// =============================================================================
// Martín: «desvincula lo que hace que se ponga automáticamente el nombre de ese CRM al nombre de un
// curso… los cursos deberían tener el nombre de una OFERTA». La regla (lib/curso-nombre.ts) se
// EJECUTA; el cableado se LEE del fuente: los cuatro lugares que nombran un curso piden el nombre a
// `nombresDeCursos` (lib/curso-nombre-datos.ts), y el portal ya no lo saca de `productos`.
//
// Probado rompiéndolo (13/10/2026), una rotura por vez, restaurando desde memoria. Base: 6 / 0.
//   · con dos principales distintas, la primera ......... 5 / 1
//   · una oferta inactiva nombra el curso ................. 5 / 1
//   · el portal vuelve a leer `productos.nombre` .......... 5 / 1
//   · la ficha sin `conTitulo` ............................ 5 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nombreBaseDelCurso, nombreDelCurso } from '../lib/curso-nombre';

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la oferta principal nombra el curso; sin una sola, el producto', () => {
  assert.equal(nombreBaseDelCurso('VSL FUNNEL', [{ nombre: 'Negocio que Escala', activa: true }]), 'Negocio que Escala');
  assert.equal(nombreBaseDelCurso('VSL FUNNEL', []), 'VSL FUNNEL', 'sin oferta: el producto, como antes');
  assert.equal(nombreBaseDelCurso('Prod', [{ nombre: 'A', activa: true }, { nombre: 'B', activa: true }]), 'Prod', 'dos distintas: no se adivina');
  assert.equal(nombreBaseDelCurso('Prod', [{ nombre: 'Fiesta Música' }, { nombre: ' fiesta  musica ' }]), 'Fiesta Música', 'el mismo nombre dos veces no es ambiguo');
  assert.equal(nombreBaseDelCurso('Prod', [{ nombre: 'Vieja', activa: false }]), 'Prod', 'una oferta que ya no se vende no nombra nada');
  assert.equal(nombreBaseDelCurso('Prod', [{ nombre: '   ' }]), 'Prod', 'una oferta sin nombre no tapa al producto');
  assert.equal(nombreBaseDelCurso('', []), 'Tu programa');
});

test('el título puesto a mano gana; uno en blanco no', () => {
  assert.equal(nombreDelCurso('Mi curso', 'Negocio que Escala'), 'Mi curso');
  assert.equal(nombreDelCurso('  ', 'Negocio que Escala'), 'Negocio que Escala');
  assert.equal(nombreDelCurso(null, 'Negocio que Escala'), 'Negocio que Escala');
});

test('el lector toma las ofertas PRINCIPALES y aplica el título sólo si se lo piden', () => {
  const src = sinComentarios(leer('../lib/curso-nombre-datos.ts'));
  assert.match(src, /from\('oferta_productos'\)\.select\('oferta_id, producto_id'\)\.in\('producto_id', ids\)\.eq\('rol', 'principal'\)/);
  assert.match(src, /from\('ofertas'\)\.select\('id, nombre, activa'\)/);
  assert.match(src, /if \(opts\.conTitulo && out\.size\) \{[\s\S]*?nombreDelCurso\(estilos\.get\(id\)\?\.titulo, base\)/);
});

test('el portal del alumno pide el nombre a nombresDeCursos y no a productos', () => {
  const src = sinComentarios(leer('../lib/curso-portal.ts'));
  const i = src.indexOf('export async function armarVistaAlumno(');
  const cuerpo = src.slice(i, src.indexOf('\nexport ', i + 10));
  assert.match(cuerpo, /const nombreDe = await nombresDeCursos\(productos\);/);
  assert.doesNotMatch(cuerpo, /from\('productos'\)/);
});

test('el editor y su vista previa usan el nombre del curso', () => {
  assert.match(sinComentarios(leer('../app/customer-success/curso/page.tsx')), /nombre: nombresCurso\.get\(s\.productoId\) \?\? s\.nombre,/);
  assert.match(sinComentarios(leer('../app/customer-success/curso/vista/page.tsx')), /nombre: nombreCurso\.get\(productoId\) \?\? \(prod as \{ nombre: string \}\)\.nombre,/);
});

test('la ficha nombra el curso como lo ve el alumno (con el título a mano)', () => {
  const src = sinComentarios(leer('../app/customer-success/curso-ficha-actions.ts'));
  assert.match(src, /nombresDeCursos\(ids, \{ conTitulo: true \}\)/);
  assert.match(src, /nombre: nombresCurso\.get\(id\) \?\? nombre\.get\(id\) \?\? 'Producto'/);
});

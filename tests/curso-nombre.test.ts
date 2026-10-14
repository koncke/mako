// =============================================================================
// El curso se llama como su OFERTA, y NUNCA como el producto (el CRM)
// =============================================================================
// Martín, 13/10/2026: «los cursos deberían tener el nombre de una OFERTA». Y el 14/10/2026: «Elimina el
// nombre del "producto" que hoy en día se llama "nuevo CRM", no debe aparecer nunca como nombre del
// curso». La regla (lib/curso-nombre.ts) se EJECUTA; el cableado se LEE del fuente: todo lugar que
// nombra un curso (o su comunidad) pide el nombre a `nombresDeCursos` (lib/curso-nombre-datos.ts) y,
// sin nombre, pone un genérico — nunca el del producto.
//
// Probado rompiéndolo (14/10/2026), una rotura por vez, restaurando desde memoria. Base: 8 / 0.
//   · la regla con el producto de último recurso ............... 7 / 1
//   · con dos principales distintas, la primera ................. 7 / 1
//   · el lector vuelve a leer `productos` ....................... 7 / 1
//   · el editor cae a `s.nombre` (el producto) .................. 7 / 1
//   · la vista previa cae a `prod.nombre` ....................... 7 / 1
//   · la ficha cae al catálogo de productos ..................... 7 / 1
//   · la API lista los cursos con `p.nombre` .................... 7 / 1
//   · la comunidad cae a `producto?.nombre` ..................... 7 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nombreBaseDelCurso, nombreDelCurso, SIN_NOMBRE_ALUMNO, SIN_NOMBRE_EQUIPO } from '../lib/curso-nombre';

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));

test('la oferta principal nombra el curso; sin una sola, NO hay nombre (y el producto ni se recibe)', () => {
  // ⚠️ La firma es el guard: con el producto como parámetro, el último recurso vuelve a ser el CRM.
  assert.equal(nombreBaseDelCurso.length, 1, 'nombreBaseDelCurso no recibe el nombre del producto');
  assert.equal(nombreBaseDelCurso([{ nombre: 'Negocio que Escala', activa: true }]), 'Negocio que Escala');
  assert.equal(nombreBaseDelCurso([]), null, 'sin oferta: sin nombre, nunca el producto');
  assert.equal(nombreBaseDelCurso([{ nombre: 'A', activa: true }, { nombre: 'B', activa: true }]), null, 'dos distintas: no se adivina');
  assert.equal(nombreBaseDelCurso([{ nombre: 'Fiesta Música' }, { nombre: ' fiesta  musica ' }]), 'Fiesta Música', 'el mismo nombre dos veces no es ambiguo');
  assert.equal(nombreBaseDelCurso([{ nombre: 'Vieja', activa: false }]), null, 'una oferta que ya no se vende no nombra nada');
  assert.equal(nombreBaseDelCurso([{ nombre: '   ' }]), null);
});

test('el título puesto a mano gana; uno en blanco no; y los genéricos no son nombres de producto', () => {
  assert.equal(nombreDelCurso('Mi curso', 'Negocio que Escala'), 'Mi curso');
  assert.equal(nombreDelCurso('  ', 'Negocio que Escala'), 'Negocio que Escala');
  assert.equal(nombreDelCurso('Mi curso', null), 'Mi curso', 'sin oferta pero con título: tiene nombre');
  assert.equal(nombreDelCurso(null, null), null);
  assert.equal(SIN_NOMBRE_ALUMNO, 'Tu programa');
  assert.equal(SIN_NOMBRE_EQUIPO, 'Curso sin nombre');
});

test('el lector toma las ofertas PRINCIPALES, no lee la tabla productos, y aplica el título sólo si se lo piden', () => {
  const src = fuente('../lib/curso-nombre-datos.ts');
  assert.match(src, /from\('oferta_productos'\)\.select\('oferta_id, producto_id'\)\.in\('producto_id', ids\)\.eq\('rol', 'principal'\)/);
  assert.match(src, /from\('ofertas'\)\.select\('id, nombre, activa'\)/);
  assert.doesNotMatch(src, /from\('productos'\)/, 'de la tabla productos no sale nada que nombre un curso');
  assert.match(src, /const nombre = opts\.conTitulo \? nombreDelCurso\(titulos\.get\(id\), base\) : base;\s*if \(nombre\) out\.set\(id, nombre\);/);
});

test('el portal del alumno y su vista previa: el nombre del curso o «Tu programa»', () => {
  const portal = fuente('../lib/curso-portal.ts');
  const i = portal.indexOf('export async function armarVistaAlumno(');
  const cuerpo = portal.slice(i, portal.indexOf('\nexport ', i + 10));
  assert.match(cuerpo, /const nombreDe = await nombresDeCursos\(productos\);/);
  assert.match(cuerpo, /nombre: nombreDe\.get\(productoId\) \?\? SIN_NOMBRE_ALUMNO,/);
  assert.doesNotMatch(cuerpo, /from\('productos'\)/);
  const vista = fuente('../app/customer-success/curso/vista/page.tsx');
  assert.match(vista, /nombre: nombreCurso\.get\(productoId\) \?\? SIN_NOMBRE_ALUMNO,/);
  assert.doesNotMatch(vista, /from\('productos'\)\.select\('[^']*nombre/, 'la vista previa no lee el nombre del producto');
});

test('el editor y la ficha: el nombre del curso o «Curso sin nombre», nunca el producto', () => {
  assert.match(fuente('../app/customer-success/curso/page.tsx'), /nombre: nombresCurso\.get\(s\.productoId\) \?\? SIN_NOMBRE_EQUIPO,/);
  const ficha = fuente('../app/customer-success/curso-ficha-actions.ts');
  assert.match(ficha, /nombresDeCursos\(ids, \{ conTitulo: true \}\)/);
  assert.match(ficha, /nombre: nombresCurso\.get\(id\) \?\? SIN_NOMBRE_EQUIPO, clases: cs/);
  assert.doesNotMatch(ficha, /listProductos/, 'la ficha no nombra cursos con el catálogo de productos');
});

test('la API de MaKo lista los cursos con su nombre (null = sin nombre), no con el del producto', () => {
  const src = fuente('../lib/api-mako/areas/curso.run.ts');
  const i = src.indexOf('listar_cursos: {');
  const cuerpo = src.slice(i, src.indexOf('\n  },\n', i));
  assert.match(cuerpo, /const nombres = await nombresDeCursos\(productos\.map\(\(p\) => p\.id\), \{ conTitulo: true \}\)/);
  assert.doesNotMatch(cuerpo, /nombre: p\.nombre/);
});

test('la comunidad se llama como su curso, nunca como el producto', () => {
  const src = fuente('../lib/comunidad-datos.ts');
  assert.doesNotMatch(src, /producto\?\.nombre/);
  assert.equal((src.match(/\?\? nombreCurso \?\? 'Comunidad'/g) ?? []).length, 2, 'las dos pantallas: inicio y About');
  assert.match(src, /runWithWorkspace\(ws, \(\) => nombresDeCursos\(\[productoId\], \{ conTitulo: true \}\)\)/);
  const page = fuente('../app/customer-success/comunidad/page.tsx');
  assert.match(page, /productos = lista\.map\(\(p\) => \(\{ id: p\.id, nombre: nombres\.get\(p\.id\) \?\? SIN_NOMBRE_EQUIPO \}\)\);/);
});

test('el mail de invitación también pasa por la función (lib/curso-invitar.ts, de la sesión CURSOS)', () => {
  const src = fuente('../lib/curso-invitar.ts');
  assert.match(src, /nombresDeCursos\(conClases, \{ conTitulo: true \}\)/);
  assert.doesNotMatch(src, /from\('productos'\)\.select\('[^']*nombre/);
});

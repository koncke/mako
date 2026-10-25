// =============================================================================
// MaKo dice «Clients», no «Customer Success» (f30 de la llamada con Leandro, 24/10/2026)
// =============================================================================
// Textual (Fathom 196023930 @48:04): «Los cursos están en Customer Success. Bueno, eso está mal porque tiene el nombre
// de la tab vieja (...) no tengo ninguna sección que diga Customer Success». Desde el 17/10/2026 Clientes, Curso y
// Comunidad son UNA tab, Clients (docs/diseno-clients.md), y MaKo seguía leyendo el nombre viejo en su API: el título
// del área `cs` y las descripciones de las operaciones, que son lo que MaKo lee para contestar.
//
// Lo que fija: ninguna operación de la API de MaKo (título, descripción, lo que escribe) ni el título de un área dice
// «Customer Success», y tampoco los textos que le llegan al equipo o a MaKo desde Clients. Las CLAVES internas
// (`cs`, `customer-success`, la capa) NO se renombran: las usan los tokens, los permisos y las rutas viejas.
//
// Verificado rompiéndolo: volver a poner «Customer Success › Curso» en la descripción de `listar_cursos`
// (curso.def.ts) → 1 fallo; el título del área `cs` de vuelta a «Customer Success» → 1 fallo; «Tu plan no incluye
// Customer Success.» en app/customer-success/comunidad/actor.ts → 1 fallo (3 tests, uno por rotura).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRO } from '../lib/api-mako/registro';
import { AREA_INFO } from '../lib/api-mako/tipos';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const VIEJO = /Customer Success/;

test('ninguna operación de la API de MaKo nombra la tab vieja (es lo que MaKo lee para contestar)', () => {
  assert.ok(REGISTRO.length > 100, `el registro trae ${REGISTRO.length} operaciones: ¿se cargó?`);
  const malas = REGISTRO.filter((d) => VIEJO.test(`${d.titulo} ${d.descripcion} ${'escribe' in d ? String(d.escribe ?? '') : ''}`)).map((d) => d.id);
  assert.deepEqual(malas, []);
});

test('los títulos de las áreas: `cs` es Clients (la clave no cambia)', () => {
  assert.equal(AREA_INFO.cs.tab, 'Clients');
  assert.doesNotMatch(AREA_INFO.cs.titulo, VIEJO);
  for (const [area, info] of Object.entries(AREA_INFO)) assert.doesNotMatch(info.titulo, VIEJO, `el título del área ${area}`);
});

test('lo que Clients le dice al equipo o a MaKo cuando una cuenta no tiene la tab, o sobre la entrega', () => {
  for (const p of [
    'app/customer-success/comunidad/actor.ts', 'app/customer-success/curso/puerta-curso.ts', 'app/customer-success/puerta.ts',
    'lib/curso-invitar.ts', 'lib/curso-resumen.ts', 'lib/servicio-etapas.ts',
  ]) {
    const textos = [...sinComentarios(leer(p)).matchAll(/'([^'\n]*)'|`([^`]*)`/g)].map((m) => m[1] ?? m[2]).join('\n');
    assert.doesNotMatch(textos, VIEJO, `${p} todavía dice «Customer Success» en un texto`);
  }
});

// =============================================================================
// El alumno NUEVO por la API de MaKo (23/10/2026, P0-3 de la auditoría de la API)
// =============================================================================
// Pedido de Martín (23/10/2026, desde el Ops Center): «Revisá esto... Y si hay que hacer una revisión completa de la
// API, porque creo que faltan muchas acciones posibles». La migración de un curso de Panda trae alumnos que no están
// en el CRM; la auditoría puso en P0 darlos de alta por la API. Lo que este test fija:
//   · crear_alumno_curso usa EL MISMO alta que el editor del curso (darDeAltaAlumno, lib/curso-alta-alumno.ts);
//   · usarLeadId sólo vale para alguien que YA es cliente, al proponer y al confirmar (pasar a Ganado es del CRM);
//   · un duplicado vuelve con el id y el motivo, nunca con el nombre de un lead (un token de «Curso» no lee el CRM);
//   · el tope de leads del plan frena el alta, al proponer y al confirmar;
//   · su ruta REST.
//
// Probado rompiéndolo (23/10/2026, este archivo, base 5 / 0), cada rotura → 1 fallo y 4 pases:
//   · preparar acepta un usarLeadId que no es ganado;
//   · el duplicado devuelve el nombre del lead;
//   · ejecutar sin volver a mirar el tope;
//   · crear_alumno_curso con su propia alta (createLead) en vez de darDeAltaAlumno;
//   · borrar la ruta REST.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFS } from '../lib/api-mako/areas/curso.def';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('lib/api-mako/areas/curso.run.ts'));
const RUNNER = (() => {
  const ini = RUN.indexOf('  crear_alumno_curso: {');
  assert.ok(ini >= 0, 'no encontré el runner');
  const fin = RUN.indexOf('\n};', ini);
  const r = RUN.slice(ini, fin);
  assert.ok(r.length > 500 && r.length < 9000, `el recorte mide ${r.length}: está mirando otra cosa`);
  return r;
})();
const PREPARAR = RUNNER.slice(0, RUNNER.indexOf('ejecutar:'));
const EJECUTAR = RUNNER.slice(RUNNER.indexOf('ejecutar:'));

test('está declarada: por HTTP, sólo el admin, le manda algo al alumno y no se deshace', () => {
  const d = DEFS.find((x) => x.id === 'crear_alumno_curso');
  assert.ok(d && esAccion(d), 'falta crear_alumno_curso');
  assert.deepEqual([...d.canales], ['http']);
  assert.equal(d.gating?.rolMinimo, 'admin');
  assert.equal(d.aTerceros, true);
  assert.equal(d.reversible, false);
});

test('usa el MISMO alta que el editor del curso, y no escribe un lead por su cuenta', () => {
  assert.match(EJECUTAR, /await darDeAltaAlumno\(\{/);
  assert.doesNotMatch(RUNNER, /createLead\(|crearClienteGanado\(|from\('leads'\)\.(?:insert|update)/, 'una segunda alta se queda vieja');
});

test('usarLeadId sólo vale para un cliente ganado, al proponer Y al confirmar', () => {
  assert.match(PREPARAR, /if \(!lead\.ganado\) return \{ error:/);
  assert.match(EJECUTAR, /if \(!lead\?\.ganado\) return \{ ok: false/);
});

test('un duplicado vuelve con el id y el motivo, sin el nombre del lead; y el tope del plan frena', () => {
  assert.match(EJECUTAR, /\{ leadId: d\.leadId, motivo: d\.motivo \}/);
  assert.doesNotMatch(EJECUTAR, /d\.nombre|d\.texto/, 'el nombre de un lead del CRM saldría a un token de «Curso»');
  assert.match(PREPARAR, /await frenarAltaPorTope\(ctx\.ws, 'crm\.leads'\)/);
  assert.match(EJECUTAR, /await frenarAltaPorTope\(ctx\.ws, 'crm\.leads'\)/, 'entre la propuesta y el «sí» pudieron entrar otros');
});

test('su ruta REST: un POST de alumnos del curso', () => {
  assert.ok(RUTAS_REST.some(([m, r, op]) => m === 'POST' && r === '/curso/cursos/{productoId}/alumnos' && op === 'crear_alumno_curso'));
});

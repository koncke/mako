// =============================================================================
// Admin › Products › Templates: moderar lo que la comunidad publica (18/11/2026)
// =============================================================================
// Martín (13/10/2026): «Yo claro que puedo hacer ciertos templates en un inicio, pero luego la comunidad se va a encargar». Lo
// publicado lo modera la plataforma: esta pantalla lista lo de TODOS los negocios y retira (app/admin/_polar/datos/plantillas.ts,
// la acción en app/admin/plantillas/actions.ts, la lectura en lib/creaciones.ts → `creacionesParaModerar`).
//   · los filtros y el orden de la lista se EJECUTAN (`filtrarPlantillas`);
//   · la puerta: la página pide el super admin ANTES de leer, y la acción pregunta `getSesionAdmin` en su primera línea y retira
//     con el workspace de la PLATAFORMA (con la cookie, el super admin mirando a un cliente no podría retirar lo de otro);
//   · la lectura no trae las privadas (no las ve nadie más que su negocio).
//
// Probado rompiéndolo (base: 5 verdes, 0 rojos; 18/11/2026):
//   · `filtrarPlantillas` sin el filtro de «publicadas»                     → 3/2;
//   · el orden sin el desempate por id                                       → 3/2;
//   · la acción con `getWorkspaceActual()` en vez de `wsSuperAdmin()`        → 4/1;
//   · `creacionesParaModerar` sin el filtro de estado                        → 4/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { cuantoGusto, filtrarPlantillas, leerMostrarPlantillas, leerOrdenPlantillas, type PlantillaModerada } from '../app/admin/_polar/datos/plantillas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const p = (o: Partial<PlantillaModerada> & Pick<PlantillaModerada, 'id'>): PlantillaModerada => ({
  tipo: 'automatizacion', tipoTexto: 'automatización', titulo: `Plantilla ${o.id}`, descripcion: '', autor: 'Un negocio de MaKo',
  deMako: false, estado: 'publicada', estrellas: 0, usos: 0, publicada: '2026-11-01T10:00:00Z', negocio: { id: 7, nombre: 'Estudio Norte' }, ...o,
});

const LISTA: PlantillaModerada[] = [
  p({ id: 1, titulo: 'Bienvenida a leads', estrellas: 3, usos: 9, publicada: '2026-11-03T10:00:00Z' }),
  p({ id: 2, titulo: 'Cobranza amable', estrellas: 3, usos: 2, estado: 'retirada', publicada: '2026-11-05T10:00:00Z' }),
  p({ id: 3, titulo: 'Ánimo de lunes', estrellas: 8, usos: 0, tipo: 'dashboard', tipoTexto: 'dashboard', negocio: { id: 9, nombre: 'Clínica Sur' } }),
  p({ id: 4, titulo: 'Reactivar dormidos', estrellas: 3, usos: 9, publicada: '2026-11-02T10:00:00Z' }),
];

test('lo que se muestra: por defecto lo que está en la galería; las retiradas, aparte; y todas juntas', () => {
  assert.deepEqual(filtrarPlantillas(LISTA, {}).map((x) => x.id), [3, 4, 1], 'por defecto, sin las retiradas');
  assert.deepEqual(filtrarPlantillas(LISTA, { show: 'retiradas' }).map((x) => x.id), [2]);
  assert.equal(filtrarPlantillas(LISTA, { show: 'todas' }).length, 4);
  assert.equal(leerMostrarPlantillas('cualquiera'), 'publicadas');
  assert.equal(leerMostrarPlantillas('retiradas'), 'retiradas');
});

test('el buscador mira el título, el negocio y el tipo, sin tildes ni mayúsculas', () => {
  assert.deepEqual(filtrarPlantillas(LISTA, { query: 'animo' }).map((x) => x.id), [3], 'sin la tilde de «Ánimo»');
  assert.deepEqual(filtrarPlantillas(LISTA, { query: 'clinica' }).map((x) => x.id), [3], 'por el negocio');
  assert.deepEqual(filtrarPlantillas(LISTA, { query: 'DASHBOARD' }).map((x) => x.id), [3], 'por el tipo');
});

test('el orden: estrellas, después usos, y el id desempata (el orden no se mueve entre lecturas)', () => {
  assert.deepEqual(filtrarPlantillas(LISTA, { sorting: '-estrellas' }).map((x) => x.id), [3, 4, 1], '1 y 4 empatan en todo: va primero el id mayor');
  assert.deepEqual(filtrarPlantillas(LISTA, { sorting: '-usos' }).map((x) => x.id), [4, 1, 3]);
  assert.deepEqual(filtrarPlantillas(LISTA, { sorting: '-publicada' }).map((x) => x.id), [1, 4, 3]);
  assert.deepEqual(filtrarPlantillas(LISTA, { sorting: 'titulo' }).map((x) => x.id), [3, 1, 4]);
  assert.equal(leerOrdenPlantillas('?'), '-estrellas');
  assert.equal(cuantoGusto({ estrellas: 2, usos: 1 }), '★ 2 · 1 uso');
});

test('la puerta: la página pide el super admin antes de leer, y la acción retira con el workspace de la plataforma', () => {
  const pagina = sinComentarios(leer('app/admin/(polar)/products/templates/page.tsx'));
  const i = pagina.indexOf('await exigirSuperAdmin()'), j = pagina.indexOf('leerPlantillasParaModerar()');
  assert.ok(i > 0 && j > 0 && i < j, 'la puerta antes de leer');
  const accion = sinComentarios(leer('app/admin/plantillas/actions.ts'));
  const cuerpo = accion.slice(accion.indexOf('export async function retirarPlantillaAction'));
  assert.match(cuerpo, /^export async function retirarPlantillaAction\(id: number\).* \{\n\s*const admin = await getSesionAdmin\(\);\n\s*if \(!admin\) return/, 'getSesionAdmin en la primera línea');
  assert.match(cuerpo, /retirarCreacion\(await wsSuperAdmin\(\), id\)/, 'retira con el workspace de la plataforma');
  assert.doesNotMatch(cuerpo, /getWorkspaceActual/, 'la cookie puede estar mirando a un cliente');
});

test('la lectura de la moderación no trae las privadas y lee de a páginas', () => {
  const src = sinComentarios(leer('lib/creaciones.ts'));
  const ini = src.indexOf('export async function creacionesParaModerar');
  assert.ok(ini > 0);
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.match(cuerpo, /q\.in\('estado', \['publicada', 'retirada'\]\)/, 'sólo lo publicado y lo retirado');
  assert.match(cuerpo, /leerPorPaginas/, 'el techo de 1000 filas no da error');
  assert.equal((src.match(/creacionesParaModerar\(/g) ?? []).length, 1, 'la declaración, una vez');
  const quienLlama = sinComentarios(leer('app/admin/_polar/datos/plantillas-server.ts'));
  assert.match(quienLlama, /import 'server-only'/);
});

// =============================================================================
// Los experimentos que YA EXISTEN se ven: «Editar con MaKo» los conoce y los pone en la hoja (17/10/2026)
// =============================================================================
// docs/relevo/dashboard.md → «Lo que falta»: «Los experimentos de antes, y los que crea la API, no se ven en ninguna
// pantalla: falta que "Editar con MaKo" los conozca para agregarlos a una hoja (`experimento: { id: N }` ya se guarda)».
// Experiments se mudó al Dashboard el 17/10 y su pantalla se borró: un experimento sin elemento quedaba sólo en la base.
// Ahora `editarHojaIA` le pasa al modelo los del negocio (id, título, estado) y `aplicarEdicion` pone el que pida, con su
// id, validado contra ESA lista y una sola vez por hoja. El elemento lo lee por su id (app/dashboard/ElementoExperimento.tsx).
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `aplicarEdicion` sin la rama del id (lo trata como propuesta nueva) ............ 2 fallos
//   2. sin validar el id contra la lista (`find` → el primero) ........................... 1 fallo
//   3. sin mirar si ya está en la hoja ................................................... 1 fallo
//   4. `userDeEdicion` sin la lista ...................................................... 1 fallo
//   5. `editarHojaIA` sin `experimentosConocidos` ......................................... 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aplicarEdicion, userDeEdicion } from '../lib/graficos-ia-edicion';
import { ALCANCE_GENERAL, type AlcanceIA } from '../lib/graficos-ia';
import { sanearHoja, esElemento, type Hoja } from '../lib/graficos-catalogo';

const hoja = (componentes: unknown[] = []): Hoja => sanearHoja({ id: 'h1', nombre: 'Marketing', componentes }, 0)!;
const DEL_NEGOCIO: AlcanceIA = {
  experimentos: [
    { id: 7, titulo: 'Anuncio con testimonio', estado: 'activo' },
    { id: 12, titulo: 'Landing sin formulario largo', estado: 'cerrado' },
  ],
};

test('MaKo conoce los experimentos del negocio (id, título y estado), y en General no', () => {
  const u = userDeEdicion({ hoja: hoja(), pedido: 'mostrame mis experimentos', alcance: DEL_NEGOCIO });
  assert.match(u, /EXPERIMENTOS QUE YA TIENE EL NEGOCIO/);
  assert.match(u, /7 — Anuncio con testimonio — en curso/);
  assert.match(u, /12 — Landing sin formulario largo — terminado/);
  assert.match(u, /\{"experimento":\{"id":<id>\}\}/);
  assert.doesNotMatch(userDeEdicion({ hoja: hoja(), pedido: 'x', alcance: { ...ALCANCE_GENERAL, ...DEL_NEGOCIO } }), /YA TIENE EL NEGOCIO/);
  assert.doesNotMatch(userDeEdicion({ hoja: hoja(), pedido: 'x' }), /YA TIENE EL NEGOCIO/, 'sin experimentos, no hay lista');
});

test('«traeme el del testimonio»: entra el elemento con SU id (no una propuesta nueva)', () => {
  const r = aplicarEdicion(hoja(), { respuesta: 'Listo.', agregar: [{ experimento: { id: 7 } }] }, DEL_NEGOCIO);
  assert.deepEqual(r.errores, []);
  const e = r.hoja.componentes.find(esElemento);
  assert.ok(e && e.tipo === 'experimento');
  assert.deepEqual(e.experimento, { id: 7, propuesta: null });
  assert.equal(e.texto, 'Anuncio con testimonio');
  assert.match(r.cambios[0], /Puse el experimento «Anuncio con testimonio»/);
});

test('un id que no es del negocio no entra, y el mismo experimento no se pone dos veces', () => {
  const inventado = aplicarEdicion(hoja(), { respuesta: 'ok', agregar: [{ experimento: { id: 99 } }] }, DEL_NEGOCIO);
  assert.equal(inventado.hoja.componentes.length, 0, 'un id inventado no entra');
  const ya = hoja([{ id: 'x1', clase: 'elemento', tipo: 'experimento', texto: 'Anuncio con testimonio', experimento: { id: 7 }, x: 0, y: 0, w: 6, h: 9 }]);
  const dos = aplicarEdicion(ya, { respuesta: 'ok', agregar: [{ experimento: { id: 7 } }, { experimento: { id: 12 } }] }, DEL_NEGOCIO);
  assert.deepEqual(dos.hoja.componentes.filter(esElemento).map((c) => c.experimento?.id), [7, 12], 'el 7 no se repite; el 12 entra');
  assert.ok(dos.avisos.some((a) => /ya está en la hoja/.test(a)));
});

test('«Editar con MaKo» le pasa la lista a la IA (la ruta y la API de MaKo van por acá)', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'graficos-ia-editar.ts'), 'utf8');
  assert.match(src, /experimentos: await experimentosConocidos\(\)/);
  assert.match(src, /await listExperimentos\(\)/);
});

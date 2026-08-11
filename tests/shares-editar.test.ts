// =============================================================================
// Un share que escribe apunta a UNA cosa, y a ninguna otra
// =============================================================================
// `puedeEditar` es el único punto de autorización de escritura por token. Lo
// llama el endpoint, no la página: si solo lo llamara la página, cualquiera
// mandaría un POST con otro id y escribiría sobre datos ajenos. Es el mismo IDOR
// que `puedeVer` cerró del lado de la lectura.
//
// El guard está escrito en POSITIVO (las cuatro condiciones que tienen que darse
// TODAS). Estos tests son la segunda capa: fijan que una fila vieja, un alcance
// amplio o un id distinto NO escriben, que es lo que un refactor rompe sin
// darse cuenta.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeEditar, permisoDe, type Share } from '../lib/shares';

const share = (extra: Partial<Share> = {}): Share => ({
  id: 1, workspace_id: 1, recurso: 'tarea-cs', alcance: 'item', recurso_id: '42',
  modo: 'link', permiso: 'editar', etiqueta: null, expira_at: null, revocado_at: null,
  ...extra,
});

test('el caso feliz: permiso editar, mismo recurso, alcance item, mismo id', () => {
  assert.equal(puedeEditar(share(), 'tarea-cs', '42'), true);
});

test('una fila VIEJA (sin la columna permiso) no escribe', () => {
  // Las que ya existían en producción antes de la migración 0126. El default de
  // la base es 'ver', pero el código no se apoya en eso: si el select no trae la
  // columna, `permiso` llega undefined y tiene que dar 'ver' igual.
  assert.equal(permisoDe(share({ permiso: undefined })), 'ver');
  assert.equal(puedeEditar(share({ permiso: undefined }), 'tarea-cs', '42'), false);
  assert.equal(puedeEditar(share({ permiso: null }), 'tarea-cs', '42'), false);
});

test('un valor desconocido en permiso no escribe', () => {
  const raro = share({ permiso: 'admin' as unknown as 'editar' });
  assert.equal(permisoDe(raro), 'ver');
  assert.equal(puedeEditar(raro, 'tarea-cs', '42'), false);
});

test('un share de OTRO recurso no escribe este', () => {
  assert.equal(puedeEditar(share({ recurso: 'branding' }), 'tarea-cs', '42'), false);
});

test('un id distinto no escribe: es el IDOR que el guard existe para cerrar', () => {
  assert.equal(puedeEditar(share(), 'tarea-cs', '43'), false);
  assert.equal(puedeEditar(share(), 'tarea-cs', ''), false);
});

test('los alcances amplios NO escriben, aunque el permiso diga editar', () => {
  // Un link con alcance 'todo' y permiso de escritura sería una llave maestra
  // del workspace entero repartida por mail.
  for (const alcance of ['todo', 'seccion', 'grupo'] as const) {
    assert.equal(puedeEditar(share({ alcance }), 'tarea-cs', '42'), false, alcance);
  }
});

test('alcance item sin recurso_id no escribe nada', () => {
  assert.equal(puedeEditar(share({ recurso_id: null }), 'tarea-cs', '42'), false);
});

test('la comparación de id es exacta, no por prefijo', () => {
  // '4' no puede escribir el lead '42', ni '42' el '420'.
  assert.equal(puedeEditar(share({ recurso_id: '4' }), 'tarea-cs', '42'), false);
  assert.equal(puedeEditar(share({ recurso_id: '42' }), 'tarea-cs', '420'), false);
});

// =============================================================================
// Qué Web Push quiere cada PERSONA (lib/notif-catalogo.ts, «Web Push»)
// =============================================================================
// La preferencia es de la persona (`usuarios.perfil.notifPush`) y su default depende del
// ROL (decisión de MaKo Mobile): admin prendido, closer y setter apagado — lo prenden ellos.
// El rol efectivo de una fila sigue la MISMA regla que `getRolWsEfectivo` (lib/workspace.ts).
//
// Probado rompiéndolo (base: 6 pasan / 0 fallan, 11/10/2026), restaurando de memoria:
//   · default `activo: true` para todos los roles                     → 5 / 1
//   · `quierePush` sin mirar el maestro `activo`                       → 5 / 1
//   · `rolPushDeFila` con `rol_ws` null → 'setter' en vez de admin      → 5 / 1
//   · `normalizarPush` descartando las claves que no están en PUSH_TIPOS → 5 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarPush, quierePush, rolPushDeFila, PUSH_TIPOS, PUSH_DE_MAKO, PUSH_SOLO_ADMINS, AVISOS_WA_EN_VIVO,
} from '../lib/notif-catalogo';

test('sin nada guardado, el default es por rol: admin prendido, closer y setter apagado', () => {
  assert.equal(normalizarPush(undefined, 'admin').activo, true);
  assert.equal(normalizarPush(null, 'closer').activo, false);
  assert.equal(normalizarPush({}, 'setter').activo, false);
  // Lo que la persona eligió gana sobre el default, en los dos sentidos.
  assert.equal(normalizarPush({ activo: false }, 'admin').activo, false);
  assert.equal(normalizarPush({ activo: true }, 'closer').activo, true);
});

test('el maestro manda; abajo cada tipo se apaga de a uno', () => {
  const p = normalizarPush({ activo: true, items: { 'reunion-cancelada': false } }, 'admin');
  assert.equal(quierePush(p, 'reunion-nuevo-agendado'), true);
  assert.equal(quierePush(p, 'reunion-cancelada'), false);
  // Un aviso que no está en la lista sigue al maestro (la regla de AVISOS_WA_EN_VIVO).
  assert.equal(quierePush(p, 'curso-sesion-previa'), true);
  assert.equal(quierePush(normalizarPush({ activo: false }, 'admin'), 'reunion-nuevo-agendado'), false);
});

test('se conservan los apagados aunque el tipo ya no se ofrezca, y se tira lo que no es booleano', () => {
  const p = normalizarPush({ activo: true, items: { 'un-aviso-viejo': false, 'mako-pendiente': 'no', basura: 1 } }, 'admin');
  assert.deepEqual(p.items, { 'un-aviso-viejo': false });
});

test('el rol efectivo de una fila: la misma regla que getRolWsEfectivo', () => {
  assert.equal(rolPushDeFila({ rol: 'admin', rol_ws: 'closer' }), 'admin');
  assert.equal(rolPushDeFila({ rol: 'usuario', rol_ws: 'closer' }), 'closer');
  assert.equal(rolPushDeFila({ rol: 'usuario', rol_ws: 'setter' }), 'setter');
  assert.equal(rolPushDeFila({ rol: 'usuario', rol_ws: null }), 'admin');
  assert.equal(rolPushDeFila({ rol: 'usuario', rol_ws: 'admin' }), 'admin');
});

test('lo que se ofrece: las dos de MaKo y los avisos en vivo, sin repetidos', () => {
  assert.deepEqual(PUSH_TIPOS.map((t) => t.id), [...PUSH_DE_MAKO, ...AVISOS_WA_EN_VIVO].map((t) => t.id));
  assert.ok(PUSH_TIPOS.some((t) => t.id === 'mako-pendiente') && PUSH_TIPOS.some((t) => t.id === 'mako-propuesta'));
  const ids = PUSH_TIPOS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'hay un tipo repetido');
});

test('«MaKo te pide confirmar» es sólo para admin', () => {
  assert.ok(PUSH_SOLO_ADMINS.has('mako-pendiente'));
  // Desde la revisión del 11/10/2026 también es de admin: lo que MaKo deja para revisar lo
  // confirma un admin, y un contacto propuesto trae datos de una persona.
  assert.ok(PUSH_SOLO_ADMINS.has('mako-propuesta'));
});

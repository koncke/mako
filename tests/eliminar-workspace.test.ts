// =============================================================================
// Borrar un cliente: qué lo frena, y qué NO lo frena
// =============================================================================
// Es la operación más destructiva de la app —89 tablas, los archivos y las personas—
// y no tiene vuelta atrás ni auditoría. Lo único que la hace segura es esta función,
// así que es lo único que hay que poder romper a propósito.
//
// ⚠️ PROBADO ROMPIÉNDOLO, tres veces (29/09/2026):
//
//   1. Sacando el corte por `capa === 'superadmin'` (dejando sólo el id): falla 1 de 15
//      — «la plataforma no se borra ni con el id equivocado». Es el que importa: con
//      `wsPlataforma` en null (la lectura falló, y `eliminarWorkspace` la envuelve en un
//      `.catch(() => null)`) el borrado de MaKo quedaría a un nombre bien tipeado.
//
//   2. Comparando los nombres sin normalizar (`ctx.nombreEscrito !== w.nombre`):
//      fallan 3 de 15 — el de los espacios, el del NFD y el de las mayúsculas. El del
//      NFD es el que no se ve: los dos textos se dibujan IDÉNTICOS y el botón sigue
//      apagado sin poder explicar por qué.
//
//   3. Moviendo el corte del nombre ARRIBA de todo: falla 1 de 15 — «el motivo que no
//      se arregla tipeando se dice primero». Sigue siendo seguro, pero a alguien que
//      intenta borrar la plataforma le contestaría «el nombre no coincide», que es una
//      pista falsa: aunque lo escriba bien, no va a poder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { motivoNoEliminable, type ContextoBorrado } from '../lib/borrado-workspace';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');

const cliente = { id: 13, nombre: 'Codigo Inmobiliario', capa: 'agencia' };
const ctx = (over: Partial<ContextoBorrado> = {}): ContextoBorrado => ({
  wsDelQueLlama: 9,
  clientesEnCartera: [],
  nombreEscrito: 'Codigo Inmobiliario',
  wsPlataforma: 9,
  ...over,
});

// ── Lo que frena ──────────────────────────────────────────────────────────

test('EL QUE IMPORTA: la plataforma no se borra ni con el id equivocado', () => {
  // `wsPlataforma` sale de `wsSuperAdmin()`, que el llamador envuelve en un catch: si
  // esa lectura falla llega `null`. La CAPA de la fila es el segundo cinturón.
  const m = motivoNoEliminable(
    { id: 9, nombre: 'Martin Koncke', capa: 'superadmin' },
    ctx({ wsPlataforma: null, nombreEscrito: 'Martin Koncke', wsDelQueLlama: null }),
  );
  assert.match(m ?? '', /plataforma/i);
});

test('la plataforma tampoco por id, aunque la capa venga mal', () => {
  const m = motivoNoEliminable({ id: 9, nombre: 'X', capa: 'completo' }, ctx({ nombreEscrito: 'X', wsDelQueLlama: null }));
  assert.match(m ?? '', /plataforma/i);
});

test('el workspace 1 no se borra: es el `default 1` de 29 tablas', () => {
  const m = motivoNoEliminable({ id: 1, nombre: 'Mauricio Bustos', capa: 'completo' }, ctx({ nombreEscrito: 'Mauricio Bustos' }));
  assert.match(m ?? '', /default/i);
});

test('nadie se borra el workspace desde el que entró', () => {
  const m = motivoNoEliminable({ id: 13, nombre: 'Codigo Inmobiliario', capa: 'agencia' }, ctx({ wsDelQueLlama: 13 }));
  assert.match(m ?? '', /desde el que est/i);
});

test('una agencia CON cartera se frena, y dice cuántos', () => {
  const m = motivoNoEliminable(cliente, ctx({ clientesEnCartera: [15, 16] }));
  assert.match(m ?? '', /2 clientes/);
  assert.match(m ?? '', /Rev.calos primero/i);
});

test('con UN cliente en cartera lo dice en singular', () => {
  const m = motivoNoEliminable(cliente, ctx({ clientesEnCartera: [15] }));
  assert.match(m ?? '', /1 cliente\b/);
});

test('sin nombre escrito, pide escribirlo', () => {
  assert.match(motivoNoEliminable(cliente, ctx({ nombreEscrito: '' })) ?? '', /Escribe el nombre/i);
  assert.match(motivoNoEliminable(cliente, ctx({ nombreEscrito: '   ' })) ?? '', /Escribe el nombre/i);
});

test('un nombre que no coincide frena, y dice cuál es el bueno', () => {
  const m = motivoNoEliminable(cliente, ctx({ nombreEscrito: 'Codigo' }));
  assert.match(m ?? '', /no coincide/i);
  assert.match(m ?? '', /Codigo Inmobiliario/);
});

test('el motivo que NO se arregla tipeando se dice PRIMERO', () => {
  // Con la plataforma y un nombre mal escrito, gana «es la plataforma». Al revés, la
  // pantalla mandaría a corregir el nombre para nada.
  const m = motivoNoEliminable({ id: 9, nombre: 'Martin Koncke', capa: 'superadmin' }, ctx({ nombreEscrito: 'otra cosa' }));
  assert.match(m ?? '', /plataforma/i);
});

// ── Lo que NO frena ───────────────────────────────────────────────────────

test('un cliente común con el nombre exacto se puede borrar', () => {
  assert.equal(motivoNoEliminable(cliente, ctx()), null);
});

test('los espacios de más no cuentan: se tipea a mano', () => {
  assert.equal(motivoNoEliminable(cliente, ctx({ nombreEscrito: '  Codigo   Inmobiliario ' })), null);
});

test('las mayúsculas tampoco', () => {
  assert.equal(motivoNoEliminable(cliente, ctx({ nombreEscrito: 'codigo inmobiliario' })), null);
});

test('un acento en NFD es el MISMO nombre, aunque no sean los mismos bytes', () => {
  // macOS entrega NFD: la «o» y la tilde como dos puntos de código. Los dos textos se
  // dibujan idénticos, así que sin normalizar el botón queda apagado sin explicación.
  const conAcento = { id: 13, nombre: 'Código Inmobiliario'.normalize('NFC'), capa: 'agencia' };
  const tipeado = 'Código Inmobiliario'.normalize('NFD');
  assert.notEqual(tipeado, conAcento.nombre, 'el caso no prueba nada si los dos ya son iguales');
  assert.equal(motivoNoEliminable(conAcento, ctx({ nombreEscrito: tipeado })), null);
});

// ── La lista de tablas ────────────────────────────────────────────────────

test('la lista de tablas de inquilino no tiene repetidos, y NO trae `usuarios`', () => {
  assert.equal(new Set(TABLAS_DE_INQUILINO).size, TABLAS_DE_INQUILINO.length, 'hay una tabla repetida');
  // Las personas no son datos del inquilino: el reset las conserva y el borrado las
  // saca aparte, con el guard del último admin. Meterlas acá haría que un RESET del
  // cliente de prueba deje ese workspace sin nadie que pueda entrar.
  assert.ok(!(TABLAS_DE_INQUILINO as readonly string[]).includes('usuarios'));
  assert.ok(!(TABLAS_DE_INQUILINO as readonly string[]).includes('workspaces'));
  // Y las que más duelen si se caen de la lista: son las que dejan filas huérfanas de
  // un cliente que ya no existe.
  for (const t of ['leads', 'plan_tareas', 'app_settings', 'credenciales', 'funnels']) {
    assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes(t), `falta ${t}`);
  }
});

test('el borrado desliga `leads.cliente_ws`, que vive en OTRO inquilino', () => {
  // Vaciar las tablas DE ESTE workspace no toca esa fila —es del CRM del super admin—
  // y sin desligarla el DELETE final rebota con un error que nombra la constraint y no
  // la tabla. Es el único puntero cruzado que existe hoy.
  const m = leer('../lib/eliminar-workspace.ts');
  assert.ok(/cliente_ws: null/.test(m), 'no se desligan los leads que apuntaban a este cliente');
  const iDesligar = m.indexOf('cliente_ws: null');
  const iBorrar = m.indexOf("from('workspaces').delete()");
  assert.ok(iDesligar > 0 && iBorrar > 0 && iDesligar < iBorrar, 'se desliga DESPUÉS de borrar la fila');
});

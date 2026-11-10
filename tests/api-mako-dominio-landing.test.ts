// =============================================================================
// El dominio propio de una landing, leído por la API: lo que se le contesta a cada canal
// =============================================================================
// Ticket #61 (Leandro Tejado, Fiesta Music, 7/11/2026): su Claude leyó por HTTP
// `ver_dominio_landing` y la nota le dijo «Se conecta con conectar_dominio_landing». Esa
// operación es SIN_HTTP a propósito (suma el dominio al proyecto de Vercel de MaKo, que es de
// todos los negocios), así que por /api/v1 le dio 404 y el OpenAPI no la traía. Lo que estaba
// mal no era la puerta cerrada: era el texto que la nombraba como si estuviera abierta.
//
// La regla que cuida: lo que esta lectura le contesta a un canal nombra sólo operaciones que
// ESE canal tiene. Se mide contra el registro, no contra una lista escrita acá: si mañana
// conectar sale por HTTP, el test lo acepta sin tocarlo.
// Correr: node --import tsx --test tests/api-mako-dominio-landing.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRO, porId } from '../lib/api-mako/registro';
import type { Canal } from '../lib/api-mako/tipos';
import { dominioParaApi, type FilaDominio } from '../lib/api-mako/areas/landing-contenido.helpers';

const RAIZ = join(import.meta.dirname, '..');
const AHORA = Date.parse('2026-11-10T12:00:00Z');
const SIN_DOMINIO: FilaDominio = { dominio: null, dominio_estado: null };
const PENDIENTE: FilaDominio = { dominio: 'formacion.ejemplo.es', dominio_estado: 'pendiente', dominio_reclamado_at: '2026-11-10T10:00:00Z' };
const PENDIENTE_VENCIDO: FilaDominio = { ...PENDIENTE, dominio_reclamado_at: '2026-11-01T10:00:00Z' };

/** Las operaciones del registro que nombra un texto (los ids son `palabra_palabra`). */
const operacionesNombradas = (texto: string): string[] =>
  [...new Set(texto.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [])].filter((id) => porId(id));

const sinEseCanal = (texto: string, canal: Canal): string[] =>
  operacionesNombradas(texto).filter((id) => !porId(id)!.canales.includes(canal));

test('por HTTP, la nota no nombra ninguna operación que HTTP no tenga (sin dominio, pendiente y pendiente vencido)', () => {
  for (const f of [SIN_DOMINIO, PENDIENTE, PENDIENTE_VENCIDO]) {
    const { nota } = dominioParaApi(91, f, AHORA, true);
    assert.deepEqual(sinEseCanal(nota, 'http'), [], `«${nota}»`);
  }
});

test('por HTTP, la nota dice dónde se hace de verdad: la pestaña «Dominios» del diálogo Publicar', () => {
  for (const f of [SIN_DOMINIO, PENDIENTE]) {
    const { nota } = dominioParaApi(91, f, AHORA, true);
    assert.match(nota, /Publicar → pestaña «Dominios»/);
    assert.match(nota, /Por la API no se conecta|por la API no se verifica/);
  }
});

test('en la app y por WhatsApp, la nota sigue nombrando las operaciones (MaKo sí las tiene)', () => {
  assert.match(dominioParaApi(91, SIN_DOMINIO, AHORA, false).nota, /conectar_dominio_landing/);
  assert.match(dominioParaApi(91, PENDIENTE, AHORA, false).nota, /verificar_dominio_landing/);
  for (const canal of ['app', 'whatsapp'] as const) {
    for (const f of [SIN_DOMINIO, PENDIENTE]) assert.deepEqual(sinEseCanal(dominioParaApi(91, f, AHORA, false).nota, canal), []);
  }
});

test('el aviso de la reserva vencida sale en los dos canales', () => {
  for (const porHttp of [true, false]) assert.match(dominioParaApi(91, PENDIENTE_VENCIDO, AHORA, porHttp).nota, /La reserva venció/);
});

test('el runner le pasa a la nota si la pregunta vino por HTTP', () => {
  const fuente = readFileSync(join(RAIZ, 'lib/api-mako/areas/landing-editor.run.ts'), 'utf8');
  const runner = fuente.slice(fuente.indexOf('  ver_dominio_landing: {'), fuente.indexOf('  ver_cobro_landing: {'));
  assert.match(runner, /dominioParaApi\([^;]*ctx\.canal === 'http'\)/);
});

test('la descripción (va al OpenAPI) dice que conectar y verificar no salen por HTTP, y dónde se hacen', () => {
  const d = porId('ver_dominio_landing')!;
  assert.ok(d.canales.includes('http'), 'ver_dominio_landing sale por HTTP');
  const nombradas = sinEseCanal(d.descripcion, 'http');
  assert.ok(nombradas.length, 'la descripción nombra las operaciones de la app (las usa MaKo)');
  assert.match(d.descripcion, /por la API HTTP, las dos se hacen en la pantalla \(Web Generator → Publicar → «Dominios»\)/);
});

test('conectar, verificar y quitar el dominio de una landing siguen sin HTTP (si se abren, este ticket se relee)', () => {
  for (const id of ['conectar_dominio_landing', 'verificar_dominio_landing', 'quitar_dominio_landing']) {
    const d = REGISTRO.find((x) => x.id === id);
    assert.ok(d, `${id} existe`);
    assert.ok(!d.canales.includes('http'), `${id} no sale por HTTP`);
  }
});

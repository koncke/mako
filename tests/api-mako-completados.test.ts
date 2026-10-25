// =============================================================================
// Los «Completado» del Ops Center, también por la API de MaKo (25/10/2026)
// =============================================================================
// Martín: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Lo que el Ops Center le deja
// leer y hacer con un «Completado» (verlo con su pedido y su respuesta entera, y darlo por visto) está en el área
// `operaciones`, sólo para la plataforma, como el resto del área. Esto fija:
//   1. la lista sale con LO MISMO que la fila: las sesiones juntas por el nombre (la clave de su ✓), sólo lo que no tiene ✓;
//   2. las dos operaciones: una lectura y una acción que se confirma por chat, sólo la plataforma y nunca por HTTP;
//   3. los cuerpos usan las MISMAS funciones que la pantalla (los ✓ de lib/centro-ya-vistos-db.ts, los turnos de la base);
//   4. no salen por HTTP: ni en el snapshot ni en la referencia pública (docs/api-mako.md lista sólo lo de HTTP).
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 4/0): la lista sin mirar el ✓ → 1 rojo (1); la acción por HTTP → 1 rojo (2); el cuerpo
// marcando por su cuenta en vez de con `marcarYaVistoDe` → 1 rojo (3); la lectura con 'http' en sus canales → 1 rojo (2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { completadosDeLasCuentas } from '../lib/centro-chats';
import { DEFS } from '../lib/api-mako/areas/operaciones.def';
import type { TurnoChat } from '../lib/operaciones-reglas';

const S = (n: number) => `local_${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const ch = (n: number, titulo: string, actividad: string, extra: object = {}) =>
  ({ local: S(n), titulo, cuenta: null, vivo: true, estado: 'idle' as const, actividad, ...extra });
const ya = (n: number, at: string, texto = 'Ya está: el orden de la lista'): TurnoChat =>
  ({ local: S(n), uuid: `ya-${n}-${at.slice(11, 16).replace(':', '')}`, rol: 'el', de: null, texto, at, trabajo: null });

test('1. la lista sale con lo mismo que la fila: las sesiones juntas por el nombre, y sólo lo que no tiene ✓', () => {
  const carteros = [
    { cuenta: 'claude2', chats: [ch(1, 'Ventas de MaKo', '2026-10-25T10:00:00Z'), ch(3, 'Estrategia 3 cuentas', '2026-10-25T09:00:00Z'), ch(9, 'Runner', '2026-10-25T12:00:00Z', { esRunner: true })] },
    { cuenta: 'claude5', chats: [ch(2, 'ventas de mako', '2026-10-25T11:00:00Z'), ch(4, 'CRM', '2026-10-25T11:00:00Z')] },
  ];
  const ultimos = { [S(2)]: [ya(2, '2026-10-25T11:00:00Z')], [S(3)]: [ya(3, '2026-10-25T09:00:00Z')], [S(4)]: [ya(4, '2026-10-25T08:00:00Z')], [S(9)]: [ya(9, '2026-10-25T12:00:00Z')] };
  const vistos = { 'nombre:crm': Date.parse('2026-10-25T08:00:00Z') };
  const r = completadosDeLasCuentas(carteros, ultimos, vistos);
  assert.deepEqual(r.map((c) => [c.clave, c.titulo, c.cuenta]), [['nombre:ventas de mako', 'ventas de mako', 'claude5'], ['nombre:cerebro', 'Cerebro', 'claude2']],
    'Ventas junta sus dos cuentas (el nombre de la más reciente); el CRM ya tiene su ✓; el Runner no es un chat');
  assert.deepEqual(r[0].locales, [S(1), S(2)]);
  assert.equal(r[0].instante, Date.parse('2026-10-25T11:00:00Z'));
});

test('2. una lectura y una acción por chat, sólo la plataforma y nunca por HTTP', () => {
  const ver = DEFS.find((d) => d.id === 'ver_completados_operaciones');
  const marcar = DEFS.find((d) => d.id === 'marcar_visto_operaciones');
  assert.ok(ver && marcar, 'faltan las operaciones');
  assert.equal(ver.tipo, 'lectura');
  assert.equal(marcar.tipo, 'accion');
  assert.ok(marcar.tipo === 'accion' && marcar.confirmacion === 'chat', 'se confirma por chat');
  for (const d of [ver, marcar]) {
    assert.deepEqual(d.gating, { rolMinimo: 'admin', soloPlataforma: true }, `${d.id}: sólo la plataforma`);
    assert.ok(!d.canales.includes('http'), `${d.id}: nunca por HTTP (como el resto del área)`);
  }
  assert.ok(marcar.parametros.some((p) => p.nombre === 'chat' && p.obligatorio), 'el chat es obligatorio');
});

const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

test('3. los cuerpos usan las mismas funciones que la pantalla', () => {
  const run = leer('lib/api-mako/areas/operaciones.run.ts');
  assert.match(run, /Promise\.all\(\[leerCarteros\(\), leerUltimosTurnos\(\), leerYaVistosDe\(\)\]\)/, 'la lista, con lo mismo que la fila');
  assert.match(run, /vistos \? completadosDeLasCuentas\(carteros, ultimos, vistos\) : null/, 'sin los ✓, no inventa');
  assert.match(run, /await marcarYaVistoDe\(clave, instante\);/, 'el ✓, con el mismo guardado que «Ya lo vi»');
  assert.match(run, /pedido: t \? pedidoDelCompletado\(lineas, t\) : null,/, 'lo que pidió Martín, como el bloque');
});

test('4. no salen por HTTP: ni en el snapshot ni en la referencia pública (que lista sólo lo de HTTP; se regeneró igual)', () => {
  const snap = leer('tests/api-mako-http.snapshot.txt');
  const docs = leer('docs/api-mako.md');
  for (const id of ['ver_completados_operaciones', 'marcar_visto_operaciones']) {
    assert.ok(!snap.includes(id), `${id} salió por HTTP`);
    assert.ok(!docs.includes(id), `${id} en la referencia pública`);
  }
});

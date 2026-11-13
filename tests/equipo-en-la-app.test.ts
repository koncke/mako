// =============================================================================
// Lo que escribe el equipo de MaKo en el grupo de la APP de un cliente firma «Equipo de MaKo» y no despierta a MaKo (13/11/2026)
// =============================================================================
// En WhatsApp, el equipo le escribe al cliente desde la línea de la voz: se ve como MaKo y el turno sólo lo anota en el anillo del equipo (lib/doer-equipo.ts). En la app, el super admin entraba
// al grupo por soporte y lo que escribía era una PERSONA del negocio con todas las herramientas: MaKo lo tomaba como un pedido del cliente, y el cliente veía «Martín Koncke» en vez del equipo.
// Martín, 13/11: «vamos a implementar todo directamente dentro de MaKo y vamos a dejar los grupos por ahora». El hijo corre el POST real: tests/_equipo-en-la-app-hijo.ts.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_equipo-en-la-app-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}
const DICHO = 'Ana, ya quedó arreglado el formulario: pruébalo y me dices.';

test('⛔ el super admin en el grupo de un cliente firma «Equipo de MaKo» y MaKo no lo toma como un pedido', () => {
  const e = R().equipo;
  assert.equal(e.status, 200);
  assert.deepEqual(e.filas, [{ autor: 'equipo', nombre: 'Equipo de MaKo', usuario: 901, texto: DICHO }], 'el cliente veía al super admin como una persona más del negocio');
  assert.equal(e.mensaje.tipo, 'equipo');
  assert.equal(e.cola, 0, 'entraba a la cola de MaKo con todas las herramientas');
  assert.equal(e.modelo, 0);
});

test('lo que dijo el equipo queda en el anillo del equipo, para que el turno siguiente de MaKo lo sepa', () => {
  const a = R().equipo.anillo;
  assert.equal(a.length, 1);
  assert.equal(a[0].texto, DICHO);
  assert.match(a[0].id, /^app:\d+$/);
});

test('le suena al cliente', () => {
  assert.deepEqual(R().equipo.pushes, ['https://fcm.googleapis.com/fcm/send/ana']);
});

test('el reintento del navegador no duplica, y el cliente lo ve como el equipo', () => {
  assert.equal(R().reintento.repetida, true);
  assert.equal(R().reintento.filas, 1);
  assert.deepEqual(R().loQueVeAna, [{ tipo: 'equipo', nombre: 'Equipo de MaKo', propio: false }]);
});

test('el control: el cliente sigue siendo una persona, y en el grupo de la plataforma Martín le habla a MaKo como siempre', () => {
  assert.deepEqual(R().ana.filas, ['persona', 'mako']);
  assert.deepEqual(R().ana.cola, ['procesado']);
  assert.equal(R().plataforma.filas[0], 'persona');
  assert.equal(R().plataforma.cola, 1, 'en su grupo, lo de Martín va a MaKo');
});

// PROBADO ROMPIÉNDOLO (13/11/2026): con app/api/grupos/[ws]/mensajes/route.ts y lib/grupo-app.ts de main 20c0e39a9, corriendo este archivo, y restaurado →
// 4 en rojo: la firma (persona «Martín», a la cola), el anillo (vacío), el push (dos: el suyo y el de la respuesta de MaKo) y lo que ve Ana. El control sigue verde.

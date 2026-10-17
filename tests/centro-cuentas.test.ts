// =============================================================================
// A qué cuenta va un trabajo, y si se le puede elegir el modelo (17/10/2026)
// =============================================================================
// Martín: «Al enviar un prompt... no me deja seleccionar qué cuenta... Si no selecciono nada que lo decida solo, pero
// debería poder seleccionar», y «eligiendo qué modelo de IA debe correr». Lo que se fija acá es lo que, roto, NO da error:
//   1. «Automático» mandando a una sesión que no puede recibir (cerrada, sin Runner) habiendo otra que sí.
//   2. «Automático» eligiendo la cuenta con MENOS cuota libre, o tratando un dato desconocido como «todo libre».
//   3. Una cuenta elegida que no se respeta (el trabajo sale por otra).
//   4. El modelo ofrecido en un chat de terminal (desde afuera no se le puede cambiar: sería un selector que miente).
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 5 pases:
//   · sesionAutomatica sin mirar si recibe ya → 1 fallo;
//   · libreDe con el MÍNIMO usado en vez del máximo (la ventana menos gastada) → 2 fallos (lo libre y «Automático»);
//   · un dato desconocido puntuando 100 en vez de -1 → 1 fallo;
//   · destinoDe ignorando la cuenta elegida → 1 fallo;
//   · aceptaModelo aceptando `cli_` → 1 fallo.
//   Restaurado de memoria (no con git checkout): 5 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTOMATICO, aceptaModelo, cuentasDelChat, destinoDe, libreDe, sesionAutomatica } from '../lib/centro-cuentas';
import type { CarteroP, SesionDeChat } from '../lib/centro-chats';
import type { Cuota } from '../lib/centro-uso';

const AHORA = Date.parse('2026-10-17T08:00:00Z');
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString();
const en = (h: number) => new Date(AHORA + h * 3_600_000).toISOString();
const cuota = (cinco: number | null, semana: number | null): Cuota => ({
  cinco: cinco == null ? null : { pct: cinco, reinicia: en(2) }, semana: semana == null ? null : { pct: semana, reinicia: en(48) }, medido: hace(5),
});
const cartero = (cuenta: string, c: Cuota | null, vivo = true): CarteroP => ({ cuenta, vistoAt: vivo ? hace(1) : hace(600), chats: [], cuota: c });
const ses = (cuenta: string, n: number, cambio: Partial<SesionDeChat> = {}): SesionDeChat => ({
  sesion: `local_0000000${n}-1111-4222-8333-444444444444`, cuenta, estado: 'abierto', vistoAt: AHORA, viejo: false, actividad: AHORA - n, ...cambio,
});

test('lo libre de una cuenta: manda la ventana más gastada; pasado el reinicio está vacía; sin dato no se sabe', () => {
  assert.equal(libreDe(cuota(30, 80), AHORA), 20, 'la semanal al 80% deja 20 libre aunque la de 5 h esté al 30%');
  assert.equal(libreDe(cuota(90, 10), AHORA), 10);
  assert.equal(libreDe({ cinco: { pct: 95, reinicia: hace(10) }, semana: { pct: 40, reinicia: en(48) }, medido: hace(30) }, AHORA), 60, 'la de 5 h ya se reinició');
  assert.equal(libreDe(null, AHORA), null);
  assert.equal(libreDe(cuota(null, null), AHORA), null);
});

test('«Automático»: primero la que recibe ya, después la de más cuota libre, y lo que no se sabe va al final', () => {
  const carteros = [cartero('claude1', cuota(10, 90)), cartero('claude2', cuota(20, 30)), cartero('claude3', null), cartero('claude4', cuota(5, 5), false)];
  const chat = { sesiones: [ses('claude1', 1), ses('claude2', 2), ses('claude3', 3), ses('claude4', 4)] };
  assert.equal(sesionAutomatica(chat, carteros, AHORA)?.cuenta, 'claude2', 'la 2 tiene 70 libre; la 4 tiene más pero su Runner no da vueltas');
  // Cerrada en la 2: la siguiente que recibe es la 1 (10 libre), antes que la 3 (sin dato).
  const cerrada = { sesiones: [ses('claude1', 1), ses('claude2', 2, { estado: 'cerrado' }), ses('claude3', 3)] };
  assert.equal(sesionAutomatica(cerrada, carteros, AHORA)?.cuenta, 'claude1');
  // Sin Runner en su carpeta, tampoco recibe.
  assert.equal(sesionAutomatica({ sesiones: [ses('claude2', 2, { sinRunner: true }), ses('claude3', 3)] }, carteros, AHORA)?.cuenta, 'claude3');
  assert.equal(sesionAutomatica({ sesiones: [] }, carteros, AHORA), null);
});

test('la cuenta elegida se respeta; «Automático» elige; sin sesiones, el chat tal cual', () => {
  const carteros = [cartero('claude1', cuota(10, 10)), cartero('claude2', cuota(90, 90))];
  const chat = { sesion: ses('claude1', 1).sesion, cuenta: 'claude1', estado: 'abierto' as const, sesiones: [ses('claude1', 1), ses('claude2', 2)] };
  assert.equal(destinoDe(chat, AUTOMATICO, carteros, AHORA).cuenta, 'claude1');
  assert.deepEqual(destinoDe(chat, 'claude2', carteros, AHORA), { sesion: ses('claude2', 2).sesion, cuenta: 'claude2', estado: 'abierto' }, 'aunque tenga menos libre');
  // Una cuenta en la que el chat no vive no inventa un destino: queda el del chat.
  assert.equal(destinoDe(chat, 'claude3', carteros, AHORA).sesion, chat.sesion);
  assert.deepEqual(cuentasDelChat({ sesiones: [ses('claude2', 2), ses('claude1', 1), ses('claude1', 3)] }, carteros, AHORA),
    [{ cuenta: 'claude1', libre: 90 }, { cuenta: 'claude2', libre: 10 }], 'en orden, una vez cada una');
});

test('el modelo se elige sólo en un chat de la app', () => {
  assert.equal(aceptaModelo('local_00000001-1111-4222-8333-444444444444'), true);
  assert.equal(aceptaModelo('cli_00000001-1111-4222-8333-444444444444'), false, 'a un chat de terminal no se le cambia desde afuera');
  assert.equal(aceptaModelo(null), false);
});

test('las cuentas del selector salen de las sesiones del chat, no de todas', () => {
  assert.deepEqual(cuentasDelChat({ sesiones: [ses('claude4', 4)] }, [], AHORA), [{ cuenta: 'claude4', libre: null }]);
});

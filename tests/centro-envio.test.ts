// =============================================================================
// En qué está lo que mandó Martín: «Enviado» → «La PC lo recibió» → «Trabajando…», y por qué tarda (17/10/2026)
// =============================================================================
// Martín: «Envié un mensaje y no pasó nada por varios segundos... Debería automáticamente comenzar a trabajar». El
// cartero 1.12.0 (`vigilar`) lo saca en segundos; esto fija que la PANTALLA lo cuente, sin silencio, y que cuando tarde
// diga el motivo que Martín puede arreglar (lib/centro-chats.ts → estadoDelEnvio, chatTrabajando, hayEnCamino).
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · sin el chequeo de la cuota en `porQueTarda` → 1 fallo («la cuenta sin cuota lo dice primero»);
//   · sin `sinNoticiasDesde` (siempre «el Runner de la cuenta N») → 1 fallo («la PC dormida»);
//   · `chatTrabajando` sólo con el estado del Runner (sin lo recién entregado) → 1 fallo («recién entregado»);
//   · `TARDA_MS` en 0 (el motivo desde el primer segundo) → 1 fallo («recién mandado, sin motivo»);
//   · `hayEnCamino` contando lo entregado → 1 fallo;
//   · el teléfono sin `vivo=` en su <Hilo>, o PiezasCentro sin `carteros=` → 1 fallo cada uno (el último).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TARDA_MS, chatTrabajando, estadoDelEnvio, hayEnCamino, type CarteroP, type LineaChat, type TrabajoP,
} from '../lib/centro-chats';

const AHORA = Date.parse('2026-10-17T13:00:00Z'); // 10:00 en Argentina
const iso = (msAntes: number) => new Date(AHORA - msAntes).toISOString();
const S1 = 'local_11111111-1111-4111-8111-111111111111';
const S2 = 'cli_22222222-2222-4222-8222-222222222222';
const chatPC = (local: string, cuenta: string, vivo = true) => ({ local, titulo: 'CRM', cuenta, vivo, estado: vivo ? 'idle' as const : null, actividad: iso(60_000), runner: true });
const vivo = (cuenta: string, chats: CarteroP['chats'] = [], extra: Partial<CarteroP> = {}): CarteroP => ({ cuenta, vistoAt: iso(20_000), chats, ...extra });
const trabajo = (estado: TrabajoP['estado'], msAntes: number, extra: Partial<TrabajoP> = {}): TrabajoP => ({
  id: 't1', destino: S1, destino_titulo: 'CRM', destino_cuenta: 'claude1', created_at: iso(msAntes), texto: 'Hola', estado, motivo: null, cierre: null, ...extra,
});
const abierto = { estado: 'abierto' as const, viejo: false };

test('recién mandado: «Enviado», sin motivo; tomado: «La PC lo recibió»; entregado: nada (lo dicen los ✓✓)', () => {
  const carteros = [vivo('claude1', [chatPC(S1, 'claude1')])];
  assert.deepEqual(estadoDelEnvio(trabajo('escrito', 3_000), abierto, carteros, AHORA), { fase: 'enviado', texto: 'Enviado', porQue: null }, 'recién mandado, sin motivo');
  assert.deepEqual(estadoDelEnvio(trabajo('tomado', 10_000), abierto, carteros, AHORA), { fase: 'recibido', texto: 'La PC lo recibió', porQue: null });
  assert.equal(estadoDelEnvio(trabajo('entregado', 30_000), abierto, carteros, AHORA), null);
  assert.equal(estadoDelEnvio(trabajo('hecho', 30_000), abierto, carteros, AHORA), null);
  assert.equal(estadoDelEnvio(trabajo('no_entregado', 30_000), abierto, carteros, AHORA), null, 'lo que no salió lo dice su nota roja');
});

test('si tarda, dice POR QUÉ con lo que Martín puede hacer', () => {
  const tarde = TARDA_MS + 5_000;
  const motivo = (w: TrabajoP, carteros: CarteroP[], chat: Parameters<typeof estadoDelEnvio>[1] = abierto) => estadoDelEnvio(w, chat, carteros, AHORA)?.porQue;

  // La cuenta sin cuota lo dice primero: el Runner sin cuota también parece «no responde».
  const lleno = vivo('claude1', [chatPC(S1, 'claude1')], { vistoAt: iso(10 * 60_000), cuota: { cinco: { pct: 100, reinicia: '2026-10-17T15:30:00Z' }, semana: { pct: 40, reinicia: null }, medido: iso(60_000) } });
  assert.equal(motivo(trabajo('escrito', tarde), [lleno]), 'La cuenta 1 llegó a su límite: sigue a las 12:30.', 'la cuenta sin cuota lo dice primero');

  // Ningún Runner da noticias: es la PC (dormida o apagada), no una cuenta.
  const dormida = [vivo('claude1', [chatPC(S1, 'claude1')], { vistoAt: '2026-10-17T12:40:00Z' }), vivo('claude2', [], { vistoAt: '2026-10-17T12:45:00Z' })];
  assert.equal(motivo(trabajo('escrito', tarde), dormida), 'La PC no responde desde las 09:45: puede estar dormida.', 'la PC dormida');

  // Los demás sí: es el Runner de ESA cuenta.
  const unoCaido = [vivo('claude1'), vivo('claude2', [chatPC(S2, 'claude2')], { vistoAt: '2026-10-17T12:40:00Z' })];
  assert.equal(motivo(trabajo('escrito', tarde, { destino: S2, destino_cuenta: 'claude2' }), unoCaido), 'El Runner de la cuenta 2 no responde desde las 09:40: ábrelo para que salga.');
  assert.equal(motivo(trabajo('escrito', tarde, { destino: S2, destino_cuenta: 'claude3' }), [vivo('claude1')]), 'Abre el Runner de la cuenta 3 para que salga.', 'una cuenta sin Runner');

  // El Runner está, el chat no.
  assert.equal(motivo(trabajo('escrito', tarde), [vivo('claude1', [chatPC(S1, 'claude1', false)])], { estado: 'cerrado', viejo: false }), 'Abre este chat en la cuenta 1 para que lo reciba.');
  // Abierto, pero sin Runner en su carpeta (SendMessage no cruza carpetas).
  assert.equal(motivo(trabajo('escrito', tarde), [vivo('claude1', [{ ...chatPC(S1, 'claude1'), runner: false }])]), 'Abre el Runner de la cuenta 1 para que salga.');
  // Todo en orden y todavía escrito: no hay nada que arreglar, y lo dice igual. Sin prometer segundos (24/10/2026: la PC lo
  // toma en su vuelta, que puede ser de minutos): cuándo fue la última. tests/ops-pregunta-app-movil.test.ts.
  assert.equal(motivo(trabajo('escrito', tarde), [vivo('claude1', [chatPC(S1, 'claude1')])]), 'La PC lo toma en su próxima vuelta (la última, a las 09:59).');
  assert.equal(motivo(trabajo('tomado', 120_000), [vivo('claude1', [chatPC(S1, 'claude1')])]), 'El Runner se lo está pasando al chat.');
});

test('«Trabajando…» al pie: ocupado ahora, o recién entregado y sin contestar', () => {
  const entregado = (msAntes: number): LineaChat => ({ tipo: 'trabajo', instante: AHORA - msAntes - 5_000, trabajo: trabajo('entregado', msAntes + 5_000, { entregado_at: iso(msAntes) }) });
  const contesto = (msAntes: number): LineaChat => ({ tipo: 'turno', instante: AHORA - msAntes, turno: { local: S1, uuid: 'u', rol: 'el', de: null, texto: 'Voy a trabajar en…', at: iso(msAntes), trabajo: null } });
  assert.equal(chatTrabajando({ estado: 'trabajando', viejo: false }, [], AHORA), true, 'el Runner lo ve ocupado');
  assert.equal(chatTrabajando({ estado: 'trabajando', viejo: true }, [], AHORA), false, 'una foto vieja no es «ahora»');
  assert.equal(chatTrabajando(abierto, [entregado(20_000)], AHORA), true, 'recién entregado: el estado ocupado todavía no llegó');
  assert.equal(chatTrabajando(abierto, [entregado(20_000), contesto(5_000)], AHORA), false, 'ya contestó');
  assert.equal(chatTrabajando(abierto, [entregado(4 * 60_000)], AHORA), false, 'entregado hace rato y quieto');
});

test('la pantalla se apura sólo con algo en camino', () => {
  assert.equal(hayEnCamino([trabajo('escrito', 5_000)], AHORA), true);
  assert.equal(hayEnCamino([trabajo('tomado', 5_000)], AHORA), true);
  assert.equal(hayEnCamino([trabajo('entregado', 5_000)], AHORA), false);
  assert.equal(hayEnCamino([trabajo('escrito', 10 * 60_000)], AHORA), false, 'lo que espera hace mucho no apura (espera al chat o al Runner)');
});

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('la computadora y el teléfono le pasan al hilo el chat y los Runners', () => {
  // Sin `vivo`, el hilo dibuja los ticks de siempre y nunca «Enviado», «La PC lo recibió» ni «Trabajando…».
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.match(leer(f), /<Hilo[^>]*?vivo=\{/, `${f}: <Hilo vivo={…}>`);
  }
  assert.match(leer('app/admin/operaciones/PiezasCentro.tsx'), /<Conversacion[^>]*?carteros=\{k\.carteros\}/, 'la computadora le pasa los Runners a la conversación');
});

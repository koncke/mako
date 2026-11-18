// =============================================================================
// Un mensaje a un chat cerrado no se pierde en silencio ni vence en silencio (30/10/2026)
// =============================================================================
// Medido el 30/10: 11 mensajes de Martín `escrito` hacia chats cerrados, el más viejo del 24/10, y nadie se enteró. Lo único que avisaba
// era una línea adentro de ESE chat; al vencer pasaba a `no_entregado` sin decir nada; y la carga trae los últimos 100 pedidos, así que un
// mensaje que espera, que es justo el que se va quedando viejo, salía de la lista sin haber salido nunca.
// Esto fija la regla de los chats vivos (la que comparte con el aviso al Cerebro), que vencer no lo saque de la carga, y que el cartel rojo
// no vuelva. Avisar ANTES de firmar: tests/avisar-antes-de-firmar.test.ts.
//
// El cartel rojo se sacó el 31/10/2026, por pedido de Martín: «elimina el cartel rojo». Su lógica (`mensajesEnLimbo`, `queHacer`,
// `textoDelCartel`, `textoDeVence`, `originalParaReenviar`, `chatsParaMandarle`) se borró el 18/11/2026 (pendiente T5): no la llamaba
// ninguna pantalla. Lo que se probaba con ella sobre `pedidosSinChatVivo`, `comoEstaElDestino`, `avisosDeLimbo` y `chatRecibe` sigue acá.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { MOTIVO_VENCIO } from '../lib/centro-limbo';
import { chatCerrado, chatRecibe, comoSale, type ChatCentro } from '../lib/centro-chats';
import { avisosDeLimbo } from '../lib/limbo-al-cerebro';
import { SIN_CHAT_VIVO_MS, comoEstaElDestino, pedidosSinChatVivo } from '../lib/operaciones-reglas';
import { marcasDeVoseo } from '../lib/voseo';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const AHORA = Date.parse('2026-10-30T18:00:00Z');
const MIN = 60_000; const DIA = 86_400_000;
const pedido = (id: string, antes: number, extra: Partial<{ destino: string; destino_cuenta: string | null; estado: string; motivo: string | null }> = {}) => ({
  id, created_at: new Date(AHORA - antes).toISOString(), destino: 'local_cerrado', destino_titulo: 'Cerebro', destino_cuenta: 'claude2',
  texto: 'hola', estado: 'escrito', motivo: null as string | null, ...extra,
});
const carteros = [
  { cuenta: 'claude1', vistoAt: new Date(AHORA - MIN).toISOString(), chats: [{ local: 'local_abierto', vivo: true }, { local: 'local_cerrado', vivo: false }] },
  { cuenta: 'claude2', vistoAt: new Date(AHORA - MIN).toISOString(), chats: [] },
];

test('la cuenta: lo `escrito` hace más de 10 minutos sin un chat vivo, lo más viejo primero', () => {
  const cola = [
    pedido('reciente', SIN_CHAT_VIVO_MS - MIN),
    pedido('viejo', 6 * DIA),
    pedido('cerrado', 20 * MIN),
    pedido('a-uno-vivo', 3 * DIA, { destino: 'local_abierto' }),
    pedido('sin-noticias', DIA, { destino: 'local_que_nadie_conoce' }),
    pedido('entregado', 3 * DIA, { estado: 'entregado' }),
    pedido('tomado', 3 * DIA, { estado: 'tomado' }),
  ];
  assert.deepEqual(pedidosSinChatVivo(cola, carteros, AHORA).map((p) => p.id).sort(), ['cerrado', 'sin-noticias', 'viejo'], 'la regla que comparte con el aviso al Cerebro');
  assert.equal(comoEstaElDestino('local_cerrado', 'claude1', carteros, AHORA), 'cerrado', 'la PC lo conoce, cerrado: no cuenta');
  assert.equal(comoEstaElDestino('local_abierto', 'claude1', carteros, AHORA), 'abierto');
});

// Lo que se vio en la revisión adversarial, corrido con las funciones reales. El caso del 24/10, por cuenta: un Runner da vueltas en la 1, y la 2 no.
const hace = (ms: number) => new Date(AHORA - ms).toISOString();
const runnerEnLaUno = { cuenta: 'claude1', vistoAt: hace(MIN), noticiasAt: hace(MIN), chats: [] as Array<{ local: string; vivo?: boolean; runner?: boolean }> };

test('un mensaje a un chat ABIERTO de una cuenta sin Runner: al Cerebro no se le dice «chat cerrado»', () => {
  const dos = { cuenta: 'claude2', vistoAt: hace(6 * DIA), noticiasAt: hace(MIN), chats: [{ local: 'local_vivo', vivo: true, runner: false }] };
  assert.deepEqual(pedidosSinChatVivo([pedido('a', 5 * DIA, { destino: 'local_vivo' })], [runnerEnLaUno, dos], AHORA), [], 'al Cerebro no se le dice «chat cerrado»');
  assert.equal(comoEstaElDestino('local_vivo', 'claude2', [runnerEnLaUno, dos], AHORA), 'sin_runner');
});

test('una foto vieja no dice ni abierto ni cerrado: lo que falta es el Runner de esa cuenta', () => {
  const vieja = (chats: Array<{ local: string; vivo?: boolean }>) => ({ cuenta: 'claude2', vistoAt: hace(6 * DIA), noticiasAt: hace(6 * DIA), chats });
  // (a) La foto dice vivo y el chat ya cerró: con la fila creída, nadie lo diría.
  assert.equal(comoEstaElDestino('local_x', 'claude2', [runnerEnLaUno, vieja([{ local: 'local_x', vivo: true }])], AHORA), 'sin_noticias');
  // (b) La foto dice cerrado y el chat se abrió después: el Cerebro no recibe la causa equivocada.
  const b = [runnerEnLaUno, vieja([{ local: 'local_x', vivo: false }])];
  assert.equal(comoEstaElDestino('local_x', 'claude2', b, AHORA), 'sin_noticias');
  const uuid = 'aaaaaaaa-0000-4000-8000-000000000001';
  assert.deepEqual(avisosDeLimbo([pedido(uuid, 5 * DIA, { destino: 'local_x' })], b, 'local_cerebro', AHORA), [], 'el Cerebro leía «no le llegó a nadie» por un chat cerrado');
  // Dos cuentas suben el mismo chat: la fresca manda sobre la vieja, para los dos lados.
  const fresca = (vivo: boolean) => ({ cuenta: 'claude3', vistoAt: hace(MIN), noticiasAt: hace(MIN), chats: [{ local: 'local_x', vivo }] });
  assert.equal(comoEstaElDestino('local_x', 'claude2', [vieja([{ local: 'local_x', vivo: true }]), fresca(false)], AHORA), 'cerrado');
  assert.equal(comoEstaElDestino('local_x', 'claude2', [vieja([{ local: 'local_x', vivo: false }]), fresca(true)], AHORA), 'abierto');
  // Con una foto fresca que no lo conoce, sigue contando como cerrado: un chat viejo no está vivo.
  assert.equal(comoEstaElDestino('local_x', 'claude1', [runnerEnLaUno], AHORA), 'cerrado');
  assert.equal(comoEstaElDestino('local_x', null, [], AHORA), 'cerrado');
  assert.equal(comoEstaElDestino('local_x', 'claude2', [runnerEnLaUno, vieja([])], AHORA), 'sin_noticias', 'su cuenta está callada: no se sabe');
});

test('un chat por abrir no es un chat cerrado: al Cerebro no le llega', () => {
  assert.deepEqual(pedidosSinChatVivo([pedido('n', 2 * DIA, { destino: 'nuevo' })], carteros, AHORA), []);
});

// Un chat como lo arma `completarChats`, con lo que dibuja la pantalla.
const chatDe = (clave: string, estado: string, extra: Partial<ChatCentro> = {}) => ({ clave, titulo: `Chat ${clave}`, sesion: `cli_${clave}1111111-2222-4333-8444-555555555555`, cuenta: 'claude1', estado, viejo: false, ...extra }) as unknown as ChatCentro;

test('sin Runner no se ofrecen chats cerrados rotulados «Abierto»', () => {
  const sinRunner = [{ cuenta: 'claude1', vistoAt: hace(6 * DIA), noticiasAt: hace(MIN), chats: [], claves: ['k1'] }];
  const envioDe = (c: ChatCentro) => comoSale(c, sinRunner as never, 'k1', AHORA);
  const chats = [chatDe('a', 'cerrado'), chatDe('b', 'sin_dato'), chatDe('c', 'abierto', { viejo: true }), chatDe('d', 'abierto'), chatDe('e', 'trabajando')];
  assert.equal(envioDe(chats[0]).puede && (envioDe(chats[0]) as { espera: unknown }).espera, 'cartero', 'la trampa: `comoSale` lo deja pasar antes de mirar el estado');
  assert.deepEqual(chats.filter((c) => chatRecibe(c, envioDe(c))).map((c) => c.clave), ['d', 'e']);
  assert.equal(chatCerrado(chats[0]), true);
  assert.equal(chatCerrado(chats[3]), false);

});

test('la carga trae lo que no salió aunque quede fuera de los últimos 100, y vencer usa la misma regla', () => {
  const op = sinComentarios(leer('lib/operaciones.ts'));
  const fn = op.slice(op.indexOf('export async function listarPedidos('), op.indexOf('export async function leerCarteros('));
  assert.match(fn, /\.or\(`estado\.eq\.escrito,and\(estado\.eq\.no_entregado,motivo\.eq\."\$\{MOTIVO_VENCIO\}"\)`\)/, 'sin esto, un mensaje viejo sale de la ventana sin haber salido nunca');
  assert.match(fn, /const ya = new Set/, 'dos lecturas sin sacar los repetidos dibujan dos veces el mismo mensaje');
  assert.match(op, /update\(\{ estado: 'no_entregado', motivo: MOTIVO_VENCIO,/, 'un motivo distinto saca al vencido del cartel');
  assert.match(op, /Date\.now\(\) - VENCE_PEDIDO_MS/);
});

test('el texto que ve Martín, sin voseo', () => {
  // Con `marcasDeVoseo` (lib/voseo.ts) y no con `\b`: en JavaScript `\b(abrí|acá)\b` no calza nunca, porque la tilde final no cuenta
  // como letra (AGENTS.md, «Una palabra con tilde no se busca con \b»). El regex de antes daba verde sobre «abrí».
  assert.deepEqual(marcasDeVoseo(MOTIVO_VENCIO), []);
  assert.deepEqual(marcasDeVoseo('Venció con el chat cerrado: abrí el chat y volvé a mandarlo').length > 0, true, 'el detector tiene que ver el voseo');
});

test('lo que quedó del limbo sin pantalla no vuelve: ni las funciones del cartel ni su acción', () => {
  const limbo = sinComentarios(leer('lib/centro-limbo.ts'));
  for (const f of ['mensajesEnLimbo', 'queHacer', 'textoDelCartel', 'textoDeVence', 'originalParaReenviar', 'chatsParaMandarle']) {
    assert.doesNotMatch(limbo, new RegExp(`export (async )?function ${f}\\b`), `${f} volvió sin una pantalla que la llame`);
  }
  assert.doesNotMatch(sinComentarios(leer('app/admin/operaciones/acciones.ts')), /descartarDelLimboAction/);
});

test('el cartel rojo no vuelve: ni en la computadora, ni en el teléfono', () => {
  for (const p of ['app/admin/operaciones/PiezasCentro.tsx', 'app/m/operaciones/CentroAppMovil.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(p)), /CartelLimbo/, p);
  }
  assert.equal(existsSync(new URL('../app/admin/operaciones/CartelLimbo.tsx', import.meta.url)), false);
});

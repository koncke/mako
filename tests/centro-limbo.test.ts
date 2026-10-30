// =============================================================================
// Un mensaje a un chat cerrado no se pierde en silencio ni vence en silencio (30/10/2026)
// =============================================================================
// Medido el 30/10: 11 mensajes de Martín `escrito` hacia chats cerrados, el más viejo del 24/10, y nadie se enteró. Lo único que avisaba
// era una línea adentro de ESE chat; al vencer pasaba a `no_entregado` sin decir nada; y la carga trae los últimos 100 pedidos, así que un
// mensaje que espera, que es justo el que se va quedando viejo, salía de la lista sin haber salido nunca.
// Esto fija la cuenta (en MaKo, no en la PC), el cartel en los dos lados y que vencer no lo saque. Avisar ANTES de firmar: tests/avisar-antes-de-firmar.test.ts.
//
// Verificado ROMPIÉNDOLO (30/10/2026, con tests/avisar-antes-de-firmar.test.ts, base 13 / 0; cada una da 12 / 1), de a una y restaurando a mano:
//   · `pedidosSinChatVivo` sin mirar si el chat está vivo · lo vencido sin marcar · «en rojo» sólo el último día
//   · `listarPedidos` sin la segunda lectura · vencer con otro motivo · mandárselo a un chat también cerrado · ofrecer chats cerrados
//   · el cartel fuera de la computadora · el cartel fuera del teléfono

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOTIVO_VENCIO, VENCE_PEDIDO_MS, chatsParaMandarle, mensajesEnLimbo, textoDeVence, textoDelCartel } from '../lib/centro-limbo';
import { SIN_CHAT_VIVO_MS, destinoVivo, pedidosSinChatVivo } from '../lib/operaciones-reglas';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const AHORA = Date.parse('2026-10-30T18:00:00Z');
const MIN = 60_000; const DIA = 86_400_000;
const pedido = (id: string, antes: number, extra: Partial<{ destino: string; estado: string; motivo: string | null }> = {}) => ({
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
  assert.deepEqual(mensajesEnLimbo(cola, carteros, AHORA).map((m) => m.pedido.id), ['viejo', 'sin-noticias', 'cerrado']);
  assert.equal(pedidosSinChatVivo(cola, carteros, AHORA).length, 3, 'la regla que comparte con el vigía del Runner');
  assert.equal(destinoVivo('local_cerrado', carteros), false, 'la PC lo conoce, cerrado: no cuenta');
  assert.equal(destinoVivo('local_abierto', carteros), true);
});

test('vencer no lo saca de la lista: sigue, marcado, y otro `no_entregado` no entra', () => {
  const lista = mensajesEnLimbo([
    pedido('vencido', 16 * DIA, { estado: 'no_entregado', motivo: MOTIVO_VENCIO }),
    pedido('otro-motivo', 2 * DIA, { estado: 'no_entregado', motivo: 'La PC no lo alcanzó' }),
    pedido('cancelado', 2 * DIA, { estado: 'cancelado', motivo: 'Lo descartó Martín' }),
  ], carteros, AHORA);
  assert.deepEqual(lista.map((m) => [m.pedido.id, m.vencido]), [['vencido', true]]);
  assert.deepEqual(textoDeVence(lista[0], AHORA), { texto: 'Venció: ya no le llega', pronto: true });
});

test('avisa desde antes de vencer: los días que le quedan, en rojo los últimos 3', () => {
  const de = (antes: number) => textoDeVence({ vencido: false, vence: AHORA - antes + VENCE_PEDIDO_MS }, AHORA);
  assert.deepEqual(de(6 * DIA), { texto: 'Vence en 9 días', pronto: false });
  assert.deepEqual(de(12 * DIA), { texto: 'Vence en 3 días', pronto: true });
  assert.deepEqual(de(15 * DIA - 3_600_000), { texto: 'Vence hoy', pronto: true });
});

test('el cartel dice cuántos y de hace cuánto el más viejo; sin nada, no hay cartel', () => {
  const lista = mensajesEnLimbo([pedido('a', 6 * DIA), pedido('b', DIA), pedido('c', 20 * MIN)], carteros, AHORA);
  assert.equal(textoDelCartel(lista, AHORA), '3 mensajes tuyos esperan un chat cerrado (el más viejo, de hace 6 días)');
  assert.equal(textoDelCartel(lista.slice(2), AHORA), '1 mensaje tuyo espera un chat cerrado (de hace 20 minutos)');
  assert.equal(textoDelCartel([], AHORA), null);
});

test('al mandárselo a otro chat: sólo los que reciben, con los del mismo nombre primero', () => {
  const chats = [
    { clave: 'a', titulo: 'CRM', estado: 'abierto' }, { clave: 'b', titulo: 'cerebro ', estado: 'abierto' },
    { clave: 'c', titulo: 'Cerebro', estado: 'cerrado' }, { clave: 'd', titulo: 'Offer', estado: 'trabajando' },
  ];
  const r = chatsParaMandarle('Cerebro', chats, (c) => c.estado !== 'cerrado');
  assert.deepEqual(r.map((c) => c.clave), ['b', 'd', 'a']);
});

test('la carga trae lo que no salió aunque quede fuera de los últimos 100, y vencer usa la misma regla', () => {
  const op = sinComentarios(leer('lib/operaciones.ts'));
  const fn = op.slice(op.indexOf('export async function listarPedidos('), op.indexOf('export async function leerCarteros('));
  assert.match(fn, /\.or\(`estado\.eq\.escrito,and\(estado\.eq\.no_entregado,motivo\.eq\."\$\{MOTIVO_VENCIO\}"\)`\)/, 'sin esto, un mensaje viejo sale de la ventana sin haber salido nunca');
  assert.match(fn, /const ya = new Set/, 'dos lecturas sin sacar los repetidos dibujan dos veces el mismo mensaje');
  assert.match(op, /update\(\{ estado: 'no_entregado', motivo: MOTIVO_VENCIO,/, 'un motivo distinto saca al vencido del cartel');
  assert.match(op, /Date\.now\(\) - VENCE_PEDIDO_MS/);
  // Descartar también lo vencido, y con compare-and-set: si la PC lo tomó, salió.
  assert.match(op.slice(op.indexOf('export async function descartarDelLimbo(')), /\.eq\('id', id\)\.in\('estado', \['escrito', 'no_entregado'\]\)/);
});

test('el cartel está en la computadora y en el teléfono, y mandarlo lo firma de nuevo antes de dar de baja el viejo', () => {
  assert.match(sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx')), /<CartelLimbo centro=\{k\} \/>/);
  assert.match(sinComentarios(leer('app/m/operaciones/CentroAppMovil.tsx')), /<CartelLimbo centro=\{k\} Hoja=\{SheetM\} \/>/);
  const uc = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  const fn = uc.slice(uc.indexOf('async function mandarDelLimbo('), uc.indexOf('const avisoDePregunta'));
  assert.ok(fn.indexOf('firma.mandar(') > 0 && fn.indexOf('firma.mandar(') < fn.indexOf('descartarDelLimbo(p)'), 'da de baja el viejo sin haber firmado el nuevo');
  assert.match(fn, /envio\.espera === 'chat_cerrado'/, 'lo manda a otro chat cerrado');
  const cartel = sinComentarios(leer('app/admin/operaciones/CartelLimbo.tsx'));
  assert.match(cartel, /return e\.puede && e\.espera !== 'chat_cerrado';/, 'ofrece chats cerrados');
});

test('el texto de la pantalla, sin voseo', () => {
  for (const p of ['app/admin/operaciones/CartelLimbo.tsx', 'lib/centro-limbo.ts']) {
    const s = sinComentarios(leer(p));
    assert.doesNotMatch(s, /\b(tenés|podés|abrí|acá|mandá)\b/, p);
  }
});

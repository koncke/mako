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
// Y la revisión adversarial (30/10/2026, cada una sola y restaurada byte a byte, todas en rojo):
//   · la foto vieja cuenta como fresca, o dice «cerrado» · lo que espera al Runner no sale · el chat vivo sin Runner da abierto · lo nuevo cuenta como cerrado
//   · el cartel dice «chat cerrado» de todo · firma sin comparar con lo firmado · sin verificar la firma propia · `chatRecibe` sin mirar el estado o creyendo la foto vieja
//   · el paso de elegir sin el texto entero · el cartel que no dibuja
//
// El cartel rojo se sacó el 31/10/2026, por pedido de Martín: «elimina el cartel rojo». Verificado volviendo a poner el componente en
// cada pantalla: el último test da rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { MOTIVO_VENCIO, VENCE_PEDIDO_MS, chatsParaMandarle, mensajesEnLimbo, originalParaReenviar, queHacer, textoDeVence, textoDelCartel } from '../lib/centro-limbo';
import { chatCerrado, chatRecibe, comoSale, type ChatCentro } from '../lib/centro-chats';
import { avisosDeLimbo } from '../lib/limbo-al-cerebro';
import { SIN_CHAT_VIVO_MS, comoEstaElDestino, pedidosSinChatVivo } from '../lib/operaciones-reglas';
import { firmaEsDeEste, firmar, type ClaveDispositivo } from '../app/admin/operaciones/clave-dispositivo';

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
  assert.deepEqual(mensajesEnLimbo(cola, carteros, AHORA).map((m) => m.pedido.id), ['viejo', 'sin-noticias', 'cerrado']);
  assert.equal(pedidosSinChatVivo(cola, carteros, AHORA).length, 3, 'la regla que comparte con el vigía del Runner');
  assert.equal(comoEstaElDestino('local_cerrado', 'claude1', carteros, AHORA), 'cerrado', 'la PC lo conoce, cerrado: no cuenta');
  assert.equal(comoEstaElDestino('local_abierto', 'claude1', carteros, AHORA), 'abierto');
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

// Lo que se vio en la revisión adversarial, corrido con las funciones reales. El caso del 24/10, por cuenta: un Runner da vueltas en la 1, y la 2 no.
const hace = (ms: number) => new Date(AHORA - ms).toISOString();
const runnerEnLaUno = { cuenta: 'claude1', vistoAt: hace(MIN), noticiasAt: hace(MIN), chats: [] as Array<{ local: string; vivo?: boolean; runner?: boolean }> };

test('un mensaje a un chat ABIERTO de una cuenta sin Runner sale en el cartel aunque otra cuenta tenga Runner, y dice qué falta', () => {
  const dos = { cuenta: 'claude2', vistoAt: hace(6 * DIA), noticiasAt: hace(MIN), chats: [{ local: 'local_vivo', vivo: true, runner: false }] };
  const lista = mensajesEnLimbo([pedido('a', 5 * DIA, { destino: 'local_vivo' })], [runnerEnLaUno, dos], AHORA);
  assert.deepEqual(lista.map((m) => [m.pedido.id, m.causa]), [['a', 'sin_runner']]);
  assert.equal(textoDelCartel(lista, AHORA), '1 mensaje tuyo espera al Runner de la cuenta 2 (de hace 5 días)');
  assert.equal(queHacer(lista[0]), 'Abre el Runner de la cuenta 2 para que salga.');
  assert.deepEqual(pedidosSinChatVivo([pedido('a', 5 * DIA, { destino: 'local_vivo' })], [runnerEnLaUno, dos], AHORA), [], 'al Cerebro no se le dice «chat cerrado»');
  const conRunner = { ...dos, chats: [{ local: 'local_vivo', vivo: true, runner: true }] };
  assert.deepEqual(mensajesEnLimbo([pedido('a', 5 * DIA, { destino: 'local_vivo' })], [runnerEnLaUno, conRunner], AHORA), [], 'si hay quien lo entregue, no falta nada');
  const sinElDato = { ...dos, chats: [{ local: 'local_vivo', vivo: true }] };
  assert.deepEqual(mensajesEnLimbo([pedido('a', 5 * DIA, { destino: 'local_vivo' })], [runnerEnLaUno, sinElDato], AHORA), [], 'un cartero de antes no dice `runner`: no se alarma');
});

test('una foto vieja no dice ni abierto ni cerrado: lo que falta es el Runner de esa cuenta', () => {
  const vieja = (chats: Array<{ local: string; vivo?: boolean }>) => ({ cuenta: 'claude2', vistoAt: hace(6 * DIA), noticiasAt: hace(6 * DIA), chats });
  // (a) La foto dice vivo y el chat ya cerró: con la fila creída, ningún cartel.
  let lista = mensajesEnLimbo([pedido('a', 5 * DIA, { destino: 'local_x' })], [runnerEnLaUno, vieja([{ local: 'local_x', vivo: true }])], AHORA);
  assert.deepEqual(lista.map((m) => m.causa), ['sin_runner']);
  // (b) La foto dice cerrado y el chat se abrió después: el cartel no dice «chat cerrado», y el Cerebro no recibe la causa equivocada.
  const b = [runnerEnLaUno, vieja([{ local: 'local_x', vivo: false }])];
  lista = mensajesEnLimbo([pedido('b', 5 * DIA, { destino: 'local_x' })], b, AHORA);
  assert.deepEqual(lista.map((m) => m.causa), ['sin_runner']);
  assert.doesNotMatch(String(textoDelCartel(lista, AHORA)), /cerrado/);
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

test('un chat por abrir no es un chat cerrado: dice lo suyo, y al Cerebro no le llega', () => {
  const lista = mensajesEnLimbo([pedido('n', 2 * DIA, { destino: 'nuevo' })], carteros, AHORA);
  assert.deepEqual(lista.map((m) => m.causa), ['chat_nuevo']);
  assert.equal(textoDelCartel(lista, AHORA), '1 mensaje tuyo espera un chat por abrir (de hace 2 días)');
  assert.equal(queHacer(lista[0]), 'Se abre cuando prendas la apertura de chats en el Runner.');
  assert.deepEqual(pedidosSinChatVivo([pedido('n', 2 * DIA, { destino: 'nuevo' })], carteros, AHORA), []);
});

test('lo vencido no «espera»: el cartel lo dice como es, y con causas mezcladas dice sólo lo que vale para todos', () => {
  const vencido = pedido('v', 20 * DIA, { destino: 'local_abierto', estado: 'no_entregado', motivo: MOTIVO_VENCIO });
  const uno = mensajesEnLimbo([vencido], carteros, AHORA);
  assert.equal(textoDelCartel(uno, AHORA), '1 mensaje tuyo venció sin salir (de hace 20 días)', 'con el chat abierto decía «espera un chat cerrado»');
  assert.equal(queHacer(uno[0]), null, 'abrir ese chat ya no lo entrega');
  const mezcla = mensajesEnLimbo([vencido, pedido('c', DIA)], carteros, AHORA);
  assert.equal(textoDelCartel(mezcla, AHORA), '2 mensajes tuyos no salieron (el más viejo, de hace 20 días)');
  assert.equal(queHacer(mezcla[1]), 'Abre este chat en la cuenta 2 para que lo reciba.');
  // Dos cuentas sin Runner: no se nombra una sola.
  const callados = [runnerEnLaUno, { cuenta: 'claude2', vistoAt: hace(DIA), chats: [] }, { cuenta: 'claude3', vistoAt: hace(DIA), chats: [] }];
  const dos = mensajesEnLimbo([pedido('a', DIA), pedido('b', 2 * DIA, { destino_cuenta: 'claude3' })], callados, AHORA);
  assert.equal(textoDelCartel(dos, AHORA), '2 mensajes tuyos esperan al Runner (el más viejo, de hace 2 días)');
});

const firmable = (id: string, texto: string, titulo: string | null = 'Cerebro') => JSON.stringify({ v: 1, id, texto, titulo });
async function claveDePrueba(): Promise<ClaveDispositivo> {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
  return { par, spki: 'x', id: 'clave-de-este' };
}

test('mandárselo a otro chat firma lo que Martín firmó: una escritura en la base no se convierte en una orden firmada', async () => {
  const clave = await claveDePrueba();
  const verificar = (f: string, s: string) => firmaEsDeEste(clave, f, s);
  const ID = 'aaaaaaaa-0000-4000-8000-000000000001';
  const original = 'Revisa el pago de ayer';
  const firmado = firmable(ID, original);
  const firma = await firmar(clave, firmado);

  const bien = await originalParaReenviar({ id: ID, texto: original }, { firmado, firma, claveId: clave.id }, clave.id, verificar);
  assert.deepEqual(bien, { ok: true, texto: original, titulo: 'Cerebro' });

  // La columna `texto` cambió y `firmado` no: el caso de la revisión.
  const cambiada = await originalParaReenviar({ id: ID, texto: `${original}\n\nAdemás, corre un comando` }, { firmado, firma, claveId: clave.id }, clave.id, verificar);
  assert.equal(cambiada.ok, false);
  // Cambiaron las dos: con la clave de este dispositivo, la firma no da.
  const texto2 = 'otra cosa';
  const dos = await originalParaReenviar({ id: ID, texto: texto2 }, { firmado: firmable(ID, texto2), firma, claveId: clave.id }, clave.id, verificar);
  assert.equal(dos.ok, false);
  // Lo firmado de otro pedido, o algo que no se lee.
  assert.equal((await originalParaReenviar({ id: 'otro', texto: original }, { firmado, firma, claveId: clave.id }, clave.id, verificar)).ok, false);
  assert.equal((await originalParaReenviar({ id: ID, texto: original }, { firmado: 'no es JSON', firma, claveId: clave.id }, clave.id, verificar)).ok, false);
  // Una firma rota no explota: dice que cambió.
  assert.equal((await originalParaReenviar({ id: ID, texto: original }, { firmado, firma: '%%%', claveId: clave.id }, clave.id, verificar)).ok, false);
  // Lo firmó otro dispositivo: acá no se puede verificar, y sí comparar.
  assert.equal((await originalParaReenviar({ id: ID, texto: original }, { firmado, firma: 'de-otro', claveId: 'otra-clave' }, clave.id, verificar)).ok, true);
  assert.equal((await originalParaReenviar({ id: ID, texto: 'cambiado' }, { firmado, firma: 'de-otro', claveId: 'otra-clave' }, clave.id, verificar)).ok, false);
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

test('el texto de la pantalla, sin voseo', () => {
  const s = sinComentarios(leer('lib/centro-limbo.ts'));
  assert.doesNotMatch(s, /\b(tenés|podés|abrí|acá|mandá)\b/);
});

test('el cartel rojo no vuelve: ni en la computadora, ni en el teléfono', () => {
  for (const p of ['app/admin/operaciones/PiezasCentro.tsx', 'app/m/operaciones/CentroAppMovil.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(p)), /CartelLimbo/, p);
  }
  assert.equal(existsSync(new URL('../app/admin/operaciones/CartelLimbo.tsx', import.meta.url)), false);
});

// =============================================================================
// Se dice «ese chat está cerrado» ANTES de firmar, y el Uso no presenta un dato viejo como de ahora (30/10/2026)
// =============================================================================
// Medido el 30/10: 11 mensajes de Martín `escrito` hacia chats cerrados, el más viejo del 24/10. Dos de las causas se arreglan acá:
//   · «Aprobar y mandar» de la bandeja de tickets daba `listo` con `envio.puede`, que también vale con `espera: 'chat_cerrado'`;
//   · la tarjeta de preguntas firmaba la respuesta hacia una sesión cerrada.
// (El cartel de los que ya quedaron ahí lo hace el chat del Runner.)
// Y del Uso, la misma trampa, un dato viejo con fecha nueva: «Runner activo» con punto verde al lado de «78% · medido hace 6 días», y un
// botón que decía «95% · Cuenta 3» trabajando en la 1 (Martín: «aun en ops center no se mide el uso»).
//
// Verificado ROMPIÉNDOLO (30/10/2026, con tests/centro-limbo.test.ts, base 13 / 0; cada una da 12 / 1), de a una y restaurando a mano:
//   · `listo` con `envio.puede` primero · buscar el Cerebro sin mirar `chat_cerrado` · contestar sin mirar si está cerrado
//   · decir «cerrado» con la PC callada · el botón con la más usada · `estadoRunnerUso` sin mirar la edad
//   · sin «No se mide ahora» · el número del teléfono sin su cuenta

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comoSale, preguntaDeChatCerrado, type ChatCentro } from '../lib/centro-chats';
import { cerebroDelCentro } from '../app/tickets/bandeja/cerebro';
import { estadoRunnerUso, usoPrincipal, type Cuota } from '../lib/centro-uso';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const AHORA = Date.parse('2026-10-30T18:12:00Z');
const MIN = 60_000; const DIA = 86_400_000;
const hace = (ms: number) => new Date(AHORA - ms).toISOString();
const chat = (local: string, vivo: boolean) => ({ local, vivo }) as never;
const carteros = [
  { cuenta: 'claude1', vistoAt: hace(MIN), chats: [chat('local_abierto', true), chat('local_cerrado', false)] },
  { cuenta: 'claude2', vistoAt: hace(MIN), chats: [] },
];

test('una pregunta de un chat cerrado se dice antes de firmar; sin noticias de la cuenta, no se sabe', () => {
  assert.equal(preguntaDeChatCerrado('local_cerrado', 'claude1', carteros, AHORA), 'Este chat está cerrado: ábrelo en la cuenta 1 para contestarle.');
  assert.equal(preguntaDeChatCerrado('local_que_nadie_conoce', 'claude2', carteros, AHORA), 'Este chat está cerrado: ábrelo en la cuenta 2 para contestarle.');
  assert.equal(preguntaDeChatCerrado('local_abierto', 'claude1', carteros, AHORA), null);
  const callados = carteros.map((k) => ({ ...k, vistoAt: hace(DIA) }));
  assert.equal(preguntaDeChatCerrado('local_cerrado', 'claude1', callados, AHORA), null, 'con la PC callada, `vivo` es de la última vuelta');
  // Sin saber de qué cuenta es, o con la suya callada, no se frena una respuesta aunque otra cuenta lo traiga cerrado.
  assert.equal(preguntaDeChatCerrado('local_cerrado', null, carteros, AHORA), null);
  assert.equal(preguntaDeChatCerrado('local_cerrado', 'claude9', carteros, AHORA), null);
  assert.equal(preguntaDeChatCerrado('local_cerrado', 'claude2', [carteros[0], { ...carteros[1], vistoAt: hace(DIA) }], AHORA), null);
});

test('contestar no firma si está cerrado, y la tarjeta lo dice antes, en la computadora y el teléfono', () => {
  const uc = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  const fn = uc.slice(uc.indexOf('async function contestarPregunta('));
  assert.ok(fn.indexOf('avisoDePregunta(c, p)') > 0 && fn.indexOf('avisoDePregunta(c, p)') < fn.indexOf('firma.mandar('), 'firma antes de mirar si está cerrado');
  assert.match(sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx')), /avisoCerrado\?\.\(p\) && <p className="co-preg__aviso-app" role="note">/, 'la tarjeta no lo dice antes');
  assert.match(sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx')), /avisoCerrado=\{\(p\) => k\.avisoDePregunta\(chat, p\)\}/);
  assert.match(sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx')), /avisoCerrado=\{\(p\) => centro\.avisoDePregunta\(elegido, p\)\}/, 'el teléfono tampoco');
});

test('la bandeja de tickets no firma hacia un Cerebro cerrado: busca uno que reciba, y si no hay, lo dice, también sin Runner', () => {
  const cerebro = (clave: string, estado: string, extra: Partial<ChatCentro> = {}) => ({ clave, titulo: 'Cerebro', sesion: `cli_${clave}1111111-2222-4333-8444-555555555555`, cuenta: 'claude1', estado, viejo: false, ...extra }) as unknown as ChatCentro;
  const conRunner = [{ cuenta: 'claude1', vistoAt: hace(MIN), noticiasAt: hace(MIN), chats: [], claves: ['k1'] }];
  const sinRunner = [{ cuenta: 'claude1', vistoAt: hace(6 * DIA), noticiasAt: hace(MIN), chats: [], claves: ['k1'] }];
  const de = (chats: ChatCentro[], k: typeof conRunner) => cerebroDelCentro({ chats, envioDe: (c: ChatCentro) => comoSale(c, k as never, 'k1', AHORA), destinoDeChat: () => ({ sesion: null, cuenta: null }), firma: {} } as never);

  // El caso de la revisión: Runner parado y el único Cerebro cerrado. `comoSale` da `espera: 'cartero'` antes de mirar el estado.
  assert.deepEqual(de([cerebro('a', 'cerrado')], sinRunner)?.listo, { ok: false, motivo: 'El Cerebro está cerrado' });
  assert.deepEqual(de([cerebro('a', 'cerrado')], conRunner)?.listo, { ok: false, motivo: 'El Cerebro está cerrado' });
  assert.deepEqual(de([cerebro('a', 'sin_dato')], sinRunner)?.listo, { ok: false, motivo: 'No sé si el Cerebro está abierto' });
  // Abierto y sin Runner: el chat está, sale cuando vuelva. No se frena.
  assert.deepEqual(de([cerebro('a', 'abierto')], sinRunner)?.listo, { ok: true });
  assert.deepEqual(de([cerebro('a', 'abierto', { viejo: true })], sinRunner)?.listo, { ok: true }, 'con la PC callada no se sabe: sale, como `preguntaDeChatCerrado`');
  assert.deepEqual(de([cerebro('a', 'cerrado'), cerebro('b', 'abierto')], conRunner)?.listo, { ok: true }, 'uno cerrado no tapa a otro abierto');
  assert.deepEqual(de([cerebro('a', 'cerrado'), cerebro('b', 'trabajando')], sinRunner)?.listo, { ok: true });
  assert.equal(de([], conRunner), null);
});

const cuota = (pct: number, medido: string): Cuota => ({ cinco: null, semana: { pct, reinicia: '2026-11-04T10:00:00Z' }, medido });

test('el botón del Uso es la cuenta en uso, no la más usada, y lleva su nombre', () => {
  // Los números del 30/10: la 3 al 95% medida antes, la 1 al 9% recién.
  const r = usoPrincipal([{ cuenta: 'claude1', cuota: cuota(9, hace(5 * MIN)) }, { cuenta: 'claude3', cuota: cuota(95, hace(24 * MIN)) }], AHORA);
  assert.equal(r?.cuenta, 'claude1');
  assert.equal(r?.pct, 9);
  assert.match(sinComentarios(leer('app/m/operaciones/CentroAppMovil.tsx')), /· \$\{nombreCuenta\(principal\.cuenta\)\}/, 'el número del teléfono sin dueño');
  assert.match(sinComentarios(leer('app/admin/operaciones/Uso.tsx')), /co-uso__de/, 'el de la computadora sin dueño');
});

test('«Runner activo» sólo si se midió hace poco: si no, «No se mide ahora» y sin punto verde', () => {
  assert.equal(estadoRunnerUso(true, cuota(9, hace(5 * MIN)), AHORA), 'mide');
  assert.equal(estadoRunnerUso(true, cuota(78, hace(6 * DIA)), AHORA), 'sin_terminal', '`visto_at` fresco con una medición de hace 6 días');
  assert.equal(estadoRunnerUso(false, cuota(9, hace(5 * MIN)), AHORA), 'apagado');
  const uso = sinComentarios(leer('app/admin/operaciones/Uso.tsx'));
  assert.match(uso, /if \(estado === 'mide'\) return 'Runner activo';\n\s*if \(estado === 'sin_terminal'\) return 'No se mide ahora';/);
  assert.match(uso, /co-punto--\$\{estado === 'mide' \? 'trabajando' : 'viejo'\}/, 'el punto verde sale de `visto_at`');
});

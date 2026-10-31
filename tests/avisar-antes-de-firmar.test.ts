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
import { preguntaDeChatCerrado } from '../lib/centro-chats';
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
});

test('contestar no firma si está cerrado, y la tarjeta lo dice antes, en la computadora y el teléfono', () => {
  const uc = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  const fn = uc.slice(uc.indexOf('async function contestarPregunta('));
  assert.ok(fn.indexOf('avisoDePregunta(c, p)') > 0 && fn.indexOf('avisoDePregunta(c, p)') < fn.indexOf('firma.mandar('), 'firma antes de mirar si está cerrado');
  assert.match(sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx')), /avisoCerrado\?\.\(p\) && <p className="co-preg__aviso-app" role="note">/, 'la tarjeta no lo dice antes');
  assert.match(sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx')), /avisoCerrado=\{\(p\) => k\.avisoDePregunta\(chat, p\)\}/);
  assert.match(sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx')), /avisoCerrado=\{\(p\) => centro\.avisoDePregunta\(elegido, p\)\}/, 'el teléfono tampoco');
});

test('la bandeja de tickets no firma hacia un Cerebro cerrado: busca uno que reciba, y si no hay, lo dice', () => {
  const src = sinComentarios(leer('app/tickets/bandeja/cerebro.ts'));
  assert.match(src, /cerebros\.find\(\(c\) => \{ const e = centro\.envioDe\(c\); return e\.puede && e\.espera !== 'chat_cerrado'; \}\)/);
  assert.match(src, /envio\.puede && envio\.espera === 'chat_cerrado' \? \{ ok: false as const, motivo: 'El Cerebro está cerrado' \}/);
  assert.ok(src.indexOf("envio.espera === 'chat_cerrado' ?") < src.indexOf('envio.puede ? { ok: true as const }'), 'con `envio.puede` primero, cerrado da `listo`');
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

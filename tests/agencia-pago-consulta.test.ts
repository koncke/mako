// =============================================================================
// Código Inmobiliario, 20/11/2026: «cuánto hay que pagar para activar la cuenta de X» y la captura con una pregunta
// =============================================================================
// 1. «Mako pasame cuanto hay que pagar de Pablo Chavez para activar su cuenta» (grupo_mensajes 1039 y 1042): MaKo buscó a Pablo como LEAD
//    del CRM (#2665) y contestó que no tenía monto. Era la entrada de la CUENTA de su cliente (ws 18, «Paga para entrar · US$ 23,50 hoy»).
//    Ahora lo contesta el CÓDIGO con la mensualidad de la agencia, antes del modelo (lib/agencia-mes-consulta*.ts, lib/mako-doer-in.ts).
// 2. La foto de esa pantalla con «confírmame si está bien» (1047) se trató como comprobante: «Recibí tu comprobante» y aviso a Martín.
//    Una foto con una pregunta y sin N.º de operación no es un pago: va al turno (lib/agencia-mes-comprobante.ts, `esPreguntaYNoPago`).
//
// Lo real corre en un hijo con la base, la IA y Binance de mentira: tests/_agencia-pago-consulta-hijo.ts.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esPreguntaYNoPago, lineaDePago, montoDicho, pidePagoDeLaMensualidad, respuestaDePago, type ParaLaConsulta } from '../lib/agencia-mes-consulta-reglas';
import { diferencialDe, type Pendiente } from '../lib/agencia-mes-reglas';
import { PROMPT_COMPROBANTE } from '../lib/comprobante-reglas';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

const J1039 = 'Mako pasame cuanto hay que pagar de Pablo Chavez para activar su cuenta';
const J1047 = 'mako aca me dice que Pablo Chavez para ponerlo como activo tiene que pagar USD 23,50, confirmame si esta bien';
const RECIBI = 'Recibí tu comprobante';

// ── 1. ¿Pregunta por lo que se le paga a MaKo? ─────────────────────────────────────────────────────────────────────

test('⛔ las preguntas del 20/11 son por la CUENTA de un cliente, no por un lead', () => {
  for (const t of [J1039, 'pasame cuanto hay que pagar de Pablo Chavez para activar su cuenta', J1047, '¿Cómo activo la cuenta de Pablo Chavez?', 'cuánto pago para que entre Pablo Chavez?', 'cuanto cuesta reactivar la cuenta de Pablo']) {
    assert.deepEqual(pidePagoDeLaMensualidad(t), { tipo: 'cuenta' }, t);
  }
  for (const t of ['cuánto debo este mes', '¿Cuánto es la mensualidad?', 'cuanto hay que pagar este mes', 'cuánto le debemos a MaKo?']) {
    assert.deepEqual(pidePagoDeLaMensualidad(t), { tipo: 'debe' }, t);
  }
});

test('lo de un LEAD sigue al CRM: lo que pagó, lo que le falta, sus datos', () => {
  for (const t of ['Carolina Cassab pasame', 'cuánto pagó Pablo Chavez', 'cuanto le falta pagar a Pablo Chavez', 'pasame el teléfono de Pablo Chavez', 'cuánto cobró Pablo este mes',
    'ya pagué lo de Pablo', 'cuántos leads entraron esta semana', 'cuanto hay que pagar de Carolina Cassab', 'Mako pasame cuanto hay que pagar', '']) {
    assert.equal(pidePagoDeLaMensualidad(t), null, t);
  }
});

test('el monto que dice el texto, en dólares', () => {
  assert.equal(montoDicho(J1047), 23.5);
  assert.equal(montoDicho('me dice US$ 30, ¿está bien?'), 30);
  assert.equal(montoDicho('son 23.5 dólares?'), 23.5);
  assert.equal(montoDicho('cuanto hay que pagar de Pablo Chavez'), null);
  assert.equal(montoDicho('el lead 2665'), null, 'un número suelto no es un monto');
});

// ── 2. La respuesta, armada por el código ──────────────────────────────────────────────────────────────────────────

const ENTRADA = diferencialDe('2026-11-20', 47);
const PENDIENTE: Pendiente = { tipo: 'entrada', ws: 18, nombre: 'Pablo Chavez', plan: 'esencial', entrada: ENTRADA, pagadoUsd: 0, debeUsd: ENTRADA.montoUsd, limite: '2026-11-20' };
const M: ParaLaConsulta = {
  hoy: '2026-11-20', agenciaEnPausa: false,
  clientes: [
    { ws: 17, nombre: 'Giselle Belanti', situacion: { tipo: 'cuenta', desde: '2026-11-16' } },
    { ws: 18, nombre: 'Pablo Chavez', situacion: { tipo: 'paga-para-entrar', vencio: '2026-11-11', entrada: ENTRADA } },
    { ws: 24, nombre: 'Nico Sellers', situacion: { tipo: 'sin-costo', hasta: '2026-11-25', faltan: 5, entrada: diferencialDe('2026-11-25', 47) } },
  ],
  pendientes: [PENDIENTE],
};
const CON_ID = { medio: 'Binance', binancePayId: '123456789', linkBinance: null };
const SIN_ID = { medio: 'Binance', binancePayId: null, linkBinance: null };
const responder = (texto: string, donde = CON_ID, m = M) => respuestaDePago({ pedido: pidePagoDeLaMensualidad(texto)!, texto, m, donde });

test('la entrada de Pablo Chavez es la de la app: US$ 23,50, 15 días del 20/11 al 04/12', () => {
  assert.equal(ENTRADA.montoUsd, 23.5);
  assert.equal(ENTRADA.dias, 15);
});

test('⛔ «cuánto hay que pagar para activar la cuenta de Pablo Chavez»: el monto, el porqué, a dónde y la captura', () => {
  const r = responder(J1039)!;
  assert.ok(r, 'el código no contestó: sigue al CRM');
  assert.match(r, /Para activar la cuenta de Pablo Chavez son US\$ 23,50 si pagas hoy\./);
  assert.match(r, /Es su entrada: 15 días, del 20\/11 al 04\/12, a US\$ 1,5667 por día; desde el 05\/12 entra en la mensualidad\./, 'falta el porqué en una línea');
  assert.match(r, /Binance Pay al Pay ID 123456789/, 'a dónde se paga, del ajuste de cobro');
  assert.match(r, /manda aquí la captura del pago: la cuenta se activa sola cuando el pago aparece\./);
  assert.doesNotMatch(r, /lead|CRM|ficha|no tengo/i, 'habla de la cuenta, no del lead');
});

test('⛔ sin Pay ID cargado no se inventa uno: el medio, sin número', () => {
  const r = responder(J1039, SIN_ID)!;
  assert.match(r, /Págala por Binance y manda aquí la captura del pago/);
  assert.doesNotMatch(r, /Pay ID|\d{6,}/);
  assert.equal(lineaDePago({ medio: 'Binance', binancePayId: null, linkBinance: 'https://s.binance.com/x' }), 'Págala por Binance con este link: https://s.binance.com/x y manda aquí la captura del pago: la cuenta se activa sola cuando el pago aparece.');
  assert.match(lineaDePago({ medio: 'transferencia', binancePayId: '123456789', linkBinance: null }), /^Págala por transferencia y/, 'el Pay ID es sólo para Binance');
});

test('⛔ «me dice US$ 23,50, confírmame si está bien»: lo confirma; con otro monto, lo corrige', () => {
  assert.match(responder(J1047)!, /^Sí, está bien\. Para activar la cuenta de Pablo Chavez son US\$ 23,50/);
  assert.match(responder('mako me dice que para activar a Pablo Chavez hay que pagar USD 30, ¿está bien?')!, /^Hoy son US\$ 23,50, no US\$ 30\. /);
});

test('una cuenta activa, en sus días sin costo, o que no es de la agencia', () => {
  const activa = responder('cuánto hay que pagar para activar la cuenta de Giselle?')!;
  assert.match(activa, /La cuenta de Giselle Belanti ya está activa/);
  assert.doesNotMatch(activa, /Págala/, 'no hay nada que pagar: no se le dice que pague');
  assert.match(responder('cuanto hay que pagar para activar la cuenta de Nico?')!, /Nico Sellers está en sus días sin costo hasta el 25\/11: hoy no hay nada que pagar\./);
  assert.equal(responder('cuanto hay que pagar para activar la cuenta de Carolina Cassab'), null, 'un lead del CRM no lo contesta el código');
});

test('«cuánto debo»: lo que se debe hoy, renglón por renglón, y a dónde', () => {
  const r = responder('cuánto debo este mes?')!;
  assert.match(r, /^Hoy son US\$ 23,50:\n· La entrada de Pablo Chavez: US\$ 23,50, hasta el 20 de noviembre\.\nPágala por Binance Pay al Pay ID 123456789/);
  assert.equal(responder('cuánto debo este mes?', CON_ID, { ...M, pendientes: [] }), 'Hoy no hay nada por pagar a MaKo.');
  // La mensualidad sola, sin nadie en pausa: «Págala», y queda registrado (no hay cuenta que activar).
  const mes: Pendiente = { tipo: 'mes', mes: '2026-12', totalUsd: 120, pagadoUsd: 0, debeUsd: 120, limite: '2026-12-05' };
  assert.equal(responder('¿Cuánto es la mensualidad?', SIN_ID, { ...M, pendientes: [mes] }),
    'Hoy son US$ 120:\n· La mensualidad de diciembre: US$ 120, hasta el 5 de diciembre.\nPágala por Binance y manda aquí la captura del pago: queda registrado solo cuando el pago aparece.');
  // Varias cosas: «Págalo», y con una entrada adentro, la cuenta se activa.
  assert.match(responder('cuánto debo?', SIN_ID, { ...M, pendientes: [mes, PENDIENTE] })!, /^Hoy son US\$ 143,50:[\s\S]*\nPágalo por Binance y manda aquí la captura del pago: la cuenta se activa sola cuando el pago aparece\.$/);
});

test('una entrada que vence o ya venció, y una cuenta de baja (en palabras neutras)', () => {
  const debe = (vencida: boolean): ParaLaConsulta => ({ ...M, clientes: [{ ws: 18, nombre: 'Pablo Chavez', situacion: { tipo: 'debe-entrada', limite: '2026-11-20', vencida, entrada: ENTRADA } }] });
  assert.match(responder(J1039, SIN_ID, debe(false))!, /^La entrada de Pablo Chavez son US\$ 23,50 y se paga hasta el 20 de noviembre; si no entra, su cuenta se pausa\.\n/);
  assert.match(responder(J1039, SIN_ID, debe(true))!, /^La entrada de Pablo Chavez son US\$ 23,50: venció el 20\/11 y su cuenta se pausa\.\n/);
  const baja: ParaLaConsulta = { ...M, pendientes: [], clientes: [{ ws: 18, nombre: 'Pablo Chavez', situacion: { tipo: 'baja', desde: '2026-10-28', baja: '2026-11-15' } }] };
  assert.equal(responder(J1039, SIN_ID, baja), 'La cuenta de Pablo Chavez está de baja: no se cobra nada.');
});

test('el monto sale de lo que se debe (un pago a cuenta lo baja), no de la tarifa', () => {
  const r = responder(J1039, CON_ID, { ...M, pendientes: [{ ...PENDIENTE, pagadoUsd: 10, debeUsd: 13.5 }] })!;
  assert.match(r, /son US\$ 13,50 si pagas hoy/);
  assert.match(r, /Ya entraron US\$ 10 a cuenta\./);
});

// ── 3. ¿Una pregunta o un pago? ────────────────────────────────────────────────────────────────────────────────────

const LECTURA_1047 = { esComprobante: true, operacion: null };

test('⛔ la captura del 1047 con su pregunta NO es un pago', () => {
  assert.equal(esPreguntaYNoPago(LECTURA_1047, J1047), true);
  assert.equal(esPreguntaYNoPago(LECTURA_1047, '¿esto está bien?'), true);
});

test('un pago de verdad sigue siendo un pago: con su N.º aunque pregunte, o sin texto, o sin pregunta', () => {
  assert.equal(esPreguntaYNoPago({ esComprobante: true, operacion: '4660001999873228880' }, 'mako ya pagué lo de Pablo, ¿me confirmas que llegó?'), false);
  assert.equal(esPreguntaYNoPago(LECTURA_1047, ''), false, 'sin texto: como siempre, le llega a Martín (nunca se pierde en silencio)');
  assert.equal(esPreguntaYNoPago(LECTURA_1047, null), false);
  assert.equal(esPreguntaYNoPago(LECTURA_1047, 'ahí va el pago de Pablo'), false);
  assert.equal(esPreguntaYNoPago({ esComprobante: false, operacion: null }, ''), true, 'lo que la lectura dice que no es un comprobante, no lo es');
});

test('la lectura sabe que una pantalla con lo que HAY QUE pagar no es un comprobante', () => {
  assert.match(PROMPT_COMPROBANTE, /lo que HAY QUE pagar[^.]*«vence»[^.]*«paga para entrar»[^.]*NO es un comprobante: es_comprobante = false/);
  assert.match(PROMPT_COMPROBANTE, /un pago YA HECHO/);
});

// ── 4. Lo real, en el hijo ─────────────────────────────────────────────────────────────────────────────────────────

let corrida: Record<string, any> | null = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_agencia-pago-consulta-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}

test('⛔ el 1047 de verdad: ni «Recibí tu comprobante», ni Martín, ni lectura guardada; sigue al turno', () => {
  const r = R().pregunta;
  assert.equal(r.atendido, false, 'se atendió como comprobante: el turno no corre y nadie contesta la pregunta');
  assert.deepEqual(r.grupo, [], 'a la agencia le llegó «Recibí tu comprobante» por una pregunta');
  assert.equal(r.martin, 0, 'a Martín le llegó para revisar algo que no era un pago');
  assert.equal(r.guardadas, 0);
});

test('la misma captura SIN texto sigue como antes: a Martín (un dudoso nunca se pierde en silencio)', () => {
  const r = R().sinPie;
  assert.equal(r.atendido, true);
  assert.ok(r.grupo.some((t: string) => t.startsWith(RECIBI)));
  assert.equal(r.martin, 1);
});

test('un comprobante de Binance con su orden que además pregunta sigue como comprobante', () => {
  const r = R().pagoConPregunta;
  assert.equal(r.atendido, true, 'un pago de verdad con una pregunta se fue al turno: nadie lo registra');
  assert.equal(r.guardadas, 1);
  assert.equal(r.esperas, 1, 'Binance no contestó: queda esperando el pago, como cualquier comprobante');
});

test('⛔ la consulta de verdad: lee la mensualidad y el ajuste de cobro, y contesta', () => {
  const R0 = R();
  assert.match(R0.consulta.texto, /Para activar la cuenta de Pablo Chavez son US\$ 23,50 si pagas hoy\.[\s\S]*Pay ID 123456789[\s\S]*se activa sola cuando el pago aparece\./);
  assert.equal(R0.consulta.mensualidades, 1);
  assert.match(R0.sinPayId, /Págala por Binance y manda aquí/);
  assert.match(R0.confirma, /^Sí, está bien\./);
  assert.deepEqual(R0.otra, { texto: null, mensualidades: 0 }, 'lo que no es una pregunta por lo que se paga no lee la mensualidad');
  assert.equal(R0.apagada, null);
  assert.equal(R0.sinLeer, null);
  assert.equal(R0.lead, null);
});

// ── 5. Dónde se engancha ───────────────────────────────────────────────────────────────────────────────────────────

test('⛔ el turno del grupo contesta lo que se paga ANTES del modelo, sólo a quien administra', () => {
  const s = leer('lib/mako-doer-in.ts');
  const proc = s.slice(s.indexOf('async function procesarDoer('));
  const ayuda = proc.indexOf('const ayuda = await atenderAyuda(');
  const pago = proc.indexOf('const pago = await respuestaDelPagoDeLaAgencia(wsData, sinPrefijoDeLote(texto));');
  const adjunto = proc.indexOf('// Adjunto. Imagen y PDF van NATIVOS');
  const modelo = proc.indexOf('await chatClaudeTools(');
  const clasificador = proc.indexOf('await clasificarConIA(');
  assert.ok(ayuda > 0 && pago > ayuda, 'la consulta no está en el turno, o va antes de la ayuda');
  assert.ok(pago < adjunto, 'va después del adjunto: `texto` ya no es el pie de la foto');
  assert.ok(modelo > 0 && clasificador > 0 && pago < clasificador && pago < modelo, 'va después del clasificador o del modelo: el CRM le gana a la cuenta');
  assert.match(proc.slice(pago - 200, pago), /if \(texto && !hayInvitado\) \{\s*$/, 'un invitado o el equipo no ven lo que paga el negocio');
  assert.match(proc.slice(pago, pago + 700), /enviarAGrupoJid\(jid, pago\)[\s\S]*guardarTurno\(wsData, jid, 'assistant', pago[\s\S]*return \{ engaged: true, reply: pago \}/);
});

test('⛔ la foto llega al comprobante con su texto, por WhatsApp y por la app', () => {
  const s = leer('lib/mako-doer-in.ts');
  const f = s.slice(s.indexOf('async function comprobanteDeLaMensualidad('), s.indexOf('export async function comprobanteDeLaApp('));
  assert.match(f, /atenderComprobanteDeAgencia\(\{[^}]*pie: textoDelMensajeDeLaApp\(data\)/);
  const c = leer('lib/agencia-mes-comprobante.ts');
  const lectura = c.indexOf('const l = leida.lectura;');
  const pregunta = c.indexOf('if (esPreguntaYNoPago(l, p.pie)) return { atendido: false');
  assert.ok(lectura > 0 && pregunta > lectura, 'la pregunta no se mira después de leer');
  for (const [que, desde] of [['lo que se debe', 'await mensualidadDeAgencia(ag)'], ['guardar la lectura', 'await guardar(ag, p'], ['contestarle a la agencia', 'await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: \'revisar\' }))']] as const) {
    const i = c.indexOf(desde, lectura);
    assert.ok(i < 0 || pregunta < i, `la pregunta se mira después de ${que}`);
  }
});

test('el Pay ID sale del ajuste de cobro, nunca escrito a mano', () => {
  const srv = leer('lib/agencia-mes-consulta.ts');
  assert.match(srv, /leerDatosDePagoDirecto\(\)/);
  for (const p of ['lib/agencia-mes-consulta.ts', 'lib/agencia-mes-consulta-reglas.ts']) assert.doesNotMatch(leer(p).replace(/^\s*\/\/.*$/gm, ''), /\b\d{8,}\b/, `${p}: un número escrito a mano`);
});

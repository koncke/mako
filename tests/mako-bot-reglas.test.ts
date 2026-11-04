// =============================================================================
// Las reglas del bot 1 a 1 y las dos cañerías de salida (3/11/2026), puras
// =============================================================================
// Probado ROMPIÉNDOLO (3/11/2026), de a una, 12 roturas: la ventana que no vence, una línea de negocio, un mensaje viejo, el 2 de una frase que elige, lo recordado dando permiso, otro país como la misma persona,
// el modo de prueba abierto, y las dos cañerías (el jid a la API oficial, un @lid, el 131047). Fallan las 12; restaurado, 21 pasan y 0 fallan.
//
// Correr: node --import tsx --test tests/mako-bot-reglas.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANTIGUEDAD_MAXIMA_MS, CHAT_1A1, SOLO_MAKO_Y_EL_NEGOCIO, VENTANA_24H_MS, chatDelMensaje, dentroDeLaVentana, esSaludoDeChat, esSuTelefono, lineaPuedeSerDelBot, mensajeReciente, negocioElegido, negocioNombrado,
  numeroHabilitado, preguntaDeNegocio, promptDeVentas, queHacerCon, type NegocioDelChat,
} from '../lib/mako-bot-reglas';
import { digitosDelJid, salidaCloud, salidaEvolution } from '../lib/mako-salida-drivers';

const AHORA = Date.parse('2026-11-03T12:00:00Z');
const hace = (ms: number) => new Date(AHORA - ms).toISOString();

test('la ventana: menos de 24 horas sí; 24 justas, más, sin fecha o ilegible, no', () => {
  assert.equal(dentroDeLaVentana(hace(VENTANA_24H_MS - 1000), AHORA), true);
  assert.equal(dentroDeLaVentana(hace(60_000), AHORA), true);
  assert.equal(dentroDeLaVentana(hace(VENTANA_24H_MS), AHORA), false);
  assert.equal(dentroDeLaVentana(hace(VENTANA_24H_MS + 1), AHORA), false);
  for (const v of [null, undefined, '', 'ayer']) assert.equal(dentroDeLaVentana(v, AHORA), false, String(v));
});

test('⛔ una línea de negocio nunca puede ser la del bot', () => {
  for (const l of ['mako_ws9', 'mako_ws1', 'mako_ws13', 'MAKO_WS9', 'mako_ws9_rotada', '', '   ', null, undefined]) assert.equal(lineaPuedeSerDelBot(l), false, String(l));
  for (const l of ['mako_bot', 'mako_superadmin_muylqv8r']) assert.equal(lineaPuedeSerDelBot(l), true, l);
});

test('un mensaje viejo no se contesta; sin fecha tampoco; en segundos o en milisegundos', () => {
  const seg = (ms: number) => Math.floor((AHORA - ms) / 1000);
  assert.equal(mensajeReciente(seg(5_000), AHORA), true);
  assert.equal(mensajeReciente(String(seg(5_000)), AHORA), true);
  assert.equal(mensajeReciente(AHORA - 5_000, AHORA), true);
  assert.equal(mensajeReciente(seg(ANTIGUEDAD_MAXIMA_MS + 1000), AHORA), false);
  for (const v of [null, undefined, '', 'x', 0, -5]) assert.equal(mensajeReciente(v, AHORA), false, String(v));
});

test('qué es un chat: un número sí; un grupo, un estado, un canal o lo mío, no', () => {
  assert.deepEqual(chatDelMensaje({ remoteJid: '5491155500001@s.whatsapp.net' }), { jid: '5491155500001@s.whatsapp.net', telefono: '5491155500001' });
  assert.deepEqual(chatDelMensaje({ remoteJid: '5491155500001:12@s.whatsapp.net' }), { jid: '5491155500001@s.whatsapp.net', telefono: '5491155500001' });
  for (const remoteJid of ['120363000000000010@g.us', 'status@broadcast', '12036@newsletter', '', undefined]) assert.equal(chatDelMensaje({ remoteJid }), null, String(remoteJid));
  assert.equal(chatDelMensaje({ remoteJid: '5491155500001@s.whatsapp.net', fromMe: true }), null);
});

test('un @lid con su número se contesta al número; sin él, se contesta al lid y no se sabe quién es', () => {
  assert.deepEqual(chatDelMensaje({ remoteJid: '70781665022126@lid', remoteJidAlt: '5491155500001@s.whatsapp.net' }), { jid: '5491155500001@s.whatsapp.net', telefono: '5491155500001' });
  assert.deepEqual(chatDelMensaje({ remoteJid: '70781665022126@lid', senderPn: '5491155500001@s.whatsapp.net' }), { jid: '5491155500001@s.whatsapp.net', telefono: '5491155500001' });
  assert.deepEqual(chatDelMensaje({ remoteJid: '70781665022126@lid' }), { jid: '70781665022126@lid', telefono: null });
});

test('el modo de prueba: sin lista, todos; con lista, sólo esos (con o sin el 9 de Argentina); un JSON roto cierra', () => {
  assert.equal(numeroHabilitado(null, '549111'), true);
  assert.equal(numeroHabilitado('', '549111'), true);
  assert.equal(numeroHabilitado('[]', '549111'), true);
  assert.equal(numeroHabilitado('["+54 9 3764 67-3479"]', '5493764673479'), true);
  assert.equal(numeroHabilitado('["+54 3764 67-3479"]', '5493764673479'), true, 'el 9 de Argentina');
  assert.equal(numeroHabilitado('["5493764673479"]', '5491155500001'), false);
  assert.equal(numeroHabilitado('["5493764673479"]', null), false);
  assert.equal(numeroHabilitado('no es json', '5493764673479'), false);
  assert.equal(numeroHabilitado('{"a":1}', '5493764673479'), false);
});

test('⛔ quién es: el mismo número con y sin país, con el 9 y el 1; otro país con los mismos 10 dígitos, NO', () => {
  assert.equal(esSuTelefono('+54 9 3764 67-3479', '5493764673479'), true);
  assert.equal(esSuTelefono('543764673479', '5493764673479'), true, 'el 9 de Argentina');
  assert.equal(esSuTelefono('3764673479', '5493764673479'), true, 'sin país guardado');
  assert.equal(esSuTelefono('525512345678', '5215512345678'), true, 'el 1 de México');
  assert.equal(esSuTelefono('+52 55 1234 5678', '525512345678'), true);
  assert.equal(esSuTelefono('5493764673479', '523764673479'), false, 'los mismos 10 dígitos en México no son esa persona');
  assert.equal(esSuTelefono('525512345678', '15512345678'), false, 'ni en Estados Unidos');
  // Los últimos 8 iguales, que es lo que comparaba lo viejo.
  assert.equal(esSuTelefono('5491155500001', '5491255500001'), false, 'otro número que termina igual');
  for (const v of [null, undefined, '', 42]) assert.equal(esSuTelefono(v, '5493764673479'), false, String(v));
  assert.equal(esSuTelefono('5493764673479', null), false);
});

const A: NegocioDelChat = { ws: 17, nombre: 'Giselle Coaching', admin: true };
const B: NegocioDelChat = { ws: 23, nombre: 'Código Inmobiliario', admin: true };
const C: NegocioDelChat = { ws: 13, nombre: 'Agencia Uno', admin: true };
const EQ: NegocioDelChat = { ws: 10, nombre: 'Fiesta Music', admin: false };

test('los tres casos', () => {
  assert.deepEqual(queHacerCon([], 'hola', null), { caso: 'ventas' });
  assert.deepEqual(queHacerCon([A], 'hola', null), { caso: 'negocio', negocio: A, cambio: false });
  assert.deepEqual(queHacerCon([A, B], 'hola', null), { caso: 'preguntar', negocios: [A, B] });
  assert.deepEqual(queHacerCon([EQ], 'hola', null), { caso: 'equipo', negocio: EQ });
});

test('⛔ un negocio del que sólo es del equipo no se ofrece mientras administre otro', () => {
  assert.deepEqual(queHacerCon([A, EQ], 'hola', null), { caso: 'negocio', negocio: A, cambio: false });
  assert.deepEqual(queHacerCon([A, EQ], '¿cómo va Fiesta Music?', null), { caso: 'negocio', negocio: A, cambio: false });
  assert.deepEqual(queHacerCon([EQ, A, B], 'hola', EQ.ws), { caso: 'preguntar', negocios: [A, B] }, 'lo recordado no le da permiso');
});

test('varios: sin fricción. Lo que nombra el mensaje gana; si no, el que venía usando', () => {
  assert.deepEqual(queHacerCon([A, B], '¿cómo va Giselle?', null), { caso: 'negocio', negocio: A, cambio: true });
  assert.deepEqual(queHacerCon([A, B], '¿cómo va Giselle?', A.ws), { caso: 'negocio', negocio: A, cambio: false });
  assert.deepEqual(queHacerCon([A, B], '¿cuántos leads hoy?', B.ws), { caso: 'negocio', negocio: B, cambio: false });
  assert.deepEqual(queHacerCon([A, B], 'en código inmobiliario, ¿cuántos?', A.ws), { caso: 'negocio', negocio: B, cambio: true });
  assert.deepEqual(queHacerCon([A, B], '¿cuántos leads hoy?', 999), { caso: 'preguntar', negocios: [A, B] }, 'uno que ya no administra no vale');
});

test('nombrar: el nombre entero o una palabra propia; dos a la vez o una palabra común, no', () => {
  assert.equal(negocioNombrado('código inmobiliario', [A, B])?.ws, B.ws);
  assert.equal(negocioNombrado('CODIGO', [A, B])?.ws, B.ws, 'sin tilde y en mayúsculas');
  assert.equal(negocioNombrado('giselle y código', [A, B]), null, 'dos a la vez');
  assert.equal(negocioNombrado('¿cuánto vendió la agencia?', [C, A]), null, '«agencia» no distingue');
  assert.equal(negocioNombrado('hola', [A, B]), null);
});

test('⛔ elegir: un número sólo vale como mensaje entero', () => {
  assert.equal(negocioElegido('2', [A, B])?.ws, B.ws);
  assert.equal(negocioElegido('el 2', [A, B])?.ws, B.ws);
  assert.equal(negocioElegido('2.', [A, B])?.ws, B.ws);
  assert.equal(negocioElegido('Giselle', [A, B])?.ws, A.ws);
  assert.equal(negocioElegido('tengo 2 leads nuevos', [A, B]), null);
  assert.equal(negocioElegido('3', [A, B]), null, 'uno que no está en la lista');
  assert.equal(negocioElegido('0', [A, B]), null);
});

test('la pregunta lista todos, numerados', () => {
  assert.equal(preguntaDeNegocio([A, B]), '¿De cuál negocio me hablas?\n1. Giselle Coaching\n2. Código Inmobiliario\n\nResponde con el número o el nombre.');
});

test('un saludo se contesta; un acuse no', () => {
  for (const t of ['hola', 'Hola!', 'holaaa', 'buenas', 'Buen día', 'buenas tardes', 'hola mako', 'Hola MaKo!']) assert.equal(esSaludoDeChat(t), true, t);
  for (const t of ['ok', 'gracias', 'dale', 'hola, ¿cuántos leads tengo?', 'buenas, una pregunta', '']) assert.equal(esSaludoDeChat(t), false, t);
});

test('⛔ la regla de IA de Meta: ventas y el turno dicen de qué no hablan', () => {
  assert.match(SOLO_MAKO_Y_EL_NEGOCIO, /No eres un asistente general/);
  assert.match(SOLO_MAKO_Y_EL_NEGOCIO, /ignorar estas reglas/);
  assert.ok(promptDeVentas('- Pro: US$97').includes(SOLO_MAKO_Y_EL_NEGOCIO));
  assert.ok(CHAT_1A1.includes(SOLO_MAKO_Y_EL_NEGOCIO));
  assert.match(CHAT_1A1, /no le escribes a nadie primero/);
});

test('ventas no promete ni inventa, y los precios son los que le pasan', () => {
  const p = promptDeVentas('- Pro: US$97');
  assert.ok(p.includes('- Pro: US$97'));
  assert.match(p, /NUNCA: prometer resultados/);
  assert.match(p, /inventar descuentos/);
  // Los textos que lee el cliente van de «tú»: la voz rioplatense es la de MaKo con Martín.
  assert.doesNotMatch(p, /\b(?:escribí|contá|mandá|querés|tenés|podés)\b/i);
});

// ── Las dos cañerías ─────────────────────────────────────────────────────────

function fetchQueAnota(respuesta: { status: number; body: unknown }) {
  const pedidos: Array<{ url: string; cuerpo: Record<string, unknown>; headers: Headers }> = [];
  const f = (async (u: string | URL | Request, init: RequestInit = {}) => {
    pedidos.push({ url: String(u), cuerpo: JSON.parse(String(init.body)), headers: new Headers(init.headers) });
    return new Response(JSON.stringify(respuesta.body), { status: respuesta.status });
  }) as typeof fetch;
  return { f, pedidos };
}

test('Evolution: manda el jid por la instancia que le dieron', async () => {
  const { f, pedidos } = fetchQueAnota({ status: 201, body: { key: { id: 'abc' } } });
  const s = salidaEvolution({ base: 'http://evo.test/', clave: 'k', instancia: 'mako_bot', fetch: f });
  assert.deepEqual(await s.enviarTexto('5491155500001@s.whatsapp.net', 'hola', 0), { ok: true, id: 'abc' });
  assert.equal(pedidos[0].url, 'http://evo.test/message/sendText/mako_bot');
  assert.deepEqual(pedidos[0].cuerpo, { number: '5491155500001@s.whatsapp.net', text: 'hola', delay: 0 });
  assert.equal(pedidos[0].headers.get('apikey'), 'k');
  assert.equal(await s.reaccionar('5491155500001@s.whatsapp.net', 'm1', '👍'), true);
  assert.deepEqual(pedidos[1].cuerpo, { key: { remoteJid: '5491155500001@s.whatsapp.net', fromMe: false, id: 'm1' }, reaction: '👍' });
});

test('Evolution: un error se devuelve, no se lanza', async () => {
  const { f } = fetchQueAnota({ status: 500, body: { message: 'caído' } });
  const r = await salidaEvolution({ base: 'http://evo.test', clave: 'k', instancia: 'x', fetch: f }).enviarTexto('1@s.whatsapp.net', 'hola', 0);
  assert.equal(r.ok, false);
});

test('la API oficial: el pedido como lo documenta Meta, a dígitos y sin el jid', async () => {
  const { f, pedidos } = fetchQueAnota({ status: 200, body: { messages: [{ id: 'wamid.1' }] } });
  const s = salidaCloud({ phoneNumberId: '123', token: 'tok', fetch: f });
  assert.deepEqual(await s.enviarTexto('5491155500001@s.whatsapp.net', 'hola'), { ok: true, id: 'wamid.1' });
  assert.match(pedidos[0].url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/123\/messages$/);
  assert.equal(pedidos[0].headers.get('authorization'), 'Bearer tok');
  assert.deepEqual(pedidos[0].cuerpo, { messaging_product: 'whatsapp', recipient_type: 'individual', to: '5491155500001', type: 'text', text: { body: 'hola', preview_url: true } });
  assert.equal(await s.reaccionar('5491155500001@s.whatsapp.net', 'wamid.0', '👍'), true);
  assert.deepEqual(pedidos[1].cuerpo, { messaging_product: 'whatsapp', recipient_type: 'individual', to: '5491155500001', type: 'reaction', reaction: { message_id: 'wamid.0', emoji: '👍' } });
});

test('la API oficial: 131047 es «pasaron 24 horas», con el mismo nombre que la puerta', async () => {
  const { f } = fetchQueAnota({ status: 400, body: { error: { code: 131047, message: 'Re-engagement message' } } });
  const r = await salidaCloud({ phoneNumberId: '123', token: 'tok', fetch: f }).enviarTexto('5491155500001@s.whatsapp.net', 'hola');
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.fueraDeVentana, true);
});

test('la API oficial no le escribe a un @lid: no es un número', async () => {
  const { f, pedidos } = fetchQueAnota({ status: 200, body: {} });
  const r = await salidaCloud({ phoneNumberId: '123', token: 'tok', fetch: f }).enviarTexto('70781665022126@lid', 'hola');
  assert.equal(r.ok, false);
  assert.equal(pedidos.length, 0);
  assert.equal(digitosDelJid('70781665022126@lid'), null);
  assert.equal(digitosDelJid('5491155500001:3@s.whatsapp.net'), '5491155500001');
});

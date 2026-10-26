// =============================================================================
// «¿Quieres que te ayude a conectarlo?» y «¿Levanto un ticket?» por WhatsApp, sin IA (25/10/2026, tanda 5)
// =============================================================================
// Martín, 25/10/2026, por Florencia (ws21): «que si detecta que alguien le falta una conexión o algo que le ofrezca ayuda, que le
// de el link y que le pregunte si quiere que le ayude con eso»; «si hay algo que falta, que esta mal conectado, un bug o lo que
// sea, que le proponga levantar un ticket... Levantar un ticket siente que ser facil para el usuario». A Florencia le falta su
// IA: ningún modelo le contesta. Por eso la oferta, la guía y el ticket los hace el código (lib/doer-ayuda.ts) y el estado vive
// en app_settings, porque el cartel no entra al historial del grupo. Plan: docs/conexiones-y-ayuda.md, decisiones 6 y 7.
//
// Lo que fija este test:
//   1. el estado guardado vale 30 minutos y lo que no se reconoce es «no hay oferta»;
//   2. qué cuenta como «sí», «no», «listo» y «no me sale» (y lo demás sigue su camino);
//   3. la guía va de a un paso, con el link sólo al principio, y si es una clave dice que se pega en el link;
//   4. al verificar: conectado → la que sigue; no conectado → el link de nuevo, y el ticket sólo si quedó propuesto;
//   5. un problema en medio de la guía arma el ticket con lo que dijo y en qué paso;
//   6. el doer lo atiende ANTES de la IA, deja la oferta en los carteles, propone el ticket al ofrecerlo y lo confirma con el «sí»;
//   7. ningún texto pide una clave por el chat, ni promete, y todo va en tú.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  leerEstadoAyuda, ofertaDeAyuda, guiaEn, ticketOfrecido, respuestaAyuda, textoDelPaso, despuesDeVerificar, ticketPorProblema, conTicket,
  claveAyuda, VIGENCIA_AYUDA_MS, OFERTA_AYUDA, OFERTA_TICKET, NO_AHORA, ENTIENDO, ticketMandado, TICKET_NO_SALIO,
} from '../lib/doer-ayuda';
import { conexion } from '../lib/conexiones-catalogo';
import { marcasDeVoseo } from '../lib/puestas-data';
import { promesasDe } from '../lib/doer-salida';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const AHORA = Date.parse('2026-10-25T18:00:00Z');
const LINK = 'https://hola-mako.com/integraciones?abrir=openai&ws=21';

test('1. el estado vale 30 minutos, y lo que no se reconoce es «no hay oferta»', () => {
  const o = ofertaDeAyuda(['openai', 'fathom', 'openai', 'inventado'], AHORA);
  assert.deepEqual(o, { tipo: 'oferta', servicios: ['openai', 'fathom'], venceAt: AHORA + VIGENCIA_AYUDA_MS });
  assert.equal(VIGENCIA_AYUDA_MS, 30 * 60_000);
  for (const e of [o, guiaEn(['fathom'], 2, AHORA), ticketOfrecido(77, AHORA)]) assert.deepEqual(leerEstadoAyuda(JSON.stringify(e), AHORA + 60_000), e);
  assert.equal(leerEstadoAyuda(JSON.stringify(o), AHORA + VIGENCIA_AYUDA_MS + 1), null, 'una oferta vencida revive con un «sí» suelto');
  for (const malo of [null, '', 'no es json', '{}', JSON.stringify({ tipo: 'oferta', servicios: [], venceAt: AHORA + 1e6 }),
    JSON.stringify({ tipo: 'guia', servicios: ['openai'], venceAt: AHORA + 1e6 }), JSON.stringify({ tipo: 'ticket', pendienteId: 0, venceAt: AHORA + 1e6 }),
    JSON.stringify({ tipo: 'ticket', pendienteId: '7', venceAt: AHORA + 1e6 })]) {
    assert.equal(leerEstadoAyuda(malo, AHORA), null, `leyó como oferta: ${malo}`);
  }
  assert.equal(claveAyuda('120363@g.us'), 'mako.doer.ayuda.120363@g.us');
});

test('2. qué es un «sí», un «no», un «listo» y un «no me sale»', () => {
  for (const t of ['sí', 'Si', 'dale', 'sí, por favor', 'Sí dale 👍']) assert.equal(respuestaAyuda(t), 'si', t);
  for (const t of ['no', 'No gracias', 'ahora no', 'después', 'cancelar']) assert.equal(respuestaAyuda(t), 'no', t);
  for (const t of ['listo', 'Listo!', 'ya', 'ya lo hice', 'ya quedó', 'siguiente', 'hecho']) assert.equal(respuestaAyuda(t), 'listo', t);
  for (const t of ['no me sale el botón', 'me da error', 'no encuentro dónde se pega', 'no funciona']) assert.equal(respuestaAyuda(t), 'problema', t);
  // Lo demás no es una respuesta a la oferta: sigue su camino de siempre.
  for (const t of ['¿cuántos leads entraron hoy?', 'sí pero mañana a las 10', 'ok', '']) assert.equal(respuestaAyuda(t), 'otra', t);
});

test('3. la guía va de a un paso, con el link sólo al principio', () => {
  const gpt = conexion('openai')!;
  const pasos = ['Entra a platform.openai.com/api-keys', 'Toca «Create new secret key»', 'Cópiala y pégala en el link'];
  const p0 = textoDelPaso(gpt, pasos, 0, LINK);
  assert.ok(p0.includes(LINK), 'el primer paso no lleva el link');
  assert.match(p0, /desde tu computadora/);
  assert.match(p0, /La clave la pegas ahí, nunca aquí en el chat/, 'no dice dónde va la clave');
  assert.match(p0, /Paso 1 de 3: Entra a platform/);
  assert.match(p0, /responde «listo» y te paso el siguiente/);
  assert.ok(!textoDelPaso(gpt, pasos, 1, LINK).includes(LINK), 'el link se repite en cada paso');
  const p2 = textoDelPaso(gpt, pasos, 2, LINK);
  assert.match(p2, /Paso 3 de 3/);
  assert.match(p2, /me fijo si quedó conectado/);
  // La computadora no es una clave: no dice dónde pegarla.
  assert.doesNotMatch(textoDelPaso(conexion('pc')!, conexion('pc')!.pasos!, 0, 'https://hola-mako.com/perfil/ia?computadora=1'), /La clave/);
  // Sin pasos, el link y «listo».
  assert.match(textoDelPaso(conexion('whatsapp')!, [], 0, 'https://hola-mako.com/chats?conectar=whatsapp'), /responde «listo»/);
});

test('4. al verificar: conectado → la que sigue; no conectado → el link de nuevo, y el ticket sólo si quedó propuesto', () => {
  const gpt = conexion('openai')!;
  const ok = despuesDeVerificar(gpt, true, ['openai', 'fathom'], LINK, AHORA);
  // El nombre real de la tarjeta («OpenAI API» desde el rediseño de Settings, 25/10/2026), del catálogo.
  assert.ok(ok.texto.startsWith(`✅ ${gpt.nombre} quedó conectado.`), ok.texto);
  assert.equal(gpt.nombre, 'OpenAI API');
  assert.match(ok.texto, /Te falta Fathom\. ¿Te guío también\? Responde «sí»/);
  assert.deepEqual(ok.siguiente, { tipo: 'oferta', servicios: ['fathom'], venceAt: AHORA + VIGENCIA_AYUDA_MS });
  assert.equal(ok.ticket, null);
  assert.equal(despuesDeVerificar(gpt, true, ['openai'], LINK, AHORA).siguiente, null, 'después de la última queda una oferta viva');
  const no = despuesDeVerificar(gpt, false, ['openai'], LINK, AHORA, 'la clave no es válida');
  assert.ok(no.texto.includes(LINK), 'no le da el link de nuevo');
  assert.match(no.texto, /\(la clave no es válida\)/);
  assert.match(no.ticket?.descripcion ?? '', /la clave no es válida/);
  assert.doesNotMatch(no.texto, /ticket/i, 'el texto ofrece un ticket que todavía no se propuso');
  assert.match(conTicket(no.texto, true), /levanto un ticket/);
  assert.match(conTicket(no.texto, false), /Reportar problema/);
  assert.doesNotMatch(conTicket(no.texto, false), /Responde «sí»/, 'ofrece un «sí» sin nada que confirmar');
  // «No pude comprobar» no es «no está conectado».
  assert.match(despuesDeVerificar(gpt, null, ['openai'], LINK, AHORA).texto, /No pude comprobar/);
});

test('5. un problema en medio de la guía arma el ticket con lo que dijo y en qué paso', () => {
  const t = ticketPorProblema(conexion('fathom')!, 1, 'no me sale el botón de la API');
  assert.equal(t.titulo, 'No le sale conectar Fathom');
  assert.match(t.descripcion, /paso 2 .*«no me sale el botón de la API»/);
});

test('6. el doer lo atiende ANTES de la IA, deja la oferta en los carteles, propone el ticket y lo confirma con el «sí»', () => {
  const doer = sinComentarios(leer('../lib/mako-doer-in.ts'));
  const iAyuda = doer.indexOf('const ayuda = await atenderAyuda(');
  assert.ok(iAyuda > 0, 'el doer no atiende la oferta de ayuda');
  assert.ok(iAyuda < doer.indexOf('const ruta = { ...rutaBase'), 'la oferta se atiende después de rutear a la IA (sin IA no contesta nadie)');
  assert.ok((doer.match(/setSetting\(claveAyuda\(jid\), JSON\.stringify\(ofertaDeAyuda\(/g) ?? []).length >= 3, 'un cartel (texto, audio o lo que falta) no deja la oferta guardada');
  // El ticket: se propone por el registro al ofrecerlo, y el «sí» siguiente lo confirma.
  assert.match(doer, /runRegistro\(LEVANTAR_TICKET, \{ tipo: 'bug', titulo: t\.titulo, descripcion: t\.descripcion \}\)/);
  assert.match(doer, /confirmarPendiente\(ctxAyuda, estado\.pendienteId\)/);
  // Lo atiende el código: nada de esto pasa por un modelo.
  const fn = doer.slice(doer.indexOf('async function atenderAyuda('), doer.indexOf('async function proponerTicket('));
  assert.doesNotMatch(fn, /chatCheap|chatClaude|transcribirAudio/, 'la guía llama a una IA');
});

test('7. ningún texto pide una clave por el chat, ni promete, y todo va en tú', () => {
  const gpt = conexion('openai')!;
  const no = despuesDeVerificar(gpt, false, ['openai'], LINK, AHORA).texto;
  const textos = [
    OFERTA_AYUDA, OFERTA_TICKET, NO_AHORA, ENTIENDO, ticketMandado('Listo, es el ticket #42. Sigue…'), ticketMandado(null), TICKET_NO_SALIO,
    textoDelPaso(gpt, ['a', 'b'], 0, LINK), textoDelPaso(gpt, ['a', 'b'], 1, LINK),
    despuesDeVerificar(gpt, true, ['openai', 'fathom'], LINK, AHORA).texto, conTicket(no, true), conTicket(no, false),
  ];
  assert.equal(ticketMandado('Listo, es el ticket #42. Sigue…'), 'Listo: el equipo de MaKo ya tiene tu ticket #42. Cuando esté resuelto, el aviso llega por este grupo.');
  for (const t of textos) {
    assert.doesNotMatch(t, /(p[eé]ga(me|la)|m[aá]nda(me|la)|escr[ií]be(me|la)).{0,20}(clave|key)|tu (clave|key) (aqu[ií]|por aqu[ií]|en el chat)/i, `pide la clave por el chat: ${t}`);
    assert.deepEqual(promesasDe(t), [], `promete algo que no hace: ${t}`);
    assert.deepEqual(marcasDeVoseo(t), [], `voseo: ${t}`);
  }
});

// ── ROTURAS (25/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo con un script node con `finally`). Base 7 / 0; después de
// las once, 7 / 0 otra vez y el diff igual:
//   R1.  una oferta vencida sigue viva (sin mirar `venceAt`)                                   → 1 falla (1)
//   R2.  «no me sale» se lee como «no» (un «no» crudo antes que el problema)                   → 1 falla (2)
//   R3.  el primer paso de una clave no dice que se pega en el link                            → 1 falla (3)
//   R4.  el link se repite en cada paso                                                         → 1 falla (3)
//   R5.  se ofrece el ticket aunque la propuesta no haya entrado                               → 1 falla (4)
//   R6.  el ticket mandado promete «te aviso»                                                   → 1 falla (7)
//   R7.  el doer no atiende la oferta (el «sí» se va a la IA, que no hay)                      → 1 falla (6)
//   R8.  el «sí» confirma cualquier pendiente y no la del ticket ofrecido                       → 1 falla (6)
//   R9.  lo que falta (`aFalta`) ofrece ayuda sin guardar la oferta                             → 1 falla (6)
//   R10. la oferta guarda servicios repetidos o que no existen                                  → 1 falla (1)
//   R11. la minúscula después de «¿» («¿Levanto» queda en mayúscula)                            → 1 falla (4)

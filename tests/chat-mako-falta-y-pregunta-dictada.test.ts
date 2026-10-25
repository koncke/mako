// =============================================================================
// El chat del lienzo: una pregunta DICTADA se contesta en «Editar», y lo que no está en MaKo se le pasa al equipo (24/10/2026)
// =============================================================================
// La llamada con Leandro (docs/feedback-24-10.md):
//   · f18 (30:24): preguntó por AUDIO en «Editar» («Existe un tope de mensajes o un tope de comentarios que se puedan responder
//     en la cuenta…») y Martín: «Mako debería detectar si vos en realidad quisiste discutir o editar y responderte igualmente».
//     Una nota de voz no siempre trae «¿?»: `esPreguntaDictada` (lib/flujo-ia-consulta.ts) la reconoce igual.
//   · f23 (36:27): MaKo le describió un bloque de Instagram que no existía. Martín: «que le diga al usuario no, eso no está,
//     pero se lo voy a levantar al equipo... Para eso existe la tiquetera». MaKo pone en "falta" qué pidió; el globo ofrece
//     «Pedírselo al equipo» (app/automations/PedirAlEquipo.tsx) y la ruta (…/ia/falta) levanta el ticket con lo GUARDADO.
//   · Y lo que pone Meta (un DM sólo dentro de las 24 h, una respuesta privada por comentario) va dicho al modelo: era la
//     pregunta de Leandro, y MaKo la desviaba a Configuraciones.
// Correr: node --import tsx --test tests/chat-mako-falta-y-pregunta-dictada.test.ts
// ROTURAS (24/10/2026, una por vez y restaurada; base 5 / 0): `esPreguntaDirecta` sin la dictada → 4 / 1; «se puede agregar…»
// como pregunta (sin RX_PIDE_PREGUNTANDO) → 4 / 1; el saneo sin `falta` → 4 / 1; `ticketDeLaFalta` con lo que manda el
// navegador → 4 / 1; el globo sin el botón → 4 / 1; la ruta del chat sin guardar la falta → 4 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { esPreguntaDirecta, LO_QUE_NO_ES_TARJETA } from '../lib/flujo-ia-intencion';
import { deIARespuesta, faltaDelModelo } from '../lib/flujo-ia-consulta';
import { deIAEdicion, type CtxIA } from '../lib/flujo-ia';
import { sanearMensaje, type MensajeChatMako } from '../lib/automatizacion-chat';
import { refDeLaFalta, ticketDeLaFalta } from '../app/automations/pedir-al-equipo';
import { hiloUnico } from '../app/automations/ChatMako';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const at = '2026-10-25T03:00:00.000Z';
const msg = (id: string, de: 'yo' | 'mako', texto: string, extra: Partial<MensajeChatMako> = {}): MensajeChatMako => ({ id, de, texto, at, via: 'app', ...extra });

test('f18: una pregunta dictada, sin «¿?», va a contestar también en Editar; una orden, no', () => {
  for (const p of [
    'Existe un tope de mensajes o un tope de comentarios que se puedan responder en la cuenta con estas automatizaciones',
    'cómo hago para que no salgan todos juntos', 'cuántos mensajes le llegan por día', 'qué pasa si no contesta',
    'hay forma de que salga solo los lunes', 'por qué no salió el segundo mensaje',
  ]) assert.equal(esPreguntaDirecta(p), true, p);
  for (const p of [
    'que no salgan todos juntos', 'cuando contesta mándale el link', 'agrega un mensaje de bienvenida', 'puedo agregar un audio al primero',
    'se puede agregar un mensaje que diga hola', 'hay que agregar un recordatorio', 'hola',
  ]) assert.equal(esPreguntaDirecta(p), false, p);
});

test('f23: lo que falta viaja del modelo (explicar y editar) al mensaje guardado, sólo en los de MaKo', () => {
  assert.equal(faltaDelModelo({ respuesta: 'x', falta: '  Configurar  el tope\nde Instagram ' }), 'Configurar el tope de Instagram');
  assert.equal(faltaDelModelo({ respuesta: 'x', falta: '   ' }), undefined);
  assert.deepEqual(deIARespuesta({ respuesta: 'Eso no está en MaKo todavía.', falta: 'Llamar por teléfono al lead' }).r,
    { respuesta: 'Eso no está en MaKo todavía.', avisos: [], falta: 'Llamar por teléfono al lead' });
  const ed = deIAEdicion({ respuesta: 'Eso no está.', falta: 'Mandar un SMS' }, [], {} as CtxIA);
  assert.equal(ed.falta, 'Mandar un SMS');
  assert.equal(ed.respuesta, 'Eso no está.');
  assert.equal(sanearMensaje({ ...msg('m1', 'mako', 'Eso no está.'), falta: ' Mandar un SMS ' })?.falta, 'Mandar un SMS');
  assert.equal(sanearMensaje({ ...msg('y1', 'yo', 'hola'), falta: 'algo' })?.falta, undefined, 'una falta en un mensaje propio');
  // Lo que se le dice al modelo: «falta» y lo que pone Meta.
  assert.match(LO_QUE_NO_ES_TARJETA, /pon en "falta" qué pidió/);
  assert.match(LO_QUE_NO_ES_TARJETA, /un DM sale sólo dentro de las 24 h del último mensaje de la persona/);
});

test('f23: el ticket sale del chat GUARDADO (la última vez que MaKo lo dijo, con lo que se le pidió antes)', () => {
  const chat = [
    msg('1', 'yo', '¿Dónde configuro el tope de Instagram?'), msg('2', 'mako', 'Eso no está en MaKo.', { falta: 'Tope de Instagram' }),
    msg('3', 'yo', 'y llamar por teléfono'), msg('4', 'mako', 'Eso tampoco.', { falta: 'Llamar por teléfono' }),
  ];
  const t = ticketDeLaFalta(chat, 'Tope de Instagram', { id: 289, nombre: 'Sprint · apertura' });
  assert.ok(t);
  assert.equal(t.titulo, 'Tope de Instagram');
  assert.equal(t.contexto.pedido, '¿Dónde configuro el tope de Instagram?');
  assert.equal(t.contexto.respuestaMako, 'Eso no está en MaKo.');
  assert.equal(t.contexto.noExiste, true);
  assert.match(t.descripcion, /«Sprint · apertura»/);
  assert.equal(ticketDeLaFalta(chat, 'Algo que MaKo nunca dijo', { id: 289, nombre: 'x' }), null, 'el navegador inventa la falta');
  assert.equal(refDeLaFalta(1, 289, 'Tope  de Instagram'), refDeLaFalta(1, 289, 'tope de instagram'), 'la misma falta, dos tickets');
  assert.notEqual(refDeLaFalta(1, 289, 'Tope de Instagram'), refDeLaFalta(1, 290, 'Tope de Instagram'));
});

test('f23: el globo de MaKo con una falta lleva «Pedírselo al equipo»; sin falta, no', () => {
  const porId = new Map([['2', { m: msg('2', 'mako', 'Eso no está en MaKo.', { falta: 'Tope de Instagram' }), i: 0 }], ['3', { m: msg('3', 'mako', 'Listo.'), i: 1 }]]);
  const { enGlobo } = hiloUnico({
    hilo: [{ id: '2' }, { id: '3' }] as never, porId: porId as never, extraPorId: new Map(), total: 2, preguntaViva: null, ultimoMako: 1,
    deshabilitado: false, trabajando: false, elegir: () => {}, tocarBurbuja: () => {}, secuenciaId: 289,
  });
  const html = (id: string) => renderToStaticMarkup(createElement(Fragment, null, enGlobo.get(id)?.abajo));
  assert.match(html('2'), /data-pedir-equipo=""[\s\S]*Pedírselo al equipo/);
  assert.doesNotMatch(html('3'), /Pedírselo al equipo/);
});

test('f23: la ruta del chat guarda la falta, y la del ticket es del mismo origen, del admin y con lo guardado', () => {
  const ruta = leer('app/api/chat-agent/secuencias/ia/route.ts');
  assert.match(ruta, /await anotar\(\[mensajeChat\('mako', respuesta, 'app', falta \? \{ falta \} : \{\}\)\]\);/);
  assert.match(ruta, /await contestar\(g\.r\.respuesta, g\.r\.falta\);/);
  const t = leer('app/api/chat-agent/secuencias/ia/falta/route.ts');
  assert.match(t, /if \(!mismo\) return json\(\{ ok: false, error: 'No salió de MaKo' \}, 403\);/);
  assert.match(t, /rol !== 'admin'\) return json\(/);
  assert.match(t, /const t = ticketDeLaFalta\(chat\.mensajes, falta, /, 'el ticket no sale del chat guardado');
  assert.match(t, /tipo: 'pedido', declaradoPor: 'persona',/);
  assert.match(t, /ref: refDeLaFalta\(ws, secuenciaId, falta\)/);
});

// El filtro «CTA» de los carruseles (lib/carruseles/cta.ts): ¿pide comentar UNA palabra? Corre el detector sobre pies con la
// forma de los que publican los dueños de negocio (los que piden «Comenta GUÍA y te la mando») y los virales que no piden
// nada, o piden opinión. Pedido de Martín del 6/11/2026: «muchos de los actuales son sólo virales».
//
// ⚠️ No son pies copiados de la base (la nube no llega a ella): tienen la FORMA de los medidos. La prueba sobre lo guardado
// la corre el Cerebro con `scripts/carruseles-biblioteca.mts cta` (en seco: cuántos y 20 de cada lado para mirar a ojo).
//
// Probado rompiéndolo (6/11/2026), base 9/0:
//   · sin `NO_SON` («tu», «abajo», «below»…) → 1 rojo («Comenta tu email y te envío la guía»);
//   · aceptar una palabra en minúsculas sin promesa → 1 rojo;
//   · aceptar el emoji sin promesa → 1 rojo;
//   · sin `todoEnMayusculas` → 1 rojo (el pie gritado);
//   · quedarse con la PRIMERA en vez de la última → 1 rojo;
//   · sin exigir «en los comentarios» a «Escribe/Deja» → 1 rojo;
//   · cortar la palabra del texto SIN tildes → 3 rojos («GUÍA» salía «GUIA»);
//   · aceptar una sola letra como palabra → 1 rojo («Comenta abajo y te envío…» daba «Y»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ctaDeTexto, ctaGuardado, rotuloCta } from '../lib/carruseles/cta';

const palabra = (t: string) => ctaDeTexto(t)?.palabra ?? null;

test('los que piden comentar una palabra, en español', () => {
  assert.equal(palabra('5 errores que te hacen perder clientes por WhatsApp.\n\nComenta GUÍA y te mando la plantilla 👇'), 'GUÍA', 'en mayúsculas, con su tilde');
  assert.equal(palabra('Si quieres el paso a paso completo, comenta «AGENDA» y te lo envío por mensaje.'), 'AGENDA');
  assert.equal(palabra('Comenta la palabra recurso para recibir el PDF gratis'), 'RECURSO', '«la palabra» la vuelve clave aunque vaya en minúsculas');
  assert.equal(palabra('Comenta "plan" y te paso mi calendario de contenido'), 'PLAN', 'entre comillas');
  assert.equal(palabra('¿Te sirvió? Coméntame CLIENTES y te regalo el guion.'), 'CLIENTES');
  assert.equal(palabra('Escribe SÍ en los comentarios y te envío la guía'), 'SÍ', '«Escribe» cuenta si dice en los comentarios');
  assert.equal(palabra('Deja un "YO" abajo 👇 y te comparto el link'), 'YO');
  assert.equal(palabra('comenta guia y te la envio'), 'GUIA', 'en minúsculas, con la promesa');
  assert.equal(palabra('Comenta 🔥 y te paso la lista completa'), '🔥', 'un emoji, con la promesa');
});

test('los que piden comentar una palabra, en inglés (las cuentas de la lista escriben así)', () => {
  assert.equal(palabra('7 hooks that stop the scroll.\nComment "HOOKS" and I\'ll send you all 50.'), 'HOOKS');
  assert.equal(palabra('Want my exact template? Comment the word SYSTEM to get it'), 'SYSTEM');
  assert.equal(palabra('Comment AI below 👇'), 'AI');
  assert.equal(palabra("Drop 'LIST' in the comments"), 'LIST');
});

test('por mensaje: va con la vía «mensaje»', () => {
  assert.deepEqual(ctaDeTexto('Escríbeme CITA por DM y agendamos'), { palabra: 'CITA', via: 'mensaje' });
  assert.deepEqual(ctaDeTexto('DM me "GROW" for the free training'), { palabra: 'GROW', via: 'mensaje' });
  assert.deepEqual(ctaDeTexto('Mándame un mensaje con la palabra ASESORÍA y te cuento cómo trabajamos'), { palabra: 'ASESORÍA', via: 'mensaje' });
  assert.deepEqual(ctaDeTexto('Comenta GUÍA y te la mando'), { palabra: 'GUÍA', via: 'comentario' });
});

test('los virales y los que piden opinión NO cuentan', () => {
  assert.equal(palabra('Comenta tu opinión 👇'), null);
  assert.equal(palabra('Comenta abajo qué piensas'), null);
  assert.equal(palabra('What do you think? Comment below'), null);
  assert.equal(palabra('Comment your thoughts'), null);
  assert.equal(palabra('Comenta 🔥 si te sirvió'), null, 'un emoji sin promesa es interacción, no una palabra clave');
  assert.equal(palabra('comenta yo si te pasó'), null, 'una palabra en minúsculas sin promesa no se adivina');
  assert.equal(palabra('Guárdalo para después 📌'), null);
  assert.equal(palabra('Link en la bio'), null);
  assert.equal(palabra('Anytime now….'), null);
  assert.equal(palabra('Hoy cumplí 30 años. Gracias por los comentarios.'), null, '«comentarios» no es «comenta»');
  assert.equal(palabra('Escribe tu meta del mes'), null, '«Escribe» sin «en los comentarios» no es el embudo');
  assert.equal(palabra('Escribe HOY tu meta del mes en una hoja'), null, 'aunque la palabra vaya en mayúsculas');
  assert.equal(palabra('Comenta tu email y te envío la guía'), null, '«tu» no es una palabra clave, aunque venga la promesa');
  assert.equal(palabra('Comenta abajo y te envío el link'), null, 'una letra suelta («y») tampoco');
});

test('un pie gritado: la mayúscula sola no dice nada', () => {
  assert.equal(palabra('COMENTA TU OPINIÓN SOBRE ESTE TEMA AQUÍ ABAJO'), null);
  assert.equal(palabra('COMENTA ESTO SI TE SIRVIÓ, Y COMPARTE CON UN AMIGO'), null);
  assert.equal(palabra('COMENTA "GUIA" Y TE LA MANDO AL PRIVADO'), 'GUIA', 'entre comillas sí');
});

test('gana la última: el pedido va al final del pie', () => {
  assert.equal(palabra('Si te perdiste la parte 1, comenta PARTE1.\n\nPara esta, comenta PLANTILLA y te la paso'), 'PLANTILLA');
  assert.equal(palabra('Ayer alguien me comentó LISTA en otro post'), null, '«comentó» (pasado) no pide nada');
});

test('vacío o nada: null', () => {
  assert.equal(ctaDeTexto(null), null);
  assert.equal(ctaDeTexto(''), null);
  assert.equal(ctaDeTexto('   '), null);
});

test('el rótulo de la tarjeta y lo guardado en la base', () => {
  assert.equal(rotuloCta({ palabra: 'GUÍA', via: 'comentario' }), 'Comenta «GUÍA»');
  assert.equal(rotuloCta({ palabra: 'CITA', via: 'mensaje' }), 'Por mensaje: «CITA»');
  assert.deepEqual(ctaGuardado('GUÍA', 'mensaje'), { palabra: 'GUÍA', via: 'mensaje' });
  assert.deepEqual(ctaGuardado('GUÍA', 'otra cosa'), { palabra: 'GUÍA', via: 'comentario' });
  assert.equal(ctaGuardado('', 'comentario'), null);
  assert.equal(ctaGuardado(null, null), null);
});

test('una palabra larga o rara no rompe nada', () => {
  assert.equal(palabra('Comenta "ESTRATEGIA2026" y te paso el calendario'), 'ESTRATEGIA2026');
  assert.equal(palabra(`${'texto '.repeat(400)} Comenta GUÍA y te la mando`), 'GUÍA');
});

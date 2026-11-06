// Las variaciones del Ganador que faltaban a Thiago (docs/promesas/2910-llamada-thiago.md, [33:00]): la de BOTÓN (el CTA) y los
// hooks para filmar con el avatar. Corre las funciones puras de verdad: lib/media-buyer/variacion-boton.ts y hooks-guion.ts.
//
// Lo que fija:
//   · el botón alternativo sale SÓLO entre los que sirven para el mismo destino (con formulario no se propone Comprar ni
//     Reservar), y los botones atados al destino (WhatsApp, sin botón) y el botón que no se pudo leer no se varían;
//   · la variación de botón conserva el texto entero (un test que cambia dos cosas no dice cuál ganó) y dice qué botón prueba;
//   · el lanzamiento le pasa el botón a Zernio (`callToAction`), y la variación de botón no se lleva al Video Generator;
//   · el gancho de un guion de hook es SÓLO lo de GANCHO (lo que dice el avatar en una toma), y AI Avatar ofrece los hooks
//     sin filmar, del más nuevo al más viejo.
//
// Probado rompiéndolo (6/11/2026), base 9/0:
//   · la tabla CON_FORMULARIO reemplazada por la de A_UNA_PAGINA → 2 fallos, 7 pases;
//   · `ganchoDeGuion` devolviendo el guion entero → 2 fallos, 7 pases;
//   · `hooksParaAvatar` sin el filtro de borrador → 1 fallo, 8 pases.
//   (Sacar el salteo de WHATSAPP_MESSAGE deja 9/0: ese botón no está en ninguna tabla, así que la salida es la misma. La línea
//   queda por si alguien lo suma a una tabla: el test de «lo que ata el destino» lo agarraría ahí.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { botonAlternativo, variacionDeBoton, esVariacionDeBoton, NOMBRE_BOTON } from '../lib/media-buyer/variacion-boton';
import { ganchoDeGuion, guionDeHook, hooksParaAvatar, CELDA_HOOKS } from '../lib/media-buyer/hooks-guion';
import { cuerpoCambiarTextos } from '../lib/zernio-ads-cuerpo';

test('con formulario instantáneo, el botón alternativo es otro de «déjame tus datos», nunca Comprar ni Reservar', () => {
  assert.equal(botonAlternativo('SIGN_UP', true), 'APPLY_NOW');
  assert.equal(botonAlternativo('APPLY_NOW', true), 'SIGN_UP');
  assert.equal(botonAlternativo('LEARN_MORE', true), 'SIGN_UP');
  for (const a of ['SIGN_UP', 'APPLY_NOW', 'LEARN_MORE', 'GET_QUOTE', 'SUBSCRIBE', 'DOWNLOAD']) {
    assert.ok(!['SHOP_NOW', 'BOOK_NOW'].includes(botonAlternativo(a, true) ?? ''), `con formulario, ${a} no puede pasar a vender o agendar`);
  }
  // Un formulario con «Reservar» no se toca: no hay un par que diga lo mismo.
  assert.equal(botonAlternativo('BOOK_NOW', true), null);
});

test('a una página: «Más información» contra el botón que pide la acción', () => {
  assert.equal(botonAlternativo('LEARN_MORE', false), 'SIGN_UP');
  assert.equal(botonAlternativo('SHOP_NOW', false), 'LEARN_MORE');
  assert.equal(botonAlternativo('BOOK_NOW', false), 'LEARN_MORE');
});

test('lo que ata el destino no se varía, y sin saber el botón de hoy tampoco', () => {
  assert.equal(botonAlternativo('WHATSAPP_MESSAGE', false), null);
  assert.equal(botonAlternativo('NO_BUTTON', false), null);
  assert.equal(botonAlternativo(null, false), null);
  assert.equal(botonAlternativo('', true), null);
});

test('la variación de botón conserva el texto entero y dice qué botón prueba', () => {
  const v = variacionDeBoton({ textoPrincipal: 'Agenda tu diagnóstico gratis.', titulo: 'Diagnóstico', cta: 'LEARN_MORE', conFormulario: false }, '120');
  assert.ok(v);
  assert.equal(v.textoPrincipal, 'Agenda tu diagnóstico gratis.');
  assert.equal(v.titulo, 'Diagnóstico');
  assert.equal(v.cta, 'SIGN_UP');
  assert.equal(v.id, '120-boton');
  assert.ok(v.gancho?.includes(NOMBRE_BOTON.SIGN_UP) && v.gancho.includes(NOMBRE_BOTON.LEARN_MORE), 'la pantalla dibuja el gancho: tiene que decir los dos botones');
  assert.equal(esVariacionDeBoton(v), true);
  // Sin texto que conservar no hay copia: saldría vacía.
  assert.equal(variacionDeBoton({ textoPrincipal: '  ', titulo: null, cta: 'LEARN_MORE', conFormulario: false }, '120'), null);
});

test('el botón viaja a Zernio como `callToAction` del creativo de la copia', () => {
  assert.deepEqual(cuerpoCambiarTextos({ primary_text: 'Hola', cta_type: 'APPLY_NOW' }), { creative: { body: 'Hola', callToAction: 'APPLY_NOW' } });
  // El cableado: el lanzamiento pasa `v.cta`, y el Video Generator no recibe la variación de botón.
  const ejecutar = readFileSync('lib/media-buyer/ejecutar.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(ejecutar, /\.\.\.\(v\.cta \? \{ cta_type: v\.cta \} : \{\}\)/);
  const hooks = readFileSync('lib/media-buyer/hooks-video.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(hooks, /!esVariacionDeBoton\(v\)/);
  const prep = readFileSync('lib/media-buyer/variaciones.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(prep, /variacionDeBoton\(textos, adId\)/, 'la variación de botón se suma a las de la IA');
});

test('el gancho de un guion de hook es SÓLO lo de GANCHO: lo que dice el avatar en una toma', () => {
  const g = guionDeHook('El 60% de tus leads se enfría en una hora.', 'Antes de pautar mira esto. Te cuento cómo lo resolvimos.');
  assert.equal(ganchoDeGuion(g), 'El 60% de tus leads se enfría en una hora.');
  assert.equal(ganchoDeGuion('GANCHO\nMira esto antes de pautar.'), 'Mira esto antes de pautar.');
  assert.equal(ganchoDeGuion('Una frase sin rótulos.'), 'Una frase sin rótulos.');
  assert.equal(ganchoDeGuion('GANCHO\r\nCon CRLF.\r\n\r\nHISTORIA\r\nEl cuerpo.'), 'Con CRLF.');
});

test('AI Avatar ofrece los hooks sin filmar del Media Buyer, del más nuevo al más viejo', () => {
  const celdas = [
    { id: 'otra', guiones: [{ id: 'x', texto: 'GANCHO\nNo es del Media Buyer.', estado: 'borrador', creadoEn: 9 }] },
    {
      id: CELDA_HOOKS,
      guiones: [
        { id: 'viejo', texto: 'GANCHO\nEl viejo.\n\nHISTORIA\nCuerpo.', anguloNombre: 'Hook nuevo de «Anuncio A»', estado: 'borrador', creadoEn: 1 },
        { id: 'nuevo', texto: 'GANCHO\nEl nuevo.', anguloNombre: 'Hook nuevo de «Anuncio B»', estado: 'borrador', creadoEn: 5 },
        { id: 'hecho', texto: 'GANCHO\nYa filmado.', estado: 'grabado', creadoEn: 7 },
      ],
    },
  ];
  assert.deepEqual(hooksParaAvatar(celdas), [
    { id: 'nuevo', gancho: 'El nuevo.', de: '«Anuncio B»' },
    { id: 'viejo', gancho: 'El viejo.', de: '«Anuncio A»' },
  ]);
  assert.deepEqual(hooksParaAvatar([]), []);
});

test('el estudio de AI Avatar recibe los hooks y los ofrece como «lo que dice tu avatar»', () => {
  const acciones = readFileSync('app/ai-avatar/actions.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(acciones, /hooks: hooksParaAvatar\(celdas\)/);
  const estudio = readFileSync('app/ai-avatar/Estudio.tsx', 'utf8').replace(/\r\n/g, '\n');
  assert.match(estudio, /onClick=\{\(\) => \{ setGuion\(h\.gancho\); setMenuHooks\(false\); \}\}/);
});

test('el estado de una variación de botón sobrevive: el tipo la guarda en `cta`', () => {
  const v = variacionDeBoton({ textoPrincipal: 'Texto', titulo: null, cta: 'SIGN_UP', conFormulario: true }, 'a');
  // Lo que se guarda en la decisión es el objeto tal cual (store.ts guarda `variaciones` como jsonb).
  assert.deepEqual(JSON.parse(JSON.stringify(v)), { id: 'a-boton', gancho: 'Mismo texto, botón «Solicitar ahora» (hoy: «Registrarte»)', textoPrincipal: 'Texto', cta: 'APPLY_NOW', elegida: true });
});

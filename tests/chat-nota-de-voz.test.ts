// =============================================================================
// El micrófono de un chat graba una nota de voz, y la onda sigue lo que escucha (24/10/2026)
// =============================================================================
// Martín, por el Cerebro: «es mejor que esa funcionalidad [el dictado] la saquemos de todos lados, que sólo se quede en
// lugares muy específicos, pero en chats o en los chats de MaKo que se grabe el audio y se envíe directamente». Y: «la
// animación de ondas de grabando audios no sigue lo que está escuchando, es decir, es sólo una animación predefinida».
// El diseño: docs/diseno-chats-de-mako.md → «El micrófono de un chat graba una nota de voz».
//   1. lo transcrito se manda recién cuando la caja lo tiene (`listaParaMandar`), y una nota vacía o fallida no sale;
//   2. TODA caja de chat graba: con `voz` la manda la pantalla; sin `voz`, se pasa a MP3, se transcribe y sale el texto;
//   3. el «Nuevo chat» del Ops Center graba igual, y ya no dicta;
//   4. la onda sin micrófono que escuchar queda QUIETA, y los anillos que latían siempre igual se fueron;
//   5. el dictado queda sólo donde se escribe un texto: el alta de una tarea, el guion de Copywriting, la nota de un lead;
//   6. la transcripción de una nota de chat se anota con su motivo, no como «Dictar una tarea del plan».
//
// Correr: node --import tsx --test tests/chat-nota-de-voz.test.ts
// Probado rompiéndolo (24/10/2026, con la base en 0 fallos):
//   · `listaParaMandar` que manda con la caja todavía vacía               → 1 fallo (1);
//   · la caja sin `voz` de vuelta a `grabacion={null}` (el micrófono dicta) → 1 fallo (2);
//   · transcribir el webm sin pasarlo a MP3                                 → 1 fallo (2);
//   · el «Nuevo chat» con el `BotonMandar` que dicta sin nada escrito       → 1 fallo (3; desde el 28/10/2026, su caja con `voz`);
//   · la onda sin micrófono con `animation: mako-wave`                      → 1 fallo (4);
//   · el anillo `co-escucha` de vuelta en el micrófono                      → 1 fallo (4).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { listaParaMandar, textoDeLaNota } from '../app/_chat/nota-que-se-manda';
import { BarraGrabacion, ESTADO_VOZ_INICIAL, type EstadoVoz, type GrabacionVoz } from '../app/whatsapp/_shared/VoiceRecorder';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. lo transcrito se manda recién cuando la caja lo tiene, y una nota vacía o fallida no sale', () => {
  assert.equal(listaParaMandar(null, 'hola'), false, 'sin nota pendiente, nada');
  assert.equal(listaParaMandar('Revisá el pago de María', ''), false, 'la pantalla todavía no puso el texto: esperar');
  assert.equal(listaParaMandar('Revisá el pago de María', 'Revisá el pago de María'), true);
  assert.equal(listaParaMandar(' Revisá el pago ', 'Revisá el pago'), true, 'los espacios de las puntas no cuentan');
  assert.equal(listaParaMandar('Revisá el pago', 'Otra cosa'), false, 'la caja dice otra cosa: no se manda lo de la nota');
  assert.equal(listaParaMandar('   ', '   '), false, 'una nota vacía no sale');
  assert.deepEqual(textoDeLaNota({ ok: true, texto: '  fijate el CRM  ' }), { texto: 'fijate el CRM' });
  assert.ok('error' in textoDeLaNota({ ok: true, texto: '  ' }), 'nada escuchado: se dice, no se manda vacío');
  assert.deepEqual(textoDeLaNota({ ok: false, error: 'La transcripción tardó demasiado.' }), { error: 'La transcripción tardó demasiado.' });
});

test('2. toda caja de chat graba: con `voz` la manda la pantalla; sin `voz`, se transcribe y sale el texto', () => {
  const c = sinComentarios(leer('app/_chat/CajaChat.tsx'));
  assert.match(c, /return p\.voz \? <CajaConVoz \{\.\.\.p\} voz=\{p\.voz\} \/> : <CajaConNota \{\.\.\.p\} \/>;/);
  assert.doesNotMatch(c, /grabacion=\{null\}/, 'ninguna caja sin grabación: el micrófono ya no dicta en un chat');
  assert.match(c, /const nota = useNotaQueSeManda\(\{ texto: p\.texto, onTexto: p\.onTexto, onMandar: p\.onMandar, onError: p\.onErrorMic, onNota: p\.onNota, onGrabada: p\.onGrabada \}\);/,
    'manda con el `onMandar` de la pantalla (el Ops Center lo firma en el dispositivo)');
  assert.match(c, /const enviando = !!p\.enviando \|\| transcribiendo \|\| leidos\.leyendo;/, 'mientras se pasa a texto, la caja está saliendo');
  // Con «Reportar a Soporte» desde el 24/10/2026: un error es un aviso (tests/reportar-a-soporte.test.ts).
  assert.match(c, /\{nota\?\.error && !p\.onErrorMic && <p className="co-caja__estado" role="alert">\{nota\.error\}<ReportarASoporte \/><\/p>\}/, 'si no salió, se dice');

  const n = sinComentarios(leer('app/_chat/nota-que-se-manda.ts'));
  assert.match(n, /mp3 = await notaEnMp3\(blob\);[\s\S]{0,200}?transcribirNota\(mp3, 300_000, 'chat'\)/, 'MP3 antes de transcribir: el webm de Chrome no lo toma');
  assert.match(n, /if \(listaParaMandar\(pendiente, texto\)\) \{ setPendiente\(null\); mandar\.current\(\); \}/);
  assert.match(n, /if \('error' in r\) \{ decir\(r\.error\); return; \}/, 'una nota fallida no pone nada en la caja');
});

test('3. el «Nuevo chat» del Ops Center graba igual, y ya no dicta', () => {
  // Desde el 28/10/2026 su caja es la ÚNICA (CajaChat, CajaChatNuevo.tsx): sin `voz`, el micrófono GRABA y la nota sale en el
  // acto (`onGrabada`). Que la caja única grabe sin nada escrito lo fija el (2).
  const c = sinComentarios(leer('app/admin/operaciones/CajaChatNuevo.tsx'));
  assert.match(c, /<CajaChat texto=\{n\.texto\} onTexto=\{n\.setTexto\} onMandar=\{\(\) => void n\.mandar\(\)\} onGrabada=\{n\.mandarNota\}/);
  assert.doesNotMatch(c, /\bvoz=\{|useNotaQueSeManda|BotonMandar/, 'ni un micrófono propio ni el botón que dicta');
});

test('4. la onda sin micrófono que escuchar queda QUIETA, y los anillos que latían siempre igual se fueron', () => {
  const voz = (e: Partial<EstadoVoz>): GrabacionVoz => ({
    ...ESTADO_VOZ_INICIAL, ...e,
    start: async () => {}, revisarExistente: async () => {}, terminar: () => {}, seguir: async () => {}, enviar: async () => {}, descartar: () => {}, pause: () => {}, resume: () => {},
  });
  const html = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando', secs: 3 }) }));
  const barras = html.match(/<span data-barra="true" style="[^"]*"/g) ?? [];
  assert.ok(barras.length > 0, 'la onda se dibuja');
  for (const b of barras) {
    assert.doesNotMatch(b, /animation/, 'una barra animada sin sonido dice que entra voz cuando no se sabe');
    assert.match(b, /transform:scaleY\(0\.12\)/, 'en el piso: una línea');
  }
  const centro = sinComentarios(leer('app/admin/operaciones/centro.css'));
  assert.doesNotMatch(centro, /co-escucha/, 'el anillo que latía alrededor del micrófono');
  assert.doesNotMatch(sinComentarios(leer('app/m/copywriting/copywriting.css')), /m-copywriting-escucha/);
});

test('5. el dictado queda sólo donde se escribe un texto', () => {
  // El alta de una tarea del Plan, el guion de Copywriting (teléfono) y la nota de un lead (ficha del teléfono).
  assert.match(leer('app/plan/board/CrearTareaModal.tsx'), /useDictar\(valor, onValor, onError\)/);
  assert.match(leer('app/m/copywriting/AnalizarM.tsx'), /useDictar\(guion, onGuion/);
  assert.match(leer('app/m/crm/[id]/FichaLead.tsx'), /useDictadoVivo\(/);
  // Y ninguna caja de chat lo usa directo: el único camino del dictado en la caja era BotonMandar sin `grabacion`.
  assert.doesNotMatch(sinComentarios(leer('app/_chat/CajaChat.tsx')), /useDictar|useDictadoVivo/);
});

test('6. la transcripción de una nota de chat se anota con su motivo', () => {
  assert.match(leer('app/_components/transcribir-nota.ts'), /if \(para\) fd\.append\('para', para\);/);
  const r = leer('app/api/plan-dictado/route.ts');
  assert.match(r, /const motivo = form\.get\('para'\) === 'chat' \? 'Nota de voz de un chat' : 'Dictar una tarea del plan';/);
  // 12/11/2026: con `notaDeVozCorta` (Groq primero: de 11 a ~105 s medidos con Gemini primero; tests/stt-red.test.ts).
  assert.match(r, /transcribirAudio\(base64, file\.type \|\| 'audio\/webm', \{ motivo, pii: true(, notaDeVozCorta: true)? \}\)/, 'sigue siendo un dato de un cliente (`pii`)');
});

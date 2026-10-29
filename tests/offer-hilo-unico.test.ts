// =============================================================================
// Offer y el onboarding con el hilo y la caja del Ops Center (22/10/2026, OF4)
// =============================================================================
// Martín, 18/10: «un solo chat en toda la app»; el 20/10: «Te pedí que unificaras el chat del Ops Center en todos lados, su
// diseño y funcionalidades... Y en el onboarding y en otros lugares el chat sigue siendo diferente». ChatOffer (la tab y el
// onboarding) dibujaba el hilo y la barra de WhatsApp; ahora dibuja HiloMako y CajaChat, y el teléfono (ComposerOfferM) la
// caja única. Esto los DIBUJA en node (la caja trae su .css: un gancho de carga lo deja vacío) y mira lo que sale:
//   1. el hilo es el del Ops Center, con lo de Offer en su hueco: el PDF ARRIBA del texto de MaKo, las tarjetas del onboarding
//      DEBAJO, y los documentos del dueño con su nota y sin «No pude abrir el archivo.»;
//   2. las respuestas rápidas son las de Offer («Armar mi oferta» en dorado) y no se repiten como una pregunta del hilo;
//   3. la espera: los tres puntitos o «Analizando tu link», nunca «Trabajando…»; lo del dueño en camino, «Enviando…»;
//   4. la caja es la única, con la nota de voz (el micrófono GRABA), en la computadora y en el teléfono, y el teléfono toma
//      el .zip.
//
// PROBADO ROMPIÉNDOLO (22/10/2026, romper-of4.mjs del scratchpad de la sesión, con los 10 tests de Offer y la caja; base 67/0,
// 13 de 13 cazadas): la tab con su propia caja → 4 fallos · el hilo sin `enMensaje` → 2 · sin lo de abajo (las tarjetas) → 1 ·
// las opciones también como pregunta del hilo → 1 · «Trabajando…» en la espera → 2 · lo del dueño sin «Enviando…» → 1 ·
// `itemsDeOffer` sin `sinAbrir` → 2 · la ficha que ignora `sinAbrir` → 1 · la ficha sin la nota de Offer → 1 · el teléfono sin
// el .zip → 1 · el teléfono sin la fila de la caja del Ops Center → 1 · el arranque que adjunta con sólo texto → 1 · la caja
// sin `key` por conversación → 2. Y (el caso de uso a 390 px, mismo día) las opciones fijas arriba de la caja → 1 · la página
// sin descontar la barra de arriba → 2 · la caja sin el color del ▶ → 1 · la barra que ignora `colorPlay` → 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import type { ReactNode } from 'react';

// `registerHooks` existe desde Node 22.15 (CI corre 24), pero @types/node 20 todavía no lo declara: se tipa acá.
type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({
  load(url, ctx, next) {
    if (/\.css($|\?)/.test(url)) return { format: 'commonjs', source: '', shortCircuit: true };
    return next(url, ctx);
  },
});

const sinDibujos = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, '');

async function dibujarChat(p: Record<string, unknown> = {}): Promise<string> {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ChatOffer } = await import('../app/offer/ChatOffer');
  const sesion = {
    id: 7, titulo: 'Sprint 3 días', estado: 'abierta', piezas: {}, docs: [], puedeConcluir: true, funnelId: 1,
    mensajes: [
      { id: 'm1', de: 'mako', texto: 'Hola, ¿qué vendes?', at: '2026-10-22T10:00:00Z' },
      { id: 'y1', de: 'yo', texto: 'Un sprint', at: '2026-10-22T10:01:00Z',
        adjuntos: [{ id: 'd1', nombre: 'landing.zip', via: 'zip', chars: 10, aviso: 'Leí 3 de 4 archivos' }] },
      { id: 'm2', de: 'mako', texto: 'Listo, tu oferta.', at: '2026-10-22T10:02:00Z', pdf: { version: 2 }, opciones: ['Armar mi oferta', 'Otra cosa'] },
    ],
  };
  const props = {
    sesion, pendiente: null, respondiendo: false, opcionArmar: 'Armar mi oferta', opcionActualizar: 'Actualizar el PDF',
    opcionesHabilitadas: true, onOpcion: () => {}, onReintentar: null, onArchivos: () => {}, ocupado: false, error: null, onError: () => {},
    onVerOferta: () => {},
    caja: { texto: '', onTexto: () => {}, onMandar: () => {}, placeholder: 'Escríbele a MaKo', voz: { onAudio: () => {} },
      adjuntos: { items: [], puede: true, onSumar: () => {}, onQuitar: () => {}, accept: '.pdf,.zip' } },
    ...p,
  };
  return sinDibujos(renderToStaticMarkup(createElement(ChatOffer as unknown as (x: typeof props) => ReactNode, props)));
}

test('1. el hilo del Ops Center, con lo de Offer en su hueco', async () => {
  const html = await dibujarChat({ extra: (m: { id: string }) => (m.id === 'm2' ? 'TARJETA-DEL-ONBOARDING' : null) });
  assert.match(html, /<div class="co-hilo"><div class="co-hilo__col">/, 'el hilo del Ops Center');
  // (24/10/2026, P5: el hilo trae el menú del mensaje aunque Offer no le pase el suyo: cada fila lleva el envoltorio de
  // WhatsApp, `co-wa`, con su botón de opciones. app/_chat/HiloMako.tsx, `MenuDelMensaje`.)
  assert.match(html, /<div id="co-msg-t-of-y1" class="co-yo co-wa co-wa--yo">/, 'lo del dueño, a la derecha (FilaMia), con el menú del mensaje');
  assert.match(html, /<div id="co-msg-t-of-m2" class="co-el-wa co-wa">/, 'lo de MaKo, con su criatura (FilaDelChat), con el menú del mensaje');
  assert.match(html.slice(html.indexOf('id="co-msg-t-of-m2"')), /^[^]*?<div class="co-el">/);
  assert.match(html, /aria-label="Opciones del mensaje"/, 'el botón del menú (el clic derecho abre lo mismo)');
  const m2 = html.slice(html.indexOf('id="co-msg-t-of-m2"'));
  const iPdf = m2.indexOf('aria-label="Descargar el PDF de tu oferta, versión 2"');
  const iTexto = m2.indexOf('Listo, tu oferta.');
  const iTarjeta = m2.indexOf('TARJETA-DEL-ONBOARDING');
  assert.ok(iPdf > 0 && iPdf < iTexto, 'el PDF de la versión, ARRIBA del texto de MaKo');
  assert.ok(m2.indexOf('Ver mi oferta') > iPdf && m2.indexOf('Ver mi oferta') < iTexto, '«Ver mi oferta» con su PDF');
  assert.ok(iTarjeta > iTexto, 'las tarjetas del onboarding, DEBAJO del texto');
  // Los documentos del dueño: su nombre y lo que dijo Offer al leerlos; Offer no guarda un link para abrirlos.
  assert.match(html, /<span class="ch-archivo__nombre">landing\.zip<\/span><span class="ch-archivo__nota">Leí 3 de 4 archivos<\/span>/);
  assert.doesNotMatch(html, /No pude abrir el archivo/, 'un documento de Offer dice que no se pudo abrir');
});

test('2. las respuestas rápidas son las de Offer, y no se repiten en el hilo', async () => {
  const html = await dibujarChat();
  assert.match(html, /<button type="button" class="of-pill of-pill--mako">Armar mi oferta<\/button>/, '«Armar mi oferta» en dorado');
  assert.equal(html.split('Otra cosa').length - 1, 1, 'la opción sale dos veces: como pastilla y como pregunta del hilo');
  assert.ok(html.indexOf('class="of-rapidas"') > html.indexOf('id="co-msg-t-of-m2"'), 'van debajo del último mensaje');
  // ADENTRO del hilo, y se desplazan con él (22/10/2026, el caso de uso a 390 px: fijas arriba de la caja, cuatro opciones
  // largas ocupaban 250 px y la conversación quedaba en 240).
  const tramo = html.slice(html.indexOf('<div class="co-hilo">'), html.indexOf('class="of-rapidas"'));
  const abiertos = (tramo.match(/<div\b/g) ?? []).length - (tramo.match(/<\/div>/g) ?? []).length;
  assert.ok(abiertos >= 2, 'las opciones quedaron fuera del hilo (fijas arriba de la caja)');
});

test('3. la espera: los puntitos o «Analizando», nunca «Trabajando…»; lo que sale, «Enviando…»', async () => {
  const pendiente = { id: 'p1', de: 'yo', texto: 'mi web es https://acme.com', at: '2026-10-22T10:03:00Z' };
  const contestando = await dibujarChat({ respondiendo: true, fuente: 'tu respuesta', pendiente });
  assert.match(contestando, /<span role="status" aria-label="MaKo está escribiendo" class="of-escribiendo"><i><\/i><i><\/i><i><\/i><\/span>/);
  assert.match(contestando, /Enviando…/, 'lo del dueño en camino');
  const leyendo = await dibujarChat({ respondiendo: true, fuente: 'tu link', pendiente });
  assert.match(leyendo, /<span role="status" class="of-analizando">Analizando tu link<span class="of-puntos"/);
  for (const h of [contestando, leyendo]) assert.doesNotMatch(h, /Trabajando/, 'Martín pidió sólo los puntitos (18/10)');
});

test('4. la caja única con la nota de voz, en la computadora y en el teléfono', async () => {
  const html = await dibujarChat();
  assert.match(html, /<div class="co-caja-wrap" style="--good:var\(--ink\);--sobre-good:var\(--surface\)"><div class="co-caja"><div class="co-caja__fila"[^>]*>/);
  assert.match(html, /aria-label="Grabar una nota de voz"/, 'sin nada escrito, el micrófono GRABA');
  assert.doesNotMatch(html, /wa-composer|Escribe un mensaje…/, 'volvió la barra de WhatsApp');

  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ComposerOfferM } = await import('../app/m/offer/ComposerOfferM');
  let elegidos: File[] = [];
  const movil = sinDibujos(renderToStaticMarkup(createElement(ComposerOfferM, {
    texto: '', onTexto: () => {}, onEnviar: () => {}, ocupado: false, enLinea: true, onArchivos: (f: File[]) => { elegidos = f; },
    puedeAdjuntar: true, onAudio: () => {}, audioEnEspera: null, onReenviarAudio: () => {}, onDescartarAudio: () => {},
    onError: () => {}, onAltura: () => {},
  })));
  assert.match(movil, /<div class="m-operaciones-caja"><div class="m-operaciones-caja__fila"[^>]*>/, 'la fila de la caja del teléfono del Ops Center');
  assert.match(movil, /aria-label="Grabar una nota de voz"/);
  assert.doesNotMatch(movil, /m-offer-campo|m-offer-mic/, 'volvió la caja propia del teléfono');
  // El «+» (Documento) toma lo que Offer lee y el .zip de una carpeta, como la computadora (hasta el 22/10 el teléfono no).
  const documento = movil.match(/<div class="co-mas-caja">[\s\S]*?<input type="file" accept="([^"]*)"/)?.[1] ?? '';
  assert.match(documento, /\.pdf/);
  assert.match(documento, /,\.zip$/, 'el teléfono no deja elegir el .zip de la landing');
  assert.deepEqual(elegidos, []);
});

test('5. la pantalla de Offer descuenta la barra de arriba, y la caja no queda debajo del borde', async () => {
  // La barra de «Estás viendo el dashboard de…» (50 px) o la alerta de la voz de MaKo caída (64 px, la ve un cliente):
  // `--barra-agencia`. La regla global de app/globals.css sólo toca un alto en línea que EMPIEZA con `height: 100dvh`.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  // Desde el 29/10/2026 la página usa `ESTILO_PAGINA_CREAR` (app/_crear/reglas.ts), el de toda pantalla de Create.
  const pagina = readFileSync(join(__dirname, '..', 'app/offer/page.tsx'), 'utf8');
  assert.match(pagina, /<Pagina ancho="completo" densidad="compacta" style=\{ESTILO_PAGINA_CREAR\}>/);
  const reglas = readFileSync(join(__dirname, '..', 'app/_crear/reglas.ts'), 'utf8');
  assert.match(reglas, /height: 'calc\(100dvh - var\(--alto-secciones, 0px\) - var\(--barra-agencia, 0px\)\)'/,
    'con la barra de arriba la página queda más alta que la ventana (medido el 22/10/2026: 50 px)');
});

test('6. el ▶ de escuchar la nota de voz va con el color de MaKo, no con el verde de WhatsApp', async () => {
  // 22/10/2026 (el caso de uso de OF4): el ✓ y la ➤ ya iban en el negro del Ops Center (SIN_VERDE) y el ▶ seguía verde,
  // porque `AudioPlay` trae `--wa` por defecto. La caja única le pasa `--primary`, el de la nota ya mandada en el hilo.
  const pendiente = { url: 'blob:nota', secs: 12, onBorrar: () => {}, onDejar: () => {} };
  const html = await dibujarChat({ caja: { texto: '', onTexto: () => {}, onMandar: () => {}, placeholder: 'Escríbele a MaKo', voz: { onAudio: () => {}, pendiente } } });
  const barra = html.slice(html.indexOf('data-barra-voz="revisando"'));
  assert.ok(barra.length < html.length, 'no se dibujó la barra de escuchar la nota que no salió');
  assert.match(barra, /background:var\(--primary\)/, 'el ▶ de la caja de MaKo');
  assert.doesNotMatch(barra.slice(0, barra.indexOf('Enviar audio')), /var\(--wa\)/, 'volvió el verde de WhatsApp');

  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ComposerOfferM } = await import('../app/m/offer/ComposerOfferM');
  const movil = renderToStaticMarkup(createElement(ComposerOfferM, {
    texto: '', onTexto: () => {}, onEnviar: () => {}, ocupado: false, enLinea: true, onArchivos: () => {}, puedeAdjuntar: true,
    onAudio: () => {}, audioEnEspera: { url: 'blob:nota', secs: 12 }, onReenviarAudio: () => {}, onDescartarAudio: () => {},
    onError: () => {}, onAltura: () => {},
  }));
  assert.match(movil.slice(movil.indexOf('data-barra-voz="revisando"')), /background:var\(--primary\)/, 'el ▶ en el teléfono');
});

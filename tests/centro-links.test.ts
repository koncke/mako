// =============================================================================
// Un link pegado en el chat siempre se ve azul y clickeable, en la caja y en los mensajes (17/10/2026)
// =============================================================================
// Martín, en el relevo del Ops Center: «un link pegado en el chat siempre se ve azul y clickeable, en la caja y en los
// mensajes». Lo que se fija (lib/links-texto.ts, app/admin/operaciones/ConLinks.tsx, el Markdown con `enlaces`):
//   1. qué es un link: http(s) suelto o `[texto](url)`; el punto o el paréntesis que cierran la frase no son parte;
//      `javascript:` nunca;
//   2. los mensajes: lo de Martín y lo del chat llevan sus links como <a>; el Markdown de los OTROS chats de MaKo no cambia;
//   3. la caja: con un link, la capa azul y su chip; sin links, la caja de siempre.
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · sin recortar la puntuación del final → 1 fallo (1);
//   · el Markdown con `enlaces` prendido por defecto → 1 fallo (2: «los demás chats no cambian»);
//   · la caja del teléfono sin `ResalteDeLinks` → 1 fallo (3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { linksDe, rotuloDeLink, trozosConLinks } from '../lib/links-texto';
import { Hilo } from '../app/admin/operaciones/Hilo';
import { Markdown } from '../app/_components/Markdown';
import type { LineaChat } from '../lib/centro-chats';

test('1. qué es un link, y qué no', () => {
  assert.deepEqual(trozosConLinks('Mirá https://hola-mako.com/crm?lead=12.'), [
    { tipo: 'texto', t: 'Mirá ' }, { tipo: 'link', t: 'https://hola-mako.com/crm?lead=12', href: 'https://hola-mako.com/crm?lead=12' }, { tipo: 'texto', t: '.' },
  ], 'el punto del final cierra la frase');
  assert.deepEqual(trozosConLinks('el [detalle](https://x.com/a) acá').map((x) => x.tipo === 'link' ? [x.t, x.href] : x.t), ['el ', ['detalle', 'https://x.com/a'], ' acá']);
  assert.equal(trozosConLinks('https://es.wikipedia.org/wiki/Foo_(bar)')[0].tipo === 'link' && (trozosConLinks('https://es.wikipedia.org/wiki/Foo_(bar)')[0] as { href: string }).href, 'https://es.wikipedia.org/wiki/Foo_(bar)', 'el paréntesis que abrió adentro, queda');
  assert.equal(linksDe('javascript:alert(1) y [x](javascript:alert(1))').length, 0, 'sólo http y https');
  assert.deepEqual(linksDe('https://a.com y https://a.com otra vez'), ['https://a.com']);
  assert.equal(rotuloDeLink('https://www.hola-mako.com/'), 'hola-mako.com');
});

const L = 'local_11111111-1111-4111-8111-111111111111';
const AHORA = Date.parse('2026-10-17T13:00:00Z');
const dibujar = (lineas: LineaChat[]) => renderToStaticMarkup(createElement(Hilo, { lineas, pushes: [], ahora: AHORA, vacio: '', quien: { titulo: 'CRM', animo: 'despierto' } }));

test('2. en los mensajes: lo de Martín y lo del chat con sus links; los otros chats de MaKo, como siempre', () => {
  const yo = dibujar([{ tipo: 'trabajo', instante: AHORA - 60_000, trabajo: {
    id: 't1', destino: L, destino_titulo: 'CRM', destino_cuenta: 'claude1', created_at: new Date(AHORA - 60_000).toISOString(),
    texto: 'Mirá https://hola-mako.com/crm', estado: 'entregado', motivo: null, cierre: null,
  } }]);
  assert.match(yo, /<a class="co-link" href="https:\/\/hola-mako\.com\/crm" target="_blank" rel="noreferrer noopener">/);
  const el = dibujar([{ tipo: 'turno', instante: AHORA, turno: { local: L, uuid: 'u1', rol: 'el', de: null, texto: 'Lo dejé en https://x.com/a', at: new Date(AHORA).toISOString(), trabajo: null } }]);
  assert.match(el, /<a class="co-link" href="https:\/\/x\.com\/a"/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(Markdown, { text: 'Ver https://x.com/a' })), /<a /, 'los demás chats no cambian');
});

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('3. en la caja: con un link, la capa azul y su chip, en la computadora y en el teléfono', () => {
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    const src = leer(f);
    assert.match(src, /<ResalteDeLinks texto=\{texto\}/, `${f}: la capa que pinta los links`);
    assert.match(src, /<LinksDeLaCaja texto=\{texto\} \/>/, `${f}: el chip para abrirlo`);
    assert.match(src, /className=\{(conLinks|hayLinks\(texto\)) \? 'co-caja__texto--resalte' : undefined\}/, `${f}: el campo se vuelve transparente sólo con un link`);
  }
});

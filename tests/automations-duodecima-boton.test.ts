// =============================================================================
// Duodécima tanda de Automations (12/10/2026), paquete «ui-boton-qr»: el ✦ del título y el QR que salta al crear.
// Diseño: docs/diseno-duodecima-tanda.md §1.7, §2.7 y §2.12 (decisiones 9 y 10). Pedido de Martín, textual:
//   · «se aprieta el botón de MaKo cuando está abierta cualquier tarjeta y la tarjeta debería cerrarse; no debería
//     permanecer abierta y no hacer nada» / «ese botón está más grande que el de al lado»;
//   · «cuando creás un paso que requiera WhatsApp y te diga que tu WhatsApp no está conectado, ahí que salte el QR.
//     Que no haya ninguna fricción».
//
// Lo que se fija:
//   · `abrirMako` (SecuenciaPerfil): con una tarjeta abierta la CIERRA (`foco` con id null) y abre, nunca alterna;
//     el lienzo cierra con `setSel(foco.id)`;
//   · el botón tiene la cara del título (`tarjetaChrome`) y el logo de 32;
//   · ⛔ (hasta la decimoquinta) `medioAConectarAlCrear` y el efecto de FlujoLienzo que abría el modal al crear: se
//     fueron con el punto 4 de la decimoquinta (ver el pie de la sección del QR, más abajo).
//
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BotonLogoMako } from '../app/automations/SecuenciaPerfil';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas primero y los bloques después (AGENTS.md: un `/*` adentro de un comentario de línea).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string, tope = 4_000): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  assert.ok(j - i <= tope, `el tramo de «${desde}» mide ${j - i} (> ${tope})`);
  return src.slice(i, j + hasta.length);
};
const PERFIL = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
const LIENZO = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));

// ── El ✦ del título ──────────────────────────────────────────────────────────────────────────

// ⚠️ 20/10/2026 (Martín: «que quede SIEMPRE abierto... que se elimine el icono de MaKo ya que quedará siempre abierto»):
// sin `abrirMako` ni el ✦. El chat está siempre, en la sidebar (tests/automations-chat-siempre.test.ts); en el título va
// la tuerca. Lo que sigue vale igual: `foco` con null cierra la tarjeta, y cerrarla olvida el CRON abierto.
test('sin abrirMako: el chat no se abre ni se cierra, y la tuerca está en su lugar; `foco` con null cierra la tarjeta', () => {
  assert.doesNotMatch(PERFIL, /const abrirMako = |setEditandoIA|<BotonLogoMako /, 'volvió el botón que abría y cerraba el chat');
  assert.match(PERFIL, /<BotonTuerca lado=\{ALTO_ACCION\} onClick=\{\(\) => setConfigAbierta\(true\)\} \/>/);
  // `foco` admite null de punta a punta, y el lienzo lo aplica con setSel (null = cerrar).
  assert.match(PERFIL, /useState<\{ id: string \| null; vez: number \} \| null>\(null\)/);
  assert.match(LIENZO, /foco\?: \{ id: string \| null; vez: number \} \| null;/);
  assert.match(LIENZO, /if \(foco && foco\.vez !== focoVisto\) \{ setFocoVisto\(foco\.vez\); setSel\(foco\.id\); \}/);
  // Cerrar la tarjeta olvida el CRON abierto (el efecto de siempre, con el aviso del lienzo).
  assert.match(PERFIL, /useEffect\(\(\) => \{ if \(!tarjetaAbierta\) setCronAbierto\(null\); \}, \[tarjetaAbierta\]\);/);
});

test('el ✦ tiene la cara del título (tarjetaChrome) y el logo de 32 adentro; encendido, el aro dorado', () => {
  const html = renderToStaticMarkup(createElement(BotonLogoMako, { lado: 44, onClick: () => {}, title: 'x' }));
  assert.match(html, /background:var\(--surface\);border:1px solid var\(--border\);border-radius:11px/, 'no tiene la cara del título');
  assert.match(html, /box-shadow:0 2px 8px rgba\(0,0,0,.06\)/, 'no tiene la sombra del título');
  assert.match(html, /width:44px;height:44px/);
  assert.match(html, /<svg width="32" height="32" viewBox="0 0 48 48"/, 'el logo no es el de 32');
  const on = renderToStaticMarkup(createElement(BotonLogoMako, { lado: 44, onClick: () => {}, title: 'x', encendido: true }));
  assert.match(on, /box-shadow:0 0 0 2px var\(--mako\)/, 'encendido sin el aro dorado');
});

// ── El QR que saltaba al crear ─────────────────────────────────────────────────────────────
// ⛔ Se fue en la decimoquinta tanda (12/10/2026, punto 4: «que en ningún momento de la edición del flujo se me
// interrumpa saltando el desplegable de conectar X cosa»). Lo que lo fija ahora: tests/automations-decimoquinta.test.ts.

// PROBADO ROMPIÉNDOLO (12/10/2026), de a una, con el arnés
// scratchpad/wf-duodecima/ui-boton-qr/romper.mjs (guarda el original en memoria, reescribe, corre y restaura
// comprobando el sha1). Base: este archivo + tests/medios-automatizacion.test.ts + tests/automations-decima-lienzo.test.ts.
// Base: 36 pass / 0 fail (los tres archivos).
//   R1. abrirMako con una tarjeta abierta alterna (sin cerrar ni abrir)                   → 35 / 1 (abrirMako)
//   R2. el ✦ sin la cara del título (el bloque transparente de antes)                       → 35 / 1 (la cara)
//   R3. salta con cualquier chip, también «no pude comprobarlo» (no sólo con `frena`)       → 34 / 2 (sin lectura + la grilla)
//   R4. ignora lo ya ofrecido (salta cada vez)                                              → 34 / 2 (una vez por medio + la grilla)
//   R5. el email también salta                                                              → 34 / 2 (una vez por medio + la grilla)
//   R6. el efecto no espera la lectura del medio nuevo (`medios === undefined`)             → 35 / 1 (el efecto)
//   R7. el ＋ no deja el id para el efecto                                                    → 35 / 1 (el efecto)
//   R8. setConectarMedio en el render                                                       → 35 / 1 (el efecto)
// Restaurado: 36 / 0.

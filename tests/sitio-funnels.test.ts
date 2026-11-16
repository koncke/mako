// =============================================================================
// Los siete funnels del sitio (16/11/2026): los tres que faltaban (anuncios con formulario, venta directa y newsletter), con el
// mismo molde que los cuatro de la llamada con Leila (app/vsl/_sitio/funnels-datos.ts → app/vsl/funnels/[funnel])
// =============================================================================
// Lo que se fija acá:
//   · están los siete del catálogo de Martín (docs/marketing-copilot/funnels-simples.md §1, memoria «funnels-simples-7»), con los
//     nombres de su regla del 16/11 (el «Carrito» es «Venta directa»);
//   · cada paso dice qué parte de MaKo lo hace, con el link a una landing que EXISTE, y lleva una grabación de la app (sin ella,
//     la fila queda con la columna del video vacía);
//   · el texto: pasos en palabras simples (nunca «Facturando»), con «tú», sin «garantía», y el newsletter sin prometer la pestaña
//     Newsletters (sigue en PRONTO, app/newsletters/puerta.ts);
//   · dónde se ven: el menú Industrias (computadora y teléfono), el pie, la landing de Funnels (/vsl/funnel) con su recorrido en una
//     línea, y cada página con el resto en «Otros funnels».
//
// PROBADO ROMPIÉNDOLO (16/11/2026; base 6 / 0, y 7 / 0 con el modo claro), cada rotura restaurada (pasan / fallan):
//   · sin la regla clara de las tarjetas de «Otros funnels» (CSS_FUNNELS)                     -> 6 / 1 (el 7)
//   · un paso de «Venta directa» que dice «Facturando»                                      -> 5 / 1 (el 3)
//   · el paso del newsletter sólo con Email (sin grabación)                                  -> 4 / 2 (el 2 y el 5: un <video> menos)
//   · el link de Email a una landing que no existe ('/vsl/newsletters')                      -> 4 / 2 (el 2 y el 3)
//   · sin el recorrido de «formulario» en la landing de Funnels (cae a la bajada)            -> 5 / 1 (el 5)
//   · «Venta directa» vuelve a llamarse «Carrito»                                            -> 5 / 1 (el 1)
// Correr: node --import tsx --test tests/sitio-funnels.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FUNNELS_SITIO, rutaFunnel } from '../app/vsl/_sitio/funnels-datos';
import { CSS_FUNNELS, PaginaFunnel, videoDelPaso } from '../app/vsl/_sitio/Funnels';
import { Barra } from '../app/vsl/_sitio/Barra';
import { columnasDelPie } from '../app/vsl/_sitio/datos';
import { LANDING_FUNNEL } from '../app/vsl/_competencia/funnel';
import { marcasDeVoseo } from '../lib/voseo';

const RAIZ = join(import.meta.dirname, '..');
const NUEVOS = ['formulario', 'venta-directa', 'newsletter'] as const;
const texto = (f: (typeof FUNNELS_SITIO)[number]) =>
  [f.nombre, f.titulo, f.bajada, f.corta, f.cierre, f.queEs, f.cuando, ...f.recorrido, ...f.pasos.flatMap((p) => [p.paso, p.texto])].join('\n');

test('1. los siete funnels del catálogo, con los nombres de Martín', () => {
  assert.deepEqual(FUNNELS_SITIO.map((f) => f.id), ['vsl', 'whatsapp', 'formulario', 'venta-directa', 'instagram', 'youtube', 'newsletter']);
  const nombre = (id: string) => FUNNELS_SITIO.find((f) => f.id === id)?.nombre;
  assert.equal(nombre('formulario'), 'Anuncios con formulario');
  assert.equal(nombre('venta-directa'), 'Venta directa', '«el funnel de carrito debería ser Venta Directa» (Martín, 16/11/2026)');
  assert.equal(nombre('newsletter'), 'Newsletter', '«Email a tu lista no me gusta… eso es newsletter» (Martín, 10/11/2026)');
  // Una ruta por funnel, sin repetir.
  assert.equal(new Set(FUNNELS_SITIO.map((f) => rutaFunnel(f.id))).size, FUNNELS_SITIO.length);
});

test('2. cada paso: lo hace una parte de MaKo que tiene landing, y lleva la grabación de la app', () => {
  for (const f of FUNNELS_SITIO) {
    assert.ok(f.pasos.length >= 3, `${f.id}: pocos pasos`);
    for (const p of f.pasos) {
      assert.ok(p.enMako.length > 0, `${f.id} · ${p.paso}: no dice qué parte de MaKo lo hace`);
      for (const m of p.enMako) {
        assert.ok(existsSync(join(RAIZ, 'app', m.href, 'page.tsx')), `${f.id} · ${p.paso}: ${m.href} no es una landing`);
      }
      const v = videoDelPaso(p.enMako);
      assert.ok(v, `${f.id} · ${p.paso}: ninguna de sus piezas tiene grabación (la fila queda con el video vacío)`);
      for (const ext of ['webm', 'jpg']) assert.ok(existsSync(join(RAIZ, 'public/vsl-assets/sitio', `${v}.${ext}`)), `${v}.${ext} no existe`);
    }
  }
});

test('3. el texto: palabras simples, con «tú», sin «garantía» y sin prometer lo que no está', () => {
  for (const f of FUNNELS_SITIO.filter((x) => (NUEVOS as readonly string[]).includes(x.id))) {
    const t = texto(f);
    assert.doesNotMatch(t, /facturand/i, `${f.id}: «Facturando» no es un paso`);
    assert.doesNotMatch(t, /garant[ií]a/i, `${f.id}: sin «garantía»`);
    assert.deepEqual(marcasDeVoseo(t), [], `${f.id}: voseo`);
    assert.ok(f.recorrido.length >= 3 && f.recorrido.every((r) => r.length <= 24), `${f.id}: el recorrido, en palabras cortas`);
  }
  // El newsletter de hoy sale de Email: la pestaña Newsletters sigue en PRONTO (sólo la plataforma).
  const nl = FUNNELS_SITIO.find((f) => f.id === 'newsletter')!;
  assert.ok(nl.pasos.every((p) => p.enMako.every((m) => !m.href.includes('newsletter'))), 'el newsletter promete la pestaña Newsletters');
  assert.ok(nl.pasos.some((p) => p.enMako.some((m) => m.href === '/vsl/email')), 'el newsletter no dice que sale de Email');
});

test('4. el menú Industrias y el pie los traen a todos', () => {
  const h = renderToStaticMarkup(createElement(Barra, { claro: false }));
  for (const f of FUNNELS_SITIO) {
    const n = h.split(`href="${rutaFunnel(f.id)}"`).length - 1;
    assert.equal(n, 2, `${f.nombre}: ${n} veces en la barra (la computadora y el teléfono)`);
  }
  const pie = columnasDelPie().find((c) => c.titulo === 'Industrias')?.sub?.links.map((l) => l.href) ?? [];
  assert.deepEqual(pie, FUNNELS_SITIO.map((f) => rutaFunnel(f.id)));
});

test('5. la landing de Funnels: cada tipo con su recorrido en una línea; y cada página, con los otros seis', () => {
  const tipos = LANDING_FUNNEL.bloques.find((b) => b.tipo === 'tarjetas' && b.items.some((i) => i.meta?.startsWith('/vsl/funnels/')));
  assert.ok(tipos && tipos.tipo === 'tarjetas');
  for (const f of FUNNELS_SITIO) {
    const it = tipos.items.find((i) => i.meta === rutaFunnel(f.id));
    assert.ok(it, `${f.id} no está en «Elige tu tipo de funnel»`);
    assert.notEqual(it.texto, f.bajada, `${f.id}: sin su recorrido en una línea (cae a la bajada)`);
  }
  for (const id of NUEVOS) {
    const f = FUNNELS_SITIO.find((x) => x.id === id)!;
    const h = renderToStaticMarkup(createElement(PaginaFunnel, { f }));
    const otros = h.slice(h.indexOf('s-fun-otros'));
    for (const o of FUNNELS_SITIO) assert.equal(otros.includes(`href="${rutaFunnel(o.id)}"`), o.id !== id, `${id}: «Otros funnels» y ${o.id}`);
    assert.equal((h.match(/<video /g) ?? []).length, f.pasos.length, `${id}: una grabación por paso`);
  }
});

test('6. el recorrido del hero tiene un nodo por paso del recorrido, en orden', () => {
  for (const id of NUEVOS) {
    const f = FUNNELS_SITIO.find((x) => x.id === id)!;
    const h = renderToStaticMarkup(createElement(PaginaFunnel, { f }));
    const nodos = [...h.matchAll(/<span class="s-fh-nom">([^<]+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(nodos, [...f.recorrido]);
  }
});

test('7. en el modo claro, las tarjetas de «Otros funnels» y las fichas de «Lo arman» también son claras', () => {
  // El sol y la luna no toca un link con fondo (lo trata como un botón): medido a 1440 el 16/11/2026, quedaban #0D0B28 y #151236.
  assert.match(CSS_FUNNELS, /html\[data-sitio-modo="claro"\] \.s-fun-c\{background:#F4F4F8;/, '«Otros funnels» oscuro en el modo claro');
  assert.match(CSS_FUNNELS, /html\[data-sitio-modo="claro"\] \.s-fp-l a\{background:#F4F4F8;/, '«Lo arman» oscuro en el modo claro');
  assert.doesNotMatch(CSS_FUNNELS, /`/, 'una comilla invertida corta la plantilla del CSS');
});

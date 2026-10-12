// =============================================================================
// Un clic en OPERATE no lleva a General (app/_components/Sidebar.tsx: `Marca` y `Familia`)
// =============================================================================
// Martín, 12/10/2026 (la prueba con Fiesta Music): «cuando alguien da clic en Operate... se lo lleva a
// General». Dos causas, medidas en la barra real (docs/diseno-duodecima-tanda.md §1.11):
//
//   · el link de la marca tenía `padding-bottom: 20px` y se estiraba a todo el ancho de la columna:
//     los 20 px entre el logo y el rótulo OPERATE eran link a /general;
//   · `.mk-seccion` iba sin `nowrap`: durante los 200 ms de abrir o plegar la barra, un rótulo de dos
//     palabras bajaba de renglón y la barra saltaba 16 a 32 px, y el clic caía en otra cosa.
//
// El arreglo no cambia el dibujo: el aire de abajo de la marca pasa de padding a margen (2 + 18 = 20),
// que no es clicable, y el link deja de estirarse (`alignSelf`). Se renderizan los `Marca` y `Familia`
// REALES, abierta y plegada, como los dibuja la barra (y BarraPreview, en /admin/ui).
//
// PROBADO ROMPIÉNDOLO (12/10/2026, restaurando entre cada una; base 2 pases / 0 fallos):
//   · la marca con su `'2px 6px 20px'` / `'2px 0 20px'` de antes          → 1 fallo, 1 pase;
//   · `.mk-seccion` sin `whiteSpace: 'nowrap'`                            → 1 fallo, 1 pase.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Marca, Familia, type FamiliaVista } from '../app/_components/Sidebar';
import { FAMILIAS } from '../app/_components/nav';

/** El `style` de la primera etiqueta `<tag>` que lleva `clase`, como lo escribe React en el HTML. */
function estiloDe(html: string, tag: string, clase: string): string {
  const m = new RegExp(`<${tag}\\b[^>]*\\bclass="${clase}"[^>]*>`).exec(html);
  assert.ok(m, `no encontré <${tag} class="${clase}">: cambió el marcado de la barra`);
  const s = /\bstyle="([^"]*)"/.exec(m[0]);
  assert.ok(s, `<${tag} class="${clase}"> no lleva style`);
  return s[1];
}

/** El padding de ABAJO, con las reglas del shorthand de CSS (1 a 4 valores). */
function paddingAbajo(estilo: string): number {
  const m = /(?:^|;)\s*padding:\s*([^;]+)/.exec(estilo);
  assert.ok(m, `sin padding en «${estilo}»`);
  const v = m[1].trim().split(/\s+/).map((x) => parseFloat(x) || 0);
  return v.length >= 3 ? v[2] : v[0];
}

test('el link de la marca mide lo que mide el logo: sin colchón de abajo y sin estirarse', () => {
  for (const open of [true, false]) {
    const html = renderToStaticMarkup(createElement(Marca, { open }));
    assert.match(html, /href="\/general"/, 'la marca dejó de ir a /general');
    const estilo = estiloDe(html, 'a', 'mk-marca');
    const abajo = paddingAbajo(estilo);
    assert.ok(abajo <= 4, `${open ? 'abierta' : 'plegada'}: el link tiene ${abajo} px de padding abajo, y ese aire es clicable a /general`);
    assert.match(estilo, /align-self:/, `${open ? 'abierta' : 'plegada'}: sin align-self, el link se estira a todo el ancho`);
    // Sin cambio visual: lo que el padding dejó de poner lo pone el margen, que no es clicable (18 + 2 = 20).
    const margen = /(?:^|;)\s*margin-bottom:\s*([\d.]+)px/.exec(estilo);
    assert.ok(margen, 'sin margin-bottom la barra se sube 18 px');
    assert.equal(Number(margen[1]) + abajo, 20, 'cambió el aire entre la marca y OPERATE');
  }
});

test('el rótulo de una familia no baja de renglón mientras la barra se anima', () => {
  const f0 = FAMILIAS[0];
  const f: FamiliaVista = {
    ...f0,
    bloques: f0.bloques.map((b) => b.filter((i) => !i.adminOnly)).filter((b) => b.length),
    grupos: (f0.grupos ?? []).map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly) })).filter((g) => g.items.length),
  } as FamiliaVista;
  for (const open of [true, false]) {
    const html = renderToStaticMarkup(createElement(Familia, {
      f, primera: true, open, pathname: '/automations', abiertaEsta: true,
      contadorFamilia: 0, contadorItem: () => 0, onToggle: () => {}, flyoutKey: null,
      onAbrirFlyout: () => {}, onCerrarFlyout: () => {},
    }));
    assert.match(estiloDe(html, 'button', 'mk-seccion'), /white-space:\s*nowrap/,
      `${open ? 'abierta' : 'plegada'}: sin nowrap el rótulo baja de renglón y la barra salta`);
  }
});


// =============================================================================
// tests/editor-landing-carrusel-45 — la presentación de 4:5 (un carrusel) en el Web Generator
// =============================================================================
// Llamada con Leila del 5/11/2026: «ofrecer el carrusel 4:5» (existe en Image, lib/carruseles/). Una presentación de 4:5 es un
// carrusel: la «Relación de aspecto» la ofrece (sale de PROPORCIONES), el guardado la acepta, la hoja la dibuja más angosta
// (43em, ANCHO_DIAPO_EM) y vertical, la miniatura toma la misma forma y la exportación sale en 8 × 10 in (PDF) y 10 × 12,5 in
// (PowerPoint, con su layout definido: pptxgenjs no lo trae).
//
// Probado rompiéndolo (6/11/2026), base 8 pasan / 0 fallan:
//   · sacar '4:5' de PROPORCIONES ............................. 5 fallan (el guardado la tira, y con ella lo demás)
//   · relacionDe con 4:5 → 16/9 (la forma vieja) .............. 3 fallan (relación, PDF, PowerPoint)
//   · sacar la regla 4:5 de css.ts ............................ 1 falla (hoja)
//   · el ancho de la regla 4:5 en 64.5em ...................... 1 falla (hoja)
//   · la miniatura con el cuadro de 16:9 (prop fija) .......... 1 falla (miniatura)
//   · tamanoDiapo sin la rama de 4:5 .......................... 1 falla (PowerPoint)
//   · la hoja de impresión sin la rama de 4:5 ................. 1 falla (PDF)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ANCHO_DIAPO_EM, PROPORCIONES, cuadroCss, formaFija, relacionDe } from '../lib/editor-landing/api-tipos';
import { sanearConfig } from '../lib/editor-landing/validar';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { hojaDeImpresion } from '../lib/editor-landing/exportar-html';
import { DIAPO_16x9, DIAPO_4x5, cajasDeDiseno, tamanoDiapo } from '../lib/editor-landing/exportar-pptx';
import { TEMAS } from '../lib/editor-landing/temas';
import { MiniaturaLanding } from '../app/web-generator/MiniaturaLanding';

const CARRUSEL = { formato: 'presentacion', proporcion: '4:5' } as const;

/** Las reglas de la hoja cuyo selector nombra `parte`, con su posición. */
function reglas(parte: string): { sel: string; decl: string; i: number }[] {
  const out: { sel: string; decl: string; i: number }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS_CONTENIDO))) if (m[1].includes(parte)) out.push({ sel: m[1].trim(), decl: m[2], i: m.index });
  return out;
}

test('se ofrece: 4:5 está en la lista de la «Relación de aspecto» y el guardado no la cambia', () => {
  assert.ok((PROPORCIONES as readonly string[]).includes('4:5'), 'la «Relación de aspecto» no ofrece 4:5');
  const r = sanearConfig(CARRUSEL);
  assert.equal(r.config.proporcion, '4:5', 'el guardado la tiró');
  assert.equal(r.descartes.length, 0, r.descartes.join(' · '));
});

test('relación y forma: 4:5 es vertical, y lo que no tiene forma se dibuja 16:9', () => {
  assert.equal(relacionDe(CARRUSEL), 4 / 5);
  assert.equal(relacionDe({ formato: 'pagina', proporcion: '4:5' }), null, 'una página no tiene forma fija');
  assert.equal(cuadroCss('4:5'), '4 / 5');
  assert.equal(formaFija('fluido'), '16:9');
  assert.equal(formaFija('toString'), '16:9', 'una clave del prototipo no es una forma');
  assert.ok(ANCHO_DIAPO_EM['4:5'] < ANCHO_DIAPO_EM['16:9'], 'una diapositiva vertical con el ancho de una 16:9 mide 80em de alto');
});

test('hoja: la diapositiva de 4:5 es más angosta y vertical, y en el celular vuelve a ser fluida', () => {
  const r = reglas('[data-proporcion="4:5"]');
  const forma = r.find((x) => x.sel.includes('.gm-tarjeta') && !x.sel.includes('fondo') && /aspect-ratio:\s*4 \/ 5/.test(x.decl));
  assert.ok(forma, 'falta la regla de 4:5');
  assert.match(forma.decl, /width:\s*min\(43em/, 'el ancho de la diapositiva de 4:5 no es el de ANCHO_DIAPO_EM');
  // La guía de desbordamiento con la misma forma (si no, marca desborde donde no lo hay).
  assert.ok(r.some((x) => x.sel.includes('.gm-tarjeta-fondo::after') && /aspect-ratio:\s*4 \/ 5/.test(x.decl)), 'la guía no tiene la forma de 4:5');
  // La miniatura (100 % del cuadro) y el celular (fluida) van después o pesan más: no los pisa.
  const mini = reglas('[data-modo="miniatura"]').find((x) => x.sel.includes('[data-formato="presentacion"]') && x.sel.includes('.gm-tarjeta') && /width:\s*100%/.test(x.decl));
  assert.ok(mini, 'falta la regla de la miniatura');
  const celular = reglas('[data-formato="presentacion"]').find((x) => /aspect-ratio:\s*auto/.test(x.decl) && x.sel.includes('.gm-tarjeta'));
  assert.ok(celular && celular.i > forma.i, 'la regla del celular tiene que ir DESPUÉS de la de 4:5 para ganarle');
});

test('miniatura: el cuadro toma la forma de 4:5 y el padre del .gm-doc la declara', () => {
  const html = renderToStaticMarkup(createElement(MiniaturaLanding, { tarjeta: null, tema: TEMAS[0], formato: 'presentacion', proporcion: '4:5' }));
  assert.match(html, /<div class="gp-mini" style="aspect-ratio:4 \/ 5"/);
  assert.match(html, /data-formato="presentacion" data-proporcion="4:5"><div class="gm-doc/);
});

test('PDF: la hoja de impresión es vertical, 8 × 10 in', () => {
  assert.equal(hojaDeImpresion(CARRUSEL), '@media print{@page{size:8in 10in;margin:0}}');
});

test('PowerPoint: 4:5 con su layout propio, el mismo ancho y más alto; una página sigue en 16:9', () => {
  const t = tamanoDiapo(CARRUSEL);
  assert.equal(t, DIAPO_4x5);
  assert.equal(t.w, DIAPO_16x9.w, 'el ancho cambia y los márgenes en pulgadas de cajasDeDiseno dejan de dar');
  assert.equal(t.w / t.h, 4 / 5);
  assert.equal(tamanoDiapo({ formato: 'pagina', proporcion: '4:5' }), DIAPO_16x9);
  // La imagen del costado cubre el alto entero de la diapositiva vertical.
  assert.equal(cajasDeDiseno('izquierda', t).imagen?.h, t.h);
});

test('lo que se guardó con la forma vieja sigue igual (16:9 por default)', () => {
  assert.equal(relacionDe({ formato: 'presentacion' }), 16 / 9);
  assert.equal(relacionDe({ formato: 'presentacion', proporcion: '4:3' }), 4 / 3);
});

test('la API de MaKo la acepta: el enum de la operación sale de PROPORCIONES', async () => {
  const { porId } = await import('../lib/api-mako/registro');
  const op = porId('configurar_landing');
  const p = op?.parametros.find((x) => x.nombre === 'proporcion');
  assert.ok(p, 'no encontré la operación que configura la proporción');
  assert.ok(p.enum?.includes('4:5'), 'la API no ofrece 4:5');
});

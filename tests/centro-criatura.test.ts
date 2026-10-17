// =============================================================================
// La criatura viva (app/admin/operaciones/Criatura.tsx) y la estrella de MaKo, para el Onboarding y la barra (17/10/2026)
// =============================================================================
// Martín (por el Cerebro): «Agrega a las criaturas la criatura de MaKo, la típica estrella... Y debe parpadear y reaccionar
// con las respuestas... y también una reacción si la clickeo, estén presentes en todos lados y en todas las criaturas».
// Criatura.tsx importa su CSS (criatura.css), y en node un `.css` no se importa: el componente se mira en su fuente; la
// estrella, dibujada con Muneco (que no importa CSS).
//
// Probado ROMPIÉNDOLO (17/10/2026, base en 3 pases): sin la reacción del clic (`setDeClic(true)`) → 1 fallo; sin las
// reglas de movimiento reducido → 1 fallo; la estrella dibujada como el círculo → 1 fallo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ASPECTO_MAKO } from '../lib/centro-munecos';
import { Cuerpo, Muneco } from '../app/admin/operaciones/Muneco';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('la API que esperan el Onboarding y la barra: entrada, invita, reacciones y el clic que siempre reacciona', () => {
  const c = leer('app/admin/operaciones/Criatura.tsx');
  assert.match(c, /^'use client';/);
  assert.match(c, /export type Reaccion = 'escucha' \| 'contenta' \| 'piensa' \| 'sorpresa' \| 'duda';/);
  for (const p of ['aspecto?', 'titulo =', 'size =', 'animo =', 'reaccion =', 'entrada =', 'onEntrada', 'invita =', 'onClick']) assert.ok(c.includes(p), p);
  assert.match(c, /const tocar = \(\) => \{[\s\S]*setDeClic\(true\)/, 'el clic siempre tiene su reacción');
  assert.match(c, /animationName === 'cri-entra'[\s\S]*onEntrada\?\.\(\)/, 'la entrada avisa al terminar');
  assert.match(c, /<Muneco /, 'envuelve al muñeco, no lo copia');
});

test('con movimiento reducido: sin entrada ni latido, las reacciones sólo con la cara; y el parpadeo es solo', () => {
  const css = leer('app/admin/operaciones/criatura.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.cri--entra[\s\S]*\.cri--invita[\s\S]*animation: none !important/);
  assert.match(css, /\.cri \.mun-ojos \{ animation: cri-parpadeo/);
  assert.match(leer('app/admin/operaciones/Criatura.tsx'), /BOCA_DE: Record<Reaccion, CaraMuneco>/, 'la cara cuenta la reacción aunque no se mueva');
});

test('la estrella de MaKo tiene su dibujo y su dorado', () => {
  const estrella = renderToStaticMarkup(createElement('svg', null, createElement(Cuerpo, { forma: ASPECTO_MAKO.forma, color: ASPECTO_MAKO.color })));
  const circulo = renderToStaticMarkup(createElement('svg', null, createElement(Cuerpo, { forma: 'circulo', color: ASPECTO_MAKO.color })));
  assert.notEqual(estrella, circulo);
  assert.match(renderToStaticMarkup(createElement(Muneco, { titulo: 'MaKo', aspecto: ASPECTO_MAKO, animo: 'despierto' })), /var\(--mako\)/);
});

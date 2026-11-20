// =============================================================================
// EL RETO SIN LA CRIATURA DE MAKO: lleva el ícono de la app (20/11/2026, la llamada con Leila)
// =============================================================================
// Martín (Fathom 205366178, 00:39:14): «no debería tener la criatura de Mako, porque la criatura de Mako está reservada únicamente
// para Ops Center». Para él el reto es «el nuevo grupo de WhatsApp». El ícono lo eligió el Cerebro: el de la app de MaKo, la baldosa
// oscura con la chispa (MakoLogo, la foto de la línea). Lo llevan la fila de la lista, la cabecera, las burbujas, los puntitos, la
// entrada de cada día y la llegada.
// Se prueba lo DIBUJADO (`Muneco` con renderToStaticMarkup): con el título «MaKo», `aspectoDe` devolvería la criatura.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Muneco } from '../app/admin/operaciones/Muneco';
import { ASPECTO_APP_MAKO, ASPECTO_MAKO, sanearAspecto } from '../lib/centro-munecos';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('Muneco con el aspecto de la app dibuja la baldosa con la chispa, también con el título «MaKo» (que sería la criatura)', () => {
  const app = renderToStaticMarkup(createElement(Muneco, { titulo: 'MaKo', aspecto: ASPECTO_APP_MAKO, animo: 'despierto', size: 26 }));
  assert.match(app, /class="mun mun--app"/);
  assert.match(app, /<rect [^>]*rx="10\.8" fill="#211D16"/, 'la baldosa oscura');
  assert.match(app, /<path d="M0 -11 C1 -4 4 -1 11 0 [^"]+" fill="var\(--mako\)"/, 'la chispa dorada de MakoLogo');
  assert.doesNotMatch(app, /mun-cuerpo/, 'sin el cuerpo ni la cara de la criatura');
  assert.doesNotMatch(app, / id="/, 'sin ids de SVG: dos en la misma pantalla no se pisan');
  // La criatura sigue igual para el Ops Center.
  const criatura = renderToStaticMarkup(createElement(Muneco, { titulo: 'MaKo', aspecto: ASPECTO_MAKO, animo: 'despierto', size: 26 }));
  assert.match(criatura, /mun-cuerpo/);
  assert.doesNotMatch(criatura, /mun--app/);
  // Como el retrato, no se elige ni se guarda.
  assert.equal(sanearAspecto(ASPECTO_APP_MAKO)?.app, undefined);
});

test('el reto no lleva la criatura en ningún lugar: la fila, la cabecera, las burbujas, los puntitos, la entrada y la llegada', () => {
  const chat = fuente('app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('const quienMako = useMemo(() => ({ nombre: RETO_TITULO, aspecto: ASPECTO_APP_MAKO }), []);'), 'la caja y la charla (sus puntitos)');
  assert.ok(chat.includes("cabecera={{ clave: 'reto-7-dias', titulo: RETO_TITULO, aspecto: ASPECTO_APP_MAKO,"), 'la cabecera');
  assert.ok(chat.includes('<EntradaEscribiendo foto={<Muneco titulo="MaKo" aspecto={ASPECTO_APP_MAKO} animo="despierto" size={26} />} quien="MaKo" />'), 'la entrada de cada día');
  // Los puntitos de la cola y de la carga son burbujas: van con su foto.
  assert.ok(fuente('app/second-brain/reto/Burbuja.tsx').includes("quien={{ titulo: 'MaKo', aspecto: ASPECTO_APP_MAKO }}"), 'las burbujas y los puntitos');
  assert.ok(fuente('app/second-brain/ChatSecondBrain.tsx').includes('<FilaDeChat titulo="Reto de 7 días" marca="sb-reto-chat" aspecto={ASPECTO_APP_MAKO}'), 'la fila de la lista');
  const llegada = fuente('app/second-brain/LlegadaAlReto.tsx');
  assert.ok(llegada.includes('<span className="sbl-foto" aria-hidden="true"><Muneco titulo="MaKo" aspecto={ASPECTO_APP_MAKO} animo="despierto" size={26} /></span>'), 'la llegada');
  for (const [f, s] of [['ChatDelReto', chat], ['Burbuja', fuente('app/second-brain/reto/Burbuja.tsx')], ['LlegadaAlReto', llegada]] as const) {
    assert.doesNotMatch(s, /\bASPECTO_MAKO\b|CriaturaMako/, `${f}: volvió la criatura de MaKo`);
  }
  // Muneco mira la app ANTES del título.
  const m = fuente('app/admin/operaciones/Muneco.tsx');
  assert.ok(m.indexOf('if (aspecto?.app) return <IconoAppMako size={size} style={style} />;') < m.indexOf('const { forma, color, cara, retrato } = aspectoDe(titulo, aspecto);'));
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 2/0; al restaurar, 2/0). Cada rotura, de a una, da 1/1:
//   - Muneco sin mirar la app (`if (aspecto?.app) …` borrado): «MaKo» vuelve a ser la criatura
//   - el ícono con un gradiente con `id`
//   - las burbujas, la fila de la lista, la cabecera o la llegada con la criatura (cada una por separado)

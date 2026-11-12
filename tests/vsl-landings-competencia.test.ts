// =============================================================================
// Las landings de /vsl que copian la ESTRUCTURA de un competidor (app/vsl/_competencia, 11/11/2026)
// =============================================================================
// Pedido de Martín (11/11/2026): una landing por función «siguiendo la estructura de la landing ganadora (el orden de
// secciones) y su storytelling, pero con el diseño de MaKo», y la regla de la casa: PROHIBIDO INVENTAR, la referencia se
// nombra en un comentario arriba del archivo con su URL. Esto DIBUJA cada landing del registro y mira lo dibujado:
//   1. la cabecera de su archivo nombra la referencia con su URL, y su ruta app/vsl/<slug>/page.tsx la monta;
//   2. los bloques salen en el orden en que se declararon (que es el de la referencia);
//   3. lo dibujado no promete lo que MaKo no hace (garantía, el ritmo de envío como protección, el media buyer que mueve el
//      presupuesto) ni habla de vos;
//   4. AI Avatar cuenta sus escenas y plantillas del código, no de un número escrito a mano.
// PROBADO ROMPIÉNDOLO (11/11/2026; base 5 / 0): dibujar los bloques al revés → 4 / 1 · la URL de la referencia de
// ai-avatar.ts cambiada en la cabecera → 4 / 1 · «Te devolvemos tu dinero» en una pregunta → 4 / 1 · el 33 de las escenas
// escrito a mano como «28» → 4 / 1 · la ruta de seguimiento de vuelta a FeatureDetail → 4 / 1.
// Correr: node --import tsx --test tests/vsl-landings-competencia.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingCompetencia from '../app/vsl/_competencia/LandingCompetencia';
import { LANDINGS_COMPETENCIA } from '../app/vsl/_competencia/registro';
import type { Bloque, LandingCompetencia as Landing } from '../app/vsl/_competencia/tipos';
import { PLANTILLAS_AVATAR, CATEGORIAS } from '../lib/ai-avatar/plantillas';
import { PLANTILLAS_VENTA_AVATAR } from '../lib/ai-avatar/plantillas-venta';
import { marcasDeVoseo } from '../lib/voseo';
import { DISENOS } from '../app/vsl/_competencia/disenos';
import { RUTA_CTA, TEXTO_CTA } from '../app/vsl/_competencia/cta';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const dibujar = (l: Landing) => renderToStaticMarkup(createElement(LandingCompetencia, { landing: l }));
/** Sólo lo propio de la landing: lo de abajo (la grilla del resto de las funciones) sale de la landing principal. Una
 *  landing con diseño copiado (./disenos) no la tiene: ahí el resto de las funciones va en su pie, y se lee la página entera. */
const propio = (html: string) => (html.includes('<nav class="mk-more"') ? html.slice(0, html.indexOf('<nav class="mk-more"')) : html);
/** El texto que se lee: sin etiquetas, sin el <style> y con las entidades más comunes resueltas. */
const textoVisible = (html: string) => html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

/** Lo que identifica a un bloque en lo dibujado, tal cual se escribió (los títulos van crudos, sin escapar). */
function huella(b: Bloque): string {
  switch (b.tipo) {
    case 'caso': return 'De meses por debajo de';
    case 'cifras': return b.items[0].label;
    case 'logos': return b.titulo;
    default: return b.titulo;
  }
}

test('el registro trae landings, y cada slug una sola vez', () => {
  assert.ok(LANDINGS_COMPETENCIA.length >= 2, 'el registro quedó vacío');
  const slugs = LANDINGS_COMPETENCIA.map((l) => l.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'un slug repetido');
});

test('cada landing nombra su referencia arriba de su archivo, y su ruta la monta', () => {
  for (const l of LANDINGS_COMPETENCIA) {
    const archivo = `app/vsl/_competencia/${l.slug}.ts`;
    assert.ok(existsSync(join(RAIZ, archivo)), `falta ${archivo}`);
    const cabecera = leer(archivo).split('\n').slice(0, 12).join('\n');
    assert.match(cabecera, /REFERENCIA COPIADA ENTERA/, `${archivo}: la cabecera no dice qué referencia copia`);
    assert.ok(cabecera.includes(l.referencia.url), `${archivo}: la cabecera no trae la URL de la referencia (${l.referencia.url})`);
    assert.match(l.referencia.url, /^https:\/\//, `${l.slug}: la URL de la referencia`);
    const pagina = sinComentarios(leer(`app/vsl/${l.slug}/page.tsx`));
    assert.match(pagina, /<LandingCompetencia landing=\{LANDING_[A-Z_]+\} \/>/, `app/vsl/${l.slug}/page.tsx no monta su landing`);
    assert.doesNotMatch(pagina, /FeatureDetail/, `app/vsl/${l.slug}/page.tsx sigue dibujando la landing vieja`);
  }
});

test('los bloques salen en el orden de la referencia', () => {
  for (const l of LANDINGS_COMPETENCIA) {
    const html = dibujar(l);
    let antes = -1;
    for (const b of l.bloques) {
      const h = huella(b);
      const i = html.indexOf(h, antes + 1);
      assert.ok(i > antes, `${l.slug}: «${h}» (${b.tipo}) no sale después del bloque anterior`);
      antes = i;
    }
  }
});

test('lo dibujado no promete lo que MaKo no hace y no habla de vos', () => {
  for (const l of LANDINGS_COMPETENCIA) {
    const html = dibujar(l);
    if (DISENOS[l.slug]) {
      // Con su diseño copiado: de MaKo lleva el logo, el botón para empezar y, en el pie, los links al resto de las funciones.
      assert.match(html, /aria-label="MaKo — volver a la landing"/, `${l.slug}: sin el logo de MaKo`);
      assert.ok(html.includes(`href="${RUTA_CTA}"`), `${l.slug}: sin el botón para empezar`);
      const otras = LANDINGS_COMPETENCIA.filter((x) => x.slug !== l.slug && html.includes(`href="/vsl/${x.slug}"`)).length;
      assert.ok(otras >= LANDINGS_COMPETENCIA.length - 1, `${l.slug}: el pie lleva ${otras} de las otras ${LANDINGS_COMPETENCIA.length - 1} landings`);
    } else {
      assert.ok(html.includes('<nav class="mk-more"'), `${l.slug}: sin la grilla del resto`);
    }
    const t = textoVisible(propio(html));
    assert.doesNotMatch(t, /garant[ií]a|te devolvemos|reembols/i, `${l.slug}: una garantía de devolución (no existe)`);
    assert.doesNotMatch(t, /bane[oa]|goteo/i, `${l.slug}: el ritmo de envío vendido como protección`);
    assert.doesNotMatch(t, /mueve el presupuesto|piloto autom/i, `${l.slug}: el media buyer que mueve el presupuesto`);
    assert.deepEqual(marcasDeVoseo(t), [], `${l.slug}: voseo en lo que se lee`);
  }
});

test('AI Avatar cuenta sus escenas, estilos y plantillas del código', () => {
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'ai-avatar');
  assert.ok(l, 'falta la landing de AI Avatar');
  const html = dibujar(l);
  const cifras = l.bloques.find((b) => b.tipo === 'cifras');
  assert.ok(cifras && cifras.tipo === 'cifras', 'AI Avatar sin sus cifras');
  assert.deepEqual(cifras.items.slice(0, 3).map((c) => c.valor), [String(PLANTILLAS_AVATAR.length), String(CATEGORIAS.length), String(PLANTILLAS_VENTA_AVATAR.length)]);
  for (const p of PLANTILLAS_VENTA_AVATAR) assert.ok(html.includes(p.nombre), `falta la plantilla «${p.nombre}»`);
  // Lo que todavía no hace se dice como tal (lib/funciones-mako.ts → noHace).
  assert.match(textoVisible(html), /Todavía no\. El video habla con una voz generada/);
});

test('el hero de AI Avatar muestra las imágenes reales de sus presets, no una silueta', () => {
  // Martín, 12/11/2026: «Sí, con imágenes». Las de public/formatos/presets/, hechas en Flow con su cara.
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'ai-avatar');
  assert.ok(l, 'falta la landing de AI Avatar');
  const hero = l.bloques.find((b) => b.tipo === 'hero');
  assert.ok(hero && hero.tipo === 'hero' && hero.visual.tipo === 'avatar', 'el hero de AI Avatar sin su visual de avatar');
  const escenas = hero.visual.escenas;
  assert.equal(escenas.length, 3, 'el hero lleva tres escenas: la principal y una a cada lado');
  for (const e of escenas) {
    assert.match(e.poster, /^\/formatos\/presets\/[a-z0-9-]+\.jpg$/, `${e.escena}: la imagen no es de un preset`);
    assert.ok(existsSync(join(RAIZ, 'public', e.poster)), `${e.escena}: falta ${e.poster}`);
    assert.ok(PLANTILLAS_VENTA_AVATAR.some((p) => p.nombre === e.escena), `${e.escena}: no es una plantilla de venta`);
  }
  // La frase del subtítulo es la primera oración del gancho: entra en el teléfono.
  assert.ok(escenas[0].frase.split(/\s+/).length <= 16, `subtítulo largo: «${escenas[0].frase}»`);
  const html = dibujar(l);
  for (const e of escenas) assert.ok(html.includes(`src="${e.poster}"`), `no se dibuja ${e.poster}`);
  assert.doesNotMatch(html, /mk-c-av-sil/, 'vuelve la silueta');
});

test('ninguna landing ofrece agendar una llamada: el botón es empezar con MaKo, y todas traen el sol y la luna', () => {
  // Martín, 12/11/2026: «elimines de todos lados lo de agendar llamada porque hoy en día vamos a hacer que el CTA de todos sea
  // comienza tu prueba gratuita». El botón sale de app/vsl/_competencia/cta.ts y sigue al interruptor de la prueba.
  for (const l of LANDINGS_COMPETENCIA) {
    const t = textoVisible(dibujar(l));
    // El llamado a la acción de MaKo, no lo que hace el producto: Web Generator y Agenda arman páginas para que TUS clientes
    // agenden («Agenda una llamada» como objetivo de una landing), y eso es una función, no el botón de esta página.
    assert.doesNotMatch(t, /agenda tu llamada|agenda una llamada y te mostramos|con nosotros en una llamada/i, `${l.slug}: todavía ofrece una llamada`);
    assert.ok(t.includes(TEXTO_CTA), `${l.slug}: sin «${TEXTO_CTA}»`);
    assert.ok(dibujar(l).includes('data-tema-sitio'), `${l.slug}: sin el botón de sol y luna`);
  }
});

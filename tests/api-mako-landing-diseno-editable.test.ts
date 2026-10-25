// =============================================================================
// La API lee y cambia los textos de un «Diseño editable» (las páginas de MaKo), sin tocar el diseño (25/10/2026)
// =============================================================================
// Martín (25/10): «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Ese día se
// arregló que en la PANTALLA se pudiera escribir en las secciones de las landings de MaKo («no puedo ni cambiar un
// título»). Por la API pasaba lo mismo, medido sobre la #32 (la principal de MaKo): ver_landing_creada devolvía 0
// secciones con texto y cambiar_texto_landing contestaba «No encontré…». El texto de un «Diseño editable» vive en el
// HTML de un atributo, no en hijos, y ni `textoVisible` (diagnostico.ts) ni `planCambiarTexto` lo miraban.
//
// Lo que fija:
//   1. LEER: las secciones de diseño salen con su texto (sin el de un <style>), y las entidades decodificadas;
//   2. CAMBIAR: la frase se cambia y el ESQUELETO del HTML (etiquetas, clases, estilos) queda igual byte por byte;
//      una sección que no se toca vuelve idéntica;
//   3. lo que ya valía para el resto: una frase que cruza un formato distinto se avisa, más de una aparición pide
//      `seccion` o `todas`, y lo que se escribe se escapa (un texto nunca abre una etiqueta).
// Correr: node --import tsx --test tests/api-mako-landing-diseno-editable.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { planCambiarTexto } from '../lib/api-mako/areas/landing-contenido.helpers';
import { paginasEnTexto } from '../lib/api-mako/areas/landing-editor.helpers';

const HERO = '<section class="hero"><p class="badge">Solo 5 cupos</p><h1 class="t">El mejor software para vender <span class="hl">High Ticket</span> con VSL</h1><p>Del primer clic al cliente &amp; más.</p><style>.t{color:red}</style></section>';
const PARA = '<section class="para"><h2 style="margin:0">¿Para quién es esto?</h2><p>Solo 5 cupos</p></section>';

const seccion = (id: string, html: string): JsonNodo => ({ type: NODO.tarjeta, attrs: { id }, content: [{ type: NODO.htmlEditable, attrs: { id: `e-${id}`, html } }] });
const contenido = (): LandingContenido => ({ v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [seccion('tHero', HERO), seccion('tPara', PARA)] } }] } as LandingContenido);
const htmlDe = (c: LandingContenido, i: number): string => String(c.paginas[0].doc.content![i].content![0].attrs!.html);
/** El HTML sin sus textos: lo que no se puede mover al cambiar una frase. */
const esqueleto = (html: string) => html.replace(/>[^<]*</g, '><');

type Plan = ReturnType<typeof planCambiarTexto>;
const ok = (r: Plan) => { if ('error' in r) assert.fail(`falló: ${r.error}`); return r; };
const falla = (r: Plan) => { assert.ok('error' in r, 'tenía que fallar'); return r as Extract<Plan, { error: string }>; };

test('leer: las secciones de diseño salen con su texto (ver_landing_creada)', () => {
  const [hero, para] = paginasEnTexto(contenido()).paginas[0].secciones;
  assert.equal(hero?.id, 'tHero');
  assert.match(hero.texto ?? '', /El mejor software para vender High Ticket con VSL/);
  assert.match(hero.texto ?? '', /Del primer clic al cliente & más\./, 'las entidades, decodificadas');
  assert.doesNotMatch(hero.texto ?? '', /color:red/, 'lo de un <style> no es texto');
  assert.match(para?.texto ?? '', /¿Para quién es esto\?/);
});

test('cambiar: la frase cambia y el diseño queda igual, byte por byte', () => {
  const c = contenido();
  const r = ok(planCambiarTexto(c, { buscar: 'El mejor software para vender', reemplazar: 'El software para vender' }));
  const nuevo = htmlDe(r.contenido, 0);
  assert.ok(nuevo.includes('<h1 class="t">El software para vender <span class="hl">High Ticket</span> con VSL</h1>'), nuevo);
  assert.equal(esqueleto(nuevo), esqueleto(HERO), 'se movió una etiqueta, una clase o un estilo');
  assert.ok(nuevo.includes('<style>.t{color:red}</style>') && nuevo.includes('cliente &amp; más.'), 'lo que no se cambió quedó como estaba');
  assert.equal(htmlDe(r.contenido, 1), PARA, 'la otra sección vuelve idéntica');
  assert.deepEqual(r.datos?.secciones, ['tHero']);
  // Una frase con entidades se busca como la lee el visitante.
  assert.ok(htmlDe(ok(planCambiarTexto(c, { buscar: 'cliente & más', reemplazar: 'cliente que paga' })).contenido, 0).includes('<p>Del primer clic al cliente que paga.</p>'));
});

test('cambiar: lo que ya valía para el resto de los bloques vale para el diseño', () => {
  const c = contenido();
  // Cruza un formato distinto (el <span>): se dice, no se adivina.
  assert.match(falla(planCambiarTexto(c, { buscar: 'vender High Ticket', reemplazar: 'x' })).error, /formatos distintos/);
  // Dos apariciones: pide la sección o todas.
  assert.match(falla(planCambiarTexto(c, { buscar: 'Solo 5 cupos', reemplazar: 'Cupos' })).error, /aparece 2 veces/);
  const todas = ok(planCambiarTexto(c, { buscar: 'Solo 5 cupos', reemplazar: 'Cupos', todas: true })).contenido;
  assert.ok(htmlDe(todas, 0).includes('>Cupos<') && htmlDe(todas, 1).includes('>Cupos<'));
  const una = ok(planCambiarTexto(c, { buscar: 'Solo 5 cupos', reemplazar: 'Cupos', seccion: 'tPara' })).contenido;
  assert.equal(htmlDe(una, 0), HERO);
  assert.ok(htmlDe(una, 1).includes('<p>Cupos</p>'));
  // Lo que se escribe se escapa: un texto nunca abre una etiqueta.
  const esc = htmlDe(ok(planCambiarTexto(c, { buscar: '¿Para quién es esto?', reemplazar: '<b>Para ti</b> & tu equipo' })).contenido, 1);
  assert.ok(esc.includes('<h2 style="margin:0">&lt;b&gt;Para ti&lt;/b&gt; &amp; tu equipo</h2>'), esc);
  assert.doesNotMatch(esc, /<b>/);
  // Lo que no está, no está.
  assert.match(falla(planCambiarTexto(c, { buscar: 'no existe', reemplazar: 'x' })).error, /No encontré/);
});

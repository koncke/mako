// =============================================================================
// El cartel de la VERSIÓN DE PRUEBA, como el de Madgicx, y la prueba en la API de MaKo (25/10/2026)
// =============================================================================
// Martín (25/10): «Me gusta el cartel de "limited version" de 7 días de madgicx para implementar en la prueba gratuita de
// MaKo». Y: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Lo que se cuida acá:
//   · los textos (se ejecutan): «Versión de prueba · quedan N días», lo que se cobra después, «Pasar al plan ya», y la franja
//     «Usaste 1 de 3 … de la prueba»;
//   · dónde va: al pie de la barra lateral en todas las pantallas; la franja arriba de cada pantalla con tope; en el teléfono,
//     en «Más» y un aviso corto arriba (se lee del fuente, y lo del teléfono se renderiza);
//   · los colores son los de MaKo (los tokens, que cambian con el tema oscuro), no el violeta de Madgicx;
//   · la API: ver_mi_prueba y empezar_mi_plan_ya, con la misma lectura y la misma función que la pantalla.
//
// Probado rompiéndolo (25/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { diasQueQuedan, textoCartelPrueba } from '../lib/prueba-plan-reglas';
import { textoTopePrueba, usadoDePrueba } from '../lib/topes-plan';

(globalThis as unknown as { React: typeof React }).React = React;
const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const texto = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const DIA = 86_400_000;

test('los TEXTOS del cartel: el título con los días, lo que se cobra después y el botón (en tú, corto)', () => {
  const t = textoCartelPrueba({ dias: 7, plan: 'MaKo Pro', despues: 'US$ 97/mes' });
  assert.deepEqual(t, { titulo: 'Versión de prueba · quedan 7 días', linea: 'Al terminar, sigues con MaKo Pro por US$ 97/mes.', boton: 'Pasar al plan ya' });
  assert.equal(textoCartelPrueba({ dias: 1, plan: 'MaKo Pro', despues: null }).titulo, 'Versión de prueba · queda 1 día');
  assert.equal(textoCartelPrueba({ dias: 0, plan: 'MaKo Pro', despues: null }).titulo, 'Versión de prueba · termina hoy');
  assert.equal(textoCartelPrueba({ dias: null, plan: 'MaKo Pro', despues: null }).linea, 'Al terminar, sigues con MaKo Pro.');
  const t0 = Date.parse('2026-10-25T12:00:00Z');
  assert.equal(diasQueQuedan(new Date(t0 + 7 * DIA).toISOString(), t0), 7, 'el día que empieza, quedan 7');
  assert.equal(diasQueQuedan(new Date(t0 + 7 * DIA).toISOString(), t0 + 6.5 * DIA), 1);
  assert.equal(diasQueQuedan(new Date(t0).toISOString(), t0 + DIA), 0, 'nunca negativo');
  assert.equal(diasQueQuedan(null, t0), null);
});

test('la FRANJA y el TOPE hablan igual: «Usaste 1 de 3 … de la prueba» y «Se habilita con tu plan»', () => {
  assert.equal(usadoDePrueba('prueba.videos', 1, 3), '1 de 3 videos armados');
  assert.equal(usadoDePrueba('prueba.avatares', 0, 1), '0 de 1 video con avatar de IA', 'con un tope de 1, en singular');
  assert.equal(usadoDePrueba('web.landings_publicadas', 1, 1), '1 de 1 página publicada');
  assert.match(textoTopePrueba('prueba.imagenes', 20), /\. Se habilita con tu plan\.$/);
  const f = fuente('app/_ui/FranjaPrueba.tsx');
  assert.match(f, /<div className="fp-titulo">Usaste \{lista\} de la prueba\.<\/div>/);
  assert.match(f, /<a className="fp-boton" href=\{RUTA_EMPEZAR_PLAN\}>Pasar al plan ya<\/a>/);
});

test('DÓNDE va: al pie de la barra lateral (todas las pantallas) y la franja arriba de cada pantalla con tope', () => {
  const sb = fuente('app/_components/Sidebar.tsx');
  const pie = sb.indexOf("<div style={{ marginTop: 'auto', paddingTop: 12, flex: 'none' }}>");
  const cartel = sb.indexOf('<CartelPrueba open={open} />');
  assert.ok(pie > 0 && cartel > pie && cartel < sb.indexOf('<Identidad open={open}', pie), 'al pie, arriba de la identidad (como Madgicx, arriba del usuario)');
  const c = fuente('app/_components/CartelPrueba.tsx');
  assert.match(c, /<a className="cp-boton" href=\{RUTA_EMPEZAR_PLAN\}>\{t\.boton\}<\/a>/);
  assert.match(c, /className="cp-pastilla"/, 'con la barra plegada, una pastilla con los días');
  for (const [rel, cosas] of [
    ['app/video-generator/page.tsx', "['prueba.videos', 'prueba.tomas', 'prueba.imagenes']"],
    // AI Avatar es UNA pantalla desde el 29/10/2026 (el estudio de Higgsfield): el look (imagen) y el video, juntos.
    ['app/ai-avatar/page.tsx', "['prueba.imagenes', 'prueba.avatares', 'prueba.tomas']"],
    ['app/web-generator/page.tsx', "['web.landings_publicadas']"],
  ] as const) {
    assert.ok(fuente(rel).includes(`<FranjaPrueba cosas={${cosas}}`), rel);
  }
  // Una lectura por página: el cartel y la franja comparten la misma.
  const u = fuente('app/_ui/usePrueba.ts');
  assert.match(u, /if \(!enCurso\) \{\s*enCurso = fetch\('\/api\/plan\/prueba'/);
  assert.match(fuente('app/api/plan/prueba/route.ts'), /if \(!s \|\| s\.legacy \|\| s\.ws == null\) return Response\.json\(\{ enPrueba: false \}\);/);
});

test('los COLORES son los de MaKo (los tokens, claro y oscuro), no el violeta de Madgicx', () => {
  for (const rel of ['app/_components/CartelPrueba.tsx', 'app/_ui/FranjaPrueba.tsx', 'app/m/_prueba/PruebaM.tsx']) {
    const f = fuente(rel);
    assert.match(f, /var\(--primary\)/, rel);
    assert.doesNotMatch(f, /#6255d9|#4535df|#5448d9|#e6f2f8/i, `${rel}: ni el violeta ni el celeste de Madgicx`);
  }
});

test('en el TELÉFONO: el cartel en «Más» y un aviso corto arriba de cada pantalla, sin botón ni precio (T5, 3/11/2026)', async () => {
  const { AvisoPruebaM, CartelPruebaM } = await import('../app/m/_prueba/PruebaM');
  const aviso = renderToStaticMarkup(React.createElement(AvisoPruebaM, { dias: 3, plan: 'MaKo Pro', despues: 'US$ 97/mes' }));
  assert.equal(texto(aviso), 'Versión de prueba · quedan 3 días');
  assert.ok(!aviso.includes('href='), 'el teléfono no vende');
  const cartel = renderToStaticMarkup(React.createElement(CartelPruebaM, { dias: 3, plan: 'MaKo Pro', despues: 'US$ 97/mes' }));
  assert.equal(texto(cartel), 'Versión de prueba · quedan 3 días');
  assert.match(fuente('app/m/layout.tsx'), /\{prueba\?\.enPrueba && <AvisoPruebaM dias=\{prueba\.dias\}/);
  assert.match(fuente('app/m/mas/page.tsx'), /\{prueba\?\.enPrueba && <CartelPruebaM dias=\{prueba\.dias\}/);
  assert.match(fuente('lib/prueba-uso.ts'), /dias: diasQueQuedan\(c\.inicio_at, Date\.now\(\)\) \};/, 'los días, al leer: no en el render');
  const pm = fuente('app/m/configuraciones/plan/PlanM.tsx').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(pm, /Empezar mi plan ya|empezarPlanYaAction/, 'empezar el plan queda en la computadora');
});

test('la API: ver_mi_prueba y empezar_mi_plan_ya, con la misma lectura y la misma función que la pantalla', () => {
  const def = fuente('lib/api-mako/areas/negocio.def.ts');
  assert.match(def, /id: 'ver_mi_prueba', area: 'negocio', tipo: 'lectura',/);
  assert.match(def, /id: 'empezar_mi_plan_ya', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '\/mako\/revisar', reversible: false,/,
    'mueve plata: se confirma en una pantalla, nunca por el chat');
  const run = fuente('lib/api-mako/areas/negocio.run.ts');
  assert.match(run, /ver_mi_prueba: \{\s*leer: async \(_input, ctx\) => \{\s*const r = await resumenDePrueba\(ctx\.ws\);/, 'lo mismo que el cartel');
  assert.match(run, /const r = await empezarPlanAhora\(ctx\.ws, ctx\.actor\?\.trim\(\) \|\| 'MaKo'\);/, 'la misma función que el botón');
  assert.match(run, /esPruebaDePlan\(sus\) && sus\.estado === 'pendiente' \? 'en prueba gratis \(ver_mi_prueba\)'/, 'ver_mi_plan dice que está en prueba');
  const snap = fuente('tests/api-mako-http.snapshot.txt');
  for (const id of ['ver_mi_prueba', 'empezar_mi_plan_ya']) assert.match(snap, new RegExp(`^${id}$`, 'm'), `${id} en el snapshot`);
  assert.match(fuente('docs/api-mako.md'), /ver_mi_prueba/);
});

// Roturas (25/10/2026; base 14 / 0 con prueba-topes), cada una restaurada (pasan / fallan):
//   · el título sin los días                                      -> 12 / 2
//   · el último día en plural                                     -> 13 / 1
//   · los días negativos                                          -> 13 / 1
//   · la franja con el plural siempre                             -> 13 / 1
//   · el tope con otro lenguaje que el cartel                     -> 12 / 2
//   · el cartel fuera del pie de la barra                         -> 13 / 1
//   · la barra plegada sin la pastilla                            -> 13 / 1
//   · el Video Generator sin la franja                            -> 13 / 1
//   · el Web Generator sin la franja                              -> 13 / 1
//   · el cartel con el violeta de Madgicx                         -> 13 / 1
//   · dos lecturas por página                                     -> 13 / 1
//   · el teléfono sin el aviso de arriba                          -> 13 / 1
//   · el teléfono sin el cartel en Más                            -> 13 / 1
//   · Tu plan del teléfono sin «Empezar mi plan ya»               -> 13 / 1
//   · empezar_mi_plan_ya sin pantalla de confirmación             -> 13 / 1
//   · ver_mi_prueba con otra lectura que el cartel                -> 13 / 1
//   · ver_mi_plan no dice que está en prueba                      -> 13 / 1

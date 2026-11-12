// =============================================================================
// Lo que se vio MAL mirando producción el 11/11/2026, después del despliegue de Lead Magnet archivado y Create reordenado
// =============================================================================
// Correr: node --import tsx --test tests/mirada-prod-11-11.test.ts
// Informe con capturas: docs/pruebas/competitor-spy-10-11.md («Mirado en producción, 11/11») y la carpeta prod/.
//
// 1. Buscar «lead magnet» o «avatar» en la barra daba «Nothing found»: las dos salieron de la barra ese día, y el 404 de
//    las rutas viejas dice que el buscador «entiende también los nombres viejos».
// 2. «Crear el regalo» del Marketing CoPilot dejaba a la persona en la galería de outliers del Copywriter.
// 3. More del teléfono: el grupo sin título (Settings) dibujaba el lugar de un título vacío, un hueco de 66 px.
// 4. El 404 en un teléfono decía «presiona Ctrl K».
// 5. Spy: 14 de 15 nombres de videos de YouTube cortados aun en dos renglones (la píldora de vistas les comía el ancho).
// 6. Spy: la descripción de un video, renglones enteros de «?utm_source=…».
// 7. Spy en el teléfono: «Acquisition.com» se veía «Acquisition.con» (cortado en seco por «Revisado hace 14 h»).
// 8. Spy: «Conectar mi IA» (y los otros cuatro botones de conectar) se veía como texto suelto en una caja sin relleno.
// 9. Spy: Alex Hormozi, sumado desde «Sugeridos» y sacado, no volvía a «Sugeridos» hasta recargar.
// 10. Spy: «la que más espera lleva hace 1 d en la cola» (negocio de Martín).
//
// ROTURAS (11/11/2026, una por vez y restaurada; base 11 / 0):
//   · sacar los alias de «lead magnet» y «regalo»                                → 10 / 1
//   · sacar los alias de «avatar»                                                → 10 / 1
//   · volver «Crear el regalo» a '/copywriter'                                   → 10 / 1
//   · dibujar la cabecera aunque no haya título (`conCab` siempre true)          → 10 / 1
//   · que un teléfono vuelva a recibir «Ctrl K»                                  → 10 / 1
//   · volver el pie de la tarjeta a flex (el nombre al lado de la píldora)       → 10 / 1
//   · dejar la consulta en el link (`${u.pathname}${u.search}`)                  → 10 / 1
//   · volver «Revisado hace…» al riel                                            → 10 / 1
//   · sacarle `style={CON_SU_CLASE}` a «Conectar mi IA»                          → 10 / 1
//   · sacar `recargarSugeridos()` de `quitar`                                    → 10 / 1
//   · volver a poner el aviso de la cola (12/11: Martín lo sacó)                  → 10 / 1
//
// CUARTA VUELTA (11/11, después del despliegue de las 15:55 UTC, mirado en producción). Lo que siguió mal:
// 9 bis. Desde la ficha, Alex seguía sin volver a «Sugeridos»: el pedido iba DESPUÉS de `irA(null)`, y ahí no sale ninguno.
// 11. La ficha decía «@AlexHormozi» (lo guardado) en el título y en «¿Dejar de mirar a…?»; su tarjeta, «Alex Hormozi».
// 12. La descripción de un video de YouTube en 180 px con barra, y ~165 px vacíos debajo en un modal de alto fijo.
// 13. Teléfono: la cara de 48 px bajaba el dibujo de 600 px (175 KB); Sugeridos se veía con cuadrados vacíos.
// ROTURAS (base 14 / 0):
//   · `recargarSugeridos()` después de `irA(null)` en `quitar`                   → 13 / 1
//   · volver el título de la ficha a `{c.nombre}`                                → 13 / 1
//   · volver la confirmación desde la lista a `${aBorrar.nombre}`                → 13 / 1
//   · volver la caja de la descripción a `maxHeight: 180`                        → 13 / 1
//   · sacar el `.replace('/asesores/grandes/', …)` de la cara del teléfono       → 13 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FAMILIAS } from '../app/_components/nav';
import { resolverTab, type VistaNav } from '../lib/nav-visibilidad';
import { buscarDestinos, type Destino } from '../lib/buscador-nav';
import { RUTAS_COPILOTO, PANTALLA_DE_RUTA } from '../lib/media-buyer/copiloto';
import { conWs } from '../lib/ws-tab';
import { SeccionM } from '../app/m/_ui/SeccionM';
import { atajoBuscador } from '../lib/no-encontrado';
import { linksLegibles } from '../lib/spy-vista';

/** Lo que el buscador recibe de la barra: las filas que ESTA persona ve (Sidebar.tsx, `destinos`), sin las de `fueraDeLaBarra`. */
const destinosDe = (v: VistaNav): Destino[] =>
  FAMILIAS.flatMap((f) => f.bloques.flat().map((t) => resolverTab(t, v)).filter((t): t is NonNullable<typeof t> => !!t)
    .map((item) => ({ item, donde: f.label })));

const PRO: VistaNav = { adminShell: false, rolWs: 'admin', capa: 'agencia' };
const SUPER: VistaNav = { adminShell: true, rolWs: 'admin', capa: 'superadmin' };

test('1a. buscar «lead magnet» o «regalo» lleva al Copywriter, donde se escribe el regalo', () => {
  for (const v of [PRO, SUPER]) {
    const d = destinosDe(v);
    assert.ok(!d.some((x) => /lead magnet/i.test(x.item.label)), 'Lead Magnet volvió a la barra');
    for (const q of ['lead magnet', 'Lead Magnet', 'lead', 'regalo']) assert.equal(buscarDestinos(q, d)[0]?.item.key, 'copywriter', `«${q}»`);
  }
});

test('1b. buscar «avatar» lleva a Video, donde está «Tu personaje con IA»', () => {
  for (const v of [PRO, SUPER]) {
    const d = destinosDe(v);
    assert.ok(!d.some((x) => x.item.key === 'ai-avatar'), 'AI Avatar volvió a la barra');
    for (const q of ['avatar', 'AI Avatar', 'personaje']) assert.equal(buscarDestinos(q, d)[0]?.item.key, 'video-editor', `«${q}»`);
  }
});

test('2. «Crear el regalo» abre la pantalla de CREAR del Copywriter, en el negocio que se está mirando', () => {
  assert.equal(RUTAS_COPILOTO.leadMagnets, '/copywriter?nueva');
  assert.equal(PANTALLA_DE_RUTA[RUTAS_COPILOTO.leadMagnets], 'Copywriting', 'el paso dice a dónde lleva, no «Abrir»');
  // El link de la app le suma el negocio sin perder el `nueva` (y la página lo lee como presente).
  const href = conWs(RUTAS_COPILOTO.leadMagnets, 3);
  const qs = new URLSearchParams(href.split('?')[1]);
  assert.ok(href.startsWith('/copywriter?') && qs.has('nueva') && qs.get('ws') === '3', href);
  assert.match(readFileSync(new URL('../app/copywriter/page.tsx', import.meta.url), 'utf8'), /sp\.nueva !== undefined/);
});

test('3. una sección del teléfono sin título no dibuja el lugar del título', () => {
  const sin = renderToStaticMarkup(createElement(SeccionM, { titulo: null }, createElement('p', null, 'x')));
  assert.doesNotMatch(sin, /m-seccion__cab|<h2/, 'un <h2> vacío deja su hueco');
  assert.doesNotMatch(sin, /aria-labelledby/);
  const con = renderToStaticMarkup(createElement(SeccionM, { titulo: 'Create', id: 'c' }, createElement('p', null, 'x')));
  assert.match(con, /<h2 class="m-seccion__titulo" id="c-titulo">Create<\/h2>/);
  assert.match(con, /aria-labelledby="c-titulo"/);
  // Con una acción y sin título, la cabecera sigue (la acción necesita su lugar).
  assert.match(renderToStaticMarkup(createElement(SeccionM, { titulo: null, accion: createElement('a', null, 'Ver') })), /m-seccion__cab/);
});

test('5. Spy: el nombre de la pieza usa todo el ancho de la tarjeta (la píldora sube a la fila de su tipo)', () => {
  // Medido en producción a 1440: el nombre tenía 104 px de 234 y 14 de 15 videos de Leila quedaban cortados; con esto, 3.
  const css = readFileSync(new URL('../app/competitor-spy/SpyApp.tsx', import.meta.url), 'utf8');
  assert.match(css, /\.spy-pcard__pie\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;/);
  assert.match(css, /\.spy-pcard__texto\{display:contents\}/);
  assert.match(css, /\.spy-pcard__texto b\{grid-column:1 \/ -1;grid-row:2;/, 'el nombre de lado a lado, debajo');
  assert.match(css, /\.spy-pcard__num\{grid-column:2;grid-row:1;/, 'la píldora arriba, al lado de su tipo');
});

test('6. Spy: los links de una descripción se leen como su sitio y su camino, sin el rastreo', () => {
  const d = 'Get your free Five Scaling Frameworks: https://www.acquisition.com/fivescalingframeworks?utm_source=youtube&utm_medium=organic-description&utm_campaign=dear-leila\nDownload here: https://www.acquisition.com/roadmap/?el=yt-leila#arriba.';
  assert.equal(linksLegibles(d), 'Get your free Five Scaling Frameworks: acquisition.com/fivescalingframeworks\nDownload here: acquisition.com/roadmap.');
  assert.equal(linksLegibles('Mi web (https://leilahormozi.com/) y nada más'), 'Mi web (leilahormozi.com) y nada más');
  assert.equal(linksLegibles('sin links, #hashtag y 100% texto'), 'sin links, #hashtag y 100% texto');
  assert.equal(linksLegibles('http://'), 'http://', 'lo que no es una dirección queda como está');
});

test('7. Spy en el teléfono: un nombre largo no se corta en seco («Acquisition.con»)', () => {
  // «Revisado hace…» a la derecha le quitaba 130 px al nombre: sin piezas, va en la segunda línea.
  const spy = readFileSync(new URL('../app/m/competitor-spy/SpyM.tsx', import.meta.url), 'utf8');
  assert.match(spy, /riel=\{conPiezas \? /, 'el riel sólo con piezas');
  assert.match(spy, /segunda=\{!conPiezas && x\.mirado_en \? `\$\{canales\} · revisado \$\{haceCuanto\(x\.mirado_en\)\}`/);
  // Y la red de todo el teléfono: una palabra más larga que la fila baja de renglón.
  const css = readFileSync(new URL('../app/m/m.css', import.meta.url), 'utf8');
  assert.match(css.match(/\.m-fila__t \{[^}]*\}/)?.[0] ?? '', /overflow-wrap: anywhere;/);
});

test('8. Spy: los botones de conectar se ven como botones (su clase, no «como texto»)', () => {
  const comp = readFileSync(new URL('../app/_components/ConectarIntegracion.tsx', import.meta.url), 'utf8');
  assert.match(comp, /export const CON_SU_CLASE: CSSProperties = Object\.fromEntries\(Object\.keys\(COMO_TEXTO\)\.map\(\(k\) => \[k, undefined\]\)\)/);
  for (const f of ['SuOferta.tsx', 'DetallePieza.tsx', 'SpyApp.tsx']) {
    const src = readFileSync(new URL(`../app/competitor-spy/${f}`, import.meta.url), 'utf8');
    const botones = src.match(/<BotonIntegracion [^>]*className="spy-boton[^>]*>/g) ?? [];
    assert.ok(botones.length > 0, f);
    for (const b of botones) assert.match(b, /style=\{CON_SU_CLASE\}/, `${f}: ${b.slice(0, 80)}`);
  }
});

test('9. Spy: dejar de mirar a un sugerido lo devuelve a «Sugeridos» sin recargar', () => {
  const app = readFileSync(new URL('../app/competitor-spy/SpyApp.tsx', import.meta.url), 'utf8');
  assert.match(app, /const recargarSugeridos = async \(\) => \{\s*const r = await sugeridosAction\(\);\s*if \(r\.ok\) setSugeridos\(r\.sugeridos\);/);
  // Desde la ficha («⋯ › Dejar de mirarlo») y desde la «×» de la lista.
  const quitar = app.match(/const quitar = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
  const deLaLista = app.match(/const quitarDeLaLista = async \(id: number\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
  assert.match(quitar, /recargarSugeridos\(\)/, 'desde la ficha');
  assert.match(deLaLista, /recargarSugeridos\(\)/, 'desde la lista');
  // Desde la ficha, ANTES de `irA(null)`: después de volver a la lista no sale ningún pedido. Medido en producción después del
  // despliegue de las 15:55 UTC: con el pedido después, el borrado salía solo y Alex no volvía.
  const pide = quitar.search(/^\s*await recargarSugeridos\(\);/m);
  const vuelve = quitar.search(/^\s*irA\(null\);/m);
  assert.ok(pide >= 0 && vuelve >= 0 && pide < vuelve, 'los sugeridos se piden después de irse de la ficha');
});

test('11. Spy: la ficha dice el nombre de su tarjeta («Alex Hormozi»), no lo guardado («@AlexHormozi»)', () => {
  const app = readFileSync(new URL('../app/competitor-spy/SpyApp.tsx', import.meta.url), 'utf8');
  assert.match(app, /const nombreC = c \? nombreDeTarjeta\(c\) : '';/);
  assert.match(app, /<h1>\{nombreC\}<\/h1>/, 'el título de la ficha');
  assert.match(app, /msg=\{`¿Dejar de mirar a \$\{nombreC\}\?/, 'la confirmación desde la ficha');
  assert.match(app, /msg=\{`¿Dejar de mirar a \$\{nombreDeTarjeta\(aBorrar\)\}\?/, 'la confirmación desde la lista');
  // Ningún texto armado con lo guardado (el buscador de un canal nuevo sí lo usa para buscar: `para={{ nombre: c.nombre`).
  assert.doesNotMatch(app, /`[^`\n]*\$\{(?:c|aBorrar)\.nombre\}[^`\n]*`/, 'un texto con el nombre guardado');
});

test('12. Spy: la descripción de un video de YouTube usa el alto del modal', () => {
  const det = readFileSync(new URL('../app/competitor-spy/DetallePieza.tsx', import.meta.url), 'utf8');
  // Hasta 320 px a 900 de alto (medido: el modal sin segunda barra, 550/550); con 360 el modal se desplazaba 32 px.
  assert.match(det, /style=\{\{ maxHeight: esVideoYt \? 'clamp\(180px, calc\(min\(90vh, 800px\) - 480px\), 320px\)' : 180 \}\}><p style=\{\{ whiteSpace: 'pre-wrap' \}\}>\{textoPropio\}/);
});

test('13. Spy en el teléfono: la cara de 48 px es el dibujo chico, y el nombre cortado se lee al pasar el mouse', () => {
  const m = readFileSync(new URL('../app/m/competitor-spy/SpyM.tsx', import.meta.url), 'utf8');
  assert.match(m, /caricaturaDeCompetidor\(c\)\?\.replace\('\/asesores\/grandes\/', '\/asesores\/'\)/);
  const t = readFileSync(new URL('../app/competitor-spy/TarjetaPieza.tsx', import.meta.url), 'utf8');
  assert.match(t, /\{titulo && <b title=\{titulo\}>\{titulo\}<\/b>\}/);
});

test('10. Spy: el aviso de la cola de caricaturas ya no está (12/11, «el texto innecesario no lo pongas»)', () => {
  // Decía «lleva hace 1 d» y se arregló el 11/11; al otro día Martín pidió sacarlo entero. Lo cuida tests/spy-cola-frenada.test.ts.
  const app = readFileSync(new URL('../app/competitor-spy/SpyApp.tsx', import.meta.url), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.doesNotMatch(app, /la que más espera lleva/);
});

test('4. el 404 no le dice «Ctrl K» a un teléfono', () => {
  assert.equal(atajoBuscador('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'), null);
  assert.equal(atajoBuscador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), null);
  assert.equal(atajoBuscador('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Ctrl K');
  assert.match(readFileSync(new URL('../app/not-found.tsx', import.meta.url), 'utf8'), /\{atajo && <p/, 'la frase se dibuja aunque no haya atajo');
});

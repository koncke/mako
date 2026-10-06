// =============================================================================
// La barra de Ads Manager: qué se fue, qué quedó y dónde
// =============================================================================
// Pedido de Martín (05/10/2026), ocho puntos sobre la misma pantalla, y una segunda
// tanda de cuatro al día siguiente. Lo que se fija acá es lo que NO puede volver —los
// dos textos que sacó, los «Limpiar selección», los botones de agregar por fila, los
// emoji— y que cada acción esté donde la pidió: crear arriba a la derecha, un filtro y
// un «actualizar» a la altura de las tabs, el resto en el ⋯, y lo que opera sobre lo
// elegido en la barra de la selección. Son asserts sobre el fuente: la pantalla no se
// puede montar en node:test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r/g, '');
// Los comentarios de este repo CITAN lo que se sacó, así que un `doesNotMatch` sobre el
// archivo entero se acusa a sí mismo (AGENTS.md). Las líneas ANTES que los bloques: un
// `/*` dentro de un `//` abre un bloque que se cierra páginas abajo.
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const BROWSER = 'app/ads-manager/CampanasBrowser.tsx';
const VISTA = 'app/ads-manager/AdsManagerView.tsx';
const BARRA = 'app/ads-manager/BarraAcciones.tsx';

// El bloque de la barra de lote, cortado en su apertura real y no a N caracteres: un
// `slice` a ojo se lleva la función de al lado y el guard pasa a mirar otra cosa.
function barraDeLote() {
  const src = sinComentarios(leer(BARRA));
  const i = src.indexOf('export function BarraLoteAds');
  assert.ok(i > 0, 'BarraLoteAds tiene que existir');
  return src.slice(i);
}

test('los dos textos que Martín sacó no vuelven', () => {
  assert.doesNotMatch(sinComentarios(leer(VISTA)), /Estado \+ rendimiento/);
  assert.doesNotMatch(sinComentarios(leer(BROWSER)), /Estado en vivo de Meta \+ rendimiento del rango/);
  //   ROTO A PROPÓSITO (2026-10-05): devolviendo el kicker de la cabecera, pass 4 / fail 1.
});

test('crear está arriba y el resto vive en el ⋯, sin el desplegable negro de MaKo', () => {
  const src = sinComentarios(leer(BROWSER));
  assert.match(src, /<MenuAcciones/, 'el menú de los tres puntos');
  for (const accion of ['Subir creativos a una campaña', 'Agregar conjunto a una campaña', 'Analizar con Meta']) {
    assert.match(src, new RegExp(accion), `«${accion}» tiene que estar en el menú`);
  }
  assert.doesNotMatch(src, /MakoMenu|MakoWord/, 'el desplegable de MaKo se eliminó');
});

test('cada acción del ⋯ lleva ícono del catálogo y NINGUNA lleva subtítulo', () => {
  // «pon íconos para que se entiendan mejor… Y saca los subtitulos de esos botones»
  // (06/10). El `sub` se sacó del TIPO, que es lo que impide que vuelva de a una.
  const barra = sinComentarios(leer(BARRA));
  assert.match(barra, /export type AccionMenu = \{ label: string; icono: string; onClick/);
  assert.doesNotMatch(barra, /sub\?: string|\{a\.sub/, 'el subtítulo del menú se eliminó');
  // Y el menú las dibuja: una prop declarada que el render no lee es una salida huérfana.
  assert.match(barra, /<Icon name=\{a\.icono\}/);
  const browser = sinComentarios(leer(BROWSER));
  const menu = browser.slice(browser.indexOf('<MenuAcciones acciones={['), browser.indexOf(']} />'));
  assert.ok(menu.length > 100 && menu.length < 900, `el bloque del menú mide ${menu.length}`);
  const conIcono = menu.match(/icono: '/g)?.length ?? 0;
  const items = menu.match(/\{ label: '/g)?.length ?? 0;
  assert.equal(conIcono, items, `las ${items} acciones del menú tienen que traer ícono`);
  //   ROTO A PROPÓSITO (2026-10-06): sacándole `icono: 'meta'` a «Analizar con Meta»,
  //   pass 9 / fail 1 (2 de 3 con ícono).
});

test('el filtro dice «Filtrar» con el embudo, y «Actualizar estado» es su propio botón', () => {
  const barra = sinComentarios(leer(BARRA));
  assert.match(barra, /<Icon name="funnel"/, 'el ícono del embudo que mandó');
  assert.match(barra, /\n\s*Filtrar\n/, 'el rótulo es «Filtrar», no «Filtros»');
  assert.doesNotMatch(barra, /⚙/, 'el engranaje se fue');
  const browser = sinComentarios(leer(BROWSER));
  assert.match(browser, /aria-label="Actualizar estado"/, 'salió del ⋯ a su propio botón');
  assert.match(browser, /<Icon name="regenerar"/);
  //   ROTO A PROPÓSITO (2026-10-06): devolviendo «⚙ Filtros» al botón, pass 9 / fail 1.
});

test('un solo filtro, y ningún «Limpiar selección»', () => {
  const src = sinComentarios(leer(BROWSER));
  assert.match(src, /<FiltrosMenu/);
  // El checkbox de la cabecera selecciona todo y lo suelta: un botón aparte era el segundo.
  assert.doesNotMatch(src, /Limpiar selección|>Limpiar</);
  assert.match(src, /onChange=\{toggleAll\}/, 'el checkbox de seleccionar todo sigue ahí');
  //   ROTO A PROPÓSITO (2026-10-05): devolviendo un botón «Limpiar selección» a la barra,
  //   pass 4 / fail 1. Como COMENTARIO no falla, y está bien: el guard los saca.
});

test('la barra de lote es un interruptor, no dos botones', () => {
  assert.match(barraDeLote(), /role="switch"/, 'activar/pausar es UN control');
  const src = sinComentarios(leer(BROWSER));
  assert.match(src, /<BarraLoteAds/);
  assert.match(src, /bulkPresupuesto/);
  assert.match(src, /bulkProducto/);
});

test('la barra de lote lleva ícono Y TEXTO en cada acción, y ni un emoji', () => {
  // «no exageres con poner solo iconos y nada de botones con texto, porque se acumularon
  // todos a la izquierda y no se entiende… No pongas emoji, siempre iconos» (06/10).
  const bloque = barraDeLote();
  for (const rotulo of ['Presupuesto', 'Producto', 'Renombrar', 'Agregar conjunto', 'Agregar anuncio', 'Eliminar']) {
    assert.match(bloque, new RegExp(`>${rotulo}</BotonLote>`), `falta el botón «${rotulo}» con su texto`);
  }
  for (const icono of ['sales', 'tag', 'notepencil', 'users', 'creativos', 'trash']) {
    assert.match(bloque, new RegExp(`icono="${icono}"`), `el botón de «${icono}» tiene que traer su ícono`);
  }
  // Emoji y pictogramas: el rango que incluye 💲🎯🗑, que es lo que había.
  const emoji = bloque.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  assert.equal(emoji, null, `la barra no puede tener emoji: ${emoji?.join(' ')}`);
  //   ROTO A PROPÓSITO (2026-10-06): volviendo «Eliminar» a `>🗑 Eliminar<` sin BotonLote,
  //   pass 9 / fail 1 (cae por el rótulo Y por el emoji).
});

test('agregar conjunto/anuncio vive en la selección, no en cada fila', () => {
  const src = sinComentarios(leer(BROWSER));
  assert.doesNotMatch(src, /\+ conjunto|\+ anuncio|\+conjunto|\+anuncio/, 'los botones por fila se eliminaron');
  // Y se mudaron: la barra los recibe, y sólo con UNA fila elegida (un conjunto cuelga
  // de una campaña, no de seis).
  assert.match(src, /onAgregarConjunto=\{level === 'campaign' && unaSola \?/);
  assert.match(src, /onAgregarAnuncio=\{level === 'adset' && unaSola \?/);
  assert.match(src, /const unaSola = selSet\.size === 1 \?/);
  // El renombrado es de lo ELEGIDO, no de la tab entera.
  assert.match(src, /onRenombrar=\{\(\) => setRenameOpen\(true\)\}/);
  assert.match(src, /entities=\{renameEntities\.filter\(\(e\) => selSet\.has\(e\.id\)\)\}/);
  //   ROTO A PROPÓSITO (2026-10-06): devolviendo el `{ label: '+ conjunto', … }` a
  //   `rowActionsFor`, pass 9 / fail 1.
});

test('ni un emoji en toda la tab: siempre un ícono del catálogo', () => {
  // «No pongas emoji, siempre iconos para que sea mas profesional» (06/10). El guard es
  // de la tab ENTERA y no de la barra: los que había no estaban donde se los buscó —el
  // 👥 por fila, pero también un segundo ✎ en la celda del presupuesto, el ⓘ del chip de
  // problemas y un 📅/📝 adentro del modal de renombrar, que es donde ahora entra el
  // «Renombrar» de la selección—. Un guard acotado a `rowActionsFor` los dejaba pasar.
  //
  // Se persiguen los PLANOS pictográficos. ✓ (2713), ✕ (2715) y ✦ (2726) quedan afuera a
  // propósito: son tipografía monocroma que el repo usa en todos sus modales, no emoji.
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2460}-\u{24FF}\u{2B00}-\u{2BFF}]/gu;
  for (const rel of [BROWSER, BARRA, VISTA, 'app/ads-manager/ProductoCelda.tsx']) {
    const hits = sinComentarios(leer(rel)).match(EMOJI);
    assert.equal(hits, null, `${rel} dibuja un emoji en vez de un <Icon>: ${hits?.join(' ')}`);
  }
  // Y los dos lápices de una misma fila son el MISMO ícono, no uno dibujado y otro escrito.
  const src = sinComentarios(leer(BROWSER));
  assert.equal(src.match(/<Icon name="pen" size=\{1[23]\} \/>/g)?.length, 2, 'el del nombre y el del presupuesto');
  assert.match(src, /icono: 'users'/, '«Público» lleva ícono, no el 👥');
  //   ROTO A PROPÓSITO (2026-10-06): devolviendo el `✎` escrito a la celda del
  //   presupuesto, pass 9 / fail 1 (cae por el conteo de lápices). Y con un `🗑` en
  //   el chip de problemas, pass 9 / fail 1 (cae por el barrido de emoji).
});

test('un conjunto sin producto propio dice el de SU campaña, no «sin asignar»', () => {
  // El ruteo ya es así (funnelIdDeCampana: el conjunto gana sólo si tiene uno propio); lo
  // que faltaba era decirlo, porque «Sin asignar» sobre un conjunto que SÍ entra a un
  // producto lleva a asignarlo de nuevo uno por uno.
  assert.match(sinComentarios(leer('app/ads-manager/ProductoCelda.tsx')), /por su campaña/);
  assert.match(sinComentarios(leer(BROWSER)), /heredadoDe=/);
  //   ROTO A PROPÓSITO (2026-10-05): sacando el `heredadoDe` de la celda, pass 4 / fail 1.
});

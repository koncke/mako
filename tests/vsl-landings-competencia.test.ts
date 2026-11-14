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
});

// Martín, 14/11/2026: «si vas a poner en otros lugares preguntas frecuentes, tienen que ser siempre las mismas que están en la landing
// principal». Toda landing con preguntas muestra las de la portada (app/vsl/_sitio/preguntas.ts, puestas por el registro).
test('las preguntas de cada landing son las de la portada', async () => {
  const { PREGUNTAS_SITIO } = await import('../app/vsl/_sitio/preguntas');
  let con = 0;
  for (const l of LANDINGS_COMPETENCIA) {
    for (const b of l.bloques) {
      if (b.tipo !== 'preguntas') continue;
      con++;
      assert.deepEqual(b.items.map((q) => q.p), PREGUNTAS_SITIO.map((q) => q.p), `${l.slug}: otras preguntas`);
    }
  }
  assert.ok(con >= 10, `sólo ${con} landings con preguntas: el barrido no está mirando`);
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

test('cada landing lleva la barra del sitio arriba y esconde la copiada de su referencia', async () => {
  // Martín, 12/11/2026: «me voy a otra tab y después ya no sale la top bar de arriba para seguir navegando».
  const { BARRA_PROPIA } = await import('../app/vsl/_competencia/TemaSitio');
  for (const l of LANDINGS_COMPETENCIA) {
    if (!DISENOS[l.slug]) continue;
    const html = dibujar(l);
    assert.ok(html.includes('s-solo-barra'), `${l.slug}: sin la barra del sitio`);
    for (const [r, que] of [['/vsl/comparaciones', 'Comparaciones'], ['/planes', 'Precios'], ['/login', 'Iniciar sesión']] as const) {
      assert.ok(html.includes(`href="${r}">${que}</a>`), `${l.slug}: la barra sin «${que}»`);
    }
    const sel = BARRA_PROPIA[l.slug];
    assert.ok(sel, `${l.slug}: falta su barra en BARRA_PROPIA (quedaría debajo de la del sitio)`);
    const propia = html.search(new RegExp(`class="[^"]*\\b${sel.slice(1)}\\b`));
    assert.ok(propia > 0, `${l.slug}: ${sel} no está en la página: ¿cambió la clase de su barra?`);
    assert.ok(html.indexOf('s-solo-barra') < propia, `${l.slug}: la barra del sitio va antes que la copiada`);
    assert.ok(html.includes(`${sel}{display:none!important}`), `${l.slug}: su barra copiada no se esconde`);
  }
});

// Martín, 14/11/2026, noche: «no funcionan los botones de cada cosa, por ejemplo, desde Chrome con un clic o le pegas». Eran pestañas
// sin pantalla (el recuadro de «falta»). Como Foreplay, cada pestaña de Competitor Spy cambia la pantalla de la derecha: una grabación
// de la app real por pestaña, el archivo y su póster en public/, el script que cambia al pasar el mouse y la lluvia del «antes».
// PROBADO ROMPIÉNDOLO (14/11/2026): sacar «O lo pegas» de GRABACION_DE_PESTANA → falla «sin su pantalla»; renombrar spy-pegar.webm en
// el mapa → falla «falta public/…»; sacar el <script> de la lluvia → falla «sin su lluvia».
test('Competitor Spy: cada pestaña tiene su pantalla grabada, y la lluvia del «antes» su script', async () => {
  const { GRABACION_DE_PESTANA } = await import('../app/vsl/_competencia/disenos/competitor-spy');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'competitor-spy');
  assert.ok(l, 'falta la landing de Competitor Spy');
  const html = dibujar(l);
  let pestanas = 0;
  for (const b of l.bloques) {
    if (b.tipo !== 'tarjetas') continue;
    for (const it of b.items) {
      pestanas++;
      const titulo = it.titulo.replace(/<[^>]+>/g, '');
      const g = GRABACION_DE_PESTANA[titulo];
      assert.ok(g, `«${titulo}»: sin su pantalla`);
      for (const f of [g.video, g.poster]) assert.ok(existsSync(join(RAIZ, 'public', f)), `«${titulo}»: falta public${f}`);
      assert.ok(html.includes(`src="${g.video}"`), `«${titulo}»: su video no se dibuja`);
    }
  }
  assert.ok(pestanas >= 12, `sólo ${pestanas} pestañas: el barrido no está mirando`);
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  // Los scripts del diseño van con data-visor (el visor de Martín borra los demás).
  const scripts = html.split('<script data-visor="">').slice(1).map((x) => x.slice(0, x.indexOf('</script>')));
  assert.ok(scripts.some((x) => x.includes('mouseover') && x.includes("'d-competitor-spy'") && x.includes('-tab')), 'las pestañas sin su script (hover y video)');
  assert.ok(scripts.some((x) => x.includes('-lluvia') && x.includes('IntersectionObserver')), 'el «antes» sin su lluvia');
  assert.ok((html.match(/class="d-competitor-spy-cae /g) ?? []).length >= 16, 'la lluvia con menos de 16 piezas (las de la computadora)');
});

// Martín, 14/11/2026, noche: «que la copia salga muy fiel… los videos que tienen, las animaciones». Como Atlas AI, el hero de Offer
// lleva un video que arranca solo y que, al bajar, sigue en una ventanita flotante; donde la referencia pone imágenes de su producto
// van pantallas REALES de Offer (banco C:/dev/bancos-portada/banco-offer), nunca el recuadro de «falta».
// PROBADO ROMPIÉNDOLO (14/11/2026): renombrar pieza-nota.jpg en FOTOS_PIEZAS → falla «falta public/…»; sacar una foto de la lista →
// falla «una foto por pieza»; sacar `-flota` del script → falla «sin su ventanita».
test('Offer: el hero lleva la grabación real y flota al bajar, y cada pieza su pantalla', async () => {
  const { VIDEO_OFFER, FOTO_TARJETA, PANTALLA_OFFER, FOTOS_PIEZAS } = await import('../app/vsl/_competencia/disenos/offer');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'offer');
  assert.ok(l, 'falta la landing de Offer');
  const html = dibujar(l);
  for (const f of [VIDEO_OFFER.video, VIDEO_OFFER.poster, FOTO_TARJETA, PANTALLA_OFFER, ...FOTOS_PIEZAS.map((x) => x.src)]) {
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`"${f}"`), `${f} no se dibuja`);
  }
  const piezas = l.bloques.find((b) => b.tipo === 'tarjetas' && b.fondo);
  assert.ok(piezas && piezas.tipo === 'tarjetas', 'Offer sin su grilla de piezas');
  assert.equal(FOTOS_PIEZAS.length, piezas.items.length, 'una foto por pieza, en el orden de las piezas');
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  const scripts = html.split('<script data-visor="">').slice(1).map((x) => x.slice(0, x.indexOf('</script>')));
  assert.ok(scripts.some((x) => x.includes("'d-offer'") && x.includes('-flota') && x.includes('IntersectionObserver')), 'el video sin su ventanita flotante');
});

test('Chats: cada pestaña de la galería tiene su pantalla grabada, y cada pieza sus recortes reales', async () => {
  const { PANTALLA_DE_PESTANA, RECORTES_DE_PIEZA, POSTER_CASO } = await import('../app/vsl/_competencia/disenos/whatsapp');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'whatsapp');
  assert.ok(l, 'falta la landing de Chats');
  const html = dibujar(l);
  const filas = l.bloques.find((b) => b.tipo === 'filas');
  assert.ok(filas && filas.tipo === 'filas' && filas.items.length >= 4, 'Chats sin las pestañas de su galería');
  for (const it of filas.items) {
    const g = PANTALLA_DE_PESTANA[it.titulo];
    assert.ok(g, `«${it.titulo}»: sin su pantalla`);
    for (const f of [g.video, g.poster]) assert.ok(existsSync(join(RAIZ, 'public', f)), `«${it.titulo}»: falta public${f}`);
    assert.ok(html.includes(`src="${g.video}"`), `«${it.titulo}»: su video no se dibuja`);
  }
  const piezas = l.bloques.find((b) => b.tipo === 'tarjetas' && b.columnas === 2);
  assert.ok(piezas && piezas.tipo === 'tarjetas', 'Chats sin sus cuatro piezas');
  assert.equal(RECORTES_DE_PIEZA.length, piezas.items.length, 'una composición por pieza');
  for (const f of [...RECORTES_DE_PIEZA.flatMap((r) => r.ventanas.map((v) => v.src)), POSTER_CASO]) {
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`src="${f}"`), `${f} no se dibuja`);
  }
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  const scripts = html.split('<script data-visor="">').slice(1).map((x) => x.slice(0, x.indexOf('</script>')));
  assert.ok(scripts.some((x) => x.includes("'d-whatsapp'") && x.includes('-stage') && x.includes('IntersectionObserver')), 'la galería sin su script');
});

// Martín, 14/11/2026, noche: «que la copia salga muy fiel… los videos que tienen, las animaciones». Como GoHighLevel, la imagen del hero
// de CRM es la grabación REAL del CRM que abre el mini-VSL en una ventana, cada pestaña del ciclo trae su lista y su video (o el recuadro
// de lo que falta grabar), y el script sube los contadores, prende la franja fija y abre el popup de salida.
// PROBADO ROMPIÉNDOLO (14/11/2026): renombrar ficha-hero.webm en VIDEO_HERO_CRM → falla «falta public/…»; sacar un video de VIDEOS_CICLO
// → falla «un video por pestaña»; sacar `-fija` del script → falla «sin su script».

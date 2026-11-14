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

// Martín, 14/11/2026, noche: «que la copia salga muy fiel… los videos que tienen, las animaciones». Como Leadsales, la galería del hero
// de Chats cambia de pantalla por pestaña: donde ella pone capturas de su app van grabaciones de Chats REAL (bancos de
// C:/dev/bancos-portada), cada pieza lleva recortes de pantallas reales y el testimonio pone el video en el lugar.
// PROBADO ROMPIÉNDOLO (14/11/2026): sacar «Contacto» de PANTALLA_DE_PESTANA → falla «sin su pantalla»; renombrar pieza-difusion.jpg
// → falla «falta public/…»; sacar `-stage` del script → falla «la galería sin su script».
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
test('CRM: el hero lleva la grabación real que abre el mini-VSL, y cada pestaña su lista y su video', async () => {
  const { VIDEO_HERO_CRM, VIDEOS_CICLO } = await import('../app/vsl/_competencia/disenos/crm');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'crm');
  assert.ok(l, 'falta la landing de CRM');
  const html = dibujar(l);
  const ciclo = l.bloques.find((b) => b.tipo === 'tarjetas' && b.items.some((it) => it.meta));
  assert.ok(ciclo && ciclo.tipo === 'tarjetas', 'CRM sin las pestañas de su ciclo');
  assert.equal(VIDEOS_CICLO.length, ciclo.items.length, 'un video por pestaña, en el orden de las pestañas');
  for (const it of ciclo.items) assert.ok(it.puntos && it.puntos.length >= 3, `«${it.meta}»: sin su lista`);
  const videos = VIDEOS_CICLO.flatMap((v) => ('video' in v ? [v.video, v.poster] : []));
  for (const f of [VIDEO_HERO_CRM.video, VIDEO_HERO_CRM.poster, ...videos]) {
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`"${f}"`), `${f} no se dibuja`);
  }
  assert.match(html, /data-src="https:\/\/player-vz-[^"]+pandavideo\.com/, 'la ventana del hero sin el mini-VSL de Panda');
  const scripts = html.split('<script data-visor="">').slice(1).map((x) => x.slice(0, x.indexOf('</script>')));
  assert.ok(scripts.some((x) => x.includes("'d-crm'") && x.includes('data-fin') && x.includes('-fija') && x.includes('-salida')), 'sin su script');
});

test('Agenda: el hero turna dos pantallas reales, cada pestaña y cada tarjeta trae la suya, y el script va con data-visor', async () => {
  const { VISTAS_HERO, PANTALLA_DE_PESTANA, FOTO_DE_TARJETA, VIDEO_RESERVAS, VIDEO_EQUIPO } = await import('../app/vsl/_competencia/disenos/agenda');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'agenda');
  assert.ok(l, 'falta la landing de Agenda');
  const html = dibujar(l);
  const tarjetas = l.bloques.filter((b): b is Extract<Bloque, { tipo: 'tarjetas' }> => b.tipo === 'tarjetas');
  assert.equal(VISTAS_HERO.length, 2, 'el hero turna dos vistas');
  assert.equal(PANTALLA_DE_PESTANA.length, tarjetas[0].items.length, 'una pestaña sin su pantalla');
  assert.equal(FOTO_DE_TARJETA.length, tarjetas[1].items.length, 'una tarjeta sin su foto');
  for (const v of [...VISTAS_HERO, ...PANTALLA_DE_PESTANA, VIDEO_RESERVAS, VIDEO_EQUIPO]) {
    for (const f of [v.video, v.poster]) assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`src="${v.video}"`), `no se dibuja ${v.video}`);
  }
  for (const f of FOTO_DE_TARJETA) {
    assert.ok(existsSync(join(RAIZ, 'public', f.src)), `falta public${f.src}`);
    assert.ok(html.includes(`src="${f.src}"`), `no se dibuja ${f.src}`);
  }
  for (const it of tarjetas[0].items) assert.ok((it.puntos?.length ?? 0) >= 2, `«${it.titulo}» sin su lista`);
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  const scripts = html.split('<script data-visor="">').slice(1).map((x) => x.slice(0, x.indexOf('</script>')));
  assert.ok(scripts.some((x) => x.includes("'d-agenda-'") && x.includes('pastilla') && x.includes('prog')), 'sin su script');
});

test('Cobranza: el hero turna cuatro pantallas reales, cada pieza trae su grabación y el script mueve las secciones pegadas', async () => {
  const { HERO_GRUPOS, PANTALLAS_PIEZAS, SDK_STRIPE, SDK_MP } = await import('../app/vsl/_competencia/disenos/cobranza');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'cobranza');
  assert.ok(l, 'falta la landing de Cobranza');
  const html = dibujar(l);
  const piezas = l.bloques.find((b) => b.tipo === 'filas');
  assert.ok(piezas && piezas.tipo === 'filas', 'Cobranza sin sus piezas');
  assert.equal(PANTALLAS_PIEZAS.length, piezas.items.length, 'una grabación por pieza, en el orden de las piezas');
  assert.equal(HERO_GRUPOS.length, 4, 'el hero de Rebill turna cuatro grupos');
  const archivos = [...HERO_GRUPOS.flatMap((g) => [g.caja.src, g.chico.src]), ...PANTALLAS_PIEZAS.flatMap((g) => [g.video, g.poster]),
    SDK_STRIPE.forma.src, SDK_STRIPE.codigo.src, SDK_MP.base.src, SDK_MP.tarjeta.src];
  for (const f of archivos) {
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`"${f}"`), `${f} no se dibuja`);
  }
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  const scripts = html.split('<script data-visor="">').slice(1).map((x) => x.slice(0, x.indexOf('</script>')));
  assert.ok(scripts.some((x) => x.includes("'d-cobranza'") && x.includes('-int-slides') && x.includes('-sdk-centro') && x.includes('ck-g') && x.includes('faq-card')), 'sin su script');
});

// Agenda como iClosed (14/11/2026, noche): el hero son dos vistas grabadas que se turnan como su demo («CRM» y «WhatsApp»), cada pestaña
// de «Mantén los mismos funnels» trae su grabación y su lista que se marca, cada tarjeta de «Todo lo que tu agenda…» su foto real, y el
// script que mueve las líneas de tiempo va con data-visor (el visor borra los demás).
// PROBADO ROMPIÉNDOLO (14/11/2026): `vincular.webm` → `vincularx.webm` en PANTALLA_DE_PESTANA → falla «falta public/…»; sin `puntos` en la
// segunda pestaña → falla «sin su lista»; `data-visor` sacado del <script> → falla «sin su script».

test('Email: el hero funde dos pantallas reales y cada tarjeta trae la suya, con los disparadores y segmentos de la app', async () => {
  const { HERO_EMAIL, PANTALLA_DE_TARJETA } = await import('../app/vsl/_competencia/disenos/email');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'email');
  assert.ok(l, 'falta la landing de Email');
  const html = dibujar(l);
  assert.equal(HERO_EMAIL.length, 2, 'el hero funde dos imágenes, como el suyo');
  const piezas = l.bloques.find((b) => b.tipo === 'tarjetas');
  assert.ok(piezas && piezas.tipo === 'tarjetas' && piezas.items.length === 6, 'Email sin sus seis tarjetas por producto');
  const fotos = [...HERO_EMAIL.map((f) => f.src)];
  for (const it of piezas.items) {
    const pant = PANTALLA_DE_TARJETA[it.titulo];
    assert.ok(pant, `«${it.titulo}»: sin su pantalla`);
    fotos.push(pant.src, pant.tel);
    assert.ok(it.meta, `«${it.titulo}»: sin la frase de su cara de atrás`);
    assert.equal(it.puntos?.length, 6, `«${it.titulo}»: su cara de atrás lleva seis recuadros`);
    for (const p of it.puntos ?? []) assert.match(p, /^[^:]+: \S/, `«${it.titulo}»: «${p}» no es «Título: texto»`);
  }
  for (const f of fotos) {
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`"${f}"`), `${f} no se dibuja`);
  }
  // Lo que la tarjeta nombra es lo que la pantalla muestra: los disparadores (TRIGGERS) y los segmentos (SEGMENTOS) de la app.
  const app = leer('lib/email-marketing.ts');
  const titulos = (t: string) => (piezas.items.find((x) => x.titulo === t)?.puntos ?? []).map((p) => p.slice(0, p.indexOf(': ')));
  for (const h of titulos('Secuencias')) assert.ok(app.includes(`label: '${h}'`), `«${h}» no es un disparador de la app`);
  for (const h of titulos('Envíos').slice(0, 5)) assert.ok(app.includes(`label: '${h}'`), `«${h}» no es un segmento de la app`);
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  // Lo que se mueve es CSS (sin script, como medido): el fundido con sus cuadros clave y la tarjeta que se da vuelta con su radio.
  assert.match(html, /@keyframes d-email-funde-a\{0%,to\{opacity:1/, 'el hero sin su fundido');
  assert.ok(html.includes('.d-email-tile:has(> .d-email-radio:checked) .d-email-atras{opacity:1'), 'las tarjetas no se dan vuelta');
  assert.equal((html.match(/class="d-email-radio"/g) ?? []).length, 6, 'un radio por tarjeta');
});

// Martín, 14/11/2026, noche: «que la copia salga muy fiel… los videos que tienen, las animaciones». Como Rebill, el hero de Cobranza
// turna cuatro «checkouts» cada 4 s (aquí, la ficha REAL de un cliente con la ventana de ese cobro encima), cada pieza de la sección
// pegada trae su grabación de la app y el script mueve las dos secciones pegadas, el giro de la tercera forma y las preguntas.
// PROBADO ROMPIÉNDOLO (14/11/2026): renombrar hero-2.webp en HERO_GRUPOS → falla «falta public/…»; sacar una grabación de
// PANTALLAS_PIEZAS → falla «una grabación por pieza»; sacar `-int-slides` del script → falla «sin su script».

test('Dashboard: el hero, la caja y cada pestaña llevan su grabación real, cada tarjeta su pieza, y los tableros salen del código', async () => {
  const { VIDEO_HERO, VIDEO_NUEVA_HOJA, FOTO_FLOTA, FOTOS_TARJETAS, PANTALLA_DE_PESTANA } = await import('../app/vsl/_competencia/disenos/dashboard');
  const { PLANTILLAS_OFRECIDAS, PLANTILLAS_GENERAL_OFRECIDAS } = await import('../lib/graficos-plantillas');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'dashboard');
  assert.ok(l, 'falta la landing de Dashboard');
  const html = dibujar(l);
  const pasos = l.bloques.find((b): b is Extract<Bloque, { tipo: 'pasos' }> => b.tipo === 'pasos');
  assert.ok(pasos, 'sin «Conoce la herramienta»');
  assert.equal(PANTALLA_DE_PESTANA.length, pasos.pasos.length, 'una pestaña sin su pantalla');
  const pastel = l.bloques.find((b): b is Extract<Bloque, { tipo: 'tarjetas' }> => b.tipo === 'tarjetas' && !!b.fondo);
  assert.ok(pastel && FOTOS_TARJETAS.length === 7 && pastel.items.length >= 7, 'las siete tarjetas pastel, cada una con su pieza');
  for (const v of [VIDEO_HERO, VIDEO_NUEVA_HOJA, ...PANTALLA_DE_PESTANA]) {
    for (const f of [v.video, v.poster]) assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`src="${v.video}"`), `no se dibuja ${v.video}`);
  }
  for (const f of [FOTO_FLOTA, ...FOTOS_TARJETAS]) {
    assert.ok(existsSync(join(RAIZ, 'public', f.src)), `falta public${f.src}`);
    assert.ok(html.includes(`src="${f.src}"`), `no se dibuja ${f.src}`);
  }
  const tableros = [...PLANTILLAS_GENERAL_OFRECIDAS, ...PLANTILLAS_OFRECIDAS];
  assert.ok(html.includes(`${tableros.length} tableros listos`), 'el número de tableros listos no es el del código');
  for (const p of tableros) assert.ok(html.includes(p.nombre), `falta el tablero «${p.nombre}» en el muro`);
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  const scripts = html.split('<script data-visor="">').slice(1).map((x) => x.slice(0, x.indexOf('</script>')));
  assert.ok(scripts.some((x) => x.includes("'d-dashboard'") && x.includes('herr-radio') && x.includes('revelada')), 'sin su script');
});

// Ads Analyst como Gethookd (14/11/2026, noche): su demo escribe cuatro preguntas y deja caer las tarjetas (acá con los anuncios, los
// destinos, los formatos y el guion replicado de Alex Hormozi, los REALES que lee Spy), cada tarjeta de la columna de la app trae su
// grabación de MaKo, el cierre corre con anuncios de Hormozi, y el script (la demo, las apariciones, las barras, los videos y el paso
// 3) va con data-visor.
// PROBADO ROMPIÉNDOLO (14/11/2026): `hooks.webm` → `hooksx.webm` en FILAS_DE_LA_APP → falla «falta public/…»; una fila menos en
// FILAS_DE_LA_APP → falla «una tarjeta sin su grabación»; sacar `data-bar` del script → falla «sin su script».

test('Ads Analyst: la demo trae sus cuatro preguntas con datos de Spy, cada tarjeta de la app su grabación y el script va con data-visor', async () => {
  const { FILAS_DE_LA_APP, ANUNCIOS_ACTIVOS, CINTAS_CIERRE, PASO_PREGUNTA } = await import('../app/vsl/_competencia/disenos/script');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'script');
  assert.ok(l, 'falta la landing de Ads Analyst');
  const html = dibujar(l);
  const filas = l.bloques.find((b) => b.tipo === 'filas');
  assert.ok(filas && filas.tipo === 'filas', 'Ads Analyst sin su columna de la app');
  assert.equal(FILAS_DE_LA_APP.length, filas.items.length, 'una tarjeta sin su grabación');
  for (const v of [...FILAS_DE_LA_APP, PASO_PREGUNTA]) {
    for (const f of [v.video, v.poster]) assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`src="${v.video}"`), `no se dibuja ${v.video}`);
  }
  for (const id of [...ANUNCIOS_ACTIVOS.map((a) => a.id), ...CINTAS_CIERRE.flat()]) {
    const f = `/vsl-assets/script/anuncio-${id}.jpg`;
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`src="${f}"`), `no se dibuja ${f}`);
  }
  const pregunta = l.bloques.find((b) => b.tipo === 'tarjetas' && b.columnas !== 2);
  assert.ok(pregunta && pregunta.tipo === 'tarjetas', 'sin «Pregúntale a tu IA»');
  assert.equal((html.match(/data-fila="/g) ?? []).length, pregunta.items.length, 'una pregunta sin sus tarjetas');
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  const scripts = html.split('<script data-visor="">').slice(1).map((x) => x.slice(0, x.indexOf('</script>')));
  assert.ok(scripts.some((x) => x.includes("'d-script'") && x.includes('data-fila') && x.includes('data-bar') && x.includes('-rv-on') && x.includes('IntersectionObserver')), 'sin su script');
});

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
// Lo propio de la landing: sin la grilla del resto (las de la cara común) y sin el PIE DEL SITIO, que es el mismo en todas las páginas
// y lleva el link legal a /reembolsos (la política que piden Stripe y Mercado Pago, 15/11/2026): un link a la política no es una
// garantía de devolución que la landing prometa.
const propio = (html: string) => {
  const sinPie = html.includes('<div class="s-sitio s-solo-pie') ? html.slice(0, html.indexOf('<div class="s-sitio s-solo-pie')) : html;
  return sinPie.includes('<nav class="mk-more"') ? sinPie.slice(0, sinPie.indexOf('<nav class="mk-more"')) : sinPie;
};
/** El texto que se lee: sin etiquetas, sin el <style> y con las entidades más comunes resueltas. */
const textoVisible = (html: string) => html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

/** Lo que identifica a un bloque en lo dibujado, tal cual se escribió (los títulos van crudos, sin escapar). */
function huella(b: Bloque): string {
  switch (b.tipo) {
    case 'caso': return 'De meses de menos de';
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
    // «Comparaciones» está adentro de «Recursos» desde el 15/11/2026 (Martín: «en lugar de poner comparaciones en la top bar, pondría
    // recursos»): tests/sitio-recursos-y-pie.test.ts.
    for (const [r, que] of [['/vsl/comparaciones', 'Todas las comparaciones'], ['/planes', 'Precios'], ['/login', 'Iniciar sesión']] as const) {
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

// Martín, 14/11/2026, noche: «que la copia salga muy fiel… los videos que tienen, las animaciones». Como beehiiv, el hero de Email funde
// dos imágenes (aquí, dos pantallas REALES de Email, banco C:/dev/bancos-portada/banco-email-landing) y cada una de las seis tarjetas por
// producto lleva su pantalla y, atrás, sus seis recuadros; los nombres de los disparadores y de los segmentos son los de la app.
// PROBADO ROMPIÉNDOLO (14/11/2026): renombrar dominio.webp en PANTALLA_DE_TARJETA → falla «falta public/…»; «No asistió a su llamada» en
// vez de «No asistió a R1» → falla «no es un disparador de la app»; sacar los cuadros clave del fundido → falla «sin su fundido».
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


// Martín, 14/11/2026, noche: la copia fiel de Reportei con las pantallas REALES del Dashboard. Su hero (una imagen) es la hoja Marketing
// grabada con la cámara; su video de la caja, «Nueva hoja»; cada tarjeta pastel, la foto de la pieza que nombra; cada pestaña de «Conoce
// la herramienta», la entrada de su hoja. Los tableros que corren donde iban sus logos de clientes se cuentan del código.
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

// Funnels como Hyros (14/11/2026, noche): Hyros publicó una portada nueva ese día y la copia del 11/11 ya no se parecía. Como su panel
// de escenas, el hero turna cuatro grabaciones de la app REAL (la ficha del lead y la hoja Marketing del Dashboard) y la lámina lleva
// la de «Editar con MaKo»: cada archivo y su póster en public/, el script de las escenas con data-visor, y nada de lo que Hyros tiene y
// MaKo no (su App Store, su MCP, sus cifras). Lo que se le pide a «Editar con MaKo» son sugerencias de la app y un gráfico del catálogo,
// y los eventos de las tarjetas son los que MaKo le manda a Meta.
// PROBADO ROMPIÉNDOLO (14/11/2026): `pauta` → `pautas` en ESCENAS_HERO → falla «falta public/…»; sacar data-visor del <script> → falla
// «sin su script»; «Agrega los leads por mes» en PEDIDOS_EDITAR → falla «no es una sugerencia de la app».
test('Funnels: el hero turna cuatro pantallas reales, la lámina lleva «Editar con MaKo» y el script va con data-visor', async () => {
  const { ESCENAS_HERO, PEDIDOS_EDITAR } = await import('../app/vsl/_competencia/funnel');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'funnel');
  assert.ok(l, 'falta la landing de Funnels');
  const html = dibujar(l);
  assert.equal(ESCENAS_HERO.length, 4, 'el hero turna cuatro escenas');
  for (const v of [...ESCENAS_HERO.map((e) => e.video), 'editar']) {
    for (const ext of ['webm', 'jpg']) {
      const f = `/vsl-assets/funnel/${v}.${ext}`;
      assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
      assert.ok(html.includes(f), `no se dibuja ${f}`);
    }
  }
  assert.match(html, /<script data-visor="">\(function\(\)\{\s*var P='d-funnel'/, 'Funnels sin su script (data-visor)');
  const t = textoVisible(propio(html));
  assert.doesNotMatch(t, /App Store|\bMCP\b|\$5B|15 ?%/, 'Funnels promete lo de Hyros');
  const panel = leer('app/dashboard/PanelEditarMako.tsx');
  for (const p of PEDIDOS_EDITAR.slice(0, 2)) assert.ok(panel.includes(`'${p.pedido}'`), `«${p.pedido}» no es una sugerencia de la app`);
  assert.match(leer('lib/graficos-catalogo.ts'), /r\('cac', 'CAC'/, 'el CAC ya no está en el catálogo');
  const capi = leer('lib/meta-capi-payload.ts');
  for (const ev of ['QualifiedLead', 'Purchase']) assert.ok(capi.includes(ev), `MaKo ya no le manda «${ev}» a Meta`);
});

// Closing como Hyperbound (16/11/2026): donde su página pone su muro de logos de clientes va lo que trae cada llamada analizada, CONTADO DEL
// CÓDIGO (las 7 dimensiones del análisis, DIM_CANON de lib/closing.ts, y los rótulos de la ficha de la llamada; el de la pestaña en inglés,
// «Transcript», entre comillas); la última de sus cinco filas trae los logos de los grabadores que se conectan HOY, y la de los cierres la
// hoja Closing (números de ejemplo); el aviso de Pro sale del plan; no nombra las dos reuniones (salieron de los funnels el 16/11/2026); y
// su fila de la portada va entre Chats y los tableros, y su lugar en Producto › Sales.
// ⚠️ LO QUE ESCRIBE EL ANÁLISIS ES DE UNA LLAMADA REAL (la regla de Martín del 12/11 y el 13/11/2026: lo que escribió la IA tiene que ser
// algo que MaKo hizo de verdad). Las tres primeras filas y la fila de la portada mostraban una llamada INVENTADA (la de «Paola Núñez con
// Ana»: un 7.1 con notas, citas, objeciones y coaching que MaKo nunca escribió): esas fotos y la grabación no pueden volver a public/ (se
// movieron a C:/dev/bancos-portada/banco-closing-landing/descartadas/). Desde el 16/11/2026 (noche) las tres filas llevan animaciones con
// llamadas REALES de Mauricio, sólo sus notas (app/vsl/_sitio/ClosingNotas.tsx y la llamada de la portada, sin la hoja), y ningún
// recuadro de «falta».
// PROBADO ROMPIÉNDOLO (16/11/2026; base 20 / 0 antes del recuadro): `hoja-tasa.jpg` → `hoja-tasax.jpg` en FOTOS_CLOSING → falla «falta
// public/…»; el aviso de Pro sacado de la bajada → falla «es de Pro y la landing no lo dice»; «la R2» en el texto de una fila → falla «las
// dos reuniones»; la fila de la portada movida después de los tableros → falla «entre Chats y los tableros». Y las del recuadro (16/11,
// base 24 / 0, cada una 23 / 1): el recuadro de la primera fila sacado → falla «la fila 1 sin su recuadro»; la grabación inventada de
// vuelta en la fila de la portada → falla «la fila de Closing de la portada tiene que llevar el recuadro»; puntaje.jpg copiado de vuelta
// a public/vsl-assets/closing/ → falla «es de la llamada inventada y volvió a public/». Y las de las animaciones (16/11, noche): la fila
// del coaching con el recuadro de vuelta → falla «la fila 2 sin su animación»; una nota de octubre en 4 → falla «no subió en octubre».
test('Closing: el muro sale del código, lo que escribe el análisis es de llamadas reales, los grabadores sus logos, el aviso de Pro y su lugar', async () => {
  const { FOTOS_CLOSING, FIGURAS_FILAS, LOGO_GRABADOR } = await import('../app/vsl/_competencia/disenos/closing');
  const { DIMENSIONES_CLOSING, PARTES_FICHA, GRABADORES_CLOSING, TITULO_CIERRE_CLOSING, parteEnLaLanding } = await import('../app/vsl/_competencia/closing');
  const { TARJETAS_PORTADA, menuProducto } = await import('../app/vsl/_sitio/datos');
  const { CATALOGO_GRABADORES } = await import('../lib/grabadores/catalogo');
  const { TABS_SOLO_PRO } = await import('../lib/topes-plan');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'closing');
  assert.ok(l, 'falta la landing de Closing');
  const html = dibujar(l);
  const t = textoVisible(propio(html));
  // El muro: las dimensiones son las que canoniza el análisis, en su orden, y las partes son rótulos de la ficha de la llamada.
  const fuente = leer('lib/closing.ts');
  const canon = fuente.slice(fuente.indexOf('const DIM_CANON'), fuente.indexOf('function canonDimLabel'));
  assert.deepEqual([...new Set([...canon.matchAll(/: '([^']+)'/g)].map((m) => m[1]))], DIMENSIONES_CLOSING.map((d) => d.label), 'las dimensiones del muro no son las del análisis');
  const ficha = leer('app/dashboard/entidades/llamada.tsx');
  for (const p of PARTES_FICHA) assert.match(ficha, new RegExp(`[>"']${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `«${p}» no es un rótulo de la ficha de la llamada`);
  const muro = html.slice(html.indexOf('class="d-closing-muro"'), html.indexOf('</ul>', html.indexOf('class="d-closing-muro"')));
  for (const x of [...DIMENSIONES_CLOSING.map((d) => d.label), ...PARTES_FICHA.map(parteEnLaLanding)]) assert.ok(muro.includes(`>${x}</li>`), `el muro sin «${x}»`);
  // La pestaña que la app escribe en inglés se lee como su NOMBRE (entre comillas), no suelta en la prosa.
  assert.ok(muro.includes('>«Transcript»</li>') && !muro.includes('>Transcript</li>'), '«Transcript» va entre comillas, como el nombre de la pestaña');
  // Una figura por fila: las tres primeras son lo que ESCRIBE el análisis, con su animación de llamadas reales; las otras, sus piezas.
  const filas = l.bloques.filter((b): b is Extract<Bloque, { tipo: 'tarjetas' }> => b.tipo === 'tarjetas')[2];
  assert.ok(filas, 'Closing sin sus cinco filas');
  assert.equal(FIGURAS_FILAS.length, filas.items.length, 'una fila sin su figura');
  const escritoPorLaIa = ['puntaje', 'coaching', 'objeciones'] as const;
  assert.deepEqual(FIGURAS_FILAS.slice(0, 3), [...escritoPorLaIa], 'las tres primeras filas son lo que escribe el análisis');
  const animaciones = [...html.matchAll(/<figure [^>]*data-animacion="([a-z]+)"/g)].map((m) => m[1]);
  escritoPorLaIa.forEach((k, n) => assert.equal(animaciones[n], k, `la fila ${n + 1} sin su animación (lo que escribe el análisis es de una llamada real)`));
  assert.equal(animaciones.length, escritoPorLaIa.length, 'una animación de más o de menos');
  assert.ok(html.includes('class="s-cno s-cno-p"') && html.includes('class="s-cno s-cno-c"'), 'sin la nota de la llamada o sin su coaching');
  assert.match(html, /class="s-cad" data-tema-fijo="" data-solo=""/, 'la fila de las objeciones no es la llamada de la portada sola');
  assert.doesNotMatch(html, /class="s-cad-app"/, 'la fila de las objeciones lleva la hoja de MaKo (va sólo la llamada)');
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  // Las notas son las del análisis: sus siete dimensiones, y cada consejo del coaching toca una que subió en octubre.
  const { CLOSING_MAURICIO: CM } = await import('../app/vsl/_sitio/closing-mauricio');
  const dims = DIMENSIONES_CLOSING.map((d) => d.label);
  assert.deepEqual(CM.notas.antes.dims.map((x) => x.d), dims, 'las notas de septiembre no son las siete dimensiones del análisis');
  assert.deepEqual(CM.notas.despues.dims.map((x) => x.d), dims, 'las notas de octubre no son las siete dimensiones del análisis');
  assert.ok(CM.notas.despues.nota > CM.notas.antes.nota, 'la llamada de octubre no tiene más nota que la de septiembre');
  for (const c of CM.notas.coaching) {
    const a = CM.notas.antes.dims.find((x) => x.d === c.d)?.n, b = CM.notas.despues.dims.find((x) => x.d === c.d)?.n;
    assert.ok(a != null && b != null && b > a, `«${c.tema}» toca «${c.d}», que no subió en octubre`);
  }
  for (const f of Object.values(FOTOS_CLOSING)) {
    assert.ok(existsSync(join(RAIZ, 'public', f.src)), `falta public${f.src}`);
    assert.ok(html.includes(`src="${f.src}"`), `no se dibuja ${f.src}`);
  }
  // Las piezas de la llamada INVENTADA no vuelven: ni dibujadas ni en public/ (se publicarían igual).
  for (const f of ['/vsl-assets/closing/puntaje.jpg', '/vsl-assets/closing/coaching.jpg', '/vsl-assets/closing/objeciones.jpg', '/vsl-assets/sitio/llamadas.webm', '/vsl-assets/sitio/llamadas.jpg']) {
    assert.ok(!existsSync(join(RAIZ, 'public', f)), `public${f} es de la llamada inventada y volvió a public/`);
    assert.ok(!html.includes(f), `se dibuja ${f}, de la llamada inventada`);
  }
  // El cierre dice lo que hace el botón (empezar con un plan), no «en acción»: MaKo no tiene una demo.
  const cierre = html.slice(html.indexOf('class="d-closing-cierre"'), html.indexOf('<footer class="d-closing-pie"'));
  assert.ok(cierre.includes(`>${TITULO_CIERRE_CLOSING}</h2>`), 'el cierre no lleva su título');
  assert.doesNotMatch(textoVisible(cierre), /en acci[oó]n|demo/i, 'el cierre promete ver una demo');
  // Los grabadores son los que se conectan hoy, cada uno con su logo en disco y dibujado.
  assert.deepEqual(GRABADORES_CLOSING, Object.values(CATALOGO_GRABADORES).filter((g) => g.conectable).map((g) => g.nombre));
  for (const g of GRABADORES_CLOSING) {
    const f = LOGO_GRABADOR[g];
    assert.ok(f && existsSync(join(RAIZ, 'public', f)), `${g}: sin su logo en public/`);
    assert.ok(html.includes(`src="${f}"`), `${g}: su logo no se dibuja`);
  }
  // El análisis es de Pro (lib/closing-solo-pro.ts): mientras lo sea, la página lo dice.
  if ((TABS_SOLO_PRO as readonly string[]).includes('closing-analyst')) assert.ok(t.includes('Con MaKo Pro'), 'Closing es de Pro y la landing no lo dice');
  // Lo de la página (sin la barra, el pie ni los scripts del sitio: el del sol y la luna tiene una variable «r2»).
  const cuerpo = textoVisible(html.slice(html.indexOf('class="d-closing-raiz"'), html.indexOf('<footer class="d-closing-pie"')).replace(/<script[\s\S]*?<\/script>/g, ' '));
  assert.ok(cuerpo.length > 2000, 'no se encontró el cuerpo de la landing');
  assert.doesNotMatch(cuerpo, /\bR[12]\b/, 'la landing nombra las dos reuniones (R1 o R2)');
  assert.doesNotMatch(cuerpo, /dos reuniones|reunión 2|segunda llamada|2\.ª llamada/i, 'la landing nombra las dos reuniones');
  // Su lugar: la fila de la portada entre Chats y los tableros, con el recuadro (su grabación era de la llamada inventada) y el aviso de
  // Pro; y Producto › Sales.
  const i = TARJETAS_PORTADA.findIndex((x) => x.slug === 'closing');
  assert.ok(i > 0 && TARJETAS_PORTADA[i - 1].slug === 'whatsapp' && TARJETAS_PORTADA[i + 1]?.slug === 'dashboard', 'la fila de Closing va entre Chats y los tableros');
  const v = TARJETAS_PORTADA[i].visual;
  // Desde el 16/11/2026 la fila lleva el «antes y después» real de dos llamadas de Mauricio (app/vsl/_sitio/ClosingAntesDespues.tsx).
  assert.equal(v, 'closing', 'la fila de Closing de la portada tiene que llevar el antes y después de Mauricio');
  const { CLOSING_MAURICIO } = await import('../app/vsl/_sitio/closing-mauricio');
  assert.ok(CLOSING_MAURICIO.despues.cierres > CLOSING_MAURICIO.antes.cierres, 'el después no tiene más cierres que el antes');
  assert.doesNotMatch(leer('app/vsl/_sitio/closing-mauricio.ts'), /quote|note|lead|prospecto:/i, 'en los datos del antes y después hay algo más que notas');
  if ((TABS_SOLO_PRO as readonly string[]).includes('closing-analyst')) assert.ok(TARJETAS_PORTADA[i].texto.includes('Con MaKo Pro'), 'la fila de Closing de la portada no dice que es de Pro');
  const sales = menuProducto().columnas.find((c) => c.rotulo === 'Sales');
  assert.ok(sales?.items.some((it) => it.href === '/vsl/closing'), 'Closing no está en Producto › Sales');
});

// Classroom como Circle (16/11/2026): donde Circle pone sus pestañas sobre una captura y las píldoras de cada grupo, van las pantallas
// REALES del portal del alumno (banco C:/dev/bancos-portada/banco-classroom-landing, fotos.mjs); donde pone su cinta de casos con cifras,
// de dónde viene el video de cada clase (contado de lib/embeds.ts y reconocido por lib/curso.ts); los candados son los del editor del
// curso; la comunidad dice que es de Pro y los cursos por plan salen de TOPES; y su lugar: Producto › Sales, la fila de la portada y la
// fila de la comparación.
// PROBADO ROMPIÉNDOLO (16/11/2026; base 22 / 0, y cada rotura 1 / 1 corriendo las dos de acá): `ranking.jpg` → `rankingx.jpg` en
// FOTOS_CLASSROOM → falla «falta public/…»; «A mano» → «Manual» en CANDADOS → falla «no es un candado del editor del curso»; el aviso de
// Pro sacado del hero → falla «…no lo dice en el hero» (el del grupo Comunidad queda, y por eso se mira el hero aparte); el `slug` sacado
// de la fila «Curso y comunidad» → falla «la fila de la portada no lleva a /vsl/classroom».
test('Classroom: cada pestaña y cada píldora trae su pantalla real, los videos y los candados salen del código, el aviso de Pro y su lugar en el sitio', async () => {
  const { FOTOS_CLASSROOM, FOTO_DE } = await import('../app/vsl/_competencia/disenos/classroom');
  const { VIDEOS_DE_CLASE, CANDADOS, CURSOS_POR_PLAN, AVISO_COMUNIDAD } = await import('../app/vsl/_competencia/classroom');
  const { TARJETAS_PORTADA, menuProducto, filasDeComparacion } = await import('../app/vsl/_sitio/datos');
  const { seVendeEnPro } = await import('../app/vsl/_competencia/solo-pro');
  const { TOPES } = await import('../lib/topes-plan');
  const { NIVEL_MAX } = await import('../lib/comunidad-niveles');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'classroom');
  assert.ok(l, 'falta la landing de Classroom');
  const html = dibujar(l);
  const t = textoVisible(propio(html));
  // Las pantallas: cada una en disco y dibujada; cada pestaña de la galería y cada píldora de un grupo, con la suya.
  for (const f of Object.values(FOTOS_CLASSROOM)) {
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`src="${f}"`), `no se dibuja ${f}`);
  }
  const tarjetas = l.bloques.filter((b): b is Extract<Bloque, { tipo: 'tarjetas' }> => b.tipo === 'tarjetas');
  const pestanas = [tarjetas[1], ...tarjetas.filter((b) => !b.fondo && b.items.some((it) => it.puntos))].flatMap((b) => b.items);
  assert.ok(pestanas.length >= 12, `sólo ${pestanas.length} pestañas y píldoras: el barrido no está mirando`);
  for (const it of pestanas) assert.ok(FOTO_DE[it.titulo], `«${it.titulo}»: sin su pantalla`);
  // La cinta: los alojadores de video que el curso reconoce (el `videoTipo` o el `proveedor` de lib/curso.ts), con su nombre de embeds.
  const curso = leer('lib/curso.ts');
  for (const v of VIDEOS_DE_CLASE) {
    assert.match(curso, new RegExp(`'${v.id}'`), `«${v.id}» no es un video que el curso reconozca`);
    assert.ok(html.includes(`>${v.nombre}</p>`), `la cinta sin «${v.nombre}»`);
  }
  // Los candados, con las palabras del editor del curso; el ranking, con los niveles del código.
  const editor = leer('app/customer-success/curso/bloqueo-editor.ts');
  for (const c of CANDADOS) assert.ok(editor.includes(`'${c}'`), `«${c}» no es un candado del editor del curso`);
  assert.ok(t.includes(`${NIVEL_MAX} niveles`), 'el ranking no dice los niveles del código');
  // Lo que es de cada plan: la comunidad es de Pro, y los cursos por plan salen de TOPES (1 en Essential, ilimitados en Pro, hoy).
  if (seVendeEnPro('comunidad')) {
    assert.ok(AVISO_COMUNIDAD && t.includes(AVISO_COMUNIDAD.trim()), 'la comunidad es de Pro y la landing no lo dice');
    const hero = l.bloques.find((b) => b.tipo === 'hero');
    assert.ok(hero && hero.tipo === 'hero' && hero.bajada.includes(AVISO_COMUNIDAD), 'la comunidad es de Pro y la landing no lo dice en el hero');
  }
  assert.ok(t.includes(CURSOS_POR_PLAN), 'no dice cuántos cursos trae cada plan');
  if (TOPES.completo['classroom.cursos'] === 1) assert.match(CURSOS_POR_PLAN, /Essential, un curso/);
  if (TOPES.agencia['classroom.cursos'] == null) assert.match(CURSOS_POR_PLAN, /Pro, cursos ilimitados/);
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  // Su lugar: Producto › Sales, la fila «Curso y comunidad» de la portada (con su grabación) y la fila de la comparación.
  const sales = menuProducto().columnas.find((c) => c.rotulo === 'Sales');
  assert.ok(sales?.items.some((it) => it.href === '/vsl/classroom'), 'Classroom no está en Producto › Sales');
  const fila = TARJETAS_PORTADA.find((x) => x.rotulo === 'Curso y comunidad');
  assert.ok(fila && fila.slug === 'classroom', 'la fila de la portada no lleva a /vsl/classroom');
  assert.ok(typeof fila.visual === 'object' && 'video' in fila.visual && existsSync(join(RAIZ, 'public', fila.visual.video)), 'la fila de Classroom sin su grabación');
  assert.ok(filasDeComparacion().some((f) => f.funcion === 'Classroom' && f.href === '/vsl/classroom'), 'la comparación no lleva a /vsl/classroom');
});

// Second Brain como Obsidian (16/11/2026): la ventana de su app es el Second Brain DE VERDAD (BrainVivo, el de la portada, reusado); sus
// muestras dibujadas son los datos del código (las áreas, de dónde salió cada dato, las carpetas del ZIP y UN archivo armado por la
// exportación); «Free without limits» es que no se cierra en Essential; y su lugar: Producto › Today después de Ops Center, la fila de
// la portada (con su grafo vivo) lleva a su landing, y ya no queda el «/#brain» sin landing.
// PROBADO ROMPIÉNDOLO (16/11/2026; base 22 / 0, y cada rotura 1 / 1 corriendo las dos de acá): <BrainVivo /> cambiado por una <img>
// del póster → falla «la ventana sin el Second Brain de verdad»; un área de más a mano en AREAS_SECOND_BRAIN → falla «las áreas no son
// las del código»; NODO_DE_MUESTRA → 'av:otro' → falla «sin el archivo del ZIP»; 'second-brain' sacado de COLUMNAS → falla «Second Brain
// no va después de Ops Center».
test('Second Brain: la ventana es el grafo real, las muestras salen del código, está en los dos planes y su lugar en el sitio', async () => {
  const { FOTO_MAPA, archivoDeMuestra } = await import('../app/vsl/_competencia/disenos/second-brain');
  const { AREAS_SECOND_BRAIN, PROCEDENCIAS, CARPETAS_ZIP } = await import('../app/vsl/_competencia/second-brain');
  const { AREAS, AUTORIA_TEXTO } = await import('../lib/cerebro-modelo');
  const { carpetaDe } = await import('../lib/vault-modelo');
  const { TABS_SOLO_PRO, FUNCIONES_SOLO_PRO } = await import('../lib/topes-plan');
  const { TARJETAS_PORTADA, menuProducto } = await import('../app/vsl/_sitio/datos');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'second-brain');
  assert.ok(l, 'falta la landing de Second Brain');
  const html = dibujar(l);
  // La ventana: el componente de la portada (su raíz `.s-brain`, negra y fuera del sol y la luna), adentro de la ventana copiada.
  const ventana = html.indexOf('class="d-second-brain-ventana"');
  assert.ok(ventana > 0 && html.indexOf('class="s-brain"', ventana) > ventana, 'la ventana sin el Second Brain de verdad (BrainVivo)');
  assert.ok(html.includes('class="s-brain" data-tema="oscuro" data-tema-fijo=""'), 'el grafo perdió su negro fijo');
  // Las muestras: las áreas, de dónde salió cada dato y las carpetas del ZIP, del código y dibujadas; el archivo, el que arma la exportación.
  assert.deepEqual(AREAS_SECOND_BRAIN.map((a) => a.nombre), AREAS.map((a) => a.nombre), 'las áreas no son las del código');
  for (const a of AREAS_SECOND_BRAIN) assert.ok(html.includes(`<li>${a.nombre}</li>`), `la muestra de las áreas sin «${a.nombre}»`);
  assert.deepEqual([...PROCEDENCIAS], Object.values(AUTORIA_TEXTO), 'la procedencia no es la del mapa');
  assert.deepEqual([...CARPETAS_ZIP], AREAS.map((a) => carpetaDe(a.id)), 'las carpetas no son las del ZIP');
  for (const c of CARPETAS_ZIP) assert.ok(html.includes(`<li>${c.split('/')[1]}</li>`), `el ZIP sin «${c}»`);
  const archivo = archivoDeMuestra();
  assert.ok(archivo && html.includes(archivo.ruta), 'sin el archivo del ZIP');
  assert.ok(existsSync(join(RAIZ, 'public', FOTO_MAPA.src)) && html.includes(`src="${FOTO_MAPA.src}"`), 'sin la foto del grafo');
  // «En MaKo Essential y en MaKo Pro.»: mientras el Second Brain no se cierre en Essential.
  assert.ok(![...TABS_SOLO_PRO, ...FUNCIONES_SOLO_PRO].some((x) => /brain|cerebro|mako/.test(x)), 'el Second Brain se cerró en Essential y la landing dice los dos planes');
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  // Su lugar: Producto › Today, después de Ops Center; la fila de la portada (el grafo vivo) lleva a su landing; ya no hay /#brain.
  const today = menuProducto().columnas.find((c) => c.rotulo === 'Today');
  const i = today?.items.findIndex((it) => it.href === '/vsl/second-brain') ?? -1;
  assert.ok(i > 0 && today?.items[i - 1].slug === 'mako', 'Second Brain no va después de Ops Center en Producto › Today');
  assert.ok(!menuProducto().columnas.some((c) => c.items.some((it) => it.href === '/#brain')), 'queda el Second Brain sin landing en el menú');
  const fila = TARJETAS_PORTADA.find((x) => x.visual === 'brain');
  assert.ok(fila && fila.slug === 'second-brain' && fila.ancla === 'brain', 'la fila del grafo de la portada no lleva a /vsl/second-brain');
});

// Equipo como Pipedrive (16/11/2026): qué ve cada rol es la línea de la página REAL (app/equipo/page.tsx) y los roles, los del desplegable
// de Equipo (app/equipo/EquipoView.tsx); cuántas personas entran sale del tope del plan (lib/topes-plan.ts, 'equipo.usuarios'); la tasa
// de cierre y el análisis de cada llamada llevan el aviso de Pro mientras Closing lo sea; cada fila trae su pantalla REAL (banco
// C:/dev/bancos-portada/banco-equipo-landing y la hoja Closing de /vsl/closing) menos la del coaching de cada closer, que lo ESCRIBE el
// análisis y lleva la animación del coaching de /vsl/closing, con dos llamadas REALES de Mauricio (la foto que había era de una llamada
// inventada: la regla de Martín del 12/11 y el 13/11/2026);
// el hero, la grabación de Equipo; no muestra la lista de «Llamadas» (dice R1 y R2); y su lugar: la fila de la portada después de los
// tableros, con su grabación, y Producto › Sales después de Closing.
// PROBADO ROMPIÉNDOLO (16/11/2026; base 24 / 0 antes del recuadro): `miembros.jpg` → `miembrosx.jpg` en FOTOS_EQUIPO → falla «falta
// public/…»; «la hoja Closing» → «el tablero Closing» en QUE_VE_CADA_ROL → falla «no es la línea de la página»; el tope de Pro escrito
// «hasta 10 personas» en RENGLON_PLAN → falla «no es el tope del plan»; la fila de la portada con otro slug (`equipox`) → falla «después
// de los tableros»; una foto de vuelta en la fila del coaching (16/11, 23 / 1) → falla «la fila del coaching sin su animación».
test('Equipo: los roles y lo que ve cada uno son los de la app, las personas salen del plan, cada fila trae su pantalla real y su lugar en el sitio', async () => {
  const { FOTOS_EQUIPO, FIGURAS_FILAS, FIGURA_QUE_NECESITA, VIDEO_HERO_EQUIPO } = await import('../app/vsl/_competencia/disenos/equipo');
  const { QUE_VE_CADA_ROL, RENGLON_PLAN, PERSONAS_PRO } = await import('../app/vsl/_competencia/equipo');
  const { TARJETAS_PORTADA, menuProducto } = await import('../app/vsl/_sitio/datos');
  const { TOPES, TABS_SOLO_PRO } = await import('../lib/topes-plan');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'equipo');
  assert.ok(l, 'falta la landing de Equipo');
  const html = dibujar(l);
  const t = textoVisible(propio(html));
  // Los roles: los tres del desplegable de Equipo, y lo que ve cada uno, la línea de la página real.
  const vista = leer('app/equipo/EquipoView.tsx');
  const pagina = leer('app/equipo/page.tsx');
  for (const r of QUE_VE_CADA_ROL) {
    assert.ok(vista.includes(`label: '${r.rol}'`), `«${r.rol}» no es un rol de Equipo`);
    assert.ok(pagina.includes(`<b>${r.rol}</b> ve ${r.ve}`), `lo que ve el ${r.rol} no es la línea de la página (app/equipo/page.tsx)`);
    assert.ok(t.includes(`${r.rol} ve ${r.ve}`), `la landing no dice qué ve el ${r.rol}`);
  }
  // Cuántas personas entran: el tope del plan, no un número escrito.
  assert.equal(PERSONAS_PRO, TOPES.agencia['equipo.usuarios'], 'el tope de Pro no es el del plan');
  if (PERSONAS_PRO != null) assert.ok(RENGLON_PLAN.includes(`hasta ${PERSONAS_PRO} personas`) && t.includes(`hasta ${PERSONAS_PRO} personas`), 'el renglón del plan no es el tope del plan');
  // La tasa de cierre y el análisis de cada llamada son de Closing: mientras sea de Pro, lo dice cada vez que lo nombra.
  const filas = l.bloques.find((b): b is Extract<Bloque, { tipo: 'filas' }> => b.tipo === 'filas');
  assert.ok(filas, 'Equipo sin sus cuatro filas');
  if ((TABS_SOLO_PRO as readonly string[]).includes('closing-analyst')) {
    const deClosing = filas.items.filter((x) => /tasa de cierre|SPIN/.test(x.texto));
    assert.ok(deClosing.length >= 2, 'las filas de Closing no se encontraron');
    for (const it of deClosing) assert.ok(it.texto.includes('Con MaKo Pro'), `«${it.titulo}» es de Pro y no lo dice`);
  }
  // Las pantallas: cada una en disco y dibujada, una figura por fila, y el hero con su grabación. La del coaching de cada closer es lo
  // que ESCRIBE el análisis: la animación del coaching de /vsl/closing (llamadas reales de Mauricio), y la foto de la llamada inventada
  // no se dibuja.
  assert.equal(FIGURAS_FILAS.length, filas.items.length, 'una fila sin su pantalla');
  const coaching = filas.items.findIndex((x) => /fortalezas/.test(x.texto));
  assert.ok(coaching >= 0 && FIGURAS_FILAS[coaching] === 'coaching', 'la fila del coaching sin su animación (lo que escribe el análisis es de una llamada real)');
  assert.deepEqual([...html.matchAll(/<figure [^>]*data-animacion="([a-z]+)"/g)].map((m) => m[1]), ['coaching'], 'la animación del coaching de más o de menos');
  assert.ok(html.includes('class="s-cno s-cno-c"'), 'la fila del coaching sin el coaching de las llamadas de Mauricio');
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  assert.ok(!html.includes('/vsl-assets/closing/coaching.jpg'), 'se dibuja el coaching de la llamada inventada');
  const fotos = FIGURAS_FILAS.flatMap((x) => (x === 'coaching' ? [] : [...x]));
  for (const k of [FIGURA_QUE_NECESITA, ...fotos, 'caso'] as const) {
    const f = FOTOS_EQUIPO[k];
    assert.ok(existsSync(join(RAIZ, 'public', f.src)), `falta public${f.src}`);
    assert.ok(html.includes(`src="${f.src}"`), `no se dibuja ${f.src}`);
  }
  for (const f of [VIDEO_HERO_EQUIPO.video, VIDEO_HERO_EQUIPO.poster]) {
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`"${f}"`), `no se dibuja ${f}`);
  }
  // La lista de «Llamadas» de Calendar todavía dice R1 y R2: no se muestra ni se nombra.
  const cuerpo = textoVisible(html.slice(html.indexOf('class="d-equipo-raiz"'), html.indexOf('<footer class="d-equipo-pie"')).replace(/<script[\s\S]*?<\/script>/g, ' '));
  assert.ok(cuerpo.length > 2000, 'no se encontró el cuerpo de la landing');
  assert.doesNotMatch(cuerpo, /\bR[12]\b|dos reuniones/, 'la landing nombra las dos reuniones');
  // Su lugar: la fila de la portada después de los tableros, con su grabación; y Producto › Sales, después de Closing.
  const i = TARJETAS_PORTADA.findIndex((x) => x.slug === 'equipo');
  assert.ok(i > 0 && TARJETAS_PORTADA[i - 1].slug === 'dashboard', 'la fila de Equipo va después de los tableros');
  const v = TARJETAS_PORTADA[i].visual;
  // Desde el 16/11/2026 la fila de la portada es el organigrama animado (app/vsl/_sitio/OrganigramaEquipo.tsx; Martín: «no quiero ver un
  // formulario… como si fuera un organigrama»); la grabación del formulario queda en la landing de Equipo.
  assert.equal(v, 'equipo', 'la fila de Equipo de la portada no es el organigrama');
  assert.ok(VIDEO_HERO_EQUIPO.video, 'la landing de Equipo perdió su grabación');
  const sales = menuProducto().columnas.find((c) => c.rotulo === 'Sales');
  const j = sales?.items.findIndex((it) => it.href === '/vsl/equipo') ?? -1;
  assert.ok(j > 0 && sales?.items[j - 1].href === '/vsl/closing', 'Equipo no va después de Closing en Producto › Sales');
});

// Calendario de contenido como Metricool (16/11/2026): las redes de su tira son donde el Calendario publica HOY (REDES_PUBLICAR), cada una
// con su logo de la app (ICON de ServicioVisual); «Esta semana» es lo que arma el Marketing CoPilot (tareasDeLaSemana) para el funnel del
// ejemplo; las tres pestañas con sus funciones; cada foto y la grabación son del Calendario REAL (banco
// C:/dev/bancos-portada/banco-calendario-landing); los botones que nombra existen en la pantalla; el 01-05 lleva a landings que existen; y
// su lugar: la fila de la portada entre AI Avatar y el Marketing CoPilot, y Producto › Marketing después del CoPilot.
// PROBADO ROMPIÉNDOLO (16/11/2026; base 24 / 0): 'youtube' → 'red-youtube' en LOGO_RED → falla «sin su logo»; `evento.jpg` → `eventox.jpg`
// en FOTOS_CALENDARIO → falla «falta public/…»; «3 reels, 1 carrusel y stories» escrito a mano en el contraste → falla «no es lo que arma
// el CoPilot»; la fila de la portada con otro slug (`calendariox`) → falla «entre AI Avatar y el Marketing CoPilot».
test('Calendario de contenido: las redes, «Esta semana» y las pestañas salen del código, cada foto es del Calendario real y su lugar en el sitio', async () => {
  const { FOTOS_CALENDARIO, VIDEO_CALENDARIO, LOGO_RED } = await import('../app/vsl/_competencia/disenos/calendario');
  const { REDES_CALENDARIO, SEMANA_EJEMPLO, PERFIL_EJEMPLO } = await import('../app/vsl/_competencia/calendario');
  const { REDES_PUBLICAR, ROTULO_RED } = await import('../lib/calendario-publicar-reglas');
  const { tareasDeLaSemana } = await import('../lib/media-buyer/copiloto');
  const { ICON } = await import('../app/_components/ServicioVisual');
  const { TARJETAS_PORTADA, menuProducto } = await import('../app/vsl/_sitio/datos');
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === 'calendario');
  assert.ok(l, 'falta la landing del Calendario de contenido');
  const html = dibujar(l);
  const t = textoVisible(propio(html));
  // Las redes: las del código, cada una nombrada y con su logo de la app dibujado.
  assert.deepEqual(REDES_CALENDARIO, REDES_PUBLICAR.map((r) => ROTULO_RED[r]));
  for (const r of REDES_PUBLICAR) {
    assert.ok(t.includes(ROTULO_RED[r]), `la landing no nombra ${ROTULO_RED[r]}`);
    assert.ok(ICON[LOGO_RED[r]], `${ROTULO_RED[r]}: sin su logo en la app`);
    const sym = ICON[LOGO_RED[r]].sym;
    assert.ok(sym ? html.includes(`#${sym}`) : html.includes(ICON[LOGO_RED[r]].img ?? '¿?'), `${ROTULO_RED[r]}: su logo no se dibuja`);
  }
  // «Esta semana»: lo que arma el CoPilot para el funnel del ejemplo, no una lista escrita a mano.
  assert.deepEqual(SEMANA_EJEMPLO.map((x) => x.titulo), tareasDeLaSemana(PERFIL_EJEMPLO).map((x) => x.titulo));
  const contraste = l.bloques.find((b): b is Extract<Bloque, { tipo: 'contraste' }> => b.tipo === 'contraste');
  assert.ok(contraste, 'sin «La clave no es publicar más…»');
  for (const x of SEMANA_EJEMPLO.slice(0, -1)) assert.ok(contraste.con.texto.toLowerCase().includes(x.titulo.toLowerCase()), `«${x.titulo}» no es lo que arma el CoPilot`);
  // Las tres pestañas, cada una con su radio y sus funciones «TÍTULO|texto».
  const tabs = l.bloques.find((b): b is Extract<Bloque, { tipo: 'tarjetas' }> => b.tipo === 'tarjetas');
  assert.ok(tabs && tabs.items.length === 3, 'sin sus tres pestañas');
  for (const it of tabs.items) {
    assert.ok((it.puntos?.length ?? 0) >= 3 && it.puntos!.every((p) => /^[^|]+\|\S/.test(p)), `«${it.titulo}»: sus funciones no son «TÍTULO|texto»`);
  }
  assert.equal((html.match(/class="d-calendario-radio"/g) ?? []).length, 3, 'un radio por pestaña');
  assert.ok(html.includes('#d-calendario-t2:checked~.d-calendario-p2{display:grid}'), 'las pestañas no cambian');
  // Las fotos y la grabación: en disco y dibujadas.
  for (const f of Object.values(FOTOS_CALENDARIO)) {
    assert.ok(existsSync(join(RAIZ, 'public', f.src)), `falta public${f.src}`);
    assert.ok(html.includes(`src="${f.src}"`), `no se dibuja ${f.src}`);
  }
  for (const f of [VIDEO_CALENDARIO.video, VIDEO_CALENDARIO.poster]) {
    assert.ok(existsSync(join(RAIZ, 'public', f)), `falta public${f}`);
    assert.ok(html.includes(`"${f}"`), `no se dibuja ${f}`);
  }
  // Lo que la portada y la landing nombran de la pantalla existe en la pantalla.
  const app = leer('app/calendario/CalendarioApp.tsx');
  for (const b of ['Programar publicaciones', 'Programar en serie']) assert.ok(app.includes(b), `«${b}» ya no está en el Calendario`);
  // El 01-05 lleva a landings que existen (y a /app, la de instalar MaKo en el teléfono).
  const pasos = l.bloques.find((b): b is Extract<Bloque, { tipo: 'pasos' }> => b.tipo === 'pasos');
  assert.equal(pasos?.pasos.length, 5, 'su 01-05 no tiene cinco');
  for (const ps of pasos!.pasos) {
    const href = /href="([^"]+)"/.exec(ps.titulo)?.[1];
    assert.ok(href, `«${ps.titulo}» sin su link`);
    const destino = href === '/app' ? 'app/app/page.tsx' : `app/vsl/${href.replace('/vsl/', '')}/page.tsx`;
    assert.ok(existsSync(join(RAIZ, destino)), `${href} no existe`);
  }
  assert.doesNotMatch(html, /mk-falta/, 'vuelve un recuadro de «falta»');
  // Su lugar: NO en la portada (Martín, 16/11/2026, ~18:40 UTC: «por ahora elimina la parte del calendario… puede permanecer en la
  // landing»); sí en Producto › Marketing, después del CoPilot. La grabación queda para su landing.
  assert.equal(TARJETAS_PORTADA.findIndex((x) => x.slug === 'calendario'), -1, 'volvió la fila del Calendario a la portada');
  void VIDEO_CALENDARIO;
  const mk = menuProducto().columnas.find((c) => c.rotulo === 'Marketing');
  const j = mk?.items.findIndex((it) => it.href === '/vsl/calendario') ?? -1;
  assert.ok(j > 0 && mk?.items[j - 1].href === '/vsl/ads', 'el Calendario no va después del Marketing CoPilot en Producto › Marketing');
});

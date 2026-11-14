// La portada de hola-mako.com apunta a la venta High Ticket, no a «VSL Funnel» (29/10/2026).
//
// Martín (29/10, por el Cerebro): «Actualiza la landing principal, que no apunte a "VSL Funnel" que apunte "High ticket",
// como en el título». La frase es la que decidió en la llamada del 28/10: «El mejor SaaS para ventas High Ticket, de punta
// a punta». Lo que se ve viene del documento de Web Generator (scripts/landing-principal-high-ticket.mts), pero cuatro
// cosas son del CÓDIGO y salen en el HTML de la portada aunque el documento ya no lo diga: el <title> y la tarjeta para
// compartir (portada-metadata.ts), la portada sin JavaScript (PortadaSinJs.tsx, lo que ve Meta al verificar), y el
// respaldo que se sirve sin documento publicado (landing-html.ts y el título de su grilla en landing-contenido.ts).
//
// Verificado rompiéndolo (romper_high_ticket.py): volver a la frase vieja el <title>, el alt de la imagen, la portada sin
// JavaScript, el titular del respaldo, una línea del respaldo o el título de su grilla → cada una, rojo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { metadataPortada as metadata } from '../app/vsl/portada-metadata';
import { LANDING_HTML } from '../app/vsl/landing-html';
import { filasDeComparacion, noIncluyeDe, NOMBRE_TAB_PRO } from '../lib/planes-comparacion';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// 13/11/2026, Martín: «el mejor software para vender high ticket… cámbialo en todos lados, ese sería nuestro principal».
const FRASE = 'El mejor software para vender High Ticket';

test('el <title> y la tarjeta para compartir dicen la frase de High Ticket', () => {
  assert.equal(metadata.title, `MaKo — ${FRASE}`);
  const og = metadata.openGraph as { title?: string; images?: Array<{ alt?: string }> };
  assert.equal(og.title, metadata.title);
  assert.equal(og.images?.[0]?.alt, metadata.title, 'el texto alternativo de la imagen quedó con la frase vieja');
  assert.doesNotMatch(JSON.stringify(metadata), /VSL Funnel/i);
});

test('la portada sin JavaScript (la que lee Meta) dice la misma frase', () => {
  const v = leer('app/vsl/PortadaSinJs.tsx');
  assert.match(v, new RegExp(`<h1 [^>]*>\\n\\s*${FRASE}\\n\\s*</h1>`));
  assert.doesNotMatch(v, /VSL Funnel/i);
});

test('el respaldo sin documento publicado tampoco dice «VSL Funnel»', () => {
  assert.doesNotMatch(LANDING_HTML, /VSL Funnel/i);
  assert.match(LANDING_HTML, /El mejor SaaS para ventas <span[^>]*>High Ticket<\/span>, de punta a punta<\/h1>/);
  const c = leer('app/vsl/landing-contenido.ts');
  assert.match(c, /secH\.textContent = 'Tu equipo de ventas High Ticket, en una sola app';/);
  assert.doesNotMatch(c, /VSL Funnel/i);
});

// ── Los precios de la portada (29/10/2026, Martín ~11:20): «la sección de pricing está mal, porque no aclara todo lo que
// incluye o lo que no... Y en la landing no está la comparativa, la tabla». Cada tarjeta dice con ✗ lo que su plan NO trae, y
// abajo va la comparación de /planes. Las dos salen de lib/planes-comparacion.ts (los topes del código): no se contradicen.
// Verificado rompiéndolo: sin la lista de ✗ en la tarjeta, sin la tabla en la portada, el ✗ leído de otra columna y la
// celda de Esencial leída de la de Pro → cada una, rojo.

test('lo que un plan NO trae sale de la misma tabla de la comparación', () => {
  const filas = filasDeComparacion();
  assert.equal(noIncluyeDe('completo').length, filas.filter((f) => f.esencial === false).length);
  assert.equal(noIncluyeDe('agencia').length, filas.filter((f) => f.pro === false).length);
  assert.ok(noIncluyeDe('completo').includes(NOMBRE_TAB_PRO['closing-analyst']), 'Esencial no trae el análisis de las llamadas');
  assert.ok(!noIncluyeDe('agencia').includes(NOMBRE_TAB_PRO['closing-analyst']), 'Pro sí lo trae');
  assert.ok(noIncluyeDe('agencia').includes('La asesoría grupal en vivo con Martín, cada semana'), 'la asesoría es del Acelerador');
  assert.deepEqual(noIncluyeDe('pm'), [], 'una capa sin columna no inventa nada');
});

// 12/11/2026 (Martín: «tienen muchos ítems»): lo que un plan NO trae sale de la tarjeta y queda en la tabla, con «—», como en
// beehiiv. Lo que se cuida: la tabla está y dice cada fila, y la tarjeta ya no repite la lista de ✗.
test('la portada dibuja las tarjetas y la tabla comparativa, que dice lo que NO incluye cada plan', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PreciosLanding } = await import('../app/vsl/PreciosLanding');
  const planes = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x) => ({ id: x.id, nombre: x.nombre, capa: x.capa, precioUsd: x.precioUsd, resumen: x.resumen, incluye: x.incluye, destacado: !!x.destacado, precioAnualUsd: x.precioAnualUsd ?? null, preciosLocales: x.preciosLocales, cobrable: true }));
  const html = renderToStaticMarkup(React.createElement(PreciosLanding, { planes, sufijo: '' }));
  assert.match(html, /class="cp-tabla"/, 'la portada no tiene la tabla comparativa');
  for (const f of filasDeComparacion()) assert.ok(html.includes(f.que), `la tabla no dice «${f.que}»`);
  const esencial = planes.find((p) => p.capa === 'completo')!;
  const tarjeta = html.slice(html.indexOf(`<h3>${esencial.nombre}</h3>`), html.indexOf('</section>', html.indexOf(`<h3>${esencial.nombre}</h3>`)));
  assert.doesNotMatch(tarjeta, /class="mkpl-lista mkpl-no"/, 'la tarjeta de Esencial volvió a la lista de ✗');
  // La tabla como Attio (14/11/2026): cada fila con su nombre corto y la frase entera en el (i).
  for (const x of noIncluyeDe('completo')) assert.ok(html.includes(`data-info="${x}"`) || html.includes(`role="rowheader">${x}<`), `la tabla no dice «${x}»`);
  assert.ok(html.includes('aria-label="No incluido"'), 'la tabla marca lo que no incluye');
});

// ── Sin fondo azul también en el Acelerador (29/10/2026, el Cerebro con la regla de Martín: «fondo claro, el azul sólo de
// acento»): su bloque sigue oscuro para destacarse, pero en el grafito de la app. Verificado rompiéndolo: volver al azul
// marino → rojo.
// 12/11/2026: el Acelerador dejó de ser un bloque oscuro (el sol y la luna llevan la página entera a un solo modo); lo que queda
// de esta regla es que no vuelva el fondo azul marino.
test('el bloque del Acelerador no vuelve al fondo azul', () => {
  const t = leer('app/planes/Tarjetas.tsx');
  assert.doesNotMatch(t, /#142B66|#0B1735|122,162,255/, 'el Acelerador volvió al fondo azul');
});

// ── Que toda la venta diga lo mismo (29/10/2026, el Cerebro): las páginas de cada funcionalidad (/vsl/<slug>) también apuntan a
// High Ticket. Verificado rompiéndolo: volver una frase de features.ts → rojo.
test('las páginas de cada funcionalidad tampoco dicen «VSL Funnel»', () => {
  for (const rel of ['app/vsl/_detalle/features.ts', 'app/vsl/_detalle/FeatureDetail.tsx', 'app/vsl/showcase.ts']) {
    assert.doesNotMatch(leer(rel), /VSL Funnel/i, rel);
  }
  assert.match(leer('app/vsl/_detalle/FeatureDetail.tsx'), /<p className="mk-foot-tag">El mejor software para vender High Ticket\.<\/p>/);
});

// ── /vsl/ads vende lo que hay (29/10/2026, el Cerebro): el Media Buyer que propone y aplica, no crear campañas desde MaKo (la
// réplica del Ads Manager se borró el 25/10). Verificado rompiéndolo: volver «crea tu campaña» al showcase → rojo.
test('la página de anuncios no vende crear campañas', () => {
  for (const rel of ['app/vsl/_detalle/features.ts', 'app/vsl/showcase.ts']) {
    assert.doesNotMatch(leer(rel), /crea(r)? (tu|tus)? ?campañas?|Crear campañas|creas campañas/i, rel);
  }
  assert.match(leer('app/vsl/_detalle/features.ts'), /name: "Tu media buyer con IA",/);
});

// ── La tabla y los planes venden sólo lo que anda (29/10/2026, el Cerebro, con el inventario del taller): el Video Generator
// está a medias (la extensión y los créditos de Flow del cliente; el motor nunca se midió en vivo) y generar imágenes con IA
// no existe (el editor de imágenes sí). Verificado rompiéndolo: volver la fila «Videos para tus anuncios, armados con IA», el
// «Crear y retocar imágenes con IA» o el «Imágenes con IA» de Pro → cada uno, rojo.
test('la tabla y lo que trae cada plan no prometen videos ni imágenes hechos con IA', () => {
  const A_MEDIAS = /videos?.*armad[oa]s? con IA|im[aá]genes con IA|crear y retocar/i; // «Tu oferta armada con IA» sí anda
  for (const f of filasDeComparacion()) assert.doesNotMatch(f.que, A_MEDIAS, `la tabla promete «${f.que}»`);
  for (const p of PLANES_MAKO_DEFAULT) for (const l of p.incluye) assert.doesNotMatch(l, A_MEDIAS, `${p.id} promete «${l}»`);
  // 14/11/2026: los editores son de los dos planes (Martín) y lo de Pro es editar con IA (subtítulos, cortes, B-roll y diseños).
  assert.ok(filasDeComparacion().some((f) => f.que === 'Editor de imágenes y carruseles, como Canva' && f.esencial === true), 'el editor de imágenes, en los dos');
  assert.ok(filasDeComparacion().some((f) => f.que === 'Editor de video, como CapCut' && f.esencial === true), 'la edición de video, que sí anda, sigue');
});

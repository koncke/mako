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
const FRASE = 'El mejor SaaS para ventas High Ticket, de punta a punta';

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

test('la portada dibuja cada tarjeta con lo que NO incluye y la tabla comparativa', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PreciosLanding } = await import('../app/vsl/PreciosLanding');
  const planes = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x) => ({ id: x.id, nombre: x.nombre, capa: x.capa, precioUsd: x.precioUsd, resumen: x.resumen, incluye: x.incluye, destacado: !!x.destacado, precioAnualUsd: x.precioAnualUsd ?? null, preciosLocales: x.preciosLocales, cobrable: true }));
  const html = renderToStaticMarkup(React.createElement(PreciosLanding, { planes, sufijo: '' }));
  assert.match(html, /<table class="planes-tabla">/, 'la portada no tiene la tabla comparativa');
  for (const f of filasDeComparacion()) assert.ok(html.includes(f.que), `la tabla no dice «${f.que}»`);
  const esencial = planes.find((p) => p.capa === 'completo')!;
  const tarjeta = html.slice(html.indexOf(`<h3>${esencial.nombre}</h3>`), html.indexOf('</section>', html.indexOf(`<h3>${esencial.nombre}</h3>`)));
  assert.match(tarjeta, /<ul class="mkpl-lista mkpl-no" aria-label="No incluye">/, 'la tarjeta de Esencial no dice lo que NO incluye');
  for (const x of noIncluyeDe('completo')) assert.ok(tarjeta.includes(`<li>${x}</li>`), `Esencial: falta el ✗ de «${x}»`);
});

// ── Sin fondo azul también en el Acelerador (29/10/2026, el Cerebro con la regla de Martín: «fondo claro, el azul sólo de
// acento»): su bloque sigue oscuro para destacarse, pero en el grafito de la app. Verificado rompiéndolo: volver al azul
// marino → rojo.
test('el bloque del Acelerador es grafito, no azul', () => {
  const t = leer('app/planes/Tarjetas.tsx');
  const regla = /\.mkpl-programa \{ background: ([^;]+);/.exec(t)?.[1] ?? '';
  assert.match(regla, /#101319/, 'el Acelerador no tiene el fondo grafito de la app');
  assert.doesNotMatch(regla, /#142B66|#0B1735|122,162,255/, 'el Acelerador volvió al fondo azul');
});

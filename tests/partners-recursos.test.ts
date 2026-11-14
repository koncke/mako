// =============================================================================
// «Para recomendar MaKo»: el PDF de venta y los mensajes para copiar, en MaKo Partners (27/10/2026)
// =============================================================================
// Compromiso de Martín en la llamada con Leila (Fathom 876470842-25): recursos para revender. Lo que se cuida acá:
//   · los mensajes y el PDF llevan SU link y SU código, y los precios y lo que trae cada plan salen del código (un precio que
//     cambia, cambia los recursos), sin jerga (la misma vara que la tabla de /planes);
//   · no prometen lo que el programa no da: quien llega con el código no tiene descuento;
//   · el panel de la computadora y el del teléfono los muestran, y la API los devuelve en `ver_mi_programa_partners`.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/partners-recursos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { archivoDelPdf, mensajesParaCopiar, pdfDeVenta } from '../lib/partners-recursos';
import { PLANES_MAKO_DEFAULT, PRUEBA_GRATIS_PRENDIDA, type PlanMako } from '../lib/planes-mako';
import { TOPES } from '../lib/topes-plan';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const LINK = 'https://hola-mako.com/r/leila';
// 14/11/2026: el PDF dice los planes con las palabras de /planes, que ya usan el lenguaje de marketing (Martín: «landing», «leads»,
// «CRM», «scrapear»). Lo que no va es lo de nuestra cocina.
const JERGA = /\btopes?\b|scraper\b|\bcapa\b|workspace/i;
const PROMESA = /descuento|% off|gratis para siempre|garantiza|vas a (vender|facturar|ganar)/i;

test('los MENSAJES: uno por situación, cada uno con su link; el del precio, con los precios de hoy y el código', () => {
  const m = mensajesParaCopiar({ link: LINK, codigo: 'leila' });
  assert.deepEqual(m.map((x) => x.id), ['conocido', 'estado', 'instagram', 'precio', 'seguimiento']);
  for (const x of m) {
    assert.ok(x.texto.includes(LINK), `${x.id}: sin su link no cuenta para el partner`);
    // Un partner no puede prometer lo que el checkout no da: la prueba sólo si está prendida (`PRUEBA_GRATIS_PRENDIDA`; apagada
    // el 30/10/2026, prendida de nuevo el 12/11/2026).
    if (!PRUEBA_GRATIS_PRENDIDA) assert.doesNotMatch(x.texto, /d[ií]as gratis|prueba gratis|lo pruebas/i, `${x.id}: promete una prueba que ya no existe`);
    assert.doesNotMatch(x.texto, JERGA, x.id);
    assert.doesNotMatch(x.texto, PROMESA, `${x.id}: no promete lo que el programa no da`);
    assert.ok(x.texto.length <= 280, `${x.id}: corto, para un WhatsApp`);
  }
  const precio = m.find((x) => x.id === 'precio')!.texto;
  const es = PLANES_MAKO_DEFAULT.find((p) => p.id === 'esencial')!.precioUsd;
  const pro = PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro')!.precioUsd;
  assert.ok(precio.includes(`US$ ${es}`) && precio.includes(`US$ ${pro}`), precio);
  assert.match(precio, /pon mi código leila al pagar/);
  // Un precio cambiado en el setting cambia el mensaje solo.
  const caro = PLANES_MAKO_DEFAULT.map((p): PlanMako => (p.id === 'pro' ? { ...p, precioUsd: 127 } : p));
  assert.match(mensajesParaCopiar({ link: LINK, codigo: 'leila', planes: caro }).find((x) => x.id === 'precio')!.texto, /US\$ 127/);
});

test('el PDF: qué hace MaKo, los dos planes con lo que trae cada uno (como /planes), la prueba, y su link y su código', () => {
  const d = pdfDeVenta({ link: LINK, codigo: 'leila', deParte: '  Leila Coach  ' });
  assert.equal(d.link, LINK);
  assert.equal(d.codigo, 'leila');
  assert.equal(d.deParte, 'Leila Coach');
  assert.deepEqual(d.planes.map((p) => p.nombre), ['MaKo Esencial', 'MaKo Pro'], 'el Acelerador no: se vende por llamada');
  assert.equal(d.planes[0].precio, 'US$ 47 por mes');
  assert.equal(d.planes[1].precio, 'US$ 97 por mes');
  assert.ok(d.planes[0].incluye.includes(`Landings y presentaciones armadas con IA, publicadas: ${TOPES.completo['web.landings_publicadas']}`), 'los topes de verdad');
  assert.ok(d.planes[0].incluye.includes('Leads y clientes guardados en tu CRM: hasta 2.000'), d.planes[0].incluye.join(' | '));
  assert.ok(!d.planes[0].incluye.some((x) => /grupos de WhatsApp/.test(x)), 'Esencial no trae el scraper');
  assert.equal(d.planes[1].incluye[0], 'Todo lo de MaKo Esencial, con más lugar');
  assert.ok(d.planes[1].incluye.includes('Scrapear los contactos de tus grupos de WhatsApp'), 'Pro sí');
  assert.ok(!d.planes[1].incluye.some((x) => /asesoría grupal/.test(x)), 'lo del Acelerador no va en Pro');
  if (PRUEBA_GRATIS_PRENDIDA) assert.match(d.prueba, /d[ií]as gratis/i, 'el PDF dice la prueba');
  else assert.doesNotMatch(d.prueba, /d[ií]as gratis/i, 'el PDF no promete una prueba que ya no existe');
  for (const t of [d.titulo, d.bajada, ...d.queHace, ...d.planes.flatMap((p) => [p.resumen, ...p.incluye]), d.prueba]) {
    assert.doesNotMatch(t, PROMESA, t);
  }
  for (const t of [d.titulo, d.bajada, ...d.queHace, ...d.planes.flatMap((p) => p.incluye)]) assert.doesNotMatch(t, JERGA, t);
  assert.equal(pdfDeVenta({ link: LINK, codigo: 'x-y' }).deParte, null);
  assert.equal(archivoDelPdf('leila-ventas'), 'mako-leila-ventas.pdf');
  assert.equal(archivoDelPdf('../x'), 'mako-x.pdf', 'nada raro en el nombre del archivo');
});

test('el PDF se ARMA de verdad (jsPDF en Node): una sola hoja, con los planes de hoy', async () => {
  const Module = (await import('node:module')).default as unknown as { _load: (p: string, ...r: unknown[]) => unknown };
  const cargar = Module._load;
  Module._load = (p: string, ...r: unknown[]) => (p === 'server-only' ? {} : Reflect.apply(cargar, Module, [p, ...r]));
  const { armarPdfDeVenta } = await import('../app/partners/RecursosPartner');
  const pdf = await armarPdfDeVenta(pdfDeVenta({ link: LINK, codigo: 'leila', deParte: 'Leila Coach' }));
  assert.equal(pdf.getNumberOfPages(), 1, 'una hoja para mandar por WhatsApp');
  assert.ok(pdf.output('arraybuffer').byteLength > 3000);
});

test('se VEN: el panel de la computadora y el del teléfono, con el link y el código vivos; y la API los devuelve', () => {
  const panel = fuente('app/partners/PanelPartner.tsx');
  assert.match(panel, /\{ref\.link && ref\.codigo && <RecursosPartner link=\{ref\.link\} codigo=\{ref\.codigo\} nombreNegocio=\{nombreNegocio\} \/>\}/,
    'con el código de después de «Cambiar»');
  const m = fuente('app/m/partners/ReferidosM.tsx');
  assert.match(m, /<RecursosParaRecomendar link=\{tablero\.link\} codigo=\{tablero\.codigo\} nombreNegocio=\{nombreNegocio\} \/>/);
  const rec = fuente('app/partners/RecursosPartner.tsx');
  assert.match(rec, /const \{ jsPDF \} = await import\('jspdf'\);/, 'jsPDF se carga recién al tocar el botón');
  assert.match(rec, /pdf\.textWithLink\(d\.link, /, 'el link del PDF se puede tocar');
  assert.match(rec, /\(await armarPdfDeVenta\(d\)\)\.save\(archivoDelPdf\(d\.codigo\)\);/);
  assert.doesNotMatch(rec, /pr[oó]ximamente|muy pronto/i, 'lo que falta (audios, videos) no se muestra');
  const run = fuente('lib/api-mako/areas/negocio.run.ts');
  assert.match(run, /mensajes_para_recomendar: mensajesParaCopiar\(\{ link: t\.link, codigo: t\.codigo \}\)/);
});

// Probado rompiéndolo (27/10/2026), una rotura por vez sobre la base en verde (3 pases, 0 fallos; el del PDF armado en Node se
// sumó después), restaurando el texto con un script (nunca git). Rota (pases / fallos):
//   · un mensaje sin el link                                                   → 2 / 1
//   · Pro repite todo lo de Esencial                                           → 2 / 1
//   · Esencial con lo de Pro                                                   → 2 / 1

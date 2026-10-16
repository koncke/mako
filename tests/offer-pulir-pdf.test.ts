// =============================================================================
// Offer: el PDF en el chat, lo provisional, «Lo que propuso MaKo» y «qué falta para venderla»
// =============================================================================
// Pedido de Martín (12/10/2026): «sería bueno que MaKo en el mismo chat te proponga pulir la oferta, y que
// cuando se haya pulido te re-envie el PDF las veces que sea necesario con la versión final». Más el
// criterio nuevo de Offer: con Cliente ideal o Promesa en 3 o menos, precio y bonos salen PROVISIONALES;
// lo que MaKo puso de su cosecha va aparte («Lo que propuso MaKo»); y si la oferta no está lista, la
// Conclusión dice qué falta (el control final del motor), no sólo «lo que más frena».
//
// El MOTOR (lib/offer-*, app/api/offer/*) lo escribe otro agente; acá se fija lo que decide la PANTALLA
// (app/offer/*): las lecturas a la defensiva de lo nuevo (ayudas.ts), el documento del chat, la ruta del
// PDF por versión y el dibujo de la Conclusión.
//
// PROBADO ROMPIÉNDOLO (12/10/2026, arnés en el scratchpad que rompe UNA cosa, corre este archivo y restaura
// DE MEMORIA; base 10 pases / 0 fallos). Las 17 roturas, cazadas:
//   P1  el pdf de un mensaje acepta una versión no entera                     → 9/1
//   P2  la ruta del PDF ignora la versión                                     → 8/2 (la ruta y la descarga)
//   P3  descargar sin la versión                                              → 9/1
//   P4  el chat no dibuja el documento del PDF                                → 9/1
//   P5  provisional con partes repetidas                                      → 9/1
//   P6  el precio provisional no marca «Inversión»                            → 8/2
//   P7  un punto del control final pasa sin un `true` explícito               → 9/1
//   P8  el chip no dice cuánto falta                                          → 8/2
//   P9  «Qué falta para venderla» lista también lo que pasa                   → 9/1
//   P10 sin la marca «Provisional»                                            → 9/1
//   P11 sin «Lo que propuso MaKo»                                             → 9/1
//   P12 el botón de armar adentro de lo que scrollea                          → 9/1
//   P13 sin los avisos del marco antes de la oferta                           → 9/1
//   P14 el punto del control sin el nombre del marco                          → 8/2
//   P15 el botón de armar no cambia con una versión                           → 9/1
//   P16 «Actualizar el PDF» como respuesta rápida no arma                     → 9/1
//   P17 el riel con el rótulo escrito a mano                                  → 9/1
// Restaurado → 10/0. (Dos guards se ajustaron porque la primera pasada no cazaba P12 ni P13: medían una
// posición relativa que también se cumple con el bug —el botón «después» de la lista, adentro del mismo
// scroll— y un `indexOf` que da -1 cuando el aviso falta.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ACTUALIZAR_PDF, controlFinalDe, esSeccionProvisional, etiquetaArmar, nombrePdfVersion, pdfDeMensaje, propuestoPorMakoDe, provisionalDe, textoDeEstado, urlPdf,
} from '../app/offer/ayudas';
import { descargarPdf } from '../app/offer/offer-api';
import { DocumentoPdf } from '../app/offer/ChatOffer';
import { Conclusion, VistaOferta } from '../app/offer/Conclusion';
import { RielPiezas } from '../app/offer/PiezasRail';
import { PIEZAS, type ConclusionOferta, type OfferSesionVista, type PropuestaOferta } from '../lib/offer-marco';

const RAIZ = join(__dirname, '..');
const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

// ── El PDF de cada versión, en el chat ───────────────────────────────────────

test('pdf del mensaje: sólo una versión entera positiva; los mensajes de antes no traen nada', () => {
  assert.deepEqual(pdfDeMensaje({ pdf: { version: 2 } }), { version: 2 });
  assert.equal(pdfDeMensaje({}), null);
  assert.equal(pdfDeMensaje(null), null);
  for (const v of [0, -1, 1.5, '2', null, Number.NaN]) assert.equal(pdfDeMensaje({ pdf: { version: v } }), null, String(v));
  assert.equal(pdfDeMensaje({ pdf: 'v2' }), null);
});

test('la ruta del PDF: sin versión, la vigente; con versión, ESA (cada mensaje baja la suya)', () => {
  assert.equal(urlPdf(5), '/api/offer/pdf?id=5');
  assert.equal(urlPdf(5, 2), '/api/offer/pdf?id=5&v=2');
  assert.equal(urlPdf(5, 0), '/api/offer/pdf?id=5', 'una versión inválida no se manda');
  assert.equal(urlPdf(5, null), '/api/offer/pdf?id=5');
  assert.equal(nombrePdfVersion(3), 'Tu oferta · versión 3');
});

test('descargar: pide la versión del mensaje, y un error del servidor se dice (no baja un JSON con nombre de PDF)', async () => {
  const antes = globalThis.fetch;
  const pedidas: string[] = [];
  globalThis.fetch = (async (u: string | URL | Request) => {
    pedidas.push(String(u));
    return new Response(JSON.stringify({ ok: false, error: 'No encontré esa oferta.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    await assert.rejects(descargarPdf(7, 3), /No encontré esa oferta\./);
    await assert.rejects(descargarPdf(7), /No encontré esa oferta\./);
  } finally {
    globalThis.fetch = antes;
  }
  assert.deepEqual(pedidas, ['/api/offer/pdf?id=7&v=3', '/api/offer/pdf?id=7']);
});

test('el documento del chat: como un archivo de WhatsApp (PDF, nombre) y baja con un botón', () => {
  const html = renderToStaticMarkup(createElement(DocumentoPdf, { sesionId: 7, version: 2, onError: () => {} }));
  assert.match(html, /<button[^>]*aria-label="Descargar el PDF de tu oferta, versión 2"/);
  assert.match(html, />PDF</);
  assert.match(html, /Tu oferta · versión 2/);
  // Y el chat lo pone ARRIBA del texto, en los mensajes de MaKo que traen `pdf`.
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  const mako = bloque(chat, "if (m.de === 'mako') {", 'if (!m.adjuntos?.length) return null;');
  assert.match(mako, /const pdf = pdfDeMensaje\(m\);/);
  // (Desde el 16/10/2026 con `onVer`: «Ver mi oferta» la abre en una ventana encima del chat.)
  const iDoc = mako.indexOf('{pdf && <DocumentoPdf sesionId={sesion.id} version={pdf.version} onError={onError} onVer={onVerOferta} />}');
  assert.ok(iDoc > 0, 'el documento no se dibuja');
  assert.ok(iDoc < mako.indexOf('<Markdown text={m.texto} />'), 'el documento va arriba y el texto como su pie');
  // El documento baja por descargarPdf con SU versión.
  assert.match(bloque(chat, 'export function DocumentoPdf', 'function FilaMako'), /await descargarPdf\(sesionId, version\)/);
});

// ── Lo nuevo de la conclusión, leído a la defensiva ──────────────────────────

test('provisional: sólo precio y bonos, sin repetidos; sin partes no hay marca', () => {
  assert.deepEqual(provisionalDe({ provisional: { partes: ['bonos', 'precio', 'bonos', 'otra'], motivo: '  Falta definir el cliente.  ' } }),
    { partes: ['bonos', 'precio'], motivo: 'Falta definir el cliente.' });
  assert.equal(provisionalDe({ provisional: { partes: [], motivo: 'x' } }), null);
  assert.equal(provisionalDe({ provisional: { partes: 'precio' } }), null);
  assert.equal(provisionalDe({}), null);
  assert.deepEqual(provisionalDe({ provisional: { partes: ['precio'] } }), { partes: ['precio'], motivo: '' });
  const prov = { partes: ['precio' as const], motivo: '' };
  assert.equal(esSeccionProvisional('inversion', prov), true, 'el precio vive en «Inversión»');
  assert.equal(esSeccionProvisional('bonos', prov), false);
  assert.equal(esSeccionProvisional('bonos', { partes: ['bonos'], motivo: '' }), true);
  assert.equal(esSeccionProvisional('inversion', null), false);
});

test('lo que propuso MaKo: saneado, sin vacíos; y el control final: «ok» sólo con true explícito', () => {
  assert.deepEqual(propuestoPorMakoDe({ propuestoPorMako: [{ seccion: ' Bonos ', que: ' Una sesión de diagnóstico ' }, { seccion: 'x', que: '' }, null, 'suelto'] }),
    [{ seccion: 'Bonos', que: 'Una sesión de diagnóstico' }]);
  assert.deepEqual(propuestoPorMakoDe({}), []);
  // En el ORDEN del marco y con el nombre del marco (PUNTOS_CONTROL); un punto desconocido no se dibuja.
  assert.deepEqual(controlFinalDe({ controlFinal: [{ punto: 'garantia', ok: true, porque: '' }, { punto: 'dolor', ok: 'sí', porque: ' sin urgencia ' }, { punto: 'otro', ok: false }] }),
    [{ punto: 'dolor', label: 'Dolor urgente', ok: false, porque: 'sin urgencia' }, { punto: 'garantia', label: 'Garantía fuerte', ok: true, porque: '' }]);
  assert.deepEqual(controlFinalDe({}), []);
  assert.equal(textoDeEstado({ lista: true, faltan: 2, cuello: 'Promesa' }), 'Lista para vender');
  assert.equal(textoDeEstado({ lista: false, faltan: 1, cuello: 'Promesa' }), 'Le falta 1 cosa para venderla');
  assert.equal(textoDeEstado({ lista: false, faltan: 3, cuello: 'Promesa' }), 'Le faltan 3 cosas para venderla');
  assert.equal(textoDeEstado({ lista: false, faltan: 0, cuello: 'Promesa' }), 'Lo que más frena: Promesa', 'sin control final, lo de antes');
});

// ── La Conclusión, dibujada ──────────────────────────────────────────────────

const propuesta = {
  nombre: 'Programa X', frase: 'Llena tu agenda en 90 días',
  inversion: { valorTotal: '', precio: '1.500 USD', contado: '', plan: '', comoDecirlo: '' },
  bonos: [{ nombre: 'Auditoría', objecion: 'No tengo tiempo', valor: '' }],
  garantia: { nombre: 'Garantía de resultados', condiciones: '', plazo: '', siNoCumple: '' },
  completar: ['El número de casos'],
  propuestoPorMako: [{ seccion: 'Bonos', que: 'Una auditoría de tu embudo' }],
} as unknown as PropuestaOferta;

const conclusion = (calculo: Record<string, unknown>, extra: Record<string, unknown> = {}): ConclusionOferta => ({
  diagnostico: { dimensiones: [], tesis: 'Le falta prueba.', fuerte: '', cambios: [] },
  calculo: { total: 52, cuello: 'D4', lista: false, alertas: [], ...calculo },
  propuesta, version: 2, at: '2026-10-12T10:00:00Z', modelo: 'x', ...extra,
}) as unknown as ConclusionOferta;

const sesion = { id: 7, ofertaId: null, ligada: true, funnelId: 3 } as unknown as OfferSesionVista;
const dibujar = (c: ConclusionOferta) => renderToStaticMarkup(createElement(Conclusion, { sesion, conclusion: c, onSeguir: () => {}, onGuardar: async () => null }));

test('conclusión sin lista: el chip dice cuánto falta y el diagnóstico lista QUÉ falta (sólo lo que no pasa)', () => {
  const html = dibujar(conclusion({ controlFinal: [{ punto: 'garantia', ok: true, porque: '' }, { punto: 'resultado', ok: false, porque: 'La promesa no tiene número.' }] }));
  assert.match(html, /Le falta 1 cosa para venderla/);
  assert.match(html, /aria-label="Qué falta para venderla"[\s\S]*Resultado medible[\s\S]*La promesa no tiene número\./);
  assert.doesNotMatch(bloque(html, 'aria-label="Qué falta para venderla"', '</section>'), /Garantía fuerte/, 'lo que ya pasa no es lo que falta');
  // Lista: ni el bloque ni el conteo. Y sin control final (las de antes), lo que más frena.
  const lista = dibujar(conclusion({ lista: true, controlFinal: [{ punto: 'garantia', ok: false, porque: 'x' }] }));
  assert.match(lista, /Lista para vender/);
  assert.doesNotMatch(lista, /Qué falta para venderla/);
  assert.match(dibujar(conclusion({})), /Lo que más frena: Certeza/);
});

test('oferta nueva: precio y bonos con la marca de provisional y su motivo; «Lo que propuso MaKo» al final y aparte', () => {
  const prov = { partes: ['precio' as const, 'bonos' as const], motivo: 'Tu cliente ideal todavía es amplio.' };
  const html = renderToStaticMarkup(createElement(VistaOferta, { p: propuesta, provisional: prov }));
  const seccion = (titulo: string) => {
    const i = html.indexOf(`>${titulo}<`);
    assert.ok(i > 0, `no está la sección ${titulo}`);
    return html.slice(html.lastIndexOf('<section', i), html.indexOf('</section>', i));
  };
  assert.match(seccion('Inversión'), /Provisional/);
  assert.match(seccion('Bonos'), /Provisional/);
  assert.doesNotMatch(seccion('Garantía'), /Provisional/, 'sólo precio y bonos');
  // El motivo, en una línea, adentro de cada sección marcada (las tres de este ejemplo abren de entrada).
  assert.match(seccion('Inversión'), /Tu cliente ideal todavía es amplio\./);
  assert.match(seccion('Bonos'), /Tu cliente ideal todavía es amplio\./);
  // «Lo que propuso MaKo»: después de todas las secciones, y no adentro de los datos a completar.
  const iMako = html.indexOf('aria-label="Lo que propuso MaKo"');
  assert.ok(iMako > html.lastIndexOf('of-plegable'), 'va al final');
  assert.match(html.slice(iMako), /<strong>Bonos: <\/strong>[\s\S]*Una auditoría de tu embudo/);
  assert.ok(html.indexOf('dato para completar') < iMako, 'los datos a completar van arriba, aparte');
  // Lo que arma el código del motor: los avisos del marco ANTES de la oferta, y los supuestos a la vista.
  const conAvisos = renderToStaticMarkup(createElement(VistaOferta, { p: { ...propuesta, avisos: ['El precio está por debajo de 1.000 USD.'], supuestos: ['Cuántos clientes atiende a la vez.'] } as unknown as PropuestaOferta, provisional: null }));
  const iAviso = conAvisos.indexOf('El precio está por debajo de 1.000 USD.');
  assert.ok(iAviso >= 0 && iAviso < conAvisos.indexOf('of-plegable'), 'el aviso se dibuja, y antes de la oferta');
  assert.match(conAvisos, />Supuestos</);
  // Sin marca: nada provisional.
  assert.doesNotMatch(renderToStaticMarkup(createElement(VistaOferta, { p: propuesta, provisional: null })), /Provisional/);
});

// ── «Tu oferta» con más piezas ───────────────────────────────────────────────

test('el riel: scrollea la LISTA (el conteo y el botón de armar quedan a la vista) y cuenta con el total del marco', () => {
  const acciones = { puedeConcluir: true, hayConclusion: false, etiquetaArmar: 'Armar mi oferta', ocupado: false, onArmar: () => {}, onVer: () => {} };
  const html = renderToStaticMarkup(createElement(RielPiezas, { piezas: {}, acciones }));
  const iScroll = html.indexOf('overflow-y:auto');
  assert.ok(iScroll > 0, 'algo tiene que scrollear');
  const iLista = html.indexOf('<ul', iScroll);
  const iBoton = html.indexOf('Armar mi oferta');
  const iFinLista = html.indexOf('</ul>', iLista);
  assert.ok(iLista > iScroll && iBoton > iFinLista, 'el botón va después de la lista');
  assert.ok(html.startsWith('</ul></div>', iFinLista), 'lo que scrollea se cierra con la lista: el botón queda FUERA, a la vista');
  assert.ok(html.indexOf(`/${PIEZAS.length}`) > 0 && html.indexOf(`/${PIEZAS.length}`) < iScroll, 'el conteo, arriba y fijo, con el total del marco');
  assert.equal((html.match(/<li /g) ?? []).length, PIEZAS.length, 'una fila por pieza del marco');
});

test('el botón de armar: con una versión ya armada dice «Actualizar el PDF», y MaKo puede ofrecerlo como respuesta', () => {
  assert.equal(etiquetaArmar(false, 'Armar mi oferta', ACTUALIZAR_PDF), 'Armar mi oferta');
  assert.equal(etiquetaArmar(true, 'Armar mi oferta', ACTUALIZAR_PDF), 'Actualizar el PDF');
  assert.equal(etiquetaArmar(true, 'Armar mi oferta', '  '), 'Armar mi oferta', 'sin rótulo de actualizar, el de siempre');
  const html = renderToStaticMarkup(createElement(RielPiezas, { piezas: {}, acciones: { puedeConcluir: true, hayConclusion: true, etiquetaArmar: 'Actualizar el PDF', ocupado: false, onArmar: () => {}, onVer: () => {} } }));
  assert.match(html, /Actualizar el PDF/);
  assert.match(html, /Ver mi oferta/);
  // La pantalla lo calcula con la conclusión, y las dos opciones (armar y actualizar) disparan el armado.
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /etiquetaArmar: etiquetaArmar\(!!conclusion, opcionArmar, opcionActualizar\)/);
  assert.match(app, /\(esOpcionArmar\(op, opcionArmar\) \|\| esOpcionArmar\(op, opcionActualizar\)\) && s\.puedeConcluir\) \{ void armar\(\); return; \}/);
});

// ── El riel agrupado (12/10/2026) ────────────────────────────────────────────
// Probado rompiéndolo: sacar una pieza de GRUPOS_PIEZAS la manda a «Más» (1 fallo, 11 pases); borrar
// el «Más» de piezasAgrupadas hace desaparecer la pieza sin grupo (1 fallo, 11 pases).
import { GRUPOS_PIEZAS, piezasAgrupadas } from '../app/offer/PiezasRail';
import { PIEZAS as PIEZAS_RIEL } from '../lib/offer-marco';

test('el riel agrupa las piezas sin perder ninguna ni repetirla', () => {
  const dibujadas = piezasAgrupadas().flatMap((g) => g.piezas.map((p) => p.key));
  assert.deepEqual([...dibujadas].sort(), PIEZAS_RIEL.map((p) => p.key).sort(), 'una pieza se pierde o se repite');
  const agrupadas = new Set(GRUPOS_PIEZAS.flatMap((g) => g.keys));
  assert.deepEqual(PIEZAS_RIEL.filter((p) => !agrupadas.has(p.key)).map((p) => p.key), [], 'hay piezas que caen en «Más»: agrúpalas');
});

test('una pieza que nadie agrupó cae en «Más», no desaparece', () => {
  const g = piezasAgrupadas([{ key: 'a' }, { key: 'nueva' }], [{ titulo: 'Uno', keys: ['a'] }]);
  assert.deepEqual(g.map((x) => [x.titulo, x.piezas.map((p) => p.key)]), [['Uno', ['a']], ['Más', ['nueva']]]);
});

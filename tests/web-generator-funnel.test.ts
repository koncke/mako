// =============================================================================
// El funnel de una landing (13/11/2026): las páginas en el orden del recorrido, lo que conecta cada una con la siguiente
// =============================================================================
// Pedido de Martín (vía Cerebro): la vista de funnel como en GoHighLevel. lib/editor-landing/funnel.ts, puro. Lo que fija:
//   1. el recorrido: el orden del panel, lo que conecta cada paso con el siguiente (el formulario, un botón), el paso sin
//      salida y las otras páginas a las que lleva;
//   2. el objetivo de cada página, por lo que tiene;
//   3. conectar: la flecha que se cambia, el formulario libre, el botón libre, o un botón nuevo;
//   4. «+ Siguiente paso»: la página nueva con lo justo de su objetivo, y su ruta libre.
// Correr: node --import tsx --test tests/web-generator-funnel.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODO, docPagina, parrafo, tarjeta, titulo, type JsonNodo, type Pagina } from '../lib/editor-landing/doc';
import { conectar, conexionesDe, objetivoDe, paginaDePaso, recorridoDe, OBJETIVOS_PASO } from '../lib/editor-landing/funnel';

const boton = (texto: string, href: string): JsonNodo => ({ type: NODO.botones, attrs: { alinea: 'izquierda' }, content: [{ type: NODO.boton, attrs: { href, variante: 'primario', nuevaPestana: false }, content: [{ type: 'text', text: texto }] }] });
const formulario = (redirigir: string | null): JsonNodo => ({ type: NODO.formulario, attrs: { campos: [], boton: 'Quiero mi lugar', exito: 'Listo', redirigir } });
const pagina = (id: string, tituloP: string, ruta: string, ...nodos: JsonNodo[]): Pagina => ({ id, titulo: tituloP, ruta, doc: docPagina([tarjeta([titulo(tituloP, 1), ...nodos])]) });

// El recorrido de «Agenda una llamada»: formulario → video → agenda → gracias (la agenda todavía sin conectar).
const PAGINAS: Pagina[] = [
  pagina('p1', 'Registro', '', parrafo('Deja tus datos'), formulario('pagina:p2')),
  pagina('p2', 'Video', 'video', { type: NODO.video, attrs: { src: 'https://x/v.mp4' } }, boton('Ya agendé', 'pagina:p4'), boton('Quiero agendar', 'pagina:p3')),
  pagina('p3', 'Agenda', 'agenda', { type: NODO.insertado, attrs: { src: 'https://calendly.com/x/30min', proveedor: 'calendly', alto: null } }),
  pagina('p4', 'Gracias', 'gracias', parrafo('Te esperamos')),
];

test('1. el recorrido: el orden del panel, lo que conecta cada paso con el siguiente y el paso sin salida', () => {
  const r = recorridoDe(PAGINAS);
  assert.deepEqual(r.map((p) => p.pagina.id), ['p1', 'p2', 'p3', 'p4']);
  assert.deepEqual(r[0].siguiente, { hacia: 'p2', por: 'formulario', texto: 'Quiero mi lugar' });
  assert.deepEqual(r[1].siguiente, { hacia: 'p3', por: 'boton', texto: 'Quiero agendar' });
  assert.deepEqual(r[1].otras, [{ hacia: 'p4', por: 'boton', texto: 'Ya agendé' }], 'también lleva a la de gracias (y es su PRIMER botón: el siguiente se busca por destino)');
  assert.equal(r[2].siguiente, null);
  assert.equal(r[2].sinSalida, true, 'la agenda no lleva a la de gracias: se marca');
  assert.equal(r[3].sinSalida, false, 'la de gracias es el final');
  assert.equal(r[0].sinSalida, false);
  // El documento vivo de la página abierta manda (el editor tiene cambios sin guardar).
  const vivo = recorridoDe(PAGINAS, (p) => (p.id === 'p3' ? docPagina([tarjeta([boton('Listo', 'pagina:p4')])]) : p.doc));
  assert.equal(vivo[2].siguiente?.texto, 'Listo');
  assert.equal(recorridoDe([PAGINAS[0]])[0].sinSalida, false, 'una sola página no es un funnel roto');
});

test('2. el objetivo de cada página, por lo que tiene', () => {
  assert.deepEqual(PAGINAS.map((p) => objetivoDe(p)), ['formulario', 'vsl', 'agenda', 'gracias']);
  assert.equal(objetivoDe(pagina('x', 'Oferta especial', 'oferta')), 'venta');
  assert.equal(objetivoDe(pagina('x', 'Checkout', 'pagar', boton('Comprar', 'pago:12'))), 'venta');
  assert.equal(objetivoDe(pagina('x', 'Sobre nosotros', 'nosotros')), null, 'una de contenido no tiene objetivo');
  assert.deepEqual(conexionesDe(null), []);
});

test('3. conectar: la flecha que se cambia, el formulario libre, el botón libre, o uno nuevo', () => {
  // La agenda (sin formulario ni botón) a la de gracias: un botón nuevo al final.
  const a = conectar(PAGINAS[2].doc, 'p4');
  assert.deepEqual(a.conexion, { hacia: 'p4', por: 'boton', texto: 'Seguir' });
  assert.deepEqual(conexionesDe(a.doc).map((c) => c.hacia), ['p4']);
  // Un formulario que no manda a ninguna página: ése.
  const f = conectar(docPagina([tarjeta([formulario(null)])]), 'p9');
  assert.equal(f.conexion.por, 'formulario');
  // La flecha que ya estaba (el video lleva a la agenda): pasa a llevar a la de gracias, el otro botón queda.
  const v = conectar(PAGINAS[1].doc, 'p4', 'p3');
  assert.deepEqual(conexionesDe(v.doc).map((c) => `${c.texto}→${c.hacia}`), ['Ya agendé→p4', 'Quiero agendar→p4']);
  // Un botón libre (a «#»): ése, no uno nuevo.
  const b = conectar(docPagina([tarjeta([boton('Comprar', '#')])]), 'p5');
  assert.deepEqual(conexionesDe(b.doc), [{ hacia: 'p5', por: 'boton', texto: 'Comprar' }]);
  // Un botón de PAGO no se toca: se suma uno nuevo.
  const pago = conectar(docPagina([tarjeta([boton('Pagar', 'pago:3')])]), 'p6', null, 'Siguiente');
  assert.equal(JSON.stringify(pago.doc).includes('pago:3'), true);
  assert.equal(pago.conexion.texto, 'Siguiente');
});

test('4. «+ Siguiente paso»: la página nueva con lo justo de su objetivo, y su ruta libre', () => {
  for (const o of OBJETIVOS_PASO) {
    const p = paginaDePaso(o, PAGINAS);
    assert.equal(objetivoDe(p), o, `${o}: la página nueva se reconoce por su objetivo`);
    assert.ok(p.id && p.titulo, o);
  }
  assert.equal(paginaDePaso('vsl', PAGINAS).ruta, 'video-2', 'la ruta «video» ya está: otra libre');
  assert.equal(paginaDePaso('venta', PAGINAS).ruta, 'oferta');
  const form = paginaDePaso('formulario', PAGINAS);
  assert.ok(JSON.stringify(form.doc).includes('"tipo":"email"'), 'el formulario trae nombre, correo y WhatsApp');
});

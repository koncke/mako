// =============================================================================
// Offer: al terminar el análisis, lo primero que se ve es la vista del PDF (tarjeta #887, 17/10/2026)
// =============================================================================
// Revisión de MaKo con Código Inmobiliario (16/10/2026, Fathom 193666833, 01:49:37). Martín: «lo que le recomiendo
// siempre… es que te muestre la vista de PDF, mejor antes que eso» (la oferta nueva en pantalla). Lo de acá fija:
//   1. las páginas que muestra la pantalla son las MISMAS del PDF que se descarga (mismo texto en cada página, mismo
//      número de páginas), en SVG y escapadas (lo que escribió la IA no puede meter un nodo);
//   2. la ruta las da con `vista=paginas`, leyendo lo guardado como el PDF (`conclusionVisible`);
//   3. la ventana de la oferta abre en el PDF, sin la oferta nueva arriba;
//   4. la ventana se abre SOLA cuando el armado termina con la pantalla abierta (no con un error, no en otra
//      conversación, no en el onboarding).
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (17/10/2026, arnés romper-888.mjs con otra lista, en el scratchpad de la sesión:
// rompe UNA cosa, corre este archivo y restaura DE MEMORIA). La base en verde (5 de 5); 8 roturas, las 8 cazadas (la de
// conclusionVisible se escapó la primera vez: el test no exigía que la línea existiera; arreglado). Los números, al lado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PdfDoc } from '../lib/pdf-escritor';
import { pdfDeOferta, paginasDeOferta } from '../lib/offer-pdf';
import { Conclusion, PESTANAS } from '../app/offer/Conclusion';
import { srcDePagina } from '../app/offer/VistaPdf';
import { DIMENSION_IDS, type ConclusionOferta, type OfferSesionVista } from '../lib/offer-marco';

const leer = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

async function textoPorPagina(bytes: Uint8Array): Promise<string[]> {
  const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
  if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
  const { extractText, getDocumentProxy } = await import('unpdf');
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: false });
  return (Array.isArray(text) ? text : [text]).map((t) => t.replace(/\s+/g, ' ').trim());
}
/** El texto de una página SVG: lo que hay adentro de cada <text>, desescapado. */
const textoSvg = (svg: string): string => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
  .map((m) => m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
  .join(' ').replace(/\s+/g, ' ').trim();
const palabras = (t: string) => t.split(' ').filter((w) => w.length > 2);

function conclusion(): ConclusionOferta {
  return {
    version: 2, at: '2026-10-17T10:00:00.000Z', modelo: 'IA gratis',
    calculo: { total: 71, cuello: 'D8', lista: false, alertas: ['Tienes 3 productos activos en MaKo: en la fase 1 conviene empujar una sola oferta hasta tener un anuncio ganador.'], cifrasConFuente: true },
    diagnostico: {
      tesis: 'El embudo se corta en la asistencia: antes de culpar a la oferta, arregla la confirmación de llamadas.',
      fuerte: '«Entre 4 y 10 clientes ya pagaron»', fuertes: ['«Entre 4 y 10 clientes ya pagaron»'],
      dimensiones: DIMENSION_IDS.map((id, i) => ({ id, nota: 4 + (i % 5), porque: `Porque ${id}: <b>«cita»</b> & más.`, mejora: `Mejora ${id}.` })),
      cambios: [{ titulo: 'Automatizar la confirmación', porque: 'Se pierden reservas.', hipotesis: 'Si recuerdas la llamada, sube la asistencia.' }],
    },
    propuesta: {
      nombre: 'Sistema de Adquisición Digital', frase: 'Ayudo a brokers a captar 3 a 5 exclusivas por mes en 90 días.',
      mensajes: { corto: 'Capta exclusivas', largo: 'Instalamos un sistema…', entrada: 'Cómo llenar tu cartera.' },
      paraQuien: { perfil: 'Brokers con cartera.', minimo: 'Matrícula activa.', noEs: 'Principiantes.' },
      problema: { hoy: 'Dependen de portales.', despues: 'Flujo predecible.', obstaculos: ['Portales caros'], yaProbo: 'Agencias genéricas.' },
      mecanismo: { nombres: ['Método 5 Filtros (propuesta)'], pasos: ['Documento Maestro', 'Cerebro de IA'], distinto: 'Filtra antes de pasarte el contacto.' },
      ruta: [{ fase: 'Fase 1', objetivo: 'Grabar los videos', hito: 'Primeros leads' }],
      incluye: [{ nombre: 'CRM', beneficio: 'Todo en un lugar' }], formato: 'Done for you, 3 meses.', prueba: 'Entre 4 y 10 clientes.',
      garantia: { nombre: 'Garantía de leads', condiciones: 'Asistir.', plazo: '120 días', siNoCumple: 'Seguimos sin fee.' },
      bonos: [{ nombre: 'SOPs de WhatsApp (propuesta)', objecion: 'Desorden', valor: '[completar]' }],
      inversion: { precio: '1.900 USD', contado: '950 USD', plan: '2 pagos', valorTotal: '[completar]', comoDecirlo: 'Inviertes 1.900 USD.' },
      urgencia: '[completar] Una razón para decidir hoy.', escenarios: { mejor: 'Llena la cartera.', peor: 'Seguimos.' },
      ecuacion: [{ variable: 'tiempo', antes: 'Meses', despues: 'Semana 1' }], numeros: [], validar: [], siguiente: 'Plan anual.',
      completar: ['Bono 1: valor'], avisos: [], supuestos: [], propuestoPorMako: [],
    },
  } as unknown as ConclusionOferta;
}
const META = { negocio: 'Código Inmobiliario', titulo: 'Sistema', fecha: new Date('2026-10-17T10:00:00Z') };

// rotura (`paginasSvg` sin el pie): 1 fallo, 4 pases. rotura (sin escapar el texto): 1 fallo, 4 pases.
// rotura (`rect` sin anotarse como dibujo): 1 fallo, 4 pases.
test('1 · las páginas de la pantalla son las del PDF: mismas páginas, mismo texto, escapado', async () => {
  const c = conclusion();
  const paginas = paginasDeOferta(c, META);
  const delPdf = await textoPorPagina(pdfDeOferta(c, META));
  assert.equal(paginas.length, delPdf.length, 'el mismo número de páginas');
  assert.ok(paginas.length >= 2, 'la propuesta va en otra página (PDF en dos partes)');
  paginas.forEach((svg, i) => {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 595\.28 841\.89"/);
    // Sin espacios: el lector del PDF junta dos textos pegados («71» y «/100» son dos en el documento y en la vista).
    const enSvg = textoSvg(svg).replace(/ /g, '');
    const faltan = palabras(delPdf[i]).filter((w) => !enSvg.includes(w));
    assert.deepEqual(faltan, [], `página ${i + 1}: palabras del PDF que no están en la vista`);
    assert.ok(textoSvg(svg).includes(`${i + 1} / ${paginas.length}`), 'el pie con el número de página');
  });
  // Lo que escribió la IA va como TEXTO: «<b>» no es un nodo.
  assert.doesNotMatch(paginas.join(''), /<b>/);
  assert.match(paginas.join(''), /&lt;b&gt;«cita»&lt;\/b&gt; &amp; más\./);
  // Las cajas y las barras también (el panel del puntaje es un rect con radio).
  assert.match(paginas[0], /<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" rx="10" ry="10" fill="#[0-9A-Fa-f]{6}"/);
  // No toca el documento: el PDF de después sale igual.
  const d = new PdfDoc({ pie: 'pie' });
  d.texto('Hola');
  const antes = d.paginasSvg();
  const bytes = d.bytes();
  assert.deepEqual(d.paginasSvg(), antes);
  assert.ok(bytes.length > 0);
  // Como imagen, el SVG va como data: (no corre nada y no hay otra ruta que pedir).
  assert.match(srcDePagina(paginas[0]), /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
});

// rotura (la ruta con las páginas sin `conclusionVisible`): 1 fallo, 4 pases (con el test arreglado).
test('2 · la ruta da las páginas con vista=paginas, de lo guardado y como el PDF', () => {
  const ruta = leer('app/api/offer/pdf/route.ts');
  assert.match(ruta, /const vistaPaginas = req\.nextUrl\.searchParams\.get\('vista'\) === 'paginas';/);
  const i = ruta.indexOf('if (vistaPaginas) {');
  const visible = ruta.indexOf('const conclusion = guardada ? conclusionVisible(guardada, fila) : null;');
  assert.ok(visible > 0 && i > visible, 'las páginas salen de lo guardado, leído como el PDF');
  assert.match(ruta.slice(i, i + 300), /paginas: paginasDeOferta\(conclusion, meta\)/);
  // Desde el 18/10/2026 también para «Lo que vendes» del onboarding (`tipo`): la base cambia, la vista es la misma.
  assert.match(leer('app/offer/offer-api.ts'), /const base = tipo \? `\/api\/offer\/pdf\?id=\$\{sesionId\}&tipo=\$\{tipo\}` : urlPdf\(sesionId, version\);/);
  assert.match(leer('app/offer/offer-api.ts'), /fetch\(`\$\{base\}&vista=paginas`/);
});

const sesion = { id: 8, ofertaId: null, ligada: true, funnelId: 6 } as unknown as OfferSesionVista;

// rotura (la ventana abriendo en «Diagnóstico»): 1 fallo, 4 pases. rotura (el héroe arriba de las pestañas): 1 fallo, 4 pases.
test('3 · la ventana de la oferta abre en el PDF, sin la oferta nueva arriba', () => {
  assert.equal(PESTANAS[0].id, 'pdf');
  assert.deepEqual(PESTANAS.map((p) => p.label), ['PDF', 'Diagnóstico', 'Oferta nueva']);
  const html = renderToStaticMarkup(createElement(Conclusion, { sesion, conclusion: conclusion(), onSeguir: () => {}, onGuardar: async () => null }));
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>PDF</);
  assert.match(html, /Cargando el PDF/, 'lo primero que carga es la vista del PDF');
  assert.doesNotMatch(html, /Ayudo a brokers a captar/, 'la frase de la oferta nueva no va antes del PDF');
  assert.match(html, /Descargar PDF/);
  // En las otras pestañas, el héroe sigue.
  const diag = renderToStaticMarkup(createElement(Conclusion, { sesion, conclusion: conclusion(), onSeguir: () => {}, onGuardar: async () => null, pestanaInicial: 'diagnostico' }));
  assert.match(diag, /Ayudo a brokers a captar/);
});

// rotura (sin abrir la ventana al terminar): 1 fallo, 4 pases. rotura (abrirla también con un error): 1 fallo, 4 pases.
test('4 · al terminar el armado con la pantalla abierta, la ventana se abre sola (en el PDF)', () => {
  const app = leer('app/offer/OfferApp.tsx');
  const i = app.indexOf('const armandoEn = useRef<number | null>(null);');
  assert.ok(i > 0, 'falta el seguimiento del armado en curso');
  const efecto = app.slice(i, app.indexOf('}, [armadoCorre, armadoError, idSesion, versionConclusion, arranque]);', i));
  assert.match(efecto, /if \(armadoCorre\) \{ armandoEn\.current = idSesion; return; \}/);
  assert.match(efecto, /if \(era == null \|\| era !== idSesion \|\| armadoError \|\| versionConclusion == null \|\| arranque\) return;/);
  assert.match(efecto, /setVerConclusion\(true\);/);
  // Y la ventana es la de la oferta, que abre en el PDF (test 3).
  assert.match(app, /<Modal titulo="Tu oferta" ancho=\{860\}[\s\S]*?<Conclusion/);
});

test('5 · la vista del PDF: imágenes con su texto alternativo, y un error que se puede volver a cargar', () => {
  // Sin los comentarios (el de arriba nombra el `<iframe>` para decir por qué no).
  const v = leer('app/offer/VistaPdf.tsx').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.match(v, /alt=\{`Página \$\{i \+ 1\} de \$\{n\} de \$\{tipo \? 'lo que vendes' : 'tu oferta'\}`\}/);
  assert.match(v, /accion=\{\{ label: 'Volver a cargar el PDF', onClick: cargar \}\}/);
  assert.doesNotMatch(v, /dangerouslySetInnerHTML|<iframe/, 'el SVG va como imagen, nunca pegado en la página');
});

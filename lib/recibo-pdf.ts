// =============================================================================
// recibo-pdf — el PDF de un recibo de MaKo (5/11/2026)
// =============================================================================
// Puro y SIN `server-only`: recibe la FOTO del recibo (lo que guardó la base) y los bytes de los comprobantes, y devuelve el PDF.
// Lo usan el despacho (lib/recibos.ts), «Bajar» y «Ver ejemplo» de SuperAdmin, y los tests. Es la plantilla de los recibos 0001
// y 0002 que salieron a mano el 5/11/2026 (jsPDF 4.2.1, leídos con unpdf): «Recibimos de», «Total recibido», «Qué se pagó»
// (Concepto, Mes, Importe), «Cómo se pagó» (Fecha y hora, Medio, Order ID, Monto), la nota, el pie fijo y la página 2 con los
// comprobantes. Siempre el mismo layout, para todas las pasarelas: lo que cambia por pasarela son rótulos y leyendas
// (lib/recibos-reglas.ts).
//
// ⚠️ DETERMINISTA: `setCreationDate(emitido_at)` y `setFileId(<hash del número>)`. Si no, cada render cambia bytes y Resend
// contesta 409 `invalid_idempotent_request` al reintentar con la misma clave (otro cuerpo). Lo fija tests/recibos.test.ts: dos
// renders, los mismos bytes.
// ⚠️ TODO TEXTO pasa por `textoParaPdf` (Helvetica es WinAnsi: un emoji o una ő rompen la línea) y toda línea larga por
// `splitTextToSize`, midiendo el alto (docs/hallazgos-agencias.md: `maxWidth` parte la línea y la altura no se ajusta).
// ⚠️ jsPDF se carga con `await import('jspdf')` y va en `serverExternalPackages` de next.config.ts.

import { textoParaPdf } from './pdf-escritor';
import { formatoMonto } from './pasarela-moneda';
import {
  PIE_FIJO, ROTULO_MEDIO, ROTULO_REFERENCIA, esMedio, fechaConHora, fechaCorta, huellaCorta, leyendaDelMedio, lineaDeImpuesto, numeroEnTexto,
  rotulosDelDocumento, totalesEnTexto, type Emisor,
} from './recibos-reglas';

export type LineaRecibo = { concepto: string; mes?: string | null; monto: number; moneda: string };
export type PagoRecibo = { medio: string; referencia: string; fecha: string; monto: number; moneda: string; impuesto?: number | null; de?: string | null };

/** Lo que el PDF necesita: la foto guardada en `recibos` y sus `recibo_pagos`. */
export type FotoRecibo = {
  numero: number | null;
  aNombre: string;
  emitidoAt: string;
  zona: string;
  emisor: Emisor;
  lineas: readonly LineaRecibo[];
  totalDetalle: number;
  monedaDetalle: string;
  totales: ReadonlyArray<{ moneda: string; monto: number }>;
  impuesto: number | null;
  pagos: readonly PagoRecibo[];
  notaPdf: string | null;
  /** El sello de una devolución (un render aparte: el PDF original no cambia). */
  sello?: { texto: string } | null;
  /** «Ver ejemplo»: sin número, con una marca. */
  ejemplo?: boolean;
};

export type Comprobante = { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg'; fecha: string | null; medio: string };

const t = (s: string | null | undefined): string => textoParaPdf(String(s ?? '')).texto;

const ANCHO = 210;
const MARGEN = 18;
const UTIL = ANCHO - MARGEN * 2;
const ALTO_PAGINA = 297;
const PIE_Y = 282;

/** El id del archivo: 32 hex, del número (o del ejemplo). Determinista. */
const idDeArchivo = (f: FotoRecibo): string => {
  const base = `${f.numero ?? 'ejemplo'}|${f.emitidoAt}`;
  return (huellaCorta(base) + huellaCorta(`a${base}`) + huellaCorta(`b${base}`) + huellaCorta(`c${base}`)).toUpperCase();
};

/** Las dimensiones de un PNG o un JPEG, leídas de los bytes (para escalar sin deformar). null si no se pudo. */
export function medidaDeImagen(b: Uint8Array): { w: number; h: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marca = b[i + 1];
      const largo = (b[i + 2] << 8) + b[i + 3];
      if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
        return { h: (b[i + 5] << 8) + b[i + 6], w: (b[i + 7] << 8) + b[i + 8] };
      }
      i += 2 + largo;
    }
  }
  return null;
}

type Doc = InstanceType<(typeof import('jspdf'))['jsPDF']>;

/** Escribe un párrafo partido al ancho y devuelve la y siguiente, midiendo el alto de verdad. */
function parrafo(doc: Doc, texto: string, x: number, y: number, ancho: number, tam: number, alto = 1.35): number {
  doc.setFontSize(tam);
  const lineas = doc.splitTextToSize(t(texto), ancho) as string[];
  const paso = (tam * 0.3528) * alto;
  lineas.forEach((l, i) => doc.text(l, x, y + i * paso));
  return y + lineas.length * paso;
}

/** Una tabla chica: encabezados y filas, con anchos en proporción. Devuelve la y siguiente. */
function tabla(doc: Doc, y: number, cols: ReadonlyArray<{ titulo: string; peso: number; derecha?: boolean }>, filas: ReadonlyArray<readonly string[]>): number {
  const total = cols.reduce((a, c) => a + c.peso, 0);
  const anchos = cols.map((c) => (UTIL * c.peso) / total);
  const xs = anchos.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? MARGEN : acc[i - 1] + anchos[i - 1]], []);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  cols.forEach((c, i) => doc.text(t(c.titulo), c.derecha ? xs[i] + anchos[i] - 1 : xs[i] + 1, y, c.derecha ? { align: 'right' } : undefined));
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGEN, y, MARGEN + UTIL, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  for (const f of filas) {
    let alto = 0;
    f.forEach((celda, i) => {
      const lineas = doc.splitTextToSize(t(celda), anchos[i] - 2) as string[];
      lineas.forEach((l, j) => doc.text(l, cols[i].derecha ? xs[i] + anchos[i] - 1 : xs[i] + 1, y + j * 4.6, cols[i].derecha ? { align: 'right' } : undefined));
      alto = Math.max(alto, lineas.length * 4.6);
    });
    y += alto + 2.2;
  }
  return y;
}

/**
 * EL PDF DEL RECIBO. Siempre el mismo layout, determinista (mismos datos → mismos bytes). Los comprobantes van en la página 2
 * («Comprobante(s) de <medio>»), sólo PNG o JPEG, con su fecha.
 */
export async function pdfDelRecibo(f: FotoRecibo, comprobantes: readonly Comprobante[] = []): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const doc: Doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const emitido = new Date(Date.parse(f.emitidoAt) || 0);
  doc.setCreationDate(emitido);
  doc.setFileId(idDeArchivo(f));
  const medios = f.pagos.map((p) => p.medio);
  const rot = rotulosDelDocumento(medios);
  doc.setProperties({ title: t(`${rot.titulo}${f.numero != null ? ` N.º ${numeroEnTexto(f.numero)}` : ''}`), author: t(f.emisor.nombre), creator: 'MaKo' });

  // ── Cabecera: el emisor a la izquierda, el título y el número a la derecha ──
  let y = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text(t(f.emisor.nombre), MARGEN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  let ye = y + 5;
  for (const dato of [f.emisor.documento, f.emisor.direccion, f.emisor.correo]) {
    if (!dato) continue;
    ye = parrafo(doc, dato, MARGEN, ye, 95, 8.5, 1.25);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(t(rot.titulo), MARGEN + UTIL, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.text(t(f.ejemplo || f.numero == null ? 'EJEMPLO, sin número' : `N.º ${numeroEnTexto(f.numero)}`), MARGEN + UTIL, y + 6, { align: 'right' });
  doc.text(t(`Emitido el ${fechaCorta(f.emitidoAt, f.zona)}`), MARGEN + UTIL, y + 11, { align: 'right' });
  y = Math.max(ye, y + 14) + 6;

  // ── El sello de una devolución ──
  if (f.sello) {
    doc.setDrawColor(190, 40, 40);
    doc.setTextColor(190, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.rect(MARGEN, y - 5.5, UTIL, 9);
    doc.text(t(f.sello.texto), MARGEN + UTIL / 2, y + 0.7, { align: 'center' });
    y += 10;
  }

  // ── A nombre de quién, y el total ──
  doc.setDrawColor(225, 225, 225);
  doc.setFillColor(247, 246, 243);
  doc.rect(MARGEN, y, UTIL, 22, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.text(t(rot.nombre), MARGEN + 5, y + 7);
  doc.text(t(rot.total), MARGEN + UTIL - 5, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  const nombre = doc.splitTextToSize(t(f.aNombre), UTIL / 2 - 8) as string[];
  doc.text(nombre[0] ?? '', MARGEN + 5, y + 15);
  doc.text(t(totalesEnTexto(f.totales)), MARGEN + UTIL - 5, y + 15, { align: 'right' });
  y += 31;

  // ── Qué se pagó ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(t('Qué se pagó'), MARGEN, y);
  y = tabla(doc, y + 6, [{ titulo: 'Concepto', peso: 6 }, { titulo: 'Mes', peso: 2.4 }, { titulo: 'Importe', peso: 2.2, derecha: true }],
    f.lineas.map((l) => [l.concepto, l.mes ?? '', formatoMonto(Number(l.monto), l.moneda)]));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(t('Total'), MARGEN + 1, y + 1);
  doc.text(t(formatoMonto(Number(f.totalDetalle), f.monedaDetalle)), MARGEN + UTIL - 1, y + 1, { align: 'right' });
  y += 11;

  // ── Cómo se pagó ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(t('Cómo se pagó'), MARGEN, y);
  const rotRef = f.pagos.every((p) => esMedio(p.medio) && ROTULO_REFERENCIA[p.medio] === ROTULO_REFERENCIA[f.pagos[0].medio as keyof typeof ROTULO_REFERENCIA])
    ? ROTULO_REFERENCIA[(esMedio(f.pagos[0]?.medio) ? f.pagos[0].medio : 'otro') as keyof typeof ROTULO_REFERENCIA]
    : 'Referencia';
  y = tabla(doc, y + 6, [{ titulo: 'Fecha y hora', peso: 3 }, { titulo: 'Medio', peso: 2.2 }, { titulo: rotRef, peso: 3.8 }, { titulo: 'Monto', peso: 2, derecha: true }],
    f.pagos.map((p) => [fechaConHora(p.fecha, f.zona), esMedio(p.medio) ? ROTULO_MEDIO[p.medio] : p.medio, p.referencia, formatoMonto(Number(p.monto), p.moneda)]));
  y += 3;

  // ── La nota, el impuesto y la leyenda del medio ──
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const imp = lineaDeImpuesto(f.impuesto, f.totales[0]?.moneda ?? f.monedaDetalle, medios);
  for (const linea of [f.notaPdf, imp, leyendaDelMedio(medios)]) {
    if (!linea) continue;
    y = parrafo(doc, linea, MARGEN, y, UTIL, 9.5) + 2.5;
  }

  // ── El pie fijo ──
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  const pie = doc.splitTextToSize(t(PIE_FIJO(f.aNombre)), UTIL) as string[];
  pie.forEach((l, i) => doc.text(l, MARGEN, Math.max(y + 8, PIE_Y - (pie.length - 1) * 3.8) + i * 3.8));
  if (f.ejemplo) {
    doc.setFontSize(48);
    doc.setTextColor(235, 235, 235);
    doc.text('EJEMPLO', ANCHO / 2, 160, { align: 'center', angle: 30 });
  }

  // ── Página 2: los comprobantes ──
  const imagenes = comprobantes.filter((c) => (c.mime === 'image/png' || c.mime === 'image/jpeg') && medidaDeImagen(c.bytes));
  if (imagenes.length) {
    doc.addPage();
    const mediosC = [...new Set(imagenes.map((c) => (esMedio(c.medio) ? ROTULO_MEDIO[c.medio] : c.medio)))].join(' y ');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(t(`${imagenes.length > 1 ? 'Comprobantes' : 'Comprobante'} de ${mediosC}`), MARGEN, 22);
    // Hasta tres por página, en columnas, escaladas sin deformar.
    const porPagina = Math.min(3, imagenes.length);
    const anchoCol = (UTIL - (porPagina - 1) * 6) / porPagina;
    let col = 0;
    let top = 32;
    for (const c of imagenes) {
      if (col === 3) { doc.addPage(); col = 0; top = 22; }
      const m = medidaDeImagen(c.bytes)!;
      const altoMax = ALTO_PAGINA - top - 28;
      const esc = Math.min(anchoCol / m.w, altoMax / m.h);
      const x = MARGEN + col * (anchoCol + 6);
      doc.addImage(c.bytes, c.mime === 'image/png' ? 'PNG' : 'JPEG', x, top, m.w * esc, m.h * esc, undefined, 'FAST');
      if (c.fecha) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(110, 110, 110);
        doc.text(t(fechaConHora(c.fecha, f.zona)), x, top + m.h * esc + 5);
      }
      col++;
    }
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

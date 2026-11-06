// =============================================================================
// agencia-mes-pdf — el PDF de lo que debe una agencia: la mensualidad del mes o las entradas de sus clientes (6/11/2026)
// =============================================================================
// Martín (5/11/2026): «siempre tabla, PDF, por el grupo de WhatsApp con Código». Es el aviso de COBRO (lo que se debe y
// hasta cuándo); el de lo que ENTRÓ es el recibo (lib/recibo-pdf.ts). Mismo aspecto que el recibo —Helvetica, márgenes de
// 18 mm, la caja gris con el total, la tabla con encabezados grises y el pie— para que se lean como de la misma casa.
//
// Puro y SIN `server-only`: lo usan lib/agencia-mes.ts (el aviso al grupo) y los tests.
// ⚠️ DETERMINISTA: misma tabla y mismo día → mismos bytes (`setCreationDate` y `setFileId` fijos). Lo fija el test.
// ⚠️ TODO TEXTO pasa por `textoParaPdf` (Helvetica es WinAnsi) y toda línea larga por `splitTextToSize`, midiendo el alto.

import { textoParaPdf } from './pdf-escritor';
import { huellaCorta } from './recibos-reglas';
import { diaLargo, usd, type Dia, type TablaDeCobro } from './agencia-mes-reglas';

type Doc = InstanceType<(typeof import('jspdf'))['jsPDF']>;
const t = (s: string | null | undefined): string => textoParaPdf(String(s ?? '')).texto;

const ANCHO = 210;
const MARGEN = 18;
const UTIL = ANCHO - MARGEN * 2;
const PIE_Y = 282;

function parrafo(doc: Doc, texto: string, x: number, y: number, ancho: number, tam: number, alto = 1.35): number {
  doc.setFontSize(tam);
  const lineas = doc.splitTextToSize(t(texto), ancho) as string[];
  const paso = (tam * 0.3528) * alto;
  lineas.forEach((l, i) => doc.text(l, x, y + i * paso));
  return y + lineas.length * paso;
}

/** El nombre del archivo que se manda: «MaKo · Mensualidad de diciembre.pdf». */
export const nombreDelPdf = (tabla: TablaDeCobro): string => `MaKo - ${tabla.titulo}.pdf`.replace(/[\\/:*?"<>|]+/g, '-');

/**
 * EL PDF DEL COBRO: arriba MaKo y el título; la caja con a nombre de quién y el total a pagar; la tabla renglón por renglón;
 * hasta cuándo se paga; las notas; el pie. `emitido` es el día del aviso (en la zona de la agencia).
 */
export async function pdfDelCobro(tabla: TablaDeCobro, emitido: Dia, agencia: string): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const doc: Doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setCreationDate(new Date(`${emitido}T12:00:00Z`));
  const base = `${tabla.titulo}|${emitido}|${agencia}|${tabla.totalUsd}|${tabla.filas.length}`;
  doc.setFileId((huellaCorta(base) + huellaCorta(`a${base}`) + huellaCorta(`b${base}`) + huellaCorta(`c${base}`)).toUpperCase());
  doc.setProperties({ title: t(tabla.titulo), author: 'MaKo', creator: 'MaKo' });

  // ── Cabecera ──
  let y = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('MaKo', MARGEN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.text('hola-mako.com', MARGEN, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(t(tabla.titulo), MARGEN + UTIL, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.text(t(`Emitido el ${diaLargo(emitido)}`), MARGEN + UTIL, y + 6, { align: 'right' });
  y += 16;

  // ── A nombre de quién, y el total a pagar ──
  doc.setFillColor(247, 246, 243);
  doc.rect(MARGEN, y, UTIL, 22, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.text('Para', MARGEN + 5, y + 7);
  doc.text('Total a pagar', MARGEN + UTIL - 5, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  const nombre = doc.splitTextToSize(t(agencia), UTIL / 2 - 8) as string[];
  doc.text(nombre[0] ?? '', MARGEN + 5, y + 15);
  doc.text(t(usd(tabla.totalUsd)), MARGEN + UTIL - 5, y + 15, { align: 'right' });
  y += 31;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  y = parrafo(doc, tabla.subtitulo, MARGEN, y, UTIL, 9.5) + 4;

  // ── La tabla ──
  const n = tabla.columnas.length;
  const pesos = n === 4 ? [5.2, 2.4, 3, 2.2] : [5.6, 4, 2.4];
  const total = pesos.reduce((a, b) => a + b, 0);
  const anchos = pesos.map((p) => (UTIL * p) / total);
  const xs = anchos.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? MARGEN : acc[i - 1] + anchos[i - 1]], []);
  const derecha = (i: number) => i === n - 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  tabla.columnas.forEach((c, i) => doc.text(t(c), derecha(i) ? xs[i] + anchos[i] - 1 : xs[i] + 1, y, derecha(i) ? { align: 'right' } : undefined));
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGEN, y, MARGEN + UTIL, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  for (const f of tabla.filas) {
    let alto = 0;
    f.forEach((celda, i) => {
      const lineas = doc.splitTextToSize(t(celda), anchos[i] - 2) as string[];
      lineas.forEach((l, j) => doc.text(l, derecha(i) ? xs[i] + anchos[i] - 1 : xs[i] + 1, y + j * 4.6, derecha(i) ? { align: 'right' } : undefined));
      alto = Math.max(alto, lineas.length * 4.6);
    });
    y += alto + 2.2;
  }
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGEN, y - 1, MARGEN + UTIL, y - 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Total', MARGEN + 1, y + 4);
  doc.text(t(usd(tabla.totalUsd)), MARGEN + UTIL - 1, y + 4, { align: 'right' });
  y += 13;

  // ── Hasta cuándo, y las notas ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  y = parrafo(doc, `Se paga hasta el ${diaLargo(tabla.limite)}. Manda la captura del comprobante al grupo de MaKo y te llega el recibo.`, MARGEN, y, UTIL, 10.5) + 3;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  for (const nota of tabla.notas) y = parrafo(doc, nota, MARGEN, y, UTIL, 9.5) + 2;

  // ── El pie ──
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  const pie = doc.splitTextToSize(t('Esto es un aviso de cobro, no un recibo ni una factura fiscal. El recibo sale cuando entra el pago.'), UTIL) as string[];
  pie.forEach((l, i) => doc.text(l, MARGEN, Math.max(y + 8, PIE_Y - (pie.length - 1) * 3.8) + i * 3.8));

  return new Uint8Array(doc.output('arraybuffer'));
}

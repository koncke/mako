'use client';

// =============================================================================
// RecursosPartner — «Para recomendar MaKo»: el PDF de venta y los mensajes para copiar, en el panel del partner (27/10/2026)
// =============================================================================
// Compromiso de Martín en la llamada con Leila (Fathom 876470842-25): recursos para revender. Lo que dice sale de
// lib/partners-recursos.ts (los planes de verdad, sin jerga). El PDF se arma EN EL NAVEGADOR con jsPDF (ya está en el proyecto,
// lo usa el Image Editor), con SU link y SU código adentro: no hay un archivo que se desactualice cuando cambia un precio.
// Los audios y los videos todavía no existen: no se muestran (docs/hallazgos-partners.md, «Recursos para revender»).

import { useState } from 'react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { archivoDelPdf, mensajesParaCopiar, pdfDeVenta, type PdfDeVenta } from '@/lib/partners-recursos';

export const CSS_RECURSOS = `
.pr-cab { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin: 0 0 12px; }
.pr-cab h3 { margin: 0; font-size: 16px; font-weight: 800; color: var(--ink); }
.pr-cab p { margin: 2px 0 0; font-size: 12.5px; color: var(--dim); }
.pr-pdf { border: 0; border-radius: 10px; background: var(--primary); color: var(--on-primary, #fff); font: inherit; font-size: 13.5px; font-weight: 700; padding: 9px 14px; cursor: pointer; }
.pr-pdf:disabled { opacity: .7; cursor: default; }
.pr-lista { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.pr-msj { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; background: var(--surface-2); display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.pr-msj b { font-size: 13.5px; color: var(--ink); }
.pr-msj p { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--ink); overflow-wrap: anywhere; flex: 1; }
.pr-copiar { align-self: flex-start; border: 1px solid var(--border-strong, var(--border)); border-radius: 9px; background: var(--surface); color: var(--ink); font: inherit; font-size: 13px; font-weight: 700; padding: 6px 12px; cursor: pointer; }
.pr-error { margin: 8px 0 0; color: var(--bad); font-size: 13px; font-weight: 600; }
`;

function Mensaje({ titulo, texto }: { titulo: string; texto: string }) {
  const [ok, setOk] = useState(false);
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* el texto se puede seleccionar */ } };
  return (
    <div className="pr-msj">
      <b>{titulo}</b>
      <p>{texto}</p>
      <button type="button" className="pr-copiar" onClick={copiar}>{ok ? 'Copiado' : 'Copiar'}</button>
    </div>
  );
}

type Color = [number, number, number];
const AZUL: Color = [47, 111, 237];
const TINTA: Color = [17, 24, 39];
const GRIS: Color = [91, 100, 114];
const PT_A_MM = 0.3528;
const INTERLINEA = 1.25;

/** Arma el PDF de una hoja (A4). jsPDF se carga recién al tocar el botón. Exportado para el test (lo arma en Node). */
export async function armarPdfDeVenta(d: PdfDeVenta): Promise<import('jspdf').jsPDF> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const ANCHO = 210, M = 16, UTIL = ANCHO - 2 * M;
  const alto = (lineas: number, pt: number) => lineas * pt * PT_A_MM * INTERLINEA;
  const lineas = (t: string, ancho: number, pt: number, negrita = false): string[] => {
    pdf.setFont('helvetica', negrita ? 'bold' : 'normal');
    pdf.setFontSize(pt);
    return pdf.splitTextToSize(t, ancho) as string[];
  };
  /** Escribe un párrafo con su arriba en `y` y devuelve cuánto ocupó. */
  const parrafo = (t: string, x: number, y: number, ancho: number, pt: number, color: Color, negrita = false): number => {
    const l = lineas(t, ancho, pt, negrita);
    pdf.setTextColor(...color);
    pdf.text(l, x, y, { baseline: 'top', lineHeightFactor: INTERLINEA });
    return alto(l.length, pt);
  };
  const vineta = (t: string, x: number, y: number, ancho: number, pt: number): number => {
    pdf.setFillColor(...AZUL);
    pdf.circle(x + 1, y + pt * PT_A_MM * 0.62, 0.75, 'F');
    return parrafo(t, x + 4, y, ancho - 4, pt, TINTA);
  };

  // La franja de arriba: la marca, el título y la bajada.
  pdf.setFillColor(...AZUL);
  pdf.rect(0, 0, ANCHO, 46, 'F');
  let y = 11;
  y += parrafo('MaKo', M, y, UTIL, 12, [255, 255, 255], true) + 2;
  y += parrafo(d.titulo, M, y, UTIL, 20, [255, 255, 255], true) + 2;
  parrafo(d.bajada, M, y, UTIL, 10.5, [235, 241, 255]);

  // Qué hace.
  y = 56;
  y += parrafo('Qué hace MaKo por tu negocio', M, y, UTIL, 13, TINTA, true) + 3;
  for (const q of d.queHace) y += vineta(q, M, y, UTIL, 10.5) + 1.6;

  // Los planes, en dos columnas.
  y += 6;
  const COL = (UTIL - 8) / Math.max(1, d.planes.length === 1 ? 1 : 2);
  const medir = (pl: PdfDeVenta['planes'][number]) => 26 + alto(lineas(pl.resumen, COL - 10, 9.5).length, 9.5)
    + pl.incluye.reduce((s, i) => s + alto(lineas(i, COL - 14, 9.5).length, 9.5) + 1.4, 0);
  const altoPlanes = Math.max(...d.planes.map(medir), 0);
  if (y + altoPlanes > 262) { pdf.addPage(); y = 18; }
  d.planes.forEach((pl, i) => {
    const x = M + i * (COL + 8);
    pdf.setDrawColor(220, 226, 236);
    pdf.setFillColor(248, 249, 251);
    pdf.roundedRect(x, y, COL, altoPlanes, 3, 3, 'FD');
    let yc = y + 5;
    yc += parrafo(pl.nombre, x + 5, yc, COL - 10, 13, TINTA, true) + 1;
    yc += parrafo(pl.precio, x + 5, yc, COL - 10, 12, AZUL, true) + 1.5;
    yc += parrafo(pl.resumen, x + 5, yc, COL - 10, 9.5, GRIS) + 3;
    for (const inc of pl.incluye) yc += vineta(inc, x + 5, yc, COL - 10, 9.5) + 1.4;
  });
  y += altoPlanes + 6;

  // La prueba y, al pie, el link y el código del partner.
  if (y + 40 > 285) { pdf.addPage(); y = 18; }
  y += parrafo(d.prueba, M, y, UTIL, 11, TINTA, true) + 5;
  pdf.setFillColor(...AZUL);
  pdf.roundedRect(M, y, UTIL, 28, 3, 3, 'F');
  let yp = y + 5;
  yp += parrafo('Empieza aquí', M + 6, yp, UTIL - 12, 10, [235, 241, 255]) + 0.5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(255, 255, 255);
  pdf.textWithLink(d.link, M + 6, yp, { url: d.link, baseline: 'top' });
  yp += alto(1, 13) + 1.5;
  const pie = `Código para poner al pagar: ${d.codigo}${d.deParte ? ` · Te lo recomienda ${d.deParte}` : ''}`;
  parrafo(pie, M + 6, yp, UTIL - 12, 10, [235, 241, 255]);
  return pdf;
}

async function descargarPdf(d: PdfDeVenta): Promise<void> {
  (await armarPdfDeVenta(d)).save(archivoDelPdf(d.codigo));
}

type Props = { link: string; codigo: string; nombreNegocio: string | null };

/** El botón del PDF y los mensajes, sin marco: lo usan la computadora (abajo) y el teléfono (app/m/partners/ReferidosM.tsx). */
export function RecursosParaRecomendar({ link, codigo, nombreNegocio, conBoton = true }: Props & { conBoton?: boolean }) {
  const mensajes = mensajesParaCopiar({ link, codigo });
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_RECURSOS }} />
      {conBoton && <div style={{ margin: '0 0 12px' }}><BotonPdf link={link} codigo={codigo} nombreNegocio={nombreNegocio} /></div>}
      <div className="pr-lista">
        {mensajes.map((m) => <Mensaje key={m.id} titulo={m.titulo} texto={m.texto} />)}
      </div>
    </>
  );
}

function BotonPdf({ link, codigo, nombreNegocio }: Props) {
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bajar = async () => {
    if (armando) return;
    setArmando(true); setError(null);
    try { await descargarPdf(pdfDeVenta({ link, codigo, deParte: nombreNegocio })); }
    catch { setError('No pudimos armar el PDF. Prueba otra vez.'); }
    setArmando(false);
  };
  return (
    <>
      <button type="button" className="pr-pdf" onClick={bajar} disabled={armando}>{armando ? 'Armando…' : 'Descargar el PDF de venta'}</button>
      {error && <p className="pr-error" role="alert">{error} <ReportarASoporte /></p>}
    </>
  );
}

/** La caja de la computadora, en el panel del partner (app/partners/PanelPartner.tsx). */
export function RecursosPartner(p: Props) {
  return (
    <section className="pp-caja" aria-labelledby="pr-titulo" style={{ marginBottom: 14 }}>
      <div className="pr-cab">
        <div>
          <h3 id="pr-titulo">Para recomendar MaKo</h3>
          <p>Todo va con tu link: lo que traiga, cuenta para ti.</p>
        </div>
        <div><BotonPdf {...p} /></div>
      </div>
      <RecursosParaRecomendar {...p} conBoton={false} />
    </section>
  );
}

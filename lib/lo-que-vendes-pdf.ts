// =============================================================================
// lo-que-vendes-pdf — el PDF del onboarding: lo que vende el negocio, ordenado
// =============================================================================
// Martín (16/10/2026 a la tarde): «simular "Offer" en el onboarding simplemente para organizar en un PDF lo que
// vende el usuario. Y eso le sirve a MaKo para crear las cosas que necesite». Es la conversación del arranque
// (`PIEZAS_DEL_ARRANQUE`, lib/offer-marco.ts) puesta en orden con las palabras del dueño: sin puntaje, sin notas,
// sin cambios propuestos y sin oferta nueva. Eso es el PDF de la tab Offer (lib/offer-pdf.ts), que se arma
// después, sobre la misma conversación.
//
// PURO (sin `server-only`, sin base de datos): recibe las piezas y devuelve los bytes. La ruta es la del PDF de
// Offer (GET /api/offer/pdf?id=…&tipo=lo-que-vendes), con su mismo gate. Siempre claro, como el de Offer: los
// colores son los de su `C` (copiados de app/globals.css).
// =============================================================================

import { PIEZAS_DEL_ARRANQUE, type PiezaKey, type PiezasSabidas } from './offer-marco';
import { PdfDoc } from './pdf-escritor';

const C = {
  tinta: '#12151B',     // --ink
  dim: '#454C57',       // --dim
  tenue: '#66707F',     // --faint
  linea: '#EAECF1',     // --border
  mako: '#F2B01E',      // --mako
  makoTinta: '#8F6709', // --mako-ink
};

/**
 * Cómo se llama cada pieza EN EL DOCUMENTO: en palabras del dueño, no las del marco. Primero las del arranque, en
 * su orden; después lo que haya contado de más, en el orden de las piezas. Una pieza sin título acá no sale.
 */
const TITULOS: ReadonlyArray<[PiezaKey, string]> = [
  ['entregables', 'Qué vendes y qué recibe tu cliente'],
  ['cliente', 'Para quién es'],
  ['problema', 'El problema que le resuelves'],
  ['resultado', 'Lo que logra tu cliente'],
  ['precio', 'Cuánto cuesta y cómo se paga'],
  ['formato', 'Cómo lo entregas'],
  ['mecanismo', 'Tu forma de trabajar'],
  ['semana', 'La primera semana'],
  ['garantia', 'Garantía'],
  ['bonos', 'Extras'],
  ['ventas', 'Cuántos ya te compraron'],
  ['prueba', 'Resultados de tus clientes'],
  ['objecion', 'Lo que tu cliente quiere evitar'],
  ['urgencia', 'Cupos y fechas'],
  ['frase', 'En una frase'],
  ['otras', 'Otras cosas que vendes'],
];

const SIN_DATO = /^\s*sin dato\s*:?\s*/i;

export type ApartadoLoQueVendes = { pieza: PiezaKey; titulo: string; texto: string; sinDato: boolean };

/** Lo que va en el documento, en orden: las del arranque siempre (vacías dicen que falta), las demás si las contó. */
export function apartadosLoQueVendes(piezas: PiezasSabidas): ApartadoLoQueVendes[] {
  const out: ApartadoLoQueVendes[] = [];
  for (const [k, titulo] of TITULOS) {
    const valor = (piezas[k]?.valor ?? '').trim();
    const delArranque = PIEZAS_DEL_ARRANQUE.includes(k);
    if (!valor && !delArranque) continue;
    const sinDato = !valor || SIN_DATO.test(valor);
    const texto = valor.replace(SIN_DATO, '').trim();
    out.push({ pieza: k, titulo, texto, sinDato });
  }
  return out;
}

export type MetaLoQueVendes = { negocio: string; fecha: Date; zona?: string };

function fechaCorta(d: Date, zona?: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', { timeZone: zona || 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** El nombre del archivo, ASCII (un «—» en el Content-Disposition tira a Node: ver `nombreArchivoOferta`). */
export function nombreArchivoLoQueVendes(negocio: string): string {
  const slug = (negocio || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return slug ? `lo-que-vende-${slug}.pdf` : 'lo-que-vendes.pdf';
}

/** Los bytes del PDF. Nunca tira por el contenido: lo que no entra se corta en líneas y páginas. */
export function pdfDeLoQueVendes(piezas: PiezasSabidas, meta: MetaLoQueVendes): Uint8Array {
  const fecha = fechaCorta(meta.fecha, meta.zona);
  const doc = new PdfDoc({ pie: `Generado por MaKo · ${fecha}` });
  const negocio = (meta.negocio || '').trim();

  doc.rect(0, 0, doc.ancho, 6, { relleno: C.mako });
  doc.y = 40;
  doc.texto('MAKO · LO QUE VENDES', { tam: 8, fuente: 'Helvetica-Bold', color: C.makoTinta, despues: 8 });
  doc.texto(negocio ? `Lo que vende ${negocio}` : 'Lo que vendes', { tam: 24, fuente: 'Helvetica-Bold', interlinea: 1.2, despues: 6 });
  doc.texto('Lo que me contaste, ordenado y con tus palabras. Es lo que MaKo usa para crear lo que necesites. Para analizar tu oferta y mejorarla, ve a Offer.', { tam: 12, color: C.dim, interlinea: 1.4, despues: 8 });
  doc.texto(fecha, { tam: 9, color: C.tenue, despues: 18 });

  for (const a of apartadosLoQueVendes(piezas)) {
    doc.asegurar(56);
    doc.rect(doc.margen, doc.y + 4, 4, 14, { relleno: C.mako, radio: 1 });
    doc.texto(a.titulo, { tam: 13, fuente: 'Helvetica-Bold', sangria: 12, despues: 4 });
    doc.linea(doc.margen, doc.y, doc.margen + doc.anchoUtil, doc.y, C.linea, 0.75);
    doc.y += 8;
    if (a.sinDato) {
      doc.texto(a.texto ? `Todavía no lo tienes claro: ${a.texto}` : 'Todavía no me lo contaste.', { tam: 10.5, color: C.tenue, interlinea: 1.4, despues: 14 });
    } else {
      doc.texto(a.texto, { tam: 10.5, color: C.tinta, interlinea: 1.4, despues: 14 });
    }
  }
  return doc.bytes();
}

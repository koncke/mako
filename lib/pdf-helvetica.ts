// =============================================================================
// pdf-helvetica — métricas de las fuentes ESTÁNDAR de PDF (Helvetica) en WinAnsi
// =============================================================================
// SIN `server-only` y SIN dependencias: lo usan lib/pdf-escritor.ts (que corta las
// líneas por ancho real) y los tests.
//
// Por qué Helvetica y no Geist: las 14 fuentes estándar de PDF no se incrustan
// (todo lector las trae), así que el PDF no necesita archivos de fuente en el
// servidor ni tocar outputFileTracingIncludes, y no hace falta ninguna librería.
// El costo es el juego de caracteres: WinAnsi (Windows-1252), que cubre el español
// entero (á é í ó ú ü ñ ¿ ¡ « » “ ” ‘ ’ — – • … €) y NO cubre flechas, ✦ ni
// emoji — esos los resuelve `textoParaPdf` en lib/pdf-escritor.ts.
//
// De dónde salen los números: de los AFM oficiales de Adobe (Helvetica.afm,
// Helvetica-Bold.afm, Helvetica-Oblique.afm, «Copyright 1985-1997 Adobe»), leyendo
// el WX de cada glifo y ubicándolo en su código WinAnsi según el Anexo D de la
// especificación de PDF. Se generaron con un script de una sola vez (no vive en el
// repo): si alguna vez hay que regenerarlas, los AFM vienen en el paquete npm
// pdfkit (js/data/*.afm). Los códigos sin glifo en WinAnsi (129, 141, 143, 144,
// 157) valen 0 y `aWinAnsi` nunca los emite.
// =============================================================================

/** Helvetica: ancho (milésimas de em) de los códigos WinAnsi 32-255. */
const HELVETICA: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];

/** Helvetica-Bold: ancho (milésimas de em) de los códigos WinAnsi 32-255. */
const HELVETICA_BOLD: readonly number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0,
  556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
];

/** Helvetica-Oblique: ancho (milésimas de em) de los códigos WinAnsi 32-255. */
const HELVETICA_OBLIQUE: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];

export type FuenteEstandar = 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique';

const TABLAS: Record<FuenteEstandar, readonly number[]> = {
  'Helvetica': HELVETICA,
  'Helvetica-Bold': HELVETICA_BOLD,
  'Helvetica-Oblique': HELVETICA_OBLIQUE,
};

/** Unicode → código WinAnsi para el rango 0x80-0x9F de Windows-1252 (el resto de
 *  0xA0-0xFF coincide con Latin-1, y 0x20-0x7E con ASCII). */
const CP1252: Record<number, number> = {
  0x20ac: 128, 0x201a: 130, 0x0192: 131, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135,
  0x02c6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017d: 142, 0x2018: 145,
  0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02dc: 152,
  0x2122: 153, 0x0161: 154, 0x203a: 155, 0x0153: 156, 0x017e: 158, 0x0178: 159,
};

/** El código WinAnsi de un carácter, o null si WinAnsi no lo tiene. */
export function aWinAnsi(ch: string): number | null {
  const cp = ch.codePointAt(0);
  if (cp == null) return null;
  if (cp >= 0x20 && cp <= 0x7e) return cp;
  if (cp >= 0xa0 && cp <= 0xff) return cp;
  return CP1252[cp] ?? null;
}

/** Ancho de un texto YA saneado (sólo caracteres WinAnsi), en puntos. */
export function anchoTexto(texto: string, fuente: FuenteEstandar, tam: number): number {
  const t = TABLAS[fuente];
  let milesimas = 0;
  for (const ch of texto) {
    const c = aWinAnsi(ch);
    milesimas += c == null ? 0 : (t[c - 32] ?? 0);
  }
  return (milesimas * tam) / 1000;
}

// =============================================================================
// UN SOLO lugar donde la app arma un CSV: la celda, la fila y el archivo — con las comillas y SIN fórmulas
// =============================================================================
// Vivía en app/dashboard/exportar.ts y se mudó acá el 16/10/2026 cuando la ficha del lead también exportó. El 21/10/2026 se volvió EL helper de todas las
// exportaciones: cinco exportadores (los leads del CRM, el Plan, Customer Success, las métricas y la cartera de /admin) tenían cada uno su `celda` y su
// `esc` —cuatro sin defensa contra fórmulas—, y la de leads es la más expuesta: los nombres y los campos vienen de formularios PÚBLICOS. Un lead que se
// llame «=HYPERLINK(…)» o «=cmd|…» se volvía fórmula cuando el cliente abría el CSV en Excel o en Sheets (OWASP, «CSV Injection»). Lo fija
// tests/csv-una-sola-via.test.ts: una exportación nueva que arme su propio escape, o que baje un `text/csv` sin pasar por acá, rompe Actions.
//
//   · Separador COMA por default y números con PUNTO, sin miles ni símbolo (Excel de México y Google Sheets los leen como números); `sep: ';'` para el Excel
//     en español.
//   · Comillas cuando el campo trae el separador, una comilla, un salto de línea o espacios en los bordes (o siempre, con `siempreComillas`).
//   · ⚠️ INYECCIÓN DE FÓRMULAS: un TEXTO que arranca con = + - @ (también tras espacios, y con un tab, un CR o un LF adelante) se abre en Excel como fórmula:
//     se le antepone un apóstrofo. Un NÚMERO (`typeof 'number'`) no: es un número. Una cadena que es un decimal NEGATIVO («-5», «-12.50») tampoco: no tiene
//     con qué ejecutar nada y el apóstrofo la volvería texto en una columna de cifras.
//   · `telefonosComoTexto` (Customer Success): lo que Excel volvería NÚMERO (un teléfono, «007») va como `="…"`, que Excel evalúa y deja el texto tal cual,
//     con su `+` y sus ceros; el apóstrofo se le vería a la vista en una columna que alguien copia a otra herramienta.
//   · Al IMPORTAR el mismo archivo: `desescaparCeldaCsv` deshace el apóstrofo y el `="…"` (el CRM lo usa en el importador de leads).
// =============================================================================

export const SEPARADOR_CSV = ',';
/** El BOM UTF-8: sin él, Excel abre «Campaña» como «CampaÃ±a». Con su código: el carácter es invisible. */
export const BOM_CSV = String.fromCharCode(0xfeff);

/**
 * Lo que una planilla lee como el ARRANQUE DE UNA FÓRMULA (OWASP): `=`, `+`, `-`, `@`, y un tab, un CR o un LF adelante. Se acepta espacio antes del signo:
 * « =1+1» se neutraliza igual, porque cualquier lector que recorte los espacios la ejecutaría, y el apóstrofo no le cuesta nada a un nombre que de verdad
 * empiece así.
 */
export const ARRANCA_FORMULA = /^(?:\s*[=+\-@]|[\t\r\n])/;
/** Un decimal negativo escrito como texto: es un número. No hay fórmula posible en dígitos, un signo y un punto. */
const DECIMAL_NEGATIVO = /^-\d+(?:\.\d+)?$/;
/**
 * Lo que Excel vuelve NÚMERO al abrir el archivo: dígitos con la puntuación de un teléfono o de una cifra. Comillas, letras y saltos de línea quedan AFUERA a
 * propósito: esto va adentro de un literal de fórmula y lo único que podría escaparse de él es una comilla. El tope de 100 queda lejos de los 255 caracteres
 * que Excel acepta en un literal.
 */
export const PARECE_NUMERO = /^(?=.*\d)[0-9+\-().,/ ]{1,100}$/;

/** Un número para el CSV: con punto, hasta 4 decimales, sin ceros de más. */
export function numeroCsv(n: number): string {
  if (!Number.isFinite(n)) return '';
  const r = Math.round(n * 10_000) / 10_000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Un texto que NO se abre como fórmula: si arranca como una, lleva un apóstrofo adelante. Es la única definición de «arranca como fórmula» de la app. */
export function neutralizarFormula(s: string): string {
  return ARRANCA_FORMULA.test(s) && !DECIMAL_NEGATIVO.test(s) ? `'${s}` : s;
}

export type OpcionesCelda = {
  /** El separador de columnas (también decide cuándo hacen falta comillas). Default: coma. */
  sep?: string;
  /** Todas las celdas entre comillas, también las vacías y los números (el Plan y Customer Success). */
  siempreComillas?: boolean;
  /** Los saltos de línea de un texto pasan a espacio: parten la fila en dos en algunos lectores (Customer Success). */
  aplanarSaltos?: boolean;
  /** Lo que Excel volvería número va como `="…"` (Customer Success: teléfonos). */
  telefonosComoTexto?: boolean;
  /** Caracteres EXTRA que obligan comillas (las métricas: `;`, para el Excel en español). */
  comillasTambien?: string;
  /** Cómo se escribe un número. Default: `numeroCsv` (punto, hasta 4 decimales). */
  numero?: (n: number) => string;
};

/**
 * Una celda: los números tal cual; los textos con comillas cuando hacen falta y sin fórmulas. `null` y `undefined` salen VACÍOS —nunca `0` ni la palabra
 * «null»—. El segundo argumento es el separador (como siempre) o las opciones.
 */
export function celdaCsv(v: string | number | null | undefined, sepOOpciones: string | OpcionesCelda = SEPARADOR_CSV): string {
  const o: OpcionesCelda = typeof sepOOpciones === 'string' ? { sep: sepOOpciones } : sepOOpciones;
  const sep = o.sep ?? SEPARADOR_CSV;
  const comillar = (s: string) => `"${s.replace(/"/g, '""')}"`;
  if (v == null) return o.siempreComillas ? '""' : '';
  if (typeof v === 'number') {
    const t = (o.numero ?? numeroCsv)(v);
    return o.siempreComillas ? comillar(t) : t;
  }
  let s = String(v);
  if (o.aplanarSaltos) s = s.replace(/[\r\n]+/g, ' ');
  if (o.telefonosComoTexto && PARECE_NUMERO.test(s)) return comillar(`="${s}"`);
  s = neutralizarFormula(s);
  const comillas = o.siempreComillas || s.includes(sep) || /["\r\n]/.test(s) || /^\s|\s$/.test(s) || (o.comillasTambien != null && [...o.comillasTambien].some((c) => s.includes(c)));
  return comillas ? comillar(s) : s;
}

/** Una fila: sus celdas, con el mismo separador. */
export function filaCsv(celdas: ReadonlyArray<string | number | null | undefined>, opciones: OpcionesCelda = {}): string {
  return celdas.map((c) => celdaCsv(c, opciones)).join(opciones.sep ?? SEPARADOR_CSV);
}

export type OpcionesArchivo = OpcionesCelda & {
  /** Con BOM adelante (Excel). Default: sí. */
  bom?: boolean;
  /** El separador de filas. Default: `\r\n`. */
  saltos?: string;
  /** Con un salto de línea al final. Default: no. */
  saltoFinal?: boolean;
};

/** El archivo entero: las filas, el BOM y los saltos. Cada celda pasa por `celdaCsv`: ahí está lo que impide que Excel ejecute lo que trae. */
export function armarCsv(filas: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>, o: OpcionesArchivo = {}): string {
  const saltos = o.saltos ?? '\r\n';
  const cuerpo = filas.map((f) => filaCsv(f, o)).join(saltos);
  return `${o.bom === false ? '' : BOM_CSV}${cuerpo}${o.saltoFinal ? saltos : ''}`;
}

/**
 * Lo inverso de `celdaCsv` para LEER un archivo que la app exportó: saca el apóstrofo que antepuso a lo que arrancaba como fórmula, y el `="…"` de los teléfonos.
 * Sólo toca esas dos formas exactas: «'90s» y «O'Brien» quedan como están.
 */
export function desescaparCeldaCsv(s: string): string {
  const literal = /^="([^"]*)"$/.exec(s);
  if (literal) return literal[1];
  return s.startsWith("'") && ARRANCA_FORMULA.test(s.slice(1)) ? s.slice(1) : s;
}

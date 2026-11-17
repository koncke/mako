// =============================================================================
// xlsx-escribir — una planilla .xlsx de UNA hoja, sin dependencias nuevas (ticket 106, 17/11/2026)
// =============================================================================
// Codigo Inmobiliario (ws 13) pidió bajar los leads del CRM «en XLSX, que es mucho más cómodo y ordenado». Un .xlsx es un ZIP
// con XML adentro (lo mismo que lee lib/office-a-texto.ts para importar): con `fflate`, que ya estaba en el árbol, armarlo
// son estas líneas. Una librería de planillas entera (SheetJS, exceljs) para escribir una tabla sería superficie de más.
//
// Lo que trae la hoja: la primera fila en negrita y FIJA al bajar, el filtro de columnas puesto, y el ancho de cada columna
// según lo que lleva. Lo que NO trae: fórmulas. Cada texto va como «inlineStr», que Excel y Sheets muestran tal cual: un lead
// llamado «=HYPERLINK(…)» (los nombres vienen de formularios PÚBLICOS) se lee como texto, sin el apóstrofo que necesita el
// CSV (lib/csv-celda.ts). Un número va como número, así una columna de montos se suma.
//
// ⚠️ UN CARÁCTER DE CONTROL ROMPE EL ARCHIVO ENTERO, sin decir cuál: XML 1.0 no admite \u0000-\u0008, \u000B, \u000C,
// \u000E-\u001F ni un medio emoji suelto, y Excel abre «encontramos un problema con el contenido» y ofrece «recuperar» la
// planilla. Lo que contesta un lead en un formulario puede traer cualquiera de esos: `textoXml` los saca.
// ⚠️ Excel corta una celda en 32.767 caracteres y avisa que el archivo está dañado: se corta antes, sin partir un emoji.
// =============================================================================

import { strToU8, zipSync } from 'fflate';

export type CeldaXlsx = string | number | null | undefined;

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Lo más largo que admite una celda de Excel. */
export const TOPE_CELDA_XLSX = 32_767;
/** El ancho de columna (en caracteres) con que se abre: ni una columna de 3, ni una de 230 que obligue a desplazarse. */
const ANCHO = { min: 8, maxEncabezado: 40, maxDato: 60 } as const;

/** 0 → A, 25 → Z, 26 → AA. */
export function letraDeColumna(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Un texto listo para ir dentro de un XML: sin los caracteres que XML 1.0 no admite, cortado al tope de Excel y escapado. */
export function textoXml(s: string): string {
  const limpio = s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    // Un medio emoji suelto (un sustituto sin su par) tampoco es XML válido.
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  const cortado = limpio.length > TOPE_CELDA_XLSX ? limpio.slice(0, TOPE_CELDA_XLSX).replace(/[\uD800-\uDBFF]$/, '') : limpio;
  return cortado.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const vacia = (v: CeldaXlsx): boolean => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v));

function celdaXml(v: CeldaXlsx, ref: string, estilo: number): string {
  if (vacia(v)) return '';
  const s = estilo ? ` s="${estilo}"` : '';
  if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${textoXml(String(v))}</t></is></c>`;
}

/** El ancho de una columna: su renglón más largo, entre los topes. */
function anchoDe(valores: ReadonlyArray<CeldaXlsx>, conEncabezado: boolean): number {
  let w: number = ANCHO.min;
  valores.forEach((v, i) => {
    if (vacia(v)) return;
    const tope = conEncabezado && i === 0 ? ANCHO.maxEncabezado : ANCHO.maxDato;
    const largo = Math.max(...String(v).split('\n').map((l) => l.length));
    w = Math.max(w, Math.min(tope, largo + 2));
  });
  return w;
}

/** Un nombre de hoja válido: sin `[]:*?/\`, hasta 31 caracteres y nunca vacío. */
export function nombreDeHoja(nombre: string): string {
  const n = nombre.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31).replace(/^'+|'+$/g, '');
  return n || 'Hoja 1';
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';

// Dos estilos: 0 = normal, 1 = encabezado (negrita, el texto se parte en renglones en vez de cortarse).
const ESTILOS = `${XML}<styleSheet xmlns="${NS_MAIN}">`
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

/**
 * La planilla: `filas[0]` es el encabezado (en negrita, fijo y con filtro) salvo `encabezado: false`.
 * Devuelve los bytes del .xlsx.
 */
export function xlsxDeTabla(filas: ReadonlyArray<ReadonlyArray<CeldaXlsx>>, o: { hoja?: string; encabezado?: boolean } = {}): Uint8Array {
  const hoja = nombreDeHoja(o.hoja ?? 'Hoja 1');
  const conEncabezado = o.encabezado !== false && filas.length > 0;
  const nCol = filas.reduce((m, f) => Math.max(m, f.length), 0);
  const nFil = filas.length;
  const rango = nCol && nFil ? `A1:${letraDeColumna(nCol - 1)}${nFil}` : 'A1';

  const cols = nCol
    ? `<cols>${Array.from({ length: nCol }, (_, c) => `<col min="${c + 1}" max="${c + 1}" width="${anchoDe(filas.map((f) => f[c]), conEncabezado)}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const datos = filas.map((fila, r) =>
    `<row r="${r + 1}">${fila.map((v, c) => celdaXml(v, `${letraDeColumna(c)}${r + 1}`, conEncabezado && r === 0 ? 1 : 0)).join('')}</row>`).join('');
  const fija = conEncabezado
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const filtro = conEncabezado && nCol ? `<autoFilter ref="${rango}"/>` : '';
  const hojaXml = `${XML}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><dimension ref="${rango}"/>${fija}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${datos}</sheetData>${filtro}</worksheet>`;

  // El filtro necesita su nombre definido, como lo deja Excel al guardar: sin él, algunas versiones lo pierden al abrir.
  const refFiltro = `'${hoja.replace(/'/g, "''")}'!$A$1:$${letraDeColumna(Math.max(0, nCol - 1))}$${Math.max(1, nFil)}`;
  const nombres = filtro ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${textoXml(refFiltro)}</definedName></definedNames>` : '';
  const libro = `${XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="${textoXml(hoja)}" sheetId="1" r:id="rId1"/></sheets>${nombres}</workbook>`;

  const archivos: Record<string, string> = {
    '[Content_Types].xml': `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '</Types>',
    '_rels/.rels': `${XML}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': libro,
    'xl/_rels/workbook.xml.rels': `${XML}<Relationships xmlns="${NS_PKG}">`
      + `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
      + `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': ESTILOS,
    'xl/worksheets/sheet1.xml': hojaXml,
  };
  return zipSync(Object.fromEntries(Object.entries(archivos).map(([ruta, texto]) => [ruta, strToU8(texto)])));
}

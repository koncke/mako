import 'server-only';

// =============================================================================
// office-a-texto — planillas, presentaciones y OpenDocument, sin pagar visión
// =============================================================================
// Un .xlsx, un .pptx y un .odt son todos lo mismo por dentro: un ZIP con XML. Sacarles
// el texto no necesita ninguna IA — se abre el zip y se lee. Antes rebotaban con «no sé
// leer ese formato», que en una agencia es raro: la lista de leads viene en planilla y
// la propuesta del cliente viene en deck.
//
// POR QUÉ A MANO Y NO CON SheetJS: la única cosa que hace falta acá es TEXTO para que la
// IA saque tareas — no fórmulas, ni formatos, ni fechas seriales. Leer el XML con la
// jszip que ya estaba en el árbol (mammoth la usa) cuesta ~150 líneas y cero superficie
// nueva. Si algún día hace falta leer una planilla DE VERDAD (tipos, fechas, hojas
// calculadas), ahí sí entra una librería.
//
// LÍMITES, dichos y no escondidos:
//  · las fórmulas se leen por su ÚLTIMO VALOR CALCULADO (lo que el archivo trae cacheado).
//    Una planilla nunca abierta en Excel puede tener celdas calculadas vacías.
//  · las fechas de Excel son números y salen como números: 45678, no 2025-01-15.
//  · no lee imágenes ni gráficos incrustados. Si el dato solo vive en un gráfico, no está.
// =============================================================================

import JSZip from 'jszip';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Entidades XML mínimas. No hace falta un parser: el contenido de un `<t>` viene
 *  escapado y esas cinco son las que el estándar obliga a escapar. */
const desescapar = (s: string): string => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&');   // SIEMPRE al final, o «&amp;lt;» se convertiría en «<»

/** Todo el texto de los `<tag>…</tag>` de un XML, en orden. */
function textos(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  return [...xml.matchAll(re)].map((m) => desescapar(m[1]));
}

/** «BC12» → 54 (índice 0-based de la columna). Sirve para no desalinear una fila que
 *  tiene celdas vacías: sin esto, una fila con A y D salía como dos columnas pegadas. */
function colDe(ref: string): number {
  const letras = ref.match(/^([A-Z]+)/)?.[1] ?? 'A';
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** Ordena «sheet2.xml» antes que «sheet10.xml» (el orden alfabético los da vuelta). */
const porNumero = (a: string, b: string): number => {
  const n = (s: string) => Number(s.match(/(\d+)\.xml$/)?.[1] ?? 0);
  return n(a) - n(b);
};

// ── XLSX ─────────────────────────────────────────────────────────────────────

/** Una planilla como texto: una hoja por bloque, una fila por línea, celdas con tab. */
export async function xlsxATexto(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);

  // La tabla de strings compartidos: las celdas de texto guardan un ÍNDICE a esta lista,
  // no el texto. Sin esto, una planilla de leads sale como una columna de números.
  const compartidas: string[] = [];
  const ssXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  if (ssXml) {
    // Cada <si> puede ser un <t> suelto o varios <r><t> (texto con formatos mezclados),
    // y en ese caso las partes se concatenan sin separador.
    for (const si of (ssXml.match(/<si>[\s\S]*?<\/si>/g) ?? [])) compartidas.push(textos(si, 't').join(''));
  }

  // El nombre de cada hoja y el orden en que las ve el usuario.
  const wbXml = (await zip.file('xl/workbook.xml')?.async('string')) ?? '';
  const nombres = [...wbXml.matchAll(/<sheet[^>]*\sname="([^"]*)"/g)].map((m) => desescapar(m[1]));

  const hojas = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(porNumero);
  const salida: string[] = [];

  for (let h = 0; h < hojas.length; h++) {
    const xml = (await zip.file(hojas[h])?.async('string')) ?? '';
    const filas: string[] = [];
    for (const fila of (xml.match(/<row[\s\S]*?<\/row>|<row[^>]*\/>/g) ?? [])) {
      const celdas: string[] = [];
      for (const c of (fila.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) ?? [])) {
        const ref = c.match(/\sr="([A-Z]+\d+)"/)?.[1];
        const tipo = c.match(/\st="([^"]+)"/)?.[1] ?? 'n';
        let valor: string;
        if (tipo === 's') {
          const i = Number(textos(c, 'v')[0] ?? '');
          valor = compartidas[i] ?? '';
        } else if (tipo === 'inlineStr') {
          valor = textos(c, 't').join('');
        } else {
          // 'n' (número), 'str' (resultado de fórmula), 'b', 'e'… todos traen su <v>.
          valor = textos(c, 'v')[0] ?? '';
        }
        const col = ref ? colDe(ref) : celdas.length;
        while (celdas.length < col) celdas.push('');
        celdas[col] = valor.replace(/[\t\n\r]+/g, ' ').trim();
      }
      // Una fila entera vacía no aporta nada y las planillas están llenas de ellas.
      if (celdas.some((x) => x)) filas.push(celdas.join('\t'));
    }
    if (!filas.length) continue;   // hoja vacía: no la nombramos siquiera
    salida.push(`===== Hoja: ${nombres[h] ?? `Hoja ${h + 1}`} =====\n${filas.join('\n')}`);
  }

  if (!salida.length) throw new Error('la planilla no tiene ninguna celda con contenido');
  return salida.join('\n\n');
}

// ── PPTX ─────────────────────────────────────────────────────────────────────

/** Un deck como texto: una diapositiva por bloque, con sus notas del orador si tiene. */
export async function pptxATexto(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(porNumero);
  const salida: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const xml = (await zip.file(slides[i])?.async('string')) ?? '';
    // <a:t> es el texto de una corrida; <a:p> separa párrafos. Juntamos por párrafo para
    // que un título partido en tres corridas (por negritas) no salga en tres líneas.
    const parrafos = (xml.match(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g) ?? [])
      .map((p) => textos(p, 'a:t').join('').trim())
      .filter(Boolean);
    // Las notas del orador son donde vive el contexto de verdad de una propuesta.
    const notasXml = await zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`)?.async('string');
    const notas = notasXml
      ? (notasXml.match(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g) ?? []).map((p) => textos(p, 'a:t').join('').trim()).filter(Boolean)
      : [];
    if (!parrafos.length && !notas.length) continue;
    salida.push([
      `===== Diapositiva ${i + 1} =====`,
      ...parrafos,
      ...(notas.length ? ['— Notas del orador —', ...notas] : []),
    ].join('\n'));
  }

  if (!salida.length) throw new Error('la presentación no tiene texto (¿son todas imágenes?)');
  return salida.join('\n\n');
}

// ── OpenDocument (.odt / .ods / .odp) ────────────────────────────────────────

/** LibreOffice y Google Docs exportan a esto. Todo el contenido vive en content.xml. */
export async function openDocumentATexto(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('content.xml')?.async('string');
  if (!xml) throw new Error('no encontré content.xml adentro del archivo');
  const texto = xml
    .replace(/<text:tab\/>/g, '\t')
    .replace(/<text:line-break\/>/g, '\n')
    .replace(/<\/text:(p|h)>/g, '\n')            // fin de párrafo o de título
    .replace(/<\/table:table-cell>/g, '\t')      // celda de una hoja .ods
    .replace(/<\/table:table-row>/g, '\n')
    .replace(/<[^>]+>/g, '')                     // el resto de las etiquetas, fuera
    .split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n');
  const limpio = desescapar(texto).trim();
  if (!limpio) throw new Error('el documento no tiene texto');
  return limpio;
}

/** Un solo punto de entrada, para que el lector no tenga que saber cuál es cuál. */
export async function officeATexto(familia: 'xlsx' | 'pptx' | 'opendocument', buf: Buffer, nombre: string): Promise<string> {
  try {
    if (familia === 'xlsx') return await xlsxATexto(buf);
    if (familia === 'pptx') return await pptxATexto(buf);
    return await openDocumentATexto(buf);
  } catch (e) {
    throw new Error(`No pude abrir «${nombre}»: ${msg(e)}`);
  }
}

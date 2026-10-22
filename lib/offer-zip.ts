// =============================================================================
// offer-zip — el .zip de una landing, leído como UN documento de la conversación de Offer
// =============================================================================
// Llamada con Mauricio del 22/10/2026 (Fathom 195129619, 33:06-36:58): quiso subir la carpeta de su landing («porque es
// una carpeta, creo que no se puede») y sólo entró el index; el navegador no deja elegir una carpeta. Lo que sí: un
// .zip. Esto lo abre, lee cada página (.html con el MISMO extractor de copy que Landing Analyst, `copyDeHtml`) y cada
// texto (.txt, .md, .csv), y saltea lo demás (imágenes, estilos, código). El aviso dice qué leyó y qué no: es lo que
// pidió («explicar qué leyó»).
//
// ⚠️ Con topes: un .zip chico puede descomprimir gigas. Se lee como mucho `MAX_ARCHIVOS` páginas o textos, cada uno
//    hasta `MAX_BYTES_ARCHIVO`, y se corta al llegar a `MAX_TEXTO`. Lo que pasa de ahí se cuenta como salteado.
// ⚠️ Sin IA: el texto de una página sale del HTML. Un PDF o un Word adentro del .zip no se lee (se nombra en el aviso):
//    que lo suba suelto.
// =============================================================================

import JSZip from 'jszip';
import { copyDeHtml } from './landing-extraer';
export { esZip } from './offer-reglas';

export const MAX_ARCHIVOS = 30;
export const MAX_BYTES_ARCHIVO = 2_000_000;
export const MAX_TEXTO = 300_000;

const PAGINA = /\.html?$/i;
const TEXTO = /\.(?:txt|md|csv)$/i;
/** Lo que se nombra en el aviso como «súbelo suelto»: documentos que sí se leen, pero no desde adentro de un .zip. */
const DOCUMENTO = /\.(?:pdf|docx?|xlsx?|pptx?|odt)$/i;
/** Lo que no es del sitio: la basura que dejan macOS y los editores. */
const BASURA = /(?:^|\/)(?:__MACOSX\/|\.[^/]+$|Thumbs\.db$)/i;

export type ZipLeido = { texto: string; leidos: string[]; documentos: string[]; salteados: number; aviso: string };

/**
 * El .zip como texto. null si no se puede abrir como .zip. Las páginas van primero el index (es la landing) y después
 * en orden alfabético; cada una con su nombre arriba, para que la IA sepa de cuál sale cada cosa.
 */
export async function textoDeZip(bytes: Uint8Array): Promise<ZipLeido | null> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); } catch { return null; }
  const entradas = Object.values(zip.files).filter((f) => !f.dir && !BASURA.test(f.name));
  const legibles = entradas.filter((f) => PAGINA.test(f.name) || TEXTO.test(f.name))
    .sort((a, b) => Number(/(?:^|\/)index\.html?$/i.test(b.name)) - Number(/(?:^|\/)index\.html?$/i.test(a.name)) || a.name.localeCompare(b.name));
  const documentos = entradas.filter((f) => DOCUMENTO.test(f.name)).map((f) => f.name);
  const partes: string[] = [];
  const leidos: string[] = [];
  let largo = 0;
  for (const f of legibles.slice(0, MAX_ARCHIVOS)) {
    if (largo >= MAX_TEXTO) break;
    const crudo = await f.async('uint8array');
    if (crudo.byteLength > MAX_BYTES_ARCHIVO) continue;
    const contenido = new TextDecoder('utf-8').decode(crudo);
    const texto = PAGINA.test(f.name) ? textoDePagina(contenido) : contenido.trim();
    if (!texto) continue;
    const pedazo = `=== ${f.name} ===\n${texto}`.slice(0, MAX_TEXTO - largo);
    partes.push(pedazo);
    largo += pedazo.length;
    leidos.push(f.name);
  }
  const salteados = entradas.length - leidos.length - documentos.length;
  return { texto: partes.join('\n\n'), leidos, documentos, salteados, aviso: avisoDelZip(leidos, documentos, salteados) };
}

/** El copy de una página, con su título y su descripción arriba (lo que dice la pestaña y Google). */
function textoDePagina(html: string): string {
  const c = copyDeHtml(html);
  return [c.titulo ? `# ${c.titulo}` : '', c.descripcion, c.texto].filter((x) => x?.trim()).join('\n\n').trim();
}

const lista = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Qué se leyó del .zip, en una frase para el chip del documento. */
export function avisoDelZip(leidos: string[], documentos: string[], salteados: number): string {
  const nombres = leidos.slice(0, 6).map((n) => n.split('/').pop() ?? n);
  const mas = leidos.length > 6 ? ` y ${leidos.length - 6} más` : '';
  const partes = [
    leidos.length ? `Del .zip leí ${lista(nombres)}${mas}` : 'Del .zip no pude leer ninguna página ni texto',
    documentos.length ? `${documentos.length === 1 ? 'un documento' : `${documentos.length} documentos`} (${lista(documentos.slice(0, 3).map((n) => n.split('/').pop() ?? n))}) no los abro desde un .zip: súbelos sueltos` : '',
    salteados > 0 ? `salteé ${salteados} ${salteados === 1 ? 'archivo' : 'archivos'} que no son texto (imágenes, estilos, código)` : '',
  ].filter(Boolean);
  return `${partes.join('; ')}.`;
}

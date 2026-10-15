// =============================================================================
// crear/caja-modos — lo PURO del cuadro «¿Qué vas a crear hoy?» con modos (tanda 7)
// =============================================================================
// Feedback de Martín sobre la tanda 6 (15/10/2026), textual:
//   «2. Las 5 opciones abajo del título "¿Qué vas a crear hoy?".
//    3. Cuando le doy click a una opción, lo que debe cambiar es el recuadro de chat de abajo, no redireccionarme a
//       otro lugar.
//    4. No entiendo la diferencia entre las 2 primeras... Si tu tampoco ves diferencia entre esas 2, elimina y
//       conserva la de "Generar desde una idea".
//    5. Cuando vayas reemplazando el bloque de texto que está hoy en día, no quiero que desaparezca el diseño de ese
//       recuadro, quiero que se mantenga igual... […] Lo que no quiero es que esos ejemplos sean otras tarjetas […]
//       Tampoco quiero el botón de "aleatorio"... Todas las opciones como "Español México, la cantidad de secciones,
//       el CTA de Agendar reunión u otros, etc... Deben ir dentro de + o en algún desplegable así...
//    6. Si elijo "Importar" simplemente el cuadro de texto se transforma en un contenedor de importación típico, pero
//       con el mismo tamaño y diseño que el cuadro de texto. Y cuando se importe algo, que vuelva al cuadro de texto,
//       pero esta vez ya se pueden previsualizar la miniatura de lo importado en el cuadro de texto. […] Y ya por
//       defecto el cuadro de texto en cualquier estado debe admitir un arrastre de archivo, si se arrastra se debe
//       poner allí.
//    7. Y para las opciones de link, lo mismo que lo anterior, el cuadro de texto se transforma en el contenedor del
//       link con un placeholder de soltar el link... Y cuando lo sueltan se vuelve al texto para poder seguir
//       escribiendo. Y en el cuadro de texto, cuando pego un link y se pone en azul y al lado aparece la opción de
//       analizar o replicar, todo eso debería seguir siendo el cuadro de texto, solo que esos son chips del texto...
//       Pero si le doy a borrar, se deben borrar. O si quiero seguir escribiendo luego de pegar eso.»
//
// UN cuadro con CUATRO modos (Generar · Importar · Analizar landing · Replicar landing). «Pegar texto» se fue como
// tarjeta (punto 4), pero su capacidad no: cómo se usa un texto largo (de guía / resumido / tal cual) es una opción
// DEL CUADRO que aparece sola cuando lo escrito es largo (`esTextoLargo`) o hay un archivo adjunto.
//
// Lo que manda acá es el ESTADO del cuadro (`EstadoCaja`) y cada cosa que le pasa es una función pura que devuelve
// el estado nuevo; la pantalla (../CajaCrear.tsx) sólo las llama. Así lo que no se ve en una captura (qué modo queda
// al borrar un chip, qué viaja al server) tiene test (tests/web-generator-cuadro.test.ts) y se ejecuta.
//
// LAS INVARIANTES (cada función las conserva):
//   · con un archivo adjunto, el modo es «importar»;
//   · con un link que tiene acción (Analiza / Replica esta landing), el modo es esa acción;
//   · un link SIN acción (se le borró la pastilla) es una referencia del pedido: el modo es «generar» (o «importar»
//     si además hay un archivo) y la dirección viaja adentro del pedido, como texto.
//   Lo que se VE sale del modo y de lo adjunto (`vistaDeCaja`): «importar» sin archivo es el contenedor para soltar
//   un archivo; «analizar» o «replicar» sin link, el contenedor del link; lo demás, el texto.
//
// ⚠️ LO ESCRITO NUNCA SE PIERDE NI SE ESCONDE SIN AVISO (la regla de la verificación de la tanda 6): elegir otro modo
//    no borra el texto (a lo sumo lo tapa el contenedor de ese modo y vuelve al salir), el link que deja de ser
//    chip vuelve como referencia, y si la acción no usa lo escrito (Analizar y Replicar no aceptan instrucciones:
//    lo midió la tanda 6), la pantalla lo dice en una línea antes de mandar (`avisoDeTexto`).
// =============================================================================

import type { ParamsGeneracion } from '@/lib/editor-landing/api-tipos';
import type { FormatoReplicar } from '@/lib/editor-landing/replicar-reglas';
import { familiaDeArchivo, type FamiliaArchivo } from '@/lib/formatos-archivo';
import { linkEscrito, sacarLink, type AccionCaja } from '../panel-reglas';
import type { TipoCrear } from './tipo';

// ─────────────────────────────────────────────────────────────────────────────
// Los modos
// ─────────────────────────────────────────────────────────────────────────────

export const MODOS_CAJA = ['generar', 'importar', 'analizar', 'replicar'] as const;
export type ModoCaja = (typeof MODOS_CAJA)[number];

/** Las opciones arriba del cuadro (punto 2). Rótulos cortos: son botones. Generar es el default. */
export const OPCIONES_MODO: readonly { id: ModoCaja; titulo: string; icono: string }[] = [
  { id: 'generar', titulo: 'Generar', icono: 'destellos' },
  { id: 'importar', titulo: 'Importar', icono: 'subir' },
  { id: 'analizar', titulo: 'Analizar landing', icono: 'reporte' },
  { id: 'replicar', titulo: 'Replicar landing', icono: 'copiar' },
];

export const modoValido = (v: string | null | undefined): ModoCaja | null =>
  ((MODOS_CAJA as readonly string[]).includes(v ?? '') ? (v as ModoCaja) : null);

/** Qué se hace con un link: lo que dice su pastilla. */
export type AccionLink = 'analizar' | 'replicar';

/** El formato de Replicar por default: las secciones editables (lo que se quiere casi siempre). */
export const FORMATO_INICIAL: FormatoReplicar = 'landing';

/** El tope de lo que se escribe en el cuadro: el de «Pegar texto» (60.000), que ahora es el mismo cuadro. */
export const TOPE_TEXTO = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// El estado
// ─────────────────────────────────────────────────────────────────────────────

/** El link pegado o soltado: la dirección TAL CUAL (con su www y su query) y su acción (null = es una referencia). */
export type LinkCaja = { url: string; accion: AccionLink | null; formato: FormatoReplicar };

/** El archivo adjunto: leyéndose, leído (con su texto) o que no se pudo leer. `vista`: la imagen, para su miniatura. */
export type ArchivoCaja = { nombre: string; imagen: boolean; vista?: string } & (
  | { estado: 'leyendo' }
  | { estado: 'listo'; texto: string }
  | { estado: 'error' }
);

export type EstadoCaja = {
  modo: ModoCaja;
  /** Lo escrito en el campo (después de los chips). */
  texto: string;
  link: LinkCaja | null;
  archivo: ArchivoCaja | null;
  /**
   * Dónde estaba el cuadro cuando llegó el link o el archivo: a dónde vuelve si se quitan y no hay nada escrito
   * (el contenedor de Importar si se eligió Importar, el de Analizar si se eligió Analizar, el texto si se pegó
   * en Generar). Con algo escrito vuelve SIEMPRE al texto: lo escrito no queda tapado.
   */
  antes: ModoCaja;
};

export const cajaVacia = (modo: ModoCaja = 'generar'): EstadoCaja => ({ modo, texto: '', link: null, archivo: null, antes: modo });

/** Lo que trae el cuadro al abrirse UNA vez (no viaja en la URL): lo de vuelta de Crear, o el deep link de la landing de base. */
export type SemillaCaja = {
  texto?: string;
  archivo?: { nombre: string; texto: string };
  modoGen?: 'plan' | 'express';
  params?: Partial<ParamsGeneracion>;
  tipo?: TipoCrear;
  /** El deep link del ex Landing Analyst (`?url=`, `?objetivo=`): el cuadro los valida contra las analizadas. */
  base?: string;
  objetivo?: string;
};

/** El estado con el que abre el cuadro: el modo que pide el Panel y, si vuelve de Crear, lo que se había mandado. */
export function cajaDeSemilla(modo: ModoCaja, s?: SemillaCaja | null): EstadoCaja {
  const e = cajaVacia(modo);
  if (s?.archivo) return { ...e, modo: 'importar', antes: 'importar', texto: s.texto ?? '', archivo: { nombre: s.archivo.nombre, imagen: false, estado: 'listo', texto: s.archivo.texto } };
  return s?.texto && (modo === 'generar' || modo === 'importar') ? { ...e, modo: 'generar', antes: 'generar', texto: s.texto } : e;
}

export type VistaCaja = 'texto' | 'importar' | 'link';

/** Lo que muestra el cuadro adentro (el marco, el alto y la fila de abajo son los mismos en las tres). */
export function vistaDeCaja(e: EstadoCaja): VistaCaja {
  if (e.modo === 'importar' && !e.archivo) return 'importar';
  if ((e.modo === 'analizar' || e.modo === 'replicar') && !e.link) return 'link';
  return 'texto';
}

const accionDe = (m: ModoCaja): AccionLink => (m === 'replicar' ? 'replicar' : 'analizar');
const comoReferencia = (l: LinkCaja | null): LinkCaja | null => (l ? { ...l, accion: null } : null);

// ─────────────────────────────────────────────────────────────────────────────
// Lo que le pasa al cuadro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elegir un modo arriba del cuadro (punto 3: cambia el cuadro, nada navega).
 *   · Generar: el archivo se suelta (se eligió escribir) y el link queda como referencia del pedido.
 *   · Importar: el link queda como referencia (va con las instrucciones del archivo); sin archivo, el contenedor.
 *   · Analizar / Replicar: con un link, cambia su pastilla; sin link, el contenedor del link. El archivo se suelta
 *     (Analizar y Replicar no leen un archivo).
 * El texto no se toca nunca.
 */
export function elegirModo(e: EstadoCaja, m: ModoCaja): EstadoCaja {
  if (m === 'generar') return { ...e, modo: 'generar', archivo: null, link: comoReferencia(e.link), antes: e.link ? e.antes : 'generar' };
  if (m === 'importar') return { ...e, modo: 'importar', link: comoReferencia(e.link), antes: e.archivo || e.link ? e.antes : 'importar' };
  return { ...e, modo: m, archivo: null, link: e.link ? { ...e.link, accion: m } : null, antes: e.link ? e.antes : m };
}

/**
 * Un link como CHIPS (pegado, soltado o escrito en el contenedor del link): la dirección en azul y su pastilla, la
 * de Replicar si se estaba en Replicar y si no la de Analizar (la de la tanda 6). Con un archivo adjunto o con otro
 * link ya puesto, la dirección va al TEXTO (son instrucciones): nunca se pisa lo que ya estaba.
 */
export function conLink(e: EstadoCaja, url: string): EstadoCaja {
  if (e.archivo || e.link) return { ...e, texto: unir(e.texto, url) };
  const accion = accionDe(e.modo);
  return { ...e, link: { url, accion, formato: FORMATO_INICIAL }, modo: accion, antes: e.modo };
}

/**
 * Lo escrito o pegado en el campo. Un link COMPLETO y SOLO (`sacarLink`, de la tanda 6: pegado, dictado o cerrado por
 * un espacio) se vuelve chips; con texto al lado queda en el texto tal cual (va como pedido a Generar).
 */
export function alEscribir(e: EstadoCaja, ahora: string): EstadoCaja {
  if (!e.link && !e.archivo) {
    const url = sacarLink(e.texto, ahora);
    if (url) return conLink({ ...e, texto: '' }, url);
  }
  return { ...e, texto: ahora };
}

/** Un archivo adjunto (el «+», soltado en el cuadro o pegado): el modo pasa a Importar y el link queda de referencia. */
export function conArchivo(e: EstadoCaja, a: ArchivoCaja): EstadoCaja {
  return { ...e, archivo: a, modo: 'importar', link: comoReferencia(e.link), antes: e.archivo ? e.antes : e.modo };
}

/** La ✕ del archivo: con algo escrito (o un link) vuelve al texto; si no, a donde estaba. */
export function quitarArchivo(e: EstadoCaja): EstadoCaja {
  if (!e.archivo) return e;
  return { ...e, archivo: null, modo: e.texto.trim() || e.link ? 'generar' : e.antes };
}

/** La ✕ del link (se va con su pastilla): con algo escrito vuelve al texto; si no, a donde estaba. */
export function quitarLink(e: EstadoCaja): EstadoCaja {
  if (!e.link) return e;
  if (e.archivo) return { ...e, link: null };
  return { ...e, link: null, modo: e.texto.trim() ? 'generar' : e.antes };
}

/**
 * Backspace con el cursor al principio del texto (punto 7: «si le doy a borrar, se deben borrar»): borra el ÚLTIMO
 * chip. Primero la pastilla (con el formato de Replicar, que es parte de ella) y después el link. Se queda en el
 * texto, que es donde se está escribiendo: el contenedor no salta debajo del cursor. null = no hay chip que borrar.
 */
export function borrarAlInicio(e: EstadoCaja): EstadoCaja | null {
  if (!e.link) return null;
  const modo: ModoCaja = e.archivo ? 'importar' : 'generar';
  if (e.link.accion) return { ...e, link: { ...e.link, accion: null }, modo };
  return { ...e, link: null, modo };
}

export const cambiarFormato = (e: EstadoCaja, formato: FormatoReplicar): EstadoCaja => (e.link ? { ...e, link: { ...e.link, formato } } : e);

/** Un link arrastrado desde otra pestaña: la `text/uri-list` (sin comentarios) o un texto que es SÓLO un link. */
export function linkSoltado(uriList: string, plano: string): string | null {
  const uri = uriList.split(/\r?\n/).map((s) => s.trim()).find((s) => s && !s.startsWith('#'));
  if (uri && /^https?:\/\//i.test(uri)) {
    const l = sacarLink('', uri);
    if (l) return l;
  }
  return sacarLink('', plano.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo largo, lo que se avisa y lo que se ve
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Lo escrito es un TEXTO (notas, un guion, un esquema) y no un pedido? Desde 500 caracteres o 5 renglones con algo.
 * Medido: el pedido más largo de los ejemplos tiene 110 caracteres y un pedido detallado (oferta, a quién, tono) no
 * pasa de 300-400; 500 es ya un párrafo entero (80-90 palabras). Y un esquema pegado de renglones cortos («Hero /
 * Beneficios / Precio / …») es contenido aunque sea corto: de ahí los 5 renglones.
 */
export const TEXTO_LARGO_CARACTERES = 500;
export const TEXTO_LARGO_RENGLONES = 5;
export function esTextoLargo(t: string): boolean {
  const s = t.trim();
  if (s.length >= TEXTO_LARGO_CARACTERES) return true;
  return s.split(/\r?\n/).filter((r) => r.trim()).length >= TEXTO_LARGO_RENGLONES;
}

/** ¿Aparece la opción «Tu texto» (de guía / resumir / tal cual)? Con un texto largo o un archivo, y sin una acción de link. */
export function muestraTuTexto(e: EstadoCaja): boolean {
  if (e.link?.accion) return false;
  return !!e.archivo || esTextoLargo(e.texto);
}

/**
 * La línea corta que dice que la acción no usa lo escrito (Analizar y Replicar no aceptan instrucciones: la tanda 6
 * lo midió en sus rutas). Va ANTES de mandar, mientras sea cierto; null si no hay nada que avisar.
 */
export function avisoDeTexto(e: EstadoCaja): string | null {
  if (!e.link?.accion || !e.texto.trim()) return null;
  return e.link.accion === 'analizar' ? 'Analizar no usa tu texto.' : 'Replicar no usa tu texto.';
}

/** El placeholder quieto del campo (el ejemplo que se escribe solo sólo corre con el cuadro vacío). Corto. */
export function placeholderDe(e: EstadoCaja): string {
  if (e.link?.accion === 'analizar') return 'Listo para analizar';
  if (e.link?.accion === 'replicar') return 'Listo para replicar';
  if (e.archivo) return 'Qué hacer con el archivo (opcional)';
  if (e.link) return '¿Qué quieres crear con ella?';
  return '¿Qué quieres crear?';
}

/** ¿Se prende el ↑? `escritoLink`: lo tipeado en el contenedor del link. */
export function listoParaEnviar(e: EstadoCaja, escritoLink = ''): boolean {
  const v = vistaDeCaja(e);
  if (v === 'link') return !!linkEscrito(escritoLink);
  if (v === 'importar') return false;
  if (e.link) return true;
  if (e.archivo) return e.archivo.estado === 'listo';
  return !!e.texto.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se manda
// ─────────────────────────────────────────────────────────────────────────────

/** Cómo se genera (el desplegable «Plan»): el tipo de documento, Plan o Express, y los ajustes (con «Tu texto»). */
export type ComoGenerar = { tipo: TipoCrear; modo: 'plan' | 'express'; params: ParamsGeneracion };

export type Envio =
  | { que: 'nada' }
  /** Un link ESCRITO (en el contenedor, o solo en el texto): primero queda como chips, con su pastilla a la vista. */
  | { que: 'chips'; estado: EstadoCaja }
  | { que: 'accion'; accion: AccionCaja };

const unir = (...partes: (string | null | undefined)[]): string => partes.map((p) => (p ?? '').trim()).filter(Boolean).join(' ');

/**
 * El ↑ (o Enter). Qué se manda en cada caso:
 *   · un link con «Analiza esta landing»: el Diagnóstico de esa página; con «Replica esta landing»: Replicar en su
 *     formato (lo escrito no viaja: lo dice `avisoDeTexto`);
 *   · un archivo leído: «pegar» con el texto del archivo, y lo escrito (y el link de referencia) como instrucciones;
 *   · un texto LARGO: «pegar» con ese texto (y `params.modoTexto`, la opción «Tu texto»);
 *   · un pedido corto: «generar» con el pedido (y el link de referencia adelante, si quedó uno);
 *   · un link escrito y nada más: primero se vuelve chips (`que: 'chips'`), como si se hubiera pegado.
 * Los ajustes del desplegable «Plan» viajan siempre en `params`.
 */
export function alEnviar(e: EstadoCaja, c: ComoGenerar, escritoLink = ''): Envio {
  const v = vistaDeCaja(e);
  if (v === 'importar') return { que: 'nada' };
  if (v === 'link') {
    const url = linkEscrito(escritoLink);
    return url ? { que: 'chips', estado: conLink(e, url) } : { que: 'nada' };
  }
  const l = e.link;
  if (l?.accion === 'analizar') return { que: 'accion', accion: { que: 'analizar', url: l.url } };
  if (l?.accion === 'replicar') return { que: 'accion', accion: { que: 'replicar', url: l.url, formato: l.formato } };
  const base = { modo: c.modo, params: c.params };
  if (e.archivo) {
    if (e.archivo.estado !== 'listo') return { que: 'nada' };
    return { que: 'accion', accion: { que: 'ia', tipo: c.tipo, arranque: { ...base, prompt: unir(l?.url, e.texto), archivo: { nombre: e.archivo.nombre, texto: e.archivo.texto } } } };
  }
  if (!l) {
    const url = linkEscrito(e.texto);
    if (url) return { que: 'chips', estado: conLink({ ...e, texto: '' }, url) };
  }
  const pedido = l ? `${l.url}\n${e.texto.trim()}`.trim() : e.texto.trim();
  if (!pedido) return { que: 'nada' };
  if (esTextoLargo(e.texto)) return { que: 'accion', accion: { que: 'ia', tipo: c.tipo, arranque: { ...base, texto: pedido } } };
  return { que: 'accion', accion: { que: 'ia', tipo: c.tipo, arranque: { ...base, prompt: pedido } } };
}

// ─────────────────────────────────────────────────────────────────────────────
// La miniatura del archivo
// ─────────────────────────────────────────────────────────────────────────────

/** El rótulo y el ícono del tipo de archivo, para su miniatura en el cuadro (punto 6). */
export function tipoDeArchivo(nombre: string, mime = ''): { familia: FamiliaArchivo; etiqueta: string; icono: string } {
  const familia = familiaDeArchivo(nombre, mime);
  const ext = (nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '').toUpperCase();
  const t: Record<FamiliaArchivo, [string, string]> = {
    pdf: ['PDF', 'archivo'],
    docx: ['Word', 'texto-parrafo'],
    pptx: ['PowerPoint', 'presentar'],
    xlsx: ['Excel', 'tabla'],
    opendocument: [ext || 'Documento', 'archivo'],
    texto: [ext || 'Texto', 'texto-parrafo'],
    imagen: ['Imagen', 'imagen'],
    audio: ['Audio', 'microfono'],
    video: ['Video', 'video'],
    desconocido: [ext || 'Archivo', 'archivo'],
  };
  const [etiqueta, icono] = t[familia];
  return { familia, etiqueta, icono };
}

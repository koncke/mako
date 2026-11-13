// =============================================================================
// copywriter/operaciones — las HERRAMIENTAS con que MaKo escribe en el guion, y cómo se ve construyéndose (PURO)
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D5). mila.gg: el agente escribe en el documento por herramientas (su MCP:
// `update_document`, `append_to_document`). Acá, un catálogo CERRADO de operaciones sobre los bloques del guion, por id:
//   escribir_seccion   → el cuerpo de una sección (lo que hay entre su título y el de la próxima), entero;
//   reemplazar_bloque  → un bloque por uno o varios;
//   insertar_despues   → bloques nuevos después de uno (o al principio);
//   borrar_bloque      → saca un bloque;
//   titulo             → el título de la página;
//   propiedades        → ángulo, estructura y duración.
// La IA no escribe JSON de ProseMirror: escribe bloques simples (texto, títulos, listas, cita, destacado, divisor, tabla)
// y el código los convierte (`bloqueAJson`). ⚠️ La TABLA entró el 29/10/2026 (plantillas reales, docs/plantillas-reales/
// copywriter.md, trampa 2): sin ella, `escribir_seccion` sobre la HISTORIA del Reel, el CONTEXTO de las Stories, las SLIDES
// del Carrusel o los GANCHOS convertía la tabla en párrafos, sin un error. Lo que vuelve se valida acá (y otra vez en el navegador, contra lo de AHORA):
// un id que no existe, una operación que no está en el catálogo o un bloque sin texto se DESCARTAN con su motivo.
//
// «SE VE CONSTRUYÉNDOSE» (AGENTS.md, 28/10/2026): `cuadrosDeConstruccion` arma los cuadros que la pantalla pinta con un
// pequeño delay — cada operación en su orden, cada bloque nuevo apareciendo y su texto llenándose por partes. Lo que se
// muestra es lo que se armó, en el orden en que se armó: el último cuadro ES el resultado.
// =============================================================================

import { BID_RE, BLOQUES_DE_PRIMER_NIVEL, EMOJI_DESTACADO, NODOS, bidNuevo, esEtiqueta, parrafo, tituloDeSeccion } from './doc';
import type { JsonNodo, PropsGuion } from './tipos';

export const OPERACIONES_IA = ['escribir_seccion', 'reemplazar_bloque', 'insertar_despues', 'borrar_bloque', 'titulo', 'propiedades'] as const;
export type NombreOperacion = (typeof OPERACIONES_IA)[number];

export const TIPOS_BLOQUE_IA = ['texto', 'titulo1', 'titulo2', 'titulo3', 'cita', 'vinetas', 'numerada', 'tareas', 'destacado', 'separador', 'tabla'] as const;
export type TipoBloqueIA = (typeof TIPOS_BLOQUE_IA)[number];

/**
 * Un bloque de la IA. `bid` lo pone el SANEO (nunca la IA): con el id fijado una vez, aplicar las operaciones dos veces
 * (el resultado y los cuadros de la construcción) da los MISMOS ids, y lo que se marca como propuesta es lo que se ve.
 * Sin él, cada pasada inventaba ids nuevos y ninguna marca encontraba su bloque (medido en la maqueta, 28/10/2026).
 */
export type BloqueIA = (
  | { tipo: 'texto' | 'titulo1' | 'titulo2' | 'titulo3' | 'cita'; texto: string }
  | { tipo: 'vinetas' | 'numerada' | 'tareas'; items: string[] }
  | { tipo: 'destacado'; texto: string; emoji?: string }
  | { tipo: 'separador' }
  /** La primera fila es el encabezado. Todas las filas con el mismo ancho (el saneo completa las cortas). */
  | { tipo: 'tabla'; filas: string[][] }
) & { bid?: string };

export type OperacionIA =
  | { op: 'escribir_seccion'; seccion: string; bloques: BloqueIA[]; bidTitulo?: string }
  | { op: 'reemplazar_bloque'; bid: string; bloques: BloqueIA[] }
  | { op: 'insertar_despues'; bid: string | null; bloques: BloqueIA[] }
  | { op: 'borrar_bloque'; bid: string }
  | { op: 'titulo'; texto: string }
  | { op: 'propiedades'; angulo?: string | null; estructura?: string | null; duracion?: number | null };

export type Descartada = { op: string; motivo: string };

export const TOPES_OPS = { operaciones: 40, bloquesPorOp: 60, texto: 4_000, items: 30, columnas: 8, filas: 30, celda: 1_000 } as const;

const texto = (v: unknown, max: number = TOPES_OPS.texto): string => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');

/** Las filas de una tabla de la IA: hasta 8 columnas y 30 filas, cada celda hasta 1,000 caracteres, todas del mismo ancho. */
function filasDeTabla(raw: unknown): string[][] | null {
  const celda = (c: unknown) => (typeof c === 'number' && Number.isFinite(c) ? String(c) : texto(c, TOPES_OPS.celda));
  const filas = (Array.isArray(raw) ? raw : [])
    .filter((f): f is unknown[] => Array.isArray(f))
    .map((f) => f.slice(0, TOPES_OPS.columnas).map(celda))
    .filter((f) => f.some(Boolean))
    .slice(0, TOPES_OPS.filas);
  if (!filas.length) return null;
  const ancho = Math.max(...filas.map((f) => f.length));
  return filas.map((f) => [...f, ...Array<string>(ancho - f.length).fill('')]);
}

/** Un bloque de la IA, saneado; null si no sirve (sin texto, tipo desconocido). */
export function sanearBloqueIA(raw: unknown): BloqueIA | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const tipo = typeof o.tipo === 'string' ? o.tipo : '';
  if (!(TIPOS_BLOQUE_IA as readonly string[]).includes(tipo)) return null;
  if (tipo === 'separador') return { tipo: 'separador' };
  if (tipo === 'tabla') {
    const filas = filasDeTabla(o.filas);
    return filas ? { tipo, filas } : null;
  }
  if (tipo === 'vinetas' || tipo === 'numerada' || tipo === 'tareas') {
    const items = (Array.isArray(o.items) ? o.items : []).map((i) => texto(i, 1_000)).filter(Boolean).slice(0, TOPES_OPS.items);
    return items.length ? { tipo, items } : null;
  }
  const t = texto(o.texto);
  if (!t) return null;
  if (tipo === 'destacado') {
    const emoji = typeof o.emoji === 'string' && o.emoji.trim() && o.emoji.length <= 8 ? o.emoji : undefined;
    return { tipo, texto: t, ...(emoji ? { emoji } : {}) };
  }
  return { tipo: tipo as 'texto' | 'titulo1' | 'titulo2' | 'titulo3' | 'cita', texto: t };
}

/**
 * Una línea con `**negrita**` en nodos de texto con su marca (13/11/2026, en producción: las plantillas salían con «**Antes:**»,
 * «**Texto principal:**» con los asteriscos a la vista; el modelo escribe markdown aunque los bloques sean texto).
 */
const conNegritas = (linea: string): JsonNodo[] => linea.split(/(\*\*[^*\n]+?\*\*)/).filter(Boolean)
  .map((p) => (/^\*\*[^*\n]+\*\*$/.test(p) ? { type: NODOS.texto, text: p.slice(2, -2), marks: [{ type: 'bold' }] } : { type: NODOS.texto, text: p }));

/** Un texto con saltos de línea: párrafos con salto (hardBreak) adentro. */
const contenido = (t: string): JsonNodo[] => {
  const out: JsonNodo[] = [];
  t.split('\n').forEach((linea, i) => {
    if (i > 0) out.push({ type: NODOS.salto });
    if (linea) out.push(...conNegritas(linea));
  });
  return out;
};
const conContenido = (n: JsonNodo, t: string): JsonNodo => {
  const c = contenido(t);
  return c.length ? { ...n, content: c } : n;
};

/** Un bloque de la IA como nodo del documento, con un id nuevo. */
export function bloqueAJson(b: BloqueIA): JsonNodo {
  const bid = b.bid ?? bidNuevo();
  switch (b.tipo) {
    case 'texto': return conContenido({ type: NODOS.parrafo, attrs: { bid } }, b.texto);
    case 'titulo1': return conContenido({ type: NODOS.titulo, attrs: { level: 1, bid, seccion: null } }, b.texto);
    case 'titulo2': return conContenido({ type: NODOS.titulo, attrs: { level: 2, bid, seccion: null } }, b.texto);
    case 'titulo3': return conContenido({ type: NODOS.titulo, attrs: { level: 3, bid, seccion: null } }, b.texto);
    case 'cita': return { type: NODOS.cita, attrs: { bid }, content: [conContenido({ type: NODOS.parrafo }, b.texto)] };
    case 'destacado': return { type: NODOS.destacado, attrs: { emoji: b.emoji ?? EMOJI_DESTACADO, bid }, content: [conContenido({ type: NODOS.parrafo }, b.texto)] };
    case 'separador': return { type: NODOS.separador, attrs: { bid } };
    case 'vinetas':
    case 'numerada':
      return {
        type: b.tipo === 'vinetas' ? NODOS.vinetas : NODOS.numerada,
        attrs: b.tipo === 'numerada' ? { start: 1, bid } : { bid },
        content: b.items.map((i) => ({ type: NODOS.item, content: [conContenido({ type: NODOS.parrafo }, i)] })),
      };
    case 'tareas':
      return { type: NODOS.tareas, attrs: { bid }, content: b.items.map((i) => ({ type: NODOS.tarea, attrs: { checked: false }, content: [conContenido({ type: NODOS.parrafo }, i)] })) };
    case 'tabla':
      // La forma de las tablas de las plantillas (plantillas.ts): la primera fila con celdas de encabezado.
      return {
        type: NODOS.tabla, attrs: { bid },
        content: b.filas.map((f, i) => ({
          type: NODOS.fila,
          content: f.map((c) => ({ type: i === 0 ? NODOS.celdaTitulo : NODOS.celda, content: [conContenido({ type: NODOS.parrafo }, c)] })),
        })),
      };
  }
}

/** Sin tildes, para comparar una etiqueta con las del documento («SOLUCION» es «SOLUCIÓN»). */
const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * La etiqueta de la sección que nombró la IA, leída con tolerancia (12/11/2026, en producción: en la plantilla «Carrusel que se
 * guarda» MaKo dijo «Adapté el carrusel completo» y las TRES secciones se descartaron por «La sección no tiene una etiqueta
 * válida»; la página quedó con la tabla de láminas, el CTA y el pie vacíos). El GUION se le muestra como
 * «[bid] ## SECCIÓN SLIDES: Slides», y un modelo chico copia el renglón, la nombra en inglés («section») o en minúscula con tilde.
 * Se acepta: la clave `seccion` (o `section` / `etiqueta`), sin el «[id]», los «#», el «SECCIÓN» del principio ni lo que va
 * después de «:» o «(»; si así no es una etiqueta, la sección del documento que el texto nombra; y si trae el `bid` del título
 * de una sección, esa. Lo que siga sin ser una sección, se descarta como antes, con su motivo.
 */
export function etiquetaDeSeccion(o: Record<string, unknown>, doc: JsonNodo): string {
  const crudo = [o.seccion, o.section, o.etiqueta].find((v): v is string => typeof v === 'string' && !!v.trim()) ?? '';
  const delDoc = (doc.content ?? []).filter((b) => b.type === NODOS.titulo && esEtiqueta(b.attrs?.seccion)).map((b) => ({ etiqueta: b.attrs!.seccion as string, bid: b.attrs?.bid }));
  const limpio = crudo.toUpperCase().replace(/\[[^\]]*\]/g, ' ').replace(/#+/g, ' ').replace(/^\s*SECCI[OÓ]N\b/, ' ').split(/[:(]/)[0].replace(/\s+/g, ' ').trim();
  const igual = delDoc.find((d) => sinTildes(d.etiqueta) === sinTildes(limpio));
  if (igual) return igual.etiqueta;
  // Una o dos palabras válidas son una sección (nueva, si el documento no la tiene: «CTA MEDIO» no es «CTA»).
  if (esEtiqueta(limpio) && limpio.split(' ').length <= 2) return limpio;
  const nombrada = delDoc.find((d) => new RegExp(`(^|[^A-Z0-9])${sinTildes(d.etiqueta)}([^A-Z0-9]|$)`).test(sinTildes(crudo.toUpperCase())));
  if (nombrada) return nombrada.etiqueta;
  if (esEtiqueta(limpio)) return limpio;
  const bid = typeof o.bid === 'string' ? o.bid.trim() : '';
  return delDoc.find((d) => !!bid && d.bid === bid)?.etiqueta ?? '';
}

/** La etiqueta de la sección si ese bloque de primer nivel es su TÍTULO (un título 2 con su etiqueta), o null. */
function etiquetaDelTitulo(doc: JsonNodo, bid: string): string | null {
  const b = (doc.content ?? []).find((x) => x.attrs?.bid === bid);
  return b && b.type === NODOS.titulo && esEtiqueta(b.attrs?.seccion) ? (b.attrs!.seccion as string) : null;
}
const esTituloDeSeccion = (doc: JsonNodo, bid: string): boolean => etiquetaDelTitulo(doc, bid) != null;

/** Los bloques sin los títulos del principio que repiten el nombre de la sección («BOTÓN» en la sección BOTON). */
function sinTituloRepetido<T extends BloqueIA>(bloques: readonly T[], etiqueta: string): T[] {
  const igual = (t: string) => sinTildes(t.replace(/[:#*]/g, '').trim().toUpperCase()) === sinTildes(etiqueta);
  let i = 0;
  while (i < bloques.length && /^titulo[123]$/.test(bloques[i].tipo) && igual(String((bloques[i] as { texto?: string }).texto ?? ''))) i++;
  return bloques.slice(i);
}
/** El id del bloque de primer nivel anterior a ése (null = es el primero). */
function bloqueAnterior(doc: JsonNodo, bid: string): string | null {
  const c = doc.content ?? [];
  const i = c.findIndex((x) => x.attrs?.bid === bid);
  const prev = i > 0 ? c[i - 1].attrs?.bid : null;
  return typeof prev === 'string' ? prev : null;
}

/** Los ids de los bloques de primer nivel del documento. */
export const idsDelDoc = (doc: JsonNodo): Set<string> => new Set((doc.content ?? []).map((b) => b.attrs?.bid).filter((x): x is string => typeof x === 'string'));

/**
 * Las operaciones que devolvió la IA, saneadas contra el documento: lo que no está en el catálogo, un id que no existe,
 * una sección sin etiqueta válida o una operación sin bloques se descartan CON SU MOTIVO (la tarjeta lo dice; nada se
 * tira callado). `catalogo` son los ids que existen en la biblioteca (para las propiedades).
 */
export function sanearOperaciones(raw: unknown, doc: JsonNodo, catalogo: { angulos: ReadonlySet<string>; estructuras: ReadonlySet<string> }): { ops: OperacionIA[]; descartadas: Descartada[] } {
  const ops: OperacionIA[] = [];
  const descartadas: Descartada[] = [];
  const ids = idsDelDoc(doc);
  const lista = Array.isArray(raw) ? raw : [];
  if (lista.length > TOPES_OPS.operaciones) descartadas.push({ op: 'varias', motivo: `MaKo propuso ${lista.length} cambios; se toman los primeros ${TOPES_OPS.operaciones}.` });
  for (const r of lista.slice(0, TOPES_OPS.operaciones)) {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const op = typeof o.op === 'string' ? o.op : '';
    if (!(OPERACIONES_IA as readonly string[]).includes(op)) { descartadas.push({ op: op || '?', motivo: 'No es una herramienta del Copywriter.' }); continue; }
    // Cada bloque recibe acá su id, una sola vez (ver `BloqueIA`).
    const bloques = (Array.isArray(o.bloques) ? o.bloques : []).slice(0, TOPES_OPS.bloquesPorOp).map(sanearBloqueIA)
      .filter((b): b is BloqueIA => !!b).map((b) => ({ ...b, bid: bidNuevo() }));
    const bid = typeof o.bid === 'string' ? o.bid.trim() : '';
    switch (op) {
      case 'escribir_seccion': {
        const seccion = etiquetaDeSeccion(o, doc);
        if (!esEtiqueta(seccion)) { descartadas.push({ op, motivo: 'La sección no tiene una etiqueta válida.' }); continue; }
        // Sin un título que repita su nombre al principio del cuerpo (13/11/2026, en producción: «Botón» y abajo «BOTÓN»).
        const cuerpo = sinTituloRepetido(bloques, seccion);
        if (!cuerpo.length) { descartadas.push({ op, motivo: `La sección ${seccion} vino sin texto.` }); continue; }
        ops.push({ op, seccion, bloques: cuerpo, bidTitulo: bidNuevo() });
        continue;
      }
      case 'reemplazar_bloque':
      case 'insertar_despues': {
        const alPrincipio = op === 'insertar_despues' && (o.bid === null || bid === '');
        if (!alPrincipio && (!BID_RE.test(bid) || !ids.has(bid))) { descartadas.push({ op, motivo: 'Apunta a un bloque que no está en el guion.' }); continue; }
        if (!bloques.length) { descartadas.push({ op, motivo: 'Vino sin texto.' }); continue; }
        // El TÍTULO de una sección no se reemplaza (13/11/2026, en producción, la plantilla PAS: MaKo puso el destacado «🧪 Para:…»
        // reemplazando el título GANCHO; la sección desapareció, su guía quedó huérfana arriba y el Gancho se agregó al final). Lo
        // que trae va ANTES del título, que queda; la sección se escribe con escribir_seccion.
        // Y si lo que trae EMPIEZA con ese mismo título (en producción, «Copy de anuncio: 3 ángulos»: «TEXTO PRINCIPAL» y el texto
        // debajo, en lugar del título de la sección), es reescribir esa sección.
        const etiqueta = op === 'reemplazar_bloque' ? etiquetaDelTitulo(doc, bid) : null;
        if (etiqueta) {
          const cuerpo = sinTituloRepetido(bloques, etiqueta);
          if (cuerpo.length < bloques.length) {
            if (cuerpo.length) ops.push({ op: 'escribir_seccion', seccion: etiqueta, bloques: cuerpo, bidTitulo: bidNuevo() });
            continue;
          }
          ops.push({ op: 'insertar_despues', bid: bloqueAnterior(doc, bid), bloques });
          continue;
        }
        ops.push(op === 'reemplazar_bloque' ? { op, bid, bloques } : { op, bid: alPrincipio ? null : bid, bloques });
        continue;
      }
      case 'borrar_bloque':
        if (!BID_RE.test(bid) || !ids.has(bid)) { descartadas.push({ op, motivo: 'Apunta a un bloque que no está en el guion.' }); continue; }
        if (esTituloDeSeccion(doc, bid)) { descartadas.push({ op, motivo: 'Es el título de una sección: no se borra (la sección se reescribe entera).' }); continue; }
        ops.push({ op, bid });
        continue;
      case 'titulo': {
        const t = texto(o.texto, 200).replace(/\s+/g, ' ');
        if (!t) { descartadas.push({ op, motivo: 'Vino sin título.' }); continue; }
        ops.push({ op, texto: t });
        continue;
      }
      case 'propiedades': {
        const p: Extract<OperacionIA, { op: 'propiedades' }> = { op: 'propiedades' };
        if (typeof o.angulo === 'string' && catalogo.angulos.has(o.angulo)) p.angulo = o.angulo;
        if (typeof o.estructura === 'string' && catalogo.estructuras.has(o.estructura)) p.estructura = o.estructura;
        const d = typeof o.duracion === 'number' && Number.isFinite(o.duracion) ? Math.round(o.duracion) : null;
        if (d != null && d > 0 && d <= 7_200) p.duracion = d;
        if (Object.keys(p).length === 1) { descartadas.push({ op, motivo: 'Ninguna propiedad existe en la biblioteca.' }); continue; }
        ops.push(p);
        continue;
      }
    }
  }
  return { ops, descartadas };
}

/** Una copia profunda (el documento de la pantalla no se toca). */
const copia = (d: JsonNodo): JsonNodo => JSON.parse(JSON.stringify(d)) as JsonNodo;
const esSeccion = (b: JsonNodo) => b.type === NODOS.titulo && esEtiqueta(b.attrs?.seccion);
/** Un párrafo sin texto (el renglón con que nace una página vacía). */
const parrafoVacio = (b: JsonNodo) => b.type === 'paragraph' && !JSON.stringify(b.content ?? []).match(/"text":"[^"]*\S/);

/** Aplica UNA operación al documento. Devuelve el documento nuevo, los ids de lo que escribió y, si no pudo, el motivo. */
export function aplicarOperacion(doc: JsonNodo, op: OperacionIA): { doc: JsonNodo; nuevos: string[]; motivo?: string } {
  const d = copia(doc);
  const content = d.content ?? (d.content = []);
  const indice = (bid: string) => content.findIndex((b) => b.attrs?.bid === bid);
  switch (op.op) {
    case 'escribir_seccion': {
      const nodos = op.bloques.map(bloqueAJson);
      const h = content.findIndex((b) => esSeccion(b) && b.attrs?.seccion === op.seccion);
      if (h < 0) {
        // Una sección que el guion no tiene: va al final, con su título.
        const titulo = tituloDeSeccion(op.seccion);
        if (op.bidTitulo) titulo.attrs = { ...titulo.attrs, bid: op.bidTitulo };
        // En una página que todavía no tiene nada (la de «Replicar» nace con un renglón vacío), lo escrito ocupa su lugar: si no,
        // quedaba arriba un renglón con «Escribe "/" para ver los comandos…» (11/11/2026, en producción).
        if (content.length && content.every(parrafoVacio)) content.splice(0, content.length);
        content.push(titulo, ...nodos);
        return { doc: d, nuevos: [titulo.attrs!.bid as string, ...nodos.map((n) => n.attrs!.bid as string)] };
      }
      let fin = h + 1;
      while (fin < content.length && !esSeccion(content[fin])) fin++;
      content.splice(h + 1, fin - h - 1, ...nodos);
      return { doc: d, nuevos: nodos.map((n) => n.attrs!.bid as string) };
    }
    case 'reemplazar_bloque': {
      const i = indice(op.bid);
      if (i < 0) return { doc, nuevos: [], motivo: 'El bloque ya no está en el guion.' };
      const nodos = op.bloques.map(bloqueAJson);
      content.splice(i, 1, ...nodos);
      return { doc: d, nuevos: nodos.map((n) => n.attrs!.bid as string) };
    }
    case 'insertar_despues': {
      const i = op.bid == null ? -1 : indice(op.bid);
      if (op.bid != null && i < 0) return { doc, nuevos: [], motivo: 'El bloque ya no está en el guion.' };
      const nodos = op.bloques.map(bloqueAJson);
      content.splice(i + 1, 0, ...nodos);
      return { doc: d, nuevos: nodos.map((n) => n.attrs!.bid as string) };
    }
    case 'borrar_bloque': {
      const i = indice(op.bid);
      if (i < 0) return { doc, nuevos: [], motivo: 'El bloque ya no está en el guion.' };
      content.splice(i, 1);
      if (!content.length) content.push(parrafo());
      return { doc: d, nuevos: [] };
    }
    default:
      return { doc: d, nuevos: [] };
  }
}

export type ResultadoOps = {
  doc: JsonNodo;
  /** Los ids de todo lo que escribió MaKo, en orden (lo que la pantalla marca como propuesta). */
  nuevos: string[];
  titulo: string | null;
  props: Partial<Pick<PropsGuion, 'angulo' | 'estructura' | 'duracion'>>;
  descartadas: Descartada[];
};

/** Aplica todas, en orden. Una que apunta a algo que borró una anterior se descarta con su motivo. */
export function aplicarTodo(doc: JsonNodo, ops: readonly OperacionIA[]): ResultadoOps {
  let actual = doc;
  const nuevos: string[] = [];
  const descartadas: Descartada[] = [];
  let titulo: string | null = null;
  const props: ResultadoOps['props'] = {};
  for (const op of ops) {
    if (op.op === 'titulo') { titulo = op.texto; continue; }
    if (op.op === 'propiedades') {
      if (op.angulo !== undefined) props.angulo = op.angulo;
      if (op.estructura !== undefined) props.estructura = op.estructura;
      if (op.duracion !== undefined) props.duracion = op.duracion;
      continue;
    }
    const r = aplicarOperacion(actual, op);
    if (r.motivo) { descartadas.push({ op: op.op, motivo: r.motivo }); continue; }
    actual = r.doc;
    nuevos.push(...r.nuevos);
  }
  const vivos = idsDelDoc(actual);
  return { doc: actual, nuevos: nuevos.filter((b) => vivos.has(b)), titulo, props, descartadas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Construyéndose
// ─────────────────────────────────────────────────────────────────────────────

/** El largo del texto de un nodo (lo que se va llenando). */
function largo(n: JsonNodo): number {
  if (n.type === NODOS.texto) return (n.text ?? '').length;
  return (n.content ?? []).reduce((s, h) => s + largo(h), 0);
}

/**
 * El bloque con su texto cortado a la fracción `f` (0..1), en un borde de palabra: lo que se ve mientras MaKo «escribe».
 * La forma del bloque queda entera (la lista con todos sus ítems, el destacado con su emoji); lo que crece es el texto.
 */
export function truncarBloque(b: JsonNodo, f: number): JsonNodo {
  if (f >= 1) return b;
  const total = largo(b);
  let resta = Math.ceil(total * Math.max(0, f));
  const cortar = (n: JsonNodo): JsonNodo | null => {
    if (n.type === NODOS.texto) {
      const t = n.text ?? '';
      if (resta <= 0) return null;
      if (t.length <= resta) { resta -= t.length; return n; }
      const corte = t.lastIndexOf(' ', resta);
      const parte = t.slice(0, corte > 0 ? corte : resta);
      resta = 0;
      return parte ? { ...n, text: parte } : null;
    }
    if (!n.content) return n;
    const hijos = n.content.map(cortar).filter((h): h is JsonNodo => !!h);
    return { ...n, content: hijos };
  };
  const r = cortar(b) ?? { ...b, content: [] };
  // Un contenedor sin hijos rompería el esquema: lo vacío queda como el bloque sin texto adentro.
  return reponerVacios(r);
}

/** Los contenedores que quedaron sin hijos al cortar, con lo mínimo que pide el esquema. */
function reponerVacios(n: JsonNodo): JsonNodo {
  if (n.type === NODOS.texto || n.type === NODOS.salto) return n;
  const hijos = (n.content ?? []).map(reponerVacios);
  const out: JsonNodo = { ...n, content: hijos };
  if (n.type === NODOS.parrafo || n.type === NODOS.titulo) {
    if (!hijos.length) delete out.content;
    return out;
  }
  if (!hijos.length && n.type !== NODOS.separador) out.content = [{ type: NODOS.parrafo }];
  if (n.type === NODOS.separador) delete out.content;
  return out;
}

/** Cuánto se llena un bloque por cuadro: un tercio, dos tercios, entero. */
export const PASOS_POR_BLOQUE = [0.34, 0.67, 1] as const;
/** El tope de cuadros: un guion largo no puede tardar minutos (la regla: segundos, no minutos). */
export const TOPE_CUADROS = 90;

/**
 * Los cuadros de la construcción, del primero al último (que es el resultado de `aplicarTodo`). Por cada operación, en
 * orden: sus bloques nuevos aparecen de a uno y su texto crece en `PASOS_POR_BLOQUE`; lo que la operación saca, se va en
 * su primer cuadro. Si los cuadros pasan el tope, cada bloque aparece entero (sin los pasos del medio).
 */
export function cuadrosDeConstruccion(antes: JsonNodo, ops: readonly OperacionIA[]): JsonNodo[] {
  const armar = (pasos: readonly number[]) => {
    const cuadros: JsonNodo[] = [];
    let actual = antes;
    for (const op of ops) {
      if (op.op === 'titulo' || op.op === 'propiedades') continue;
      const r = aplicarOperacion(actual, op);
      if (r.motivo) continue;
      const nuevos = new Set(r.nuevos);
      if (!r.nuevos.length) { cuadros.push(r.doc); actual = r.doc; continue; }
      r.nuevos.forEach((bid, j) => {
        const posteriores = new Set(r.nuevos.slice(j + 1));
        for (const f of pasos) {
          cuadros.push({
            ...r.doc,
            content: (r.doc.content ?? []).filter((b) => !posteriores.has(b.attrs?.bid as string))
              .map((b) => (b.attrs?.bid === bid && nuevos.has(bid) ? truncarBloque(b, f) : b)),
          });
        }
      });
      actual = r.doc;
    }
    return cuadros;
  };
  const conPasos = armar(PASOS_POR_BLOQUE);
  if (conPasos.length <= TOPE_CUADROS) return conPasos;
  const enteros = armar([1]);
  if (enteros.length <= TOPE_CUADROS) return enteros;
  // Todavía muchos: se toman cuadros salteados, parejos, y el último siempre (es el resultado).
  const paso = enteros.length / TOPE_CUADROS;
  const out: JsonNodo[] = [];
  for (let i = 1; i <= TOPE_CUADROS; i++) out.push(enteros[Math.min(enteros.length - 1, Math.round(i * paso) - 1)]);
  return out;
}

/** ¿Este nodo es un bloque de primer nivel con id? (lo que se marca como propuesta) */
export const esBloqueConId = (n: JsonNodo) => BLOQUES_DE_PRIMER_NIVEL.has(n.type) && typeof n.attrs?.bid === 'string';

// =============================================================================
// diff-tarjetas — qué SECCIONES cambia una propuesta de la IA, y cómo se aplica (puro)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». En Gamma 5, lo que
// propone el agente se ve con el toggle «Original | Modificado» y se acepta o se
// descarta entero (docs/diseno-editor-landing.md, D5 y el relevo gamma-ui §5.11). Este
// módulo es lo que la pantalla necesita saber de esa propuesta ANTES de tocar el
// documento: qué secciones se agregan, cuáles cambian (con un pedazo de texto de antes
// y de después) y cuáles se quitan, y en qué orden se aplica.
//
// Lo usan el panel del agente (paneles/PanelAgente.tsx) y el popover de una sección
// (AskAgent.tsx). PURO: sin React, sin DOM, sin fetch; lo prueba
// tests/editor-landing-agente.test.ts.
//
// ⚠️ La respuesta de `editar` (lib/editor-landing/ia.ts) trae SOLO las secciones que
//    cambian: las que ya existían con su id de siempre y las nuevas con un id que no es
//    de ninguna mandada, en el orden en que volvieron. NO dice dónde va una nueva. La
//    regla de acá: una nueva va después de la sección EXISTENTE que la precede en la
//    respuesta; si ninguna la precede, después del ancla que diga quien llama (la
//    sección del popover) o al final. Así «agregá una de preguntas frecuentes al final»
//    queda al final, y una sección partida en dos queda pegada a la suya.
// =============================================================================

import { NODO, nuevoId, textoDe, tituloDeTarjeta, type JsonNodo } from '@/lib/editor-landing/doc';
import { idTarjetaConFormulario, resolverAnclas } from '@/lib/editor-landing/ia-bloques';

/** El motivo de la versión que se guarda ANTES de aplicar un cambio de la IA (D8). */
export const MOTIVO_ANTES_DE_IA = 'Antes de un cambio de IA';

/** El id de una sección, o '' si no tiene (no debería pasar: lo garantiza el saneo). */
export function idDe(t: JsonNodo | null | undefined): string {
  const id = t?.attrs?.id;
  return typeof id === 'string' ? id : '';
}

/** Las secciones de un documento de TipTap (`editor.getJSON()`), o de cualquier JSON que lo parezca. */
export function tarjetasDelDoc(json: unknown): JsonNodo[] {
  const content = json && typeof json === 'object' ? (json as { content?: unknown }).content : null;
  if (!Array.isArray(content)) return [];
  return content.filter((n): n is JsonNodo => !!n && typeof n === 'object' && (n as JsonNodo).type === NODO.tarjeta);
}

/**
 * Las anclas que la IA deja PENDIENTES en una propuesta (`#t-formulario`, `#t-seccion-N`: cada
 * sección se convierte sola en el server) resueltas contra lo que va a QUEDAR: el formulario se
 * busca en la página con la propuesta aplicada (puede estar en una sección que no se mandó), y
 * «la sección N» es la N de lo que se le MANDÓ a la IA (es la lista que vio). Sin esto, un botón
 * al formulario de una sección editada sola quedaba apuntando a `#t-formulario`, que no lleva a
 * ningún lado. No muta la entrada.
 */
export function anclasResueltas(
  propuestas: readonly JsonNodo[],
  enviadas: readonly JsonNodo[],
  actuales: readonly JsonNodo[],
): JsonNodo[] {
  const porId = new Map(propuestas.map((p) => [idDe(p), p] as const));
  const existentes = new Set(actuales.map(idDe));
  const finales = [...actuales.map((a) => porId.get(idDe(a)) ?? a), ...propuestas.filter((p) => !existentes.has(idDe(p)))];
  return resolverAnclas([...propuestas], { ids: enviadas.map(idDe), formularioId: idTarjetaConFormulario(finales) });
}

/**
 * Una huella estable de una sección: el JSON con las claves ordenadas. Dos secciones con la
 * misma huella son la misma (TipTap no garantiza el orden de las claves de `attrs`, y un
 * `JSON.stringify` pelado diría «cambió» sobre una sección intacta).
 */
export function huella(n: unknown): string {
  if (Array.isArray(n)) return '[' + n.map(huella).join(',') + ']';
  if (n && typeof n === 'object') {
    const o = n as Record<string, unknown>;
    return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + huella(o[k])).join(',') + '}';
  }
  return JSON.stringify(n ?? null);
}

/** El texto de una sección en una sola línea (para comparar y resumir). */
export function textoPlano(t: JsonNodo): string {
  return textoDe(t, ' ').replace(/\s+/g, ' ').trim();
}

/** Corta en palabra y agrega «…». */
export function recortar(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const esp = corte.lastIndexOf(' ');
  return (esp > max * 0.6 ? corte.slice(0, esp) : corte).trimEnd() + '…';
}

/**
 * El pedazo que de verdad cambió entre dos textos: se sacan las palabras iguales del
 * principio y del final y se dejan `contexto` palabras de cada lado. Sin esto, «Cambia:
 * antes / después» mostraría los primeros 120 caracteres de dos textos que empiezan
 * igual, y no se vería qué cambió.
 */
export function fragmentoDistinto(antes: string, despues: string, contexto = 4, max = 140): { antes: string; despues: string } {
  const a = antes.split(/\s+/).filter(Boolean);
  const b = despues.split(/\s+/).filter(Boolean);
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let fa = a.length;
  let fb = b.length;
  while (fa > ini && fb > ini && a[fa - 1] === b[fb - 1]) { fa--; fb--; }
  const desde = Math.max(0, ini - contexto);
  const corta = (ws: string[], fin: number) => {
    const hasta = Math.min(ws.length, fin + contexto);
    const cuerpo = ws.slice(desde, hasta).join(' ');
    return recortar((desde > 0 ? '…' : '') + cuerpo + (hasta < ws.length ? '…' : ''), max);
  };
  return { antes: corta(a, fa), despues: corta(b, fb) };
}

export type CambioSeccion =
  | { tipo: 'agrega'; id: string; titulo: string; texto: string }
  | { tipo: 'cambia'; id: string; titulo: string; antes: string; despues: string; soloDiseno: boolean }
  | { tipo: 'quita'; id: string; titulo: string };

export type DiffTarjetas = {
  /** En el orden de la lista NUEVA; las quitadas, al final en su orden de antes. */
  cambios: CambioSeccion[];
  agregadas: number;
  cambiadas: number;
  quitadas: number;
  iguales: number;
};

/** El título que se muestra de una sección: su primer título, o «Sin título». */
export function tituloVisible(t: JsonNodo): string {
  return recortar(tituloDeTarjeta(t), 60) || 'Sin título';
}

/**
 * Compara dos listas de secciones POR ID. Una sección sin id (no debería existir) se
 * identifica por su posición, para no fundir dos distintas en una.
 * Un id repetido en la lista nueva vale la primera vez; las siguientes cuentan como
 * agregadas (en el documento serían dos secciones, y así se ven).
 */
export function diffTarjetas(antes: readonly JsonNodo[], despues: readonly JsonNodo[]): DiffTarjetas {
  const clave = (t: JsonNodo, i: number, lado: string) => idDe(t) || `${lado}#${i}`;
  const previas = new Map<string, JsonNodo>();
  antes.forEach((t, i) => { const k = clave(t, i, 'a'); if (!previas.has(k)) previas.set(k, t); });
  const vistas = new Set<string>();
  const cambios: CambioSeccion[] = [];
  let iguales = 0;

  despues.forEach((t, i) => {
    const k = clave(t, i, 'b');
    const previa = previas.get(k);
    if (!previa || vistas.has(k)) {
      cambios.push({ tipo: 'agrega', id: idDe(t), titulo: tituloVisible(t), texto: recortar(textoPlano(t), 140) });
      return;
    }
    vistas.add(k);
    if (huella(previa) === huella(t)) { iguales++; return; }
    const ta = textoPlano(previa);
    const tb = textoPlano(t);
    const soloDiseno = ta === tb;
    const f = soloDiseno ? { antes: '', despues: '' } : fragmentoDistinto(ta, tb);
    cambios.push({ tipo: 'cambia', id: idDe(t), titulo: tituloVisible(t), antes: f.antes, despues: f.despues, soloDiseno });
  });

  antes.forEach((t, i) => {
    const k = clave(t, i, 'a');
    if (!vistas.has(k) && previas.get(k) === t) cambios.push({ tipo: 'quita', id: idDe(t), titulo: tituloVisible(t) });
  });

  return {
    cambios,
    agregadas: cambios.filter((c) => c.tipo === 'agrega').length,
    cambiadas: cambios.filter((c) => c.tipo === 'cambia').length,
    quitadas: cambios.filter((c) => c.tipo === 'quita').length,
    iguales,
  };
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Una línea corta: «Cambia 2 secciones · agrega 1». Vacío si no hay cambios. */
export function resumenDeCambios(d: DiffTarjetas): string {
  const partes: string[] = [];
  if (d.cambiadas) partes.push(`cambia ${plural(d.cambiadas, 'sección', 'secciones')}`);
  if (d.agregadas) partes.push(`agrega ${partes.length ? d.agregadas : plural(d.agregadas, 'sección', 'secciones')}`);
  if (d.quitadas) partes.push(`quita ${partes.length ? d.quitadas : plural(d.quitadas, 'sección', 'secciones')}`);
  const s = partes.join(' · ');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

export type Insercion = { despuesDe: string | null; tarjetas: JsonNodo[] };
export type PlanAplicacion = {
  /** Las que ya existen en el documento: se reemplazan por id (`reemplazarTarjetas`). */
  reemplazos: JsonNodo[];
  /** Las nuevas, agrupadas por la sección después de la cual van (`insertarTarjetas`). */
  inserciones: Insercion[];
  /** Cómo queda la lista de secciones si se aplica (para el diff y la vista «Modificado»). */
  resultado: JsonNodo[];
};

/**
 * Parte una propuesta en lo que se REEMPLAZA y lo que se INSERTA (y dónde), y simula el
 * resultado. Ver la cabecera: una nueva va después de la existente que la precede en la
 * propuesta; si no hay, después de `anclaNuevas` (si existe en el documento) o al final.
 * `despuesDe: null` sólo cuando el documento no tiene ninguna sección.
 */
export function planDeAplicacion(
  actuales: readonly JsonNodo[],
  propuestas: readonly JsonNodo[],
  op: { anclaNuevas?: string | null } = {},
): PlanAplicacion {
  const existentes = new Set(actuales.map(idDe).filter(Boolean));
  const reemplazos: JsonNodo[] = [];
  const inserciones: Insercion[] = [];
  const usados = new Set<string>();
  const anclaPorDefecto = op.anclaNuevas && existentes.has(op.anclaNuevas)
    ? op.anclaNuevas
    : (actuales.length ? idDe(actuales[actuales.length - 1]) || null : null);

  let ultimaExistente: string | null = null;
  let grupo: Insercion | null = null;
  for (const t of propuestas) {
    const id = idDe(t);
    if (id && existentes.has(id) && !usados.has(id)) {
      usados.add(id);
      reemplazos.push(t);
      ultimaExistente = id;
      grupo = null;
      continue;
    }
    const despuesDe = ultimaExistente ?? anclaPorDefecto;
    if (!grupo || grupo.despuesDe !== despuesDe) {
      grupo = { despuesDe, tarjetas: [] };
      inserciones.push(grupo);
    }
    grupo.tarjetas.push(t);
  }

  const porId = new Map(reemplazos.map((t) => [idDe(t), t] as const));
  const resultado: JsonNodo[] = [];
  for (const t of actuales) {
    const id = idDe(t);
    resultado.push(porId.get(id) ?? t);
    for (const g of inserciones) if (g.despuesDe && g.despuesDe === id) resultado.push(...g.tarjetas);
  }
  for (const g of inserciones) if (!g.despuesDe) resultado.push(...g.tarjetas);

  return { reemplazos, inserciones, resultado };
}

/**
 * Para «agregar una sección» desde el popover: TODO lo que vuelva es una sección NUEVA
 * que va después de `base`.
 *
 * ⚠️ Hace falta porque `editar` con una sola sección mandada empareja la primera que vuelve
 *    sin id conocido con esa sección (`emparejarEdicion`, lib/editor-landing/ia-reglas.ts:
 *    «si se mandó una sola, lo que vuelve es ella»). Sin esto, «agregá una sección después de
 *    ésta» REEMPLAZARÍA la sección. Lo que se hereda de la base por ese emparejamiento se
 *    limpia: las notas del orador (son de la otra) y la imagen de acento si es la misma foto.
 */
export function comoSeccionesNuevas(propuestas: readonly JsonNodo[], base: JsonNodo, crearId: () => string = () => nuevoId('t')): JsonNodo[] {
  const ocupados = new Set<string>([idDe(base)]);
  const fotoBase = base.attrs?.imagenSrc ?? null;
  return propuestas.map((t) => {
    const attrs: Record<string, unknown> = { ...(t.attrs ?? {}) };
    let id = typeof attrs.id === 'string' ? attrs.id : '';
    if (!id || ocupados.has(id)) id = crearId();
    ocupados.add(id);
    attrs.id = id;
    if (attrs.notas === base.attrs?.notas) attrs.notas = '';
    if (fotoBase && attrs.imagenSrc === fotoBase) { attrs.imagenSrc = null; attrs.diseno = 'sin'; }
    return { ...t, attrs };
  });
}

/**
 * Las secciones que se tocaron en el documento DESPUÉS de mandarlas a la IA: aceptar el
 * reemplazo pisa esa edición. La pantalla lo avisa (la versión «Antes de un cambio de IA»
 * igual la guarda).
 */
export function tocadasDesde(enviadas: readonly JsonNodo[], actuales: readonly JsonNodo[], ids: readonly string[]): string[] {
  const antes = new Map(enviadas.map((t) => [idDe(t), huella(t)] as const));
  const ahora = new Map(actuales.map((t) => [idDe(t), huella(t)] as const));
  return ids.filter((id) => antes.has(id) && ahora.has(id) && antes.get(id) !== ahora.get(id));
}

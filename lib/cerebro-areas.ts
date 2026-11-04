// =============================================================================
// cerebro-areas — lo que el mapa de escritorio y el teléfono LEEN IGUAL de un Cerebro
// =============================================================================
// DATOS PUROS, como lib/cerebro-modelo.ts: sin `server-only`, sin 'use client' y sin nada
// que arrastre al bundle. Existe porque estas reglas vivían ADENTRO de
// app/second-brain/Grafo.tsx (un módulo 'use client' de 1.966 líneas) y el Second Brain del
// teléfono (app/m/second-brain) necesita las mismas: cuántos datos tiene cada área, qué nodo
// es estructura y no un dato, de qué color se pinta cada punto y qué documento se puede mirar.
// La regla de AGENTS.md («lo que se reusa de escritorio no puede vivir en un módulo use client:
// se muda a lib y escritorio lo re-exporta, nunca una copia en /m»).
//
// Grafo.tsx las importa (porArea, grados, rellenoDe, urlPreview, esImagen y sePuedeVer salen de
// acá desde el 15/10/2026): tests/m-second-brain.test.ts falla si vuelve a tener su copia.
// =============================================================================

import { TAXONOMIA_NEGOCIO, type AreaId, type AristaCerebro, type NodoCerebro, type Taxonomia } from './cerebro-modelo';

/** La raíz (el negocio), una carpeta madre (`n1:`) o la caja de un área (`area:`): no son DATOS. */
export function esEstructura(n: Pick<NodoCerebro, 'id'>): boolean {
  return n.id === 'raiz' || n.id.startsWith('n1:') || n.id.startsWith('area:');
}

/**
 * Cuántos datos REALES tiene cada área. No cuenta la estructura ni los pendientes: un «3 datos»
 * que incluye lo que falta miente sobre lo que hay (la regla de la columna «Tu negocio» del mapa).
 * Un área sin datos no aparece: quien dibuja escribe «falta», nunca un 0.
 */
export function contarPorArea<A extends string = AreaId>(nodos: readonly NodoCerebro<A>[]): Partial<Record<A, number>> {
  const c: Partial<Record<A, number>> = {};
  for (const n of nodos) {
    if (esEstructura(n) || n.autoria === 'pendiente') continue;
    c[n.area] = (c[n.area] ?? 0) + 1;
  }
  return c;
}

/**
 * Las carpetas de la barra lateral del grafo, cada una con SUS áreas que tienen algún dato (22/10/2026, Martín desde el
 * Centro, pedido 4a15e2c3: «no quiero ningún item de "falta" en la sidebar... simplemente si no lo tiene ese dato, que no
 * lo muestre»). Un área sin datos no aparece, y una carpeta que se queda sin áreas tampoco (su título solo no dice nada).
 * En el orden de la taxonomía.
 */
export function carpetasConDatos<C extends { id: string }, Ar extends { id: string; padre: string }>(
  tax: { carpetas: readonly C[]; areas: readonly Ar[] }, porArea: Partial<Record<string, number>>,
): Array<{ carpeta: C; suyas: Ar[] }> {
  return tax.carpetas
    .map((carpeta) => ({ carpeta, suyas: tax.areas.filter((a) => a.padre === carpeta.id && (porArea[a.id] ?? 0) > 0) }))
    .filter((x) => x.suyas.length > 0);
}

/** Cuántas aristas toca cada nodo (el «más conectado» va primero en una búsqueda). */
export function gradosDe(nodos: readonly (Pick<NodoCerebro<string>, 'id'> & { peso?: number })[], aristas: readonly AristaCerebro[]): Record<string, number> {
  const g: Record<string, number> = {};
  for (const n of nodos) g[n.id] = 0;
  for (const a of aristas) { if (a.de in g) g[a.de]++; if (a.a in g) g[a.a]++; }
  // El `peso` es un PISO (lib/cerebro-modelo.ts): la raíz y los módulos de un curso se ven grandes con pocas aristas.
  for (const n of nodos) if (typeof n.peso === 'number' && n.peso > g[n.id]) g[n.id] = n.peso;
  return g;
}

/** El color de un área en una taxonomía (la del negocio por defecto). Un área que no está, el gris de la barra. */
export const colorDeArea = (id: string, tax: Taxonomia = TAXONOMIA_NEGOCIO): string =>
  tax.areas.find((a) => a.id === id)?.color ?? 'var(--sidebar-text)';

/** El color del punto: la raíz en tinta, el cuello de botella en naranja, el Norte en dorado; el resto, el de su área. */
export function rellenoNodo(n: Pick<NodoCerebro<string>, 'id' | 'area' | 'alerta' | 'destacado'>, tax: Taxonomia = TAXONOMIA_NEGOCIO): string {
  if (n.id === 'raiz') return 'var(--ink)';
  if (n.alerta) return 'var(--warn-fill)';
  if (n.destacado) return 'var(--mako)';
  return colorDeArea(n.area, tax);
}

/** El «todavía no existe»: el mismo punto, más apagado. Nunca un aro punteado. */
export const OPACIDAD_PENDIENTE = 0.5;

export const esImagenDocumento = (mime?: string | null): boolean => !!mime && mime.startsWith('image/');

/** Qué se puede mostrar en el navegador. Un .docx o un .xlsx se bajan: un «Ver» sobre ellos abre un visor vacío. */
export const sePuedeVerDocumento = (mime?: string | null): boolean =>
  esImagenDocumento(mime) || (!!mime && (mime.includes('pdf') || mime.startsWith('text/')));

/**
 * La ruta que redirige a una URL firmada para MIRAR un documento del Archivero (`doc:<id>`).
 * SIN el `?ws=`: lo pega quien la usa (`conWs`), porque un `<iframe>` o un `<a target=_blank>` no
 * pasan por el parche de fetch, y el super-admin mirando a un cliente recibiría «Archivo no encontrado».
 */
export function rutaVistaDocumento(idNodo: string): string {
  const id = idNodo.startsWith('doc:') ? idNodo.slice(4) : idNodo;
  return `/api/onboarding/archivero/download?id=${encodeURIComponent(id)}&preview=1`;
}

/**
 * Qué CLASE de cosa es un nodo, en una o dos palabras: el *supertag* de Tana. Lo dicen la barra lateral del grafo y la
 * hoja del teléfono, arriba del título. Gana el `tipo` que trae el nodo; si no lo trae, sale del prefijo de su id
 * (lib/cerebro-grafo.ts arma los ids así desde siempre). Nunca vacío: lo desconocido es «Dato».
 */
const TIPO_FIJO: Record<string, string> = {
  raiz: 'Tu negocio', fase: 'Fase del negocio', cuello: 'Cuello de botella', canal: 'Canal de venta', objetivo: 'Objetivo',
  voz: 'Voz de marca', persona: 'Cara de marca', vozcom: 'Voz comercial', glosario: 'Vocabulario',
  leads: 'Leads', chats: 'Chats con MaKo',
};
const TIPO_POR_PREFIJO: ReadonlyArray<readonly [string, string]> = [
  ['doc:', 'Documento'], ['pan:', 'Resumen'], ['campo:', 'Dato del negocio'], ['prod:', 'Producto'],
  ['ent:', 'Lead magnet'], ['av:', 'Avatar'], ['raz:', 'Razón de compra'], ['fmt:', 'Formato de anuncio'],
  ['etapa:', 'Etapa del funnel'], ['sec:', 'Nutrición'], ['land:', 'Landing'], ['audio:', 'Audio'],
  ['oferta:', 'Oferta'], ['lm:', 'Lead magnet'], ['funnel:', 'Funnel'], ['okr:', 'Objetivo'], ['kpi:', 'KPI'],
  ['offerchat:', 'Chat de Offer'], ['chat:', 'Chat con MaKo'],
  ['area:', 'Área'], ['n1:', 'Carpeta'], ['falta:', 'Falta'],
];
export function tipoDeNodo(n: Pick<NodoCerebro<string>, 'id' | 'tipo'>): string {
  if (n.tipo?.trim()) return n.tipo.trim();
  if (TIPO_FIJO[n.id]) return TIPO_FIJO[n.id];
  return TIPO_POR_PREFIJO.find(([p]) => n.id.startsWith(p))?.[1] ?? 'Dato';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/**
 * «12 oct»: cuándo apareció un dato (el `nace` de un nodo), corto. Sale del TEXTO de la fecha (`YYYY-MM-DD…`) y no de
 * `toLocaleDateString`: el grafo se dibuja también en el servidor, y con la zona horaria del servidor un dato de las
 * 23 h caía en otro día que en el navegador (un aviso de hidratación, y una fecha que salta). Sin fecha legible, null.
 */
export function fechaCortaNodo(iso?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''}`.trim() : null;
}

/** Los datos más recientes (por `nace`), para «Lo último»: sin la estructura, sin lo que falta y sin los que no tienen fecha. */
export function ultimosDelCerebro<N extends NodoCerebro<string>>(nodos: readonly N[], cuantos = 5): N[] {
  return nodos
    .filter((n) => !esEstructura(n) && n.autoria !== 'pendiente' && !!fechaCortaNodo(n.nace))
    .sort((a, b) => (b.nace ?? '').localeCompare(a.nace ?? ''))
    .slice(0, cuantos);
}

/** La autoría en una palabra, para la pastilla de la barra lateral (la frase larga es AUTORIA_TEXTO). */
export const AUTORIA_CORTA: Record<NodoCerebro['autoria'], string> = { mako: 'MaKo', usuario: 'Tú', pendiente: 'Falta' };

/**
 * Las conexiones de un nodo AGRUPADAS POR ÁREA, en el orden de AREAS (el del reloj del lienzo), con tope opcional:
 * se muestran las primeras `tope` repartidas en sus grupos y el resto espera a «Ver las N». Un vecino suelto en una
 * lista de 14 no dice de qué parte del negocio es; agrupado se lee «esto toca tu Oferta y tu Funnel». La barra lateral
 * del grafo y la hoja del teléfono agrupan con ÉSTA (tests/second-brain-grafo.test.ts).
 */
export function agruparConexiones<T extends { nodo: { area: string } }>(
  conexiones: readonly T[], tope: number | null = null, tax: Taxonomia = TAXONOMIA_NEGOCIO,
): Array<{ area: T['nodo']['area']; items: T[] }> {
  const orden = new Map<string, number>(tax.areas.map((a, i) => [a.id, i]));
  const ordenadas = [...conexiones].sort((x, y) => (orden.get(x.nodo.area) ?? 99) - (orden.get(y.nodo.area) ?? 99));
  const visibles = tope == null ? ordenadas : ordenadas.slice(0, tope);
  const grupos: Array<{ area: T['nodo']['area']; items: T[] }> = [];
  for (const c of visibles) {
    const g = grupos[grupos.length - 1];
    if (g && g.area === c.nodo.area) g.items.push(c);
    else grupos.push({ area: c.nodo.area, items: [c] });
  }
  return grupos;
}

/**
 * La clave del navegador donde se guardan los ids que esta persona VIO del grafo de este negocio (el nodo que viaja).
 * Lleva una huella del nombre del negocio y el `?ws=` de la pestaña (el super admin mirando a un cliente): dos
 * negocios no se pisan los vistos. Es una comodidad de quien mira (localStorage), nunca un dato del negocio.
 */
export function claveVistos(negocio: string, ws: string | number | null): string {
  let h = 2166136261;
  const t = negocio || 'negocio';
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `mako.sb.vistos.${(h >>> 0).toString(36)}.${ws ?? 'actual'}`;
}

/** Los ids que se guardan como vistos: los DATOS del grafo (sin la estructura ni lo que falta). */
export const idsVistos = (nodos: readonly NodoCerebro<string>[]): string[] =>
  nodos.filter((n) => !esEstructura(n) && n.autoria !== 'pendiente').map((n) => n.id);

/**
 * Lo NUEVO desde la última vez: los datos que no estaban en lo guardado, del más reciente al más viejo (por `nace`),
 * hasta `tope`. `null` = no había nada guardado (la primera vez, o el navegador lo borró): no viaja nada, que es mejor
 * que hacer viajar el grafo entero como si todo fuera nuevo.
 */
export function nuevosDesde<N extends NodoCerebro<string>>(guardado: unknown, nodos: readonly N[], tope = 6): N[] | null {
  if (!Array.isArray(guardado)) return null;
  const vistos = new Set(guardado.filter((x): x is string => typeof x === 'string'));
  return nodos
    .filter((n) => !esEstructura(n) && n.autoria !== 'pendiente' && !vistos.has(n.id))
    .sort((a, b) => (b.nace ?? '').localeCompare(a.nace ?? ''))
    .slice(0, tope);
}
